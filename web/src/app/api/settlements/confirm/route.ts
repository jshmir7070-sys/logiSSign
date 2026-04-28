import { createClient } from '@supabase/supabase-js'
import { NextRequest, NextResponse } from 'next/server'

import { apiError } from '@/lib/api-error'
import { authenticateRequest } from '@/lib/api-auth'
import { calcVAT, calcWithholding } from '@/config/constants'
import { getClientIp } from '@/lib/get-ip'
import { rateLimitAuth } from '@/lib/rate-limit'

const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!,
  { auth: { autoRefreshToken: false, persistSession: false } },
)

interface ConfirmedSettlementRow {
  id: string
  driver_id: string | null
  year_month: string
  net_amount: number
  is_business_owner: boolean
  vat_included: boolean
}

interface TaxInvoiceInsert {
  agency_id: string
  settlement_id: string
  driver_id: string | null
  year_month: string
  supply_amount: number
  tax_amount: number
  total_amount: number
  invoice_type: 'vat_invoice' | 'withholding_3_3'
  status: 'pending' | 'issued'
}

function buildInvoiceForSettlement(
  agencyId: string,
  row: ConfirmedSettlementRow,
): TaxInvoiceInsert {
  if (row.is_business_owner) {
    const supplyAmount = row.vat_included
      ? Math.round(row.net_amount / 1.1)
      : row.net_amount
    const taxAmount = row.vat_included
      ? row.net_amount - supplyAmount
      : calcVAT(row.net_amount)
    return {
      agency_id: agencyId,
      settlement_id: row.id,
      driver_id: row.driver_id,
      year_month: row.year_month,
      supply_amount: supplyAmount,
      tax_amount: taxAmount,
      total_amount: supplyAmount + taxAmount,
      invoice_type: 'vat_invoice',
      status: 'pending',
    }
  }

  const withholdingAmount = calcWithholding(row.net_amount)
  return {
    agency_id: agencyId,
    settlement_id: row.id,
    driver_id: row.driver_id,
    year_month: row.year_month,
    supply_amount: row.net_amount,
    tax_amount: withholdingAmount,
    total_amount: row.net_amount - withholdingAmount,
    invoice_type: 'withholding_3_3',
    status: 'issued',
  }
}

async function rollbackToSent(settlementIds: string[]): Promise<void> {
  if (settlementIds.length === 0) return
  await supabaseAdmin
    .from('settlements')
    .update({ status: 'sent' })
    .in('id', settlementIds)
    .eq('status', 'confirmed')
}

export async function POST(request: NextRequest) {
  const ip = getClientIp(request)
  const limited = await rateLimitAuth(ip, '/api/settlements/confirm')
  if (limited) return limited

  const { auth, error: authError } = await authenticateRequest(request)
  if (authError || !auth) return authError!

  let body: { settlementIds?: unknown }
  try {
    body = await request.json()
  } catch {
    return NextResponse.json({ error: '잘못된 요청 본문입니다.' }, { status: 400 })
  }

  const settlementIds = Array.isArray(body.settlementIds)
    ? (body.settlementIds.filter((id) => typeof id === 'string') as string[])
    : []

  if (settlementIds.length === 0) {
    return NextResponse.json({ error: '확정할 정산서를 선택해 주세요.' }, { status: 400 })
  }

  const agencyId = auth.agencyId
  let confirmedIds: string[] = []

  try {
    // Step 1 — Flip status sent → confirmed (scoped to this agency, only rows still in 'sent')
    const { data: confirmedRows, error: confirmError } = await supabaseAdmin
      .from('settlements')
      .update({ status: 'confirmed' })
      .in('id', settlementIds)
      .eq('agency_id', agencyId)
      .eq('status', 'sent')
      .select('id, driver_id, year_month, net_amount, is_business_owner, vat_included')

    if (confirmError) throw confirmError

    const rows = (confirmedRows ?? []) as ConfirmedSettlementRow[]
    confirmedIds = rows.map((row) => row.id)

    if (rows.length === 0) {
      return NextResponse.json(
        { error: '확정 가능한 정산서가 없습니다. 발송 상태(sent)인지 확인해 주세요.' },
        { status: 400 },
      )
    }

    // Step 2 — Build tax invoice rows from the just-confirmed settlements
    const invoices = rows.map((row) => buildInvoiceForSettlement(agencyId, row))

    // Step 3 — Upsert tax invoices. If this fails, rollback the settlement flip.
    const { error: insertError, count } = await supabaseAdmin
      .from('tax_invoices')
      .upsert(invoices, { onConflict: 'settlement_id', count: 'exact' })

    if (insertError) {
      await rollbackToSent(confirmedIds)
      return apiError(
        `세금계산서 생성에 실패해 정산 확정을 되돌렸습니다: ${insertError.message}`,
        500,
      )
    }

    return NextResponse.json({
      confirmed: confirmedIds.length,
      taxInvoicesCreated: count ?? invoices.length,
    })
  } catch (error) {
    if (confirmedIds.length > 0) {
      await rollbackToSent(confirmedIds)
    }
    console.error('[SettlementConfirm] Unexpected error:', error)
    return apiError('정산 확정 중 오류가 발생했습니다.', 500)
  }
}
