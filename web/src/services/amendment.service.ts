import { createBrowserSupabaseClient } from '@/lib/supabase'

/* ══════════════════════════════════════════════
   계약 변경 요청 (Contract Amendment) 서비스
   ──────────────────────────────────────────────
   흐름:
   1. 대리점 → 변경 요청 생성 (pending)
   2. 기사에게 푸시 알림
   3. 기사 → 수락(approved) 또는 거부(rejected)
   4. 수락 시 → 변경사항 적용 + 새 계약서 발송 가능
   5. 거부 시 → 변경 불가, 기존 조건 유지
   ══════════════════════════════════════════════ */

export type AmendmentType =
  | 'rate_change'
  | 'insurance_change'
  | 'deduction_change'
  | 'area_change'
  | 'renewal'
  | 'general_change'

export type AmendmentStatus = 'pending' | 'approved' | 'rejected' | 'cancelled' | 'expired'

export interface AmendmentChanges {
  before: Record<string, string>
  after: Record<string, string>
}

export interface ContractAmendment {
  id: string
  agency_id: string
  driver_id: string
  contract_id: string | null
  amendment_type: AmendmentType
  title: string
  description: string | null
  changes: AmendmentChanges
  effective_date: string | null
  status: AmendmentStatus
  requested_by: string | null
  requested_at: string
  responded_at: string | null
  rejection_reason: string | null
  new_contract_id: string | null
  created_at: string
  updated_at: string
  // joined
  driver?: { name: string; phone: string; employee_code: string | null }
}

export const AMENDMENT_TYPE_LABELS: Record<AmendmentType, string> = {
  rate_change: '단가 변경',
  insurance_change: '보험 부담비율 변경',
  deduction_change: '차감항목 변경',
  area_change: '배송구역 변경',
  renewal: '재계약',
  general_change: '기타 변경',
}

export const AMENDMENT_STATUS_LABELS: Record<AmendmentStatus, string> = {
  pending: '확인 대기',
  approved: '수락',
  rejected: '거부',
  cancelled: '취소',
  expired: '기한 초과',
}

export const AMENDMENT_STATUS_COLORS: Record<AmendmentStatus, string> = {
  pending: 'orange',
  approved: 'green',
  rejected: 'red',
  cancelled: 'gray',
  expired: 'gray',
}

/* ── 변경 요청 생성 (대리점) ── */

export interface CreateAmendmentParams {
  agencyId: string
  driverId: string
  contractId?: string
  amendmentType: AmendmentType
  title: string
  description?: string
  changes: AmendmentChanges
  effectiveDate?: string
  requestedBy?: string
}

export async function createAmendment(
  params: CreateAmendmentParams
): Promise<{ data: ContractAmendment | null; error: string | null }> {
  try {
    const supabase = createBrowserSupabaseClient()

    const { data, error } = await supabase
      .from('contract_amendments')
      .insert({
        agency_id: params.agencyId,
        driver_id: params.driverId,
        contract_id: params.contractId ?? null,
        amendment_type: params.amendmentType,
        title: params.title,
        description: params.description ?? null,
        changes: params.changes,
        effective_date: params.effectiveDate ?? null,
        requested_by: params.requestedBy ?? null,
        status: 'pending',
      })
      .select()
      .single()

    if (error) throw error
    return { data: data as ContractAmendment, error: null }
  } catch (err) {
    return { data: null, error: err instanceof Error ? err.message : '변경 요청 생성 실패' }
  }
}

/* ── 여러 기사에게 일괄 변경 요청 ── */

export async function createBulkAmendments(
  params: Omit<CreateAmendmentParams, 'driverId'> & { driverIds: string[] }
): Promise<{ created: number; error: string | null }> {
  try {
    const supabase = createBrowserSupabaseClient()

    const rows = params.driverIds.map((driverId) => ({
      agency_id: params.agencyId,
      driver_id: driverId,
      contract_id: params.contractId ?? null,
      amendment_type: params.amendmentType,
      title: params.title,
      description: params.description ?? null,
      changes: params.changes,
      effective_date: params.effectiveDate ?? null,
      requested_by: params.requestedBy ?? null,
      status: 'pending' as const,
    }))

    const { data, error } = await supabase
      .from('contract_amendments')
      .insert(rows)
      .select('id')

    if (error) throw error
    return { created: data?.length ?? 0, error: null }
  } catch (err) {
    return { created: 0, error: err instanceof Error ? err.message : '일괄 변경 요청 실패' }
  }
}

/* ── 대리점: 변경 요청 목록 조회 ── */

export async function getAmendments(
  agencyId: string,
  filters?: { status?: AmendmentStatus; driverId?: string }
): Promise<{ data: ContractAmendment[] | null; error: string | null }> {
  try {
    const supabase = createBrowserSupabaseClient()

    let query = supabase
      .from('contract_amendments')
      .select('*, driver:drivers(name, phone, employee_code)')
      .eq('agency_id', agencyId)
      .order('created_at', { ascending: false })

    if (filters?.status) {
      query = query.eq('status', filters.status)
    }
    if (filters?.driverId) {
      query = query.eq('driver_id', filters.driverId)
    }

    const { data, error } = await query
    if (error) throw error
    return { data: data as ContractAmendment[], error: null }
  } catch (err) {
    return { data: null, error: err instanceof Error ? err.message : '변경 요청 목록 조회 실패' }
  }
}

/* ── 대리점: 변경 요청 취소 ── */

export async function cancelAmendment(
  amendmentId: string
): Promise<{ error: string | null }> {
  try {
    const supabase = createBrowserSupabaseClient()

    const { error } = await supabase
      .from('contract_amendments')
      .update({ status: 'cancelled', updated_at: new Date().toISOString() })
      .eq('id', amendmentId)
      .eq('status', 'pending')  // pending 상태에서만 취소 가능

    if (error) throw error
    return { error: null }
  } catch (err) {
    return { error: err instanceof Error ? err.message : '취소 실패' }
  }
}

/* ── 기사: 변경 요청 목록 (기사앱용) ── */

export async function getDriverAmendments(
  driverId: string,
  status?: AmendmentStatus
): Promise<{ data: ContractAmendment[] | null; error: string | null }> {
  try {
    const supabase = createBrowserSupabaseClient()

    let query = supabase
      .from('contract_amendments')
      .select('*')
      .eq('driver_id', driverId)
      .order('created_at', { ascending: false })

    if (status) {
      query = query.eq('status', status)
    }

    const { data, error } = await query
    if (error) throw error
    return { data: data as ContractAmendment[], error: null }
  } catch (err) {
    return { data: null, error: err instanceof Error ? err.message : '변경 요청 조회 실패' }
  }
}

/* ── 기사: 변경 요청 수락 ── */

export async function approveAmendment(
  amendmentId: string
): Promise<{ error: string | null }> {
  try {
    const supabase = createBrowserSupabaseClient()

    const { error } = await supabase
      .from('contract_amendments')
      .update({
        status: 'approved',
        responded_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      })
      .eq('id', amendmentId)
      .eq('status', 'pending')  // pending 상태에서만 수락 가능

    if (error) throw error
    return { error: null }
  } catch (err) {
    return { error: err instanceof Error ? err.message : '수락 처리 실패' }
  }
}

/* ── 기사: 변경 요청 거부 ── */

export async function rejectAmendment(
  amendmentId: string,
  reason?: string
): Promise<{ error: string | null }> {
  try {
    const supabase = createBrowserSupabaseClient()

    const { error } = await supabase
      .from('contract_amendments')
      .update({
        status: 'rejected',
        responded_at: new Date().toISOString(),
        rejection_reason: reason ?? null,
        updated_at: new Date().toISOString(),
      })
      .eq('id', amendmentId)
      .eq('status', 'pending')  // pending 상태에서만 거부 가능

    if (error) throw error
    return { error: null }
  } catch (err) {
    return { error: err instanceof Error ? err.message : '거부 처리 실패' }
  }
}

/* ── 기사: 대기 중인 변경 요청 수 ── */

export async function getPendingAmendmentCount(
  driverId: string
): Promise<number> {
  try {
    const supabase = createBrowserSupabaseClient()

    const { count, error } = await supabase
      .from('contract_amendments')
      .select('id', { count: 'exact', head: true })
      .eq('driver_id', driverId)
      .eq('status', 'pending')

    if (error) throw error
    return count ?? 0
  } catch {
    return 0
  }
}
