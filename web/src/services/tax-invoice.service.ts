import type { TaxInvoiceSendChannel } from '@/types/database'
import { createBrowserSupabaseClient } from '@/lib/supabase'

export interface TaxInvoiceWithDriver {
  id: string
  settlement_id: string | null
  driver_id: string | null
  agency_id: string
  year_month: string
  supply_amount: number
  tax_amount: number
  total_amount: number
  invoice_type: string
  status: string
  issued_at: string | null
  pdf_url: string | null
  drivers: {
    name: string
    business_reg_number: string | null
    representative_name: string | null
  } | null
}

export interface TaxInvoiceSendLog {
  id: string
  tax_invoice_id: string
  driver_id: string
  agency_id: string
  channel: TaxInvoiceSendChannel
  success: boolean
  reason: string | null
  sent_by_user_id: string | null
  created_at: string
  drivers: {
    name: string
  } | null
}

export interface TaxInvoiceSummary {
  totalSupply: number
  totalTax: number
  totalAmount: number
  invoiceCount: number
  issuedCount: number
}

export async function getTaxInvoices(
  agencyId: string,
  yearMonth: string,
): Promise<{ data: TaxInvoiceWithDriver[] | null; error: string | null }> {
  const supabase = createBrowserSupabaseClient()

  try {
    const { data, error } = await supabase
      .from('tax_invoices')
      .select(
        'id, settlement_id, driver_id, agency_id, year_month, supply_amount, tax_amount, total_amount, invoice_type, status, issued_at, pdf_url, drivers(name, business_reg_number, representative_name)',
      )
      .eq('agency_id', agencyId)
      .eq('year_month', yearMonth)
      .order('issued_at', { ascending: false, nullsFirst: false })

    if (error) throw error

    return {
      data: (data ?? []) as unknown as TaxInvoiceWithDriver[],
      error: null,
    }
  } catch (error) {
    return {
      data: null,
      error: error instanceof Error ? error.message : '세금계산서 목록을 불러오지 못했습니다.',
    }
  }
}

export async function getTaxInvoiceSummary(
  agencyId: string,
  yearMonth: string,
): Promise<{ data: TaxInvoiceSummary | null; error: string | null }> {
  const supabase = createBrowserSupabaseClient()

  try {
    const { data, error } = await supabase
      .from('tax_invoices')
      .select('supply_amount, tax_amount, total_amount, status')
      .eq('agency_id', agencyId)
      .eq('year_month', yearMonth)

    if (error) throw error

    const rows = data ?? []
    const summary: TaxInvoiceSummary = {
      totalSupply: rows.reduce((sum, row) => sum + (row.supply_amount ?? 0), 0),
      totalTax: rows.reduce((sum, row) => sum + (row.tax_amount ?? 0), 0),
      totalAmount: rows.reduce((sum, row) => sum + (row.total_amount ?? 0), 0),
      invoiceCount: rows.length,
      issuedCount: rows.filter((row) => row.status === 'issued').length,
    }

    return { data: summary, error: null }
  } catch (error) {
    return {
      data: null,
      error: error instanceof Error ? error.message : '세금계산서 요약을 불러오지 못했습니다.',
    }
  }
}

export async function getTaxInvoiceSendLogs(
  agencyId: string,
  invoiceIds: string[],
): Promise<{ data: TaxInvoiceSendLog[] | null; error: string | null }> {
  if (invoiceIds.length === 0) {
    return { data: [], error: null }
  }

  const supabase = createBrowserSupabaseClient()

  try {
    const { data, error } = await supabase
      .from('tax_invoice_send_logs')
      .select(
        'id, tax_invoice_id, driver_id, agency_id, channel, success, reason, sent_by_user_id, created_at, drivers(name)',
      )
      .eq('agency_id', agencyId)
      .in('tax_invoice_id', invoiceIds)
      .order('created_at', { ascending: false })

    if (error) throw error

    return {
      data: (data ?? []) as unknown as TaxInvoiceSendLog[],
      error: null,
    }
  } catch (error) {
    return {
      data: null,
      error: error instanceof Error ? error.message : '세금계산서 전송 이력을 불러오지 못했습니다.',
    }
  }
}
