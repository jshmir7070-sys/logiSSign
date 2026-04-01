import { createBrowserSupabaseClient } from '@/lib/supabase'
import { todayKST } from '@/lib/date-kst'

/* ══════════════════════════════════════════════
   기사별 계약 기간 / 정산 적용 기간 서비스
   ──────────────────────────────────────────────
   흐름:
   1. 기사 등록 시 → 최초 계약 기간 생성 (active)
   2. 재계약 수락 시 → 새 기간 생성 (upcoming), 기존 기간은 만료일에 expired
   3. 정산 계산 시 → 해당 월의 active 기간의 rate_config 사용
   4. 만료 60일 전 → 자동 알림
   ══════════════════════════════════════════════ */




export type PeriodStatus = 'active' | 'upcoming' | 'expired' | 'cancelled'

export interface RateConfig {
  delivery_unit_price?: number
  return_unit_price?: number
  pickup_unit_price?: number
  delivery_rate_mode?: string        // unit_price, percentage, fixed_salary, etc.
  return_rate_mode?: string
  pickup_rate_mode?: string
  route_rates?: { route_code: string; delivery_rate: number; return_rate: number }[]
  insurance?: {
    employment_driver: string        // "50%" or "0%"
    employment_employer: string      // "50%" or "100%"
    industrial_driver: string
    industrial_employer: string
  }
  deductions?: Record<string, number | string>
  [key: string]: unknown
}

export interface DriverContractPeriod {
  id: string
  agency_id: string
  driver_id: string
  principal_id: string | null
  period_start: string             // DATE (YYYY-MM-DD)
  period_end: string               // DATE (YYYY-MM-DD)
  rate_config: RateConfig
  status: PeriodStatus
  contract_id: string | null
  amendment_id: string | null
  memo: string | null
  created_at: string
  updated_at: string
}

export const PERIOD_STATUS_LABELS: Record<PeriodStatus, string> = {
  active: '적용 중',
  upcoming: '예정',
  expired: '만료',
  cancelled: '취소',
}

/* ── 최초 계약 기간 생성 (기사 등록 시) ── */

export interface CreatePeriodParams {
  agencyId: string
  driverId: string
  principalId?: string
  periodStart: string      // YYYY-MM-DD
  periodEnd: string        // YYYY-MM-DD
  rateConfig: RateConfig
  contractId?: string
  memo?: string
}

export async function createContractPeriod(
  params: CreatePeriodParams
): Promise<{ data: DriverContractPeriod | null; error: string | null }> {
  try {
    const supabase = createBrowserSupabaseClient()

    const { data, error } = await supabase
      .from('driver_contract_periods')
      .insert({
        agency_id: params.agencyId,
        driver_id: params.driverId,
        principal_id: params.principalId ?? null,
        period_start: params.periodStart,
        period_end: params.periodEnd,
        rate_config: params.rateConfig,
        status: 'active',
        contract_id: params.contractId ?? null,
        memo: params.memo ?? null,
      })
      .select()
      .single()

    if (error) throw error
    return { data: data as DriverContractPeriod, error: null }
  } catch (err) {
    return { data: null, error: err instanceof Error ? err.message : '계약 기간 생성 실패' }
  }
}

/* ── 재계약 기간 생성 (amendment 수락 시) ── */

export async function createRenewalPeriod(
  params: CreatePeriodParams & { amendmentId: string }
): Promise<{ data: DriverContractPeriod | null; error: string | null }> {
  try {
    const supabase = createBrowserSupabaseClient()

    // 1. 새 기간 생성 (upcoming 또는 active)
    const today = todayKST()
    const isAlreadyStarted = params.periodStart <= today
    const newStatus: PeriodStatus = isAlreadyStarted ? 'active' : 'upcoming'

    const { data, error } = await supabase
      .from('driver_contract_periods')
      .insert({
        agency_id: params.agencyId,
        driver_id: params.driverId,
        principal_id: params.principalId ?? null,
        period_start: params.periodStart,
        period_end: params.periodEnd,
        rate_config: params.rateConfig,
        status: newStatus,
        contract_id: params.contractId ?? null,
        amendment_id: params.amendmentId,
        memo: params.memo ?? '재계약',
      })
      .select()
      .single()

    if (error) throw error

    // 2. 기존 active 기간의 종료일을 새 기간 시작일 -1일로 조정 (겹침 방지)
    if (isAlreadyStarted) {
      const prevEnd = new Date(params.periodStart + 'T00:00:00Z')
      prevEnd.setUTCDate(prevEnd.getUTCDate() - 1)
      await supabase
        .from('driver_contract_periods')
        .update({
          period_end: prevEnd.toISOString().slice(0, 10),
          status: 'expired',
          updated_at: new Date().toISOString(),
        })
        .eq('driver_id', params.driverId)
        .eq('status', 'active')
        .neq('id', (data as { id: string }).id)
    }

    return { data: data as DriverContractPeriod, error: null }
  } catch (err) {
    return { data: null, error: err instanceof Error ? err.message : '재계약 기간 생성 실패' }
  }
}

/* ── 기사의 계약 기간 목록 ── */

export async function getDriverPeriods(
  driverId: string
): Promise<{ data: DriverContractPeriod[] | null; error: string | null }> {
  try {
    const supabase = createBrowserSupabaseClient()

    const { data, error } = await supabase
      .from('driver_contract_periods')
      .select('*')
      .eq('driver_id', driverId)
      .order('period_start', { ascending: false })

    if (error) throw error
    return { data: data as DriverContractPeriod[], error: null }
  } catch (err) {
    return { data: null, error: err instanceof Error ? err.message : '계약 기간 조회 실패' }
  }
}

/* ── 현재 적용 중인 기간 조회 ── */

export async function getActivePeriod(
  driverId: string
): Promise<{ data: DriverContractPeriod | null; error: string | null }> {
  try {
    const supabase = createBrowserSupabaseClient()

    const { data, error } = await supabase
      .from('driver_contract_periods')
      .select('*')
      .eq('driver_id', driverId)
      .eq('status', 'active')
      .order('period_start', { ascending: false })
      .limit(1)
      .maybeSingle()

    if (error) throw error
    return { data: data as DriverContractPeriod | null, error: null }
  } catch (err) {
    return { data: null, error: err instanceof Error ? err.message : '현재 기간 조회 실패' }
  }
}

/* ── 만료 예정 기간 조회 (자동 알림용) ── */

export async function getExpiringPeriods(
  agencyId: string,
  daysBeforeExpiry: number = 60
): Promise<{ data: (DriverContractPeriod & { driver_name?: string })[] | null; error: string | null }> {
  try {
    const supabase = createBrowserSupabaseClient()

    const targetDate = new Date()
    targetDate.setDate(targetDate.getDate() + daysBeforeExpiry)
    const targetStr = targetDate.toISOString().slice(0, 10)

    const today = todayKST()

    const { data, error } = await supabase
      .from('driver_contract_periods')
      .select('*, driver:drivers(name, phone)')
      .eq('agency_id', agencyId)
      .eq('status', 'active')
      .lte('period_end', targetStr)
      .gte('period_end', today)
      .order('period_end', { ascending: true })

    if (error) throw error
    return { data: data as DriverContractPeriod[], error: null }
  } catch (err) {
    return { data: null, error: err instanceof Error ? err.message : '만료 예정 조회 실패' }
  }
}

/* ── upcoming → active 전환 (배치/스케줄용) ── */

export async function activateUpcomingPeriods(): Promise<{ activated: number; error: string | null }> {
  try {
    const supabase = createBrowserSupabaseClient()
    const today = todayKST()

    // 1. 시작일이 오늘 이하인 upcoming 기간 → active로 전환
    const { data: upcoming, error: fetchErr } = await supabase
      .from('driver_contract_periods')
      .select('id, driver_id')
      .eq('status', 'upcoming')
      .lte('period_start', today)

    if (fetchErr) throw fetchErr
    if (!upcoming?.length) return { activated: 0, error: null }

    const ids = (upcoming as { id: string; driver_id: string }[]).map((p) => p.id)
    const driverIds = Array.from(new Set((upcoming as { id: string; driver_id: string }[]).map((p) => p.driver_id)))

    // 2. 해당 기사들의 기존 active 기간 → expired
    await supabase
      .from('driver_contract_periods')
      .update({ status: 'expired', updated_at: new Date().toISOString() })
      .in('driver_id', driverIds)
      .eq('status', 'active')

    // 3. upcoming → active
    const { error: updateErr } = await supabase
      .from('driver_contract_periods')
      .update({ status: 'active', updated_at: new Date().toISOString() })
      .in('id', ids)

    if (updateErr) throw updateErr
    return { activated: ids.length, error: null }
  } catch (err) {
    return { activated: 0, error: err instanceof Error ? err.message : '기간 전환 실패' }
  }
}
