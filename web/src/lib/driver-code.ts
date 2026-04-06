import type { SupabaseClient } from '@supabase/supabase-js'
import type { Database } from '@/types/database'

const DEFAULT_PREFIX = 'DRV'
const MAX_SEQUENCE = 999999

export function normalizeDriverCodePrefix(source?: string | null): string {
  const cleaned = String(source ?? '')
    .toUpperCase()
    .replace(/[^A-Z0-9]/g, '')

  return `${cleaned}${DEFAULT_PREFIX}`.slice(0, 3).padEnd(3, 'X')
}

export function formatDriverCode(prefix: string, sequence: number): string {
  return `${prefix}-${String(sequence).padStart(6, '0')}`
}

function parseDriverCodeSequence(driverCode: string | null | undefined, prefix: string): number {
  if (!driverCode) return 0

  const match = driverCode.match(/^([A-Z0-9]{3})-(\d{6})$/)
  if (!match || match[1] !== prefix) return 0

  return Number(match[2]) || 0
}

export async function generateUniqueDriverCode(
  supabase: SupabaseClient<Database>,
  agencyId: string,
  prefixSource?: string | null,
): Promise<string> {
  const prefix = normalizeDriverCodePrefix(prefixSource)

  const { data, error } = await supabase
    .from('drivers')
    .select('driver_code')
    .eq('agency_id', agencyId)
    .like('driver_code', `${prefix}-%`)

  if (error) {
    throw new Error(`Failed to load existing driver codes: ${error.message}`)
  }

  const rows = (data ?? []) as { driver_code: string | null }[]

  const maxSequence = rows.reduce((highest, row) => {
    return Math.max(highest, parseDriverCodeSequence(row.driver_code, prefix))
  }, 0)

  const nextSequence = maxSequence + 1
  if (nextSequence > MAX_SEQUENCE) {
    throw new Error('Driver code sequence is exhausted for this agency prefix')
  }

  return formatDriverCode(prefix, nextSequence)
}
