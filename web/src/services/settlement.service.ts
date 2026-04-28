import { createBrowserSupabaseClient } from '@/lib/supabase'

export interface SettlementWithDriver {
  id: string
  driver_id: string | null
  principal_id: string | null
  year_month: string
  delivery_count: number
  delivery_amount: number
  return_count: number
  return_amount: number
  pickup_count: number
  pickup_amount: number
  base_amount: number
  incentive_amount: number
  fresh_incentive: number
  extra_incentive: number
  gross_total: number
  total_amount: number
  total_deduction: number
  vat_amount: number
  net_amount: number
  rate_mode: string
  rate_percentage: number
  is_business_owner: boolean
  vat_included: boolean
  deduction_detail: Record<string, number> | null
  route_details: { route_code: string; delivery_count: number; return_count: number; delivery_rate: number; return_rate: number; amount: number }[] | null
  status: string
  sent_at: string | null
  created_at: string
  drivers: {
    name: string
    employee_code: string | null
    driver_code: string | null
    phone: string | null
  } | null
  principals: { name: string } | null
}

export interface SettlementSummary {
  totalAmount: number
  totalDeduction: number
  netAmount: number
  totalVat: number
  driverCount: number
}

const SETTLEMENT_SELECT = [
  'id', 'driver_id', 'principal_id', 'year_month',
  'delivery_count', 'delivery_amount', 'return_count', 'return_amount',
  'pickup_count', 'pickup_amount',
  'base_amount', 'incentive_amount', 'fresh_incentive', 'extra_incentive',
  'gross_total', 'total_amount', 'total_deduction', 'vat_amount', 'net_amount',
  'rate_mode', 'rate_percentage',
  'is_business_owner', 'vat_included',
  'deduction_detail', 'route_details',
  'status', 'sent_at', 'created_at',
  'drivers(name, employee_code, driver_code, phone)',
  'principals(name)',
].join(', ')

export async function getSettlements(
  agencyId: string,
  yearMonth: string,
  principalId?: string
): Promise<{
  data: SettlementWithDriver[] | null
  error: string | null
}> {
  const supabase = createBrowserSupabaseClient()

  try {
    let query = supabase
      .from('settlements')
      .select(SETTLEMENT_SELECT)
      .eq('agency_id', agencyId)
      .eq('year_month', yearMonth)
      .order('created_at', { ascending: false })

    if (principalId) {
      query = query.eq('principal_id', principalId)
    }

    const { data, error } = await query
    if (error) throw error
    return { data: data as unknown as SettlementWithDriver[], error: null }
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Failed to fetch settlements'
    return { data: null, error: message }
  }
}

export async function getSettlementSummary(
  agencyId: string,
  yearMonth: string,
  principalId?: string
): Promise<{
  data: SettlementSummary | null
  error: string | null
}> {
  const supabase = createBrowserSupabaseClient()

  try {
    let query = supabase
      .from('settlements')
      .select('total_amount, total_deduction, net_amount, vat_amount, driver_id')
      .eq('agency_id', agencyId)
      .eq('year_month', yearMonth)

    if (principalId) {
      query = query.eq('principal_id', principalId)
    }

    const { data, error } = await query
    if (error) throw error

    const rows = (data ?? []) as { total_amount: number; total_deduction: number; net_amount: number; vat_amount: number; driver_id: string | null }[]
    const uniqueDriverIds = new Set(rows.map((r) => r.driver_id).filter(Boolean))

    const summary: SettlementSummary = {
      totalAmount: rows.reduce((sum, r) => sum + (r.total_amount ?? 0), 0),
      totalDeduction: rows.reduce((sum, r) => sum + (r.total_deduction ?? 0), 0),
      netAmount: rows.reduce((sum, r) => sum + (r.net_amount ?? 0), 0),
      totalVat: rows.reduce((sum, r) => sum + (r.vat_amount ?? 0), 0),
      driverCount: uniqueDriverIds.size,
    }

    return { data: summary, error: null }
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Failed to fetch settlement summary'
    return { data: null, error: message }
  }
}

/* ── Settlement Status Updates ── */

export async function sendSettlements(
  settlementIds: string[]
): Promise<{ count: number; error: string | null }> {
  try {
    const res = await fetch('/api/settlements/send', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ settlementIds }),
    })
    const result = await res.json()
    if (!res.ok) {
      return { count: 0, error: result.error || '발송 실패' }
    }
    return { count: result.sent ?? settlementIds.length, error: null }
  } catch (err) {
    return { count: 0, error: err instanceof Error ? err.message : 'Failed to send' }
  }
}

/**
 * 정산서를 확정하고 세금계산서를 같은 트랜잭션 단위로 생성합니다.
 * 세금계산서 생성이 실패하면 정산 상태도 sent로 되돌립니다.
 */
export async function confirmSettlementsWithTaxInvoices(
  settlementIds: string[]
): Promise<{ confirmed: number; taxInvoicesCreated: number; error: string | null }> {
  try {
    const res = await fetch('/api/settlements/confirm', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ settlementIds }),
    })
    const result = await res.json()
    if (!res.ok) {
      return {
        confirmed: 0,
        taxInvoicesCreated: 0,
        error: result.error || '확정 실패',
      }
    }
    return {
      confirmed: result.confirmed ?? 0,
      taxInvoicesCreated: result.taxInvoicesCreated ?? 0,
      error: null,
    }
  } catch (err) {
    return {
      confirmed: 0,
      taxInvoicesCreated: 0,
      error: err instanceof Error ? err.message : 'Failed to confirm',
    }
  }
}
