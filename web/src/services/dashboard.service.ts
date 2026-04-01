import { createBrowserSupabaseClient } from '@/lib/supabase'

export interface DashboardStats {
  totalSettlement: number
  driverCount: number
  unsignedContracts: number
  unpaidInvoices: number
}

export async function getDashboardStats(agencyId: string): Promise<{
  data: DashboardStats | null
  error: string | null
}> {
  const supabase = createBrowserSupabaseClient()

  // Get current year-month in YYYY-MM format
  const now = new Date()
  const yearMonth = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`

  try {
    // Run all queries in parallel
    const [settlementsResult, driversResult, contractsResult, invoicesResult] =
      await Promise.all([
        // Total settlement for current month
        supabase
          .from('settlements')
          .select('total_amount')
          .eq('agency_id', agencyId)
          .eq('year_month', yearMonth),

        // Active driver count
        supabase
          .from('drivers')
          .select('id', { count: 'exact', head: true })
          .eq('agency_id', agencyId)
          .eq('status', 'active'),

        // Unsigned contracts (sent or viewed)
        supabase
          .from('contracts')
          .select('id', { count: 'exact', head: true })
          .eq('agency_id', agencyId)
          .in('status', ['sent', 'viewed']),

        // Unpaid invoices
        supabase
          .from('tax_invoices')
          .select('id', { count: 'exact', head: true })
          .eq('agency_id', agencyId)
          .eq('status', 'pending'),
      ])

    if (settlementsResult.error) throw settlementsResult.error
    if (driversResult.error) throw driversResult.error
    if (contractsResult.error) throw contractsResult.error
    if (invoicesResult.error) throw invoicesResult.error

    const totalSettlement = (settlementsResult.data ?? []).reduce(
      (sum, row) => sum + (row.total_amount ?? 0),
      0
    )

    return {
      data: {
        totalSettlement,
        driverCount: driversResult.count ?? 0,
        unsignedContracts: contractsResult.count ?? 0,
        unpaidInvoices: invoicesResult.count ?? 0,
      },
      error: null,
    }
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Failed to fetch dashboard stats'
    return { data: null, error: message }
  }
}
