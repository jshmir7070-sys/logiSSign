import { createBrowserSupabaseClient } from '@/lib/supabase'
import { calcVAT, calcWithholding } from '@/config/constants'

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
  drivers: { name: string; employee_code: string | null } | null
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
  'drivers(name, employee_code)',
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
  const supabase = createBrowserSupabaseClient()
  try {
    const { error, count } = await supabase
      .from('settlements')
      .update({ status: 'sent', sent_at: new Date().toISOString() } as never)
      .in('id', settlementIds)
      .eq('status', 'draft')
    if (error) throw error
    return { count: count ?? settlementIds.length, error: null }
  } catch (err) {
    return { count: 0, error: err instanceof Error ? err.message : 'Failed to send' }
  }
}

export async function confirmSettlements(
  settlementIds: string[]
): Promise<{ count: number; error: string | null }> {
  const supabase = createBrowserSupabaseClient()
  try {
    const { error, count } = await supabase
      .from('settlements')
      .update({ status: 'confirmed' } as never)
      .in('id', settlementIds)
      .eq('status', 'sent')
    if (error) throw error
    return { count: count ?? settlementIds.length, error: null }
  } catch (err) {
    return { count: 0, error: err instanceof Error ? err.message : 'Failed to confirm' }
  }
}

export async function generateTaxInvoicesFromSettlements(
  agencyId: string,
  settlementIds: string[],
  yearMonth: string
): Promise<{ created: number; error: string | null }> {
  const supabase = createBrowserSupabaseClient()
  try {
    // Fetch confirmed settlements with driver info
    const { data: settlements, error: fetchErr } = await supabase
      .from('settlements')
      .select('id, driver_id, total_amount, net_amount, vat_amount, is_business_owner, vat_included')
      .in('id', settlementIds)
      .eq('status', 'confirmed')
    if (fetchErr) throw fetchErr

    const rows = (settlements ?? []) as {
      id: string; driver_id: string | null;
      total_amount: number; net_amount: number; vat_amount: number;
      is_business_owner: boolean; vat_included: boolean;
    }[]

    const invoices = rows.map((s) => {
      if (s.is_business_owner) {
        // 사업자: tax invoice
        const supplyAmount = s.vat_included
          ? Math.round(s.net_amount / 1.1)
          : s.net_amount
        const taxAmount = s.vat_included
          ? s.net_amount - supplyAmount
          : calcVAT(s.net_amount)
        return {
          agency_id: agencyId,
          settlement_id: s.id,
          driver_id: s.driver_id,
          year_month: yearMonth,
          supply_amount: supplyAmount,
          tax_amount: taxAmount,
          total_amount: supplyAmount + taxAmount,
          invoice_type: 'vat_invoice',
          status: 'pending',
        }
      } else {
        // 비사업자: 원천징수
        const withholdingAmount = calcWithholding(s.net_amount)
        return {
          agency_id: agencyId,
          settlement_id: s.id,
          driver_id: s.driver_id,
          year_month: yearMonth,
          supply_amount: s.net_amount,
          tax_amount: withholdingAmount,
          total_amount: s.net_amount - withholdingAmount,
          invoice_type: 'withholding_3_3',
          status: 'issued',
        }
      }
    })

    if (invoices.length === 0) return { created: 0, error: null }

    const { error: insertErr } = await supabase
      .from('tax_invoices')
      .upsert(invoices as never[], { onConflict: 'settlement_id' })
    if (insertErr) throw insertErr

    return { created: invoices.length, error: null }
  } catch (err) {
    return { created: 0, error: err instanceof Error ? err.message : 'Failed to process invoices' }
  }
}