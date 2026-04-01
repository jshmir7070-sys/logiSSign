import { createBrowserSupabaseClient } from '@/lib/supabase'
import type { DeductionType } from '@/types/database'

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

export async function getDriverDeductions(driverId: string): Promise<{ data: DriverDeduction[] | null; error: string | null }> {
  const supabase = createBrowserSupabaseClient()
  try {
    const { data, error } = await supabase
      .from('driver_deductions')
      .select('*')
      .eq('driver_id', driverId)
      .eq('is_active', true)
      .order('created_at')
    if (error) throw error
    return { data: data as DriverDeduction[], error: null }
  } catch (err) {
    return { data: null, error: err instanceof Error ? err.message : 'Failed' }
  }
}

export async function bulkUpsertDriverDeductions(driverId: string, deductions: {
  name: string
  deduction_type: DeductionType
  amount: number
  unit_label?: string
}[]): Promise<{ error: string | null }> {
  if (deductions.length === 0) return { error: null }
  const supabase = createBrowserSupabaseClient()
  try {
    const rows = deductions.map((d) => ({
      driver_id: driverId,
      name: d.name,
      deduction_type: d.deduction_type,
      amount: d.amount,
      unit_label: d.unit_label || '',
    }))
    const { error } = await supabase
      .from('driver_deductions')
      .insert(rows)
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
