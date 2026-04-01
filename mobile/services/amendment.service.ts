import { supabase } from '../lib/supabase';

export type AmendmentStatus = 'pending' | 'approved' | 'rejected' | 'cancelled' | 'expired';
export type AmendmentType =
  | 'rate_change'
  | 'insurance_change'
  | 'deduction_change'
  | 'area_change'
  | 'renewal'
  | 'general_change';

export interface AmendmentChanges {
  before: Record<string, string>;
  after: Record<string, string>;
}

export interface ContractAmendment {
  id: string;
  agency_id: string;
  driver_id: string;
  contract_id: string | null;
  amendment_type: AmendmentType;
  title: string;
  description: string | null;
  changes: AmendmentChanges | Record<string, unknown>;
  effective_date: string | null;
  status: AmendmentStatus;
  requested_by: string | null;
  requested_at: string | null;
  responded_at: string | null;
  rejection_reason: string | null;
  created_at: string;
}

export const AMENDMENT_TYPE_LABELS: Record<AmendmentType, string> = {
  rate_change: '단가 변경',
  insurance_change: '보험 부담비율 변경',
  deduction_change: '차감항목 변경',
  area_change: '배송구역 변경',
  renewal: '재계약',
  general_change: '기타 변경',
};

export const AMENDMENT_STATUS_LABELS: Record<AmendmentStatus, string> = {
  pending: '확인 대기',
  approved: '수락됨',
  rejected: '거부됨',
  cancelled: '취소됨',
  expired: '기한 초과',
};

/** 기사의 변경 요청 목록 조회 */
export async function getDriverAmendments(
  driverId: string,
  status?: AmendmentStatus
): Promise<{ data: ContractAmendment[] | null; error: string | null }> {
  try {
    let query = supabase
      .from('contract_amendments')
      .select('*')
      .eq('driver_id', driverId)
      .order('created_at', { ascending: false });

    if (status) {
      query = query.eq('status', status);
    }

    const { data, error } = await query;
    if (error) throw error;
    return { data: data as ContractAmendment[], error: null };
  } catch (err) {
    return { data: null, error: err instanceof Error ? err.message : '변경 요청 조회 실패' };
  }
}

/** 대기 중인 변경 요청 수 */
export async function getPendingAmendmentCount(driverId: string): Promise<number> {
  try {
    const { count, error } = await supabase
      .from('contract_amendments')
      .select('id', { count: 'exact', head: true })
      .eq('driver_id', driverId)
      .eq('status', 'pending');
    if (error) throw error;
    return count ?? 0;
  } catch {
    return 0;
  }
}

/** 변경 요청 수락 */
export async function approveAmendment(
  amendmentId: string
): Promise<{ error: string | null }> {
  try {
    const { error } = await supabase
      .from('contract_amendments')
      .update({
        status: 'approved',
        responded_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      })
      .eq('id', amendmentId)
      .eq('status', 'pending');
    if (error) throw error;
    return { error: null };
  } catch (err) {
    return { error: err instanceof Error ? err.message : '수락 처리 실패' };
  }
}

/** 변경 요청 거부 */
export async function rejectAmendment(
  amendmentId: string,
  reason?: string
): Promise<{ error: string | null }> {
  try {
    const { error } = await supabase
      .from('contract_amendments')
      .update({
        status: 'rejected',
        responded_at: new Date().toISOString(),
        rejection_reason: reason ?? null,
        updated_at: new Date().toISOString(),
      })
      .eq('id', amendmentId)
      .eq('status', 'pending');
    if (error) throw error;
    return { error: null };
  } catch (err) {
    return { error: err instanceof Error ? err.message : '거부 처리 실패' };
  }
}
