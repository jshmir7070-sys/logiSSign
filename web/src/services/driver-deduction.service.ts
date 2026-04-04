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
  try {
    const res = await fetch('/api/drivers/update', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ driverId, deductions: deductions.map(d => ({
        name: d.name,
        deduction_type: d.deduction_type,
        amount: d.amount,
      })) }),
    })
    if (!res.ok) {
      const data = await res.json().catch(() => ({}))
      return { error: data.error || 'Failed' }
    }
    return { error: null }
  } catch (err) {
    return { error: err instanceof Error ? err.message : 'Failed' }
  }
}

export async function deleteDriverDeduction(id: string): Promise<{ error: string | null }> {
  try {
    const res = await fetch('/api/drivers/delete-item', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ table: 'driver_deductions', id }),
    })
    if (!res.ok) {
      const data = await res.json().catch(() => ({}))
      return { error: data.error || 'Failed' }
    }
    return { error: null }
  } catch (err) {
    return { error: err instanceof Error ? err.message : 'Failed' }
  }
}
