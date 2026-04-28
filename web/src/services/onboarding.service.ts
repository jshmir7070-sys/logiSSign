import { createBrowserSupabaseClient } from '@/lib/supabase'

export type OnboardingStepKey =
  | 'business_profile'
  | 'seal_or_logo'
  | 'principal'
  | 'driver'
  | 'first_contract'

export interface OnboardingStepStatus {
  key: OnboardingStepKey
  done: boolean
}

export interface OnboardingProgress {
  steps: OnboardingStepStatus[]
  completedCount: number
  totalCount: number
  allDone: boolean
}

const STEP_KEYS: OnboardingStepKey[] = [
  'business_profile',
  'seal_or_logo',
  'principal',
  'driver',
  'first_contract',
]

export async function getOnboardingProgress(agencyId: string): Promise<OnboardingProgress> {
  const supabase = createBrowserSupabaseClient()

  const [agencyRes, sealCountRes, principalCountRes, driverCountRes, contractCountRes] = await Promise.all([
    supabase
      .from('agencies')
      .select('business_number, representative_name, address, logo_url')
      .eq('id', agencyId)
      .maybeSingle(),
    supabase
      .from('seals')
      .select('id', { count: 'exact', head: true })
      .eq('owner_type', 'agency')
      .eq('owner_id', agencyId),
    supabase
      .from('principals')
      .select('id', { count: 'exact', head: true })
      .eq('agency_id', agencyId),
    supabase
      .from('drivers')
      .select('id', { count: 'exact', head: true })
      .eq('agency_id', agencyId)
      .eq('status', 'active'),
    supabase
      .from('contracts')
      .select('id', { count: 'exact', head: true })
      .eq('agency_id', agencyId),
  ])

  const agency = (agencyRes.data ?? {}) as {
    business_number?: string | null
    representative_name?: string | null
    address?: string | null
    logo_url?: string | null
  }

  const businessProfileDone = Boolean(
    agency.business_number?.trim() && agency.representative_name?.trim() && agency.address?.trim(),
  )
  const sealOrLogoDone = Boolean(agency.logo_url?.trim()) || (sealCountRes.count ?? 0) > 0
  const principalDone = (principalCountRes.count ?? 0) > 0
  const driverDone = (driverCountRes.count ?? 0) > 0
  const firstContractDone = (contractCountRes.count ?? 0) > 0

  const stepDoneMap: Record<OnboardingStepKey, boolean> = {
    business_profile: businessProfileDone,
    seal_or_logo: sealOrLogoDone,
    principal: principalDone,
    driver: driverDone,
    first_contract: firstContractDone,
  }

  const steps = STEP_KEYS.map((key) => ({ key, done: stepDoneMap[key] }))
  const completedCount = steps.filter((step) => step.done).length

  return {
    steps,
    completedCount,
    totalCount: STEP_KEYS.length,
    allDone: completedCount === STEP_KEYS.length,
  }
}
