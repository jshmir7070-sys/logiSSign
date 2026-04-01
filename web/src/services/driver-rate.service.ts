import { createBrowserSupabaseClient } from '@/lib/supabase'
import type { PackageType, RateType, DeductionType } from '@/types/database'

/* ── Types ── */

export interface DriverRate {
  id: string
  driver_id: string | null
  principal_id: string | null
  package_type: PackageType
  unit_price: number
  rate_type: RateType
  is_active: boolean
  created_at: string
}

export interface DriverDeduction {
  id: string
  driver_id: string | null
  principal_id: string | null
  name: string
  deduction_type: DeductionType
  amount: number
  unit_label: string
  is_active: boolean
  created_at: string
}

export interface DriverIncentive {
  id: string
  driver_id: string | null
  principal_id: string | null
  min_count: number
  max_count: number | null
  bonus_per_unit: number
}

/* ── Rates ── */

export async function getDriverRates(driverId: string): Promise<{ data: DriverRate[] | null; error: string | null }> {
  const supabase = createBrowserSupabaseClient()
  try {
    const { data, error } = await supabase.from('driver_rates').select('*').eq('driver_id', driverId).order('created_at')
    if (error) throw error
    return { data: data as DriverRate[], error: null }
  } catch (err) {
    return { data: null, error: err instanceof Error ? err.message : 'Failed' }
  }
}

export async function createDriverRate(data: {
  driver_id: string
  package_type: PackageType
  unit_price: number
  rate_type: RateType
}): Promise<{ error: string | null }> {
  const supabase = createBrowserSupabaseClient()
  try {
    const { error } = await supabase.from('driver_rates').insert(data)
    if (error) throw error
    return { error: null }
  } catch (err) {
    return { error: err instanceof Error ? err.message : 'Failed' }
  }
}

export async function deleteDriverRate(id: string): Promise<{ error: string | null }> {
  const supabase = createBrowserSupabaseClient()
  try {
    const { error } = await supabase.from('driver_rates').delete().eq('id', id)
    if (error) throw error
    return { error: null }
  } catch (err) {
    return { error: err instanceof Error ? err.message : 'Failed' }
  }
}

/* ── Deductions ── */

export async function getDriverDeductions(driverId: string): Promise<{ data: DriverDeduction[] | null; error: string | null }> {
  const supabase = createBrowserSupabaseClient()
  try {
    const { data, error } = await supabase.from('driver_deductions').select('*').eq('driver_id', driverId).order('created_at')
    if (error) throw error
    return { data: data as DriverDeduction[], error: null }
  } catch (err) {
    return { data: null, error: err instanceof Error ? err.message : 'Failed' }
  }
}

export async function createDriverDeduction(data: {
  driver_id: string
  name: string
  deduction_type: DeductionType
  amount: number
  unit_label?: string
}): Promise<{ error: string | null }> {
  const supabase = createBrowserSupabaseClient()
  try {
    const { error } = await supabase.from('driver_deductions').insert(data)
    if (error) throw error
    return { error: null }
  } catch (err) {
    return { error: err instanceof Error ? err.message : 'Failed' }
  }
}

export async function deleteDriverDeduction(id: string): Promise<{ error: string | null }> {
  const supabase = createBrowserSupabaseClient()
  try {
    const { error } = await supabase.from('driver_deductions').delete().eq('id', id)
    if (error) throw error
    return { error: null }
  } catch (err) {
    return { error: err instanceof Error ? err.message : 'Failed' }
  }
}

/* ── Incentives ── */

export async function getDriverIncentives(driverId: string): Promise<{ data: DriverIncentive[] | null; error: string | null }> {
  const supabase = createBrowserSupabaseClient()
  try {
    const { data, error } = await supabase.from('driver_incentives').select('*').eq('driver_id', driverId).order('created_at')
    if (error) throw error
    return { data: data as DriverIncentive[], error: null }
  } catch (err) {
    return { data: null, error: err instanceof Error ? err.message : 'Failed' }
  }
}

export async function createDriverIncentive(data: {
  driver_id: string
  min_count: number
  max_count: number | null
  bonus_per_unit: number
}): Promise<{ error: string | null }> {
  const supabase = createBrowserSupabaseClient()
  try {
    const { error } = await supabase.from('driver_incentives').insert(data)
    if (error) throw error
    return { error: null }
  } catch (err) {
    return { error: err instanceof Error ? err.message : 'Failed' }
  }
}

export async function deleteDriverIncentive(id: string): Promise<{ error: string | null }> {
  const supabase = createBrowserSupabaseClient()
  try {
    const { error } = await supabase.from('driver_incentives').delete().eq('id', id)
    if (error) throw error
    return { error: null }
  } catch (err) {
    return { error: err instanceof Error ? err.message : 'Failed' }
  }
}

/* ── Bulk create (기사 등록 시 일괄 저장) ── */

export async function bulkCreateDriverRates(driverId: string, rates: {
  package_type: PackageType
  unit_price: number
  rate_type: RateType
}[]): Promise<{ error: string | null }> {
  if (rates.length === 0) return { error: null }
  const supabase = createBrowserSupabaseClient()
  try {
    const { error } = await supabase.from('driver_rates').insert(
      rates.map((r) => ({ driver_id: driverId, ...r }))
    )
    if (error) throw error
    return { error: null }
  } catch (err) {
    return { error: err instanceof Error ? err.message : 'Failed' }
  }
}

export async function bulkCreateDriverDeductions(driverId: string, deductions: {
  name: string
  deduction_type: DeductionType
  amount: number
  unit_label?: string
}[]): Promise<{ error: string | null }> {
  if (deductions.length === 0) return { error: null }
  const supabase = createBrowserSupabaseClient()
  try {
    const { error } = await supabase.from('driver_deductions').insert(
      deductions.map((d) => ({ driver_id: driverId, ...d }))
    )
    if (error) throw error
    return { error: null }
  } catch (err) {
    return { error: err instanceof Error ? err.message : 'Failed' }
  }
}
