import { createBrowserSupabaseClient } from '@/lib/supabase'

export interface DriverRouteRate {
  id: string
  driver_id: string | null
  principal_id: string | null
  route_code: string
  route_name: string | null
  unit_price: number
  delivery_rate: number | null
  return_rate: number
  is_active: boolean
  created_at: string
}

export interface DriverBusinessSettings {
  is_business_owner: boolean
  vat_included: boolean
  fresh_incentive_pct: number
  extra_incentive_pct: number
  tax_type?: string
}

/* ── Route Rates CRUD ── */

export async function getDriverRouteRates(driverId: string): Promise<{ data: DriverRouteRate[] | null; error: string | null }> {
  const supabase = createBrowserSupabaseClient()
  try {
    const { data, error } = await supabase
      .from('driver_route_rates')
      .select('*')
      .eq('driver_id', driverId)
      .eq('is_active', true)
      .order('route_code')
    if (error) throw error
    return { data: data as DriverRouteRate[], error: null }
  } catch (err) {
    return { data: null, error: err instanceof Error ? err.message : 'Failed' }
  }
}

export async function upsertDriverRouteRate(data: {
  driver_id: string
  route_code: string
  delivery_rate?: number
  return_rate?: number
  unit_price?: number
}): Promise<{ error: string | null }> {
  const supabase = createBrowserSupabaseClient()
  try {
    const row = {
      ...data,
      unit_price: data.unit_price ?? data.delivery_rate ?? 0,
    }
    const { error } = await supabase
      .from('driver_route_rates')
      .upsert(row as never, { onConflict: 'driver_id,route_code' })
    if (error) throw error
    return { error: null }
  } catch (err) {
    return { error: err instanceof Error ? err.message : 'Failed' }
  }
}

export async function deleteDriverRouteRate(id: string): Promise<{ error: string | null }> {
  const supabase = createBrowserSupabaseClient()
  try {
    const { error } = await supabase.from('driver_route_rates').delete().eq('id', id)
    if (error) throw error
    return { error: null }
  } catch (err) {
    return { error: err instanceof Error ? err.message : 'Failed' }
  }
}

export async function bulkUpsertDriverRouteRates(driverId: string, rates: {
  route_code: string
  delivery_rate?: number
  return_rate?: number
  unit_price?: number
}[]): Promise<{ error: string | null }> {
  if (rates.length === 0) return { error: null }
  const supabase = createBrowserSupabaseClient()
  try {
    const rows = rates.map((r) => ({
      driver_id: driverId,
      ...r,
      unit_price: r.unit_price ?? r.delivery_rate ?? 0,
    }))
    const { error } = await supabase
      .from('driver_route_rates')
      .upsert(rows as never[], { onConflict: 'driver_id,route_code' })
    if (error) throw error
    return { error: null }
  } catch (err) {
    return { error: err instanceof Error ? err.message : 'Failed' }
  }
}

/* ── Business Settings ── */

export async function updateDriverBusinessSettings(
  driverId: string,
  settings: DriverBusinessSettings
): Promise<{ error: string | null }> {
  const supabase = createBrowserSupabaseClient()
  try {
    const { error } = await supabase
      .from('drivers')
      .update(settings as never)
      .eq('id', driverId)
    if (error) throw error
    return { error: null }
  } catch (err) {
    return { error: err instanceof Error ? err.message : 'Failed' }
  }
}

export async function getDriverBusinessSettings(driverId: string): Promise<{ data: DriverBusinessSettings | null; error: string | null }> {
  const supabase = createBrowserSupabaseClient()
  try {
    const { data, error } = await supabase
      .from('drivers')
      .select('is_business_owner, vat_included, fresh_incentive_pct, extra_incentive_pct, tax_type')
      .eq('id', driverId)
      .single()
    if (error) throw error
    return { data: data as DriverBusinessSettings, error: null }
  } catch (err) {
    return { data: null, error: err instanceof Error ? err.message : 'Failed' }
  }
}
