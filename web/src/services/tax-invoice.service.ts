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
  drivers: { name: string; business_reg_number: string | null; representative_name: string | null } | null
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
  yearMonth: string
): Promise<{ data: TaxInvoiceWithDriver[] | null; error: string | null }> {
  const supabase = createBrowserSupabaseClient()
  try {
    const { data, error } = await supabase
      .from('tax_invoices')
      .select('id, settlement_id, driver_id, agency_id, year_month, supply_amount, tax_amount, total_amount, invoice_type, status, issued_at, pdf_url, drivers(name, business_reg_number, representative_name)')
      .eq('agency_id', agencyId)
      .eq('year_month', yearMonth)
      .order('issued_at', { ascending: false, nullsFirst: false })
    if (error) throw error
    return { data: data as unknown as TaxInvoiceWithDriver[], error: null }
  } catch (err) {
    return { data: null, error: err instanceof Error ? err.message : 'Failed' }
  }
}

export async function getTaxInvoiceSummary(
  agencyId: string,
  yearMonth: string
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
      totalSupply: rows.reduce((s, r) => s + (r.supply_amount ?? 0), 0),
      totalTax: rows.reduce((s, r) => s + (r.tax_amount ?? 0), 0),
      totalAmount: rows.reduce((s, r) => s + (r.total_amount ?? 0), 0),
      invoiceCount: rows.length,
      issuedCount: rows.filter((r) => r.status === 'issued').length,
    }
    return { data: summary, error: null }
  } catch (err) {
    return { data: null, error: err instanceof Error ? err.message : 'Failed' }
  }
}
