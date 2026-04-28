import { createClient } from '@supabase/supabase-js'
import { NextRequest, NextResponse } from 'next/server'

import { apiError } from '@/lib/api-error'
import { authenticateRequest } from '@/lib/api-auth'
import { getClientIp } from '@/lib/get-ip'
import { rateLimitAuth } from '@/lib/rate-limit'

const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!,
  { auth: { autoRefreshToken: false, persistSession: false } },
)

interface ConfirmRpcRow {
  confirmed_count: number
  tax_invoices_count: number
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

  try {
    // 단일 Postgres 함수 호출 — UPDATE settlements + UPSERT tax_invoices를
    // 한 트랜잭션 안에서 처리하므로 어느 쪽이 실패해도 자동 롤백.
    const { data, error } = await supabaseAdmin.rpc('confirm_settlements_with_tax_invoices', {
      p_agency_id: agencyId,
      p_settlement_ids: settlementIds,
    })

    if (error) {
      console.error('[SettlementConfirm] RPC error:', error)
      return apiError(`정산 확정에 실패했습니다: ${error.message}`, 500)
    }

    const row = Array.isArray(data) ? (data[0] as ConfirmRpcRow | undefined) : undefined
    const confirmedCount = row?.confirmed_count ?? 0
    const taxInvoicesCount = row?.tax_invoices_count ?? 0

    if (confirmedCount === 0) {
      return NextResponse.json(
        { error: '확정 가능한 정산서가 없습니다. 발송 상태(sent)인지 확인해 주세요.' },
        { status: 400 },
      )
    }

    return NextResponse.json({
      confirmed: confirmedCount,
      taxInvoicesCreated: taxInvoicesCount,
    })
  } catch (error) {
    console.error('[SettlementConfirm] Unexpected error:', error)
    return apiError('정산 확정 중 오류가 발생했습니다.', 500)
  }
}
