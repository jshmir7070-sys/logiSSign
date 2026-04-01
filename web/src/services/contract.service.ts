import { createBrowserSupabaseClient } from '@/lib/supabase'
import type { Database } from '@/types/database'

type ContractRow = Database['public']['Tables']['contracts']['Row']

/* ── Contract Template Types ── */

export interface ContractTemplate {
  id: string
  agency_id: string | null
  principal_id: string | null
  title: string
  content: string
  is_active: boolean
  created_at: string
  principals?: { name: string } | null
}

export interface ContractWithDriver {
  id: string
  template_id: string | null
  driver_id: string | null
  title: string
  status: ContractRow['status']
  sent_at: string | null
  signed_at: string | null
  signed_pdf_url: string | null
  created_at: string
  drivers: { name: string } | null
}

const CONTRACT_SELECT_COLUMNS =
  'id, template_id, driver_id, title, status, sent_at, signed_at, signed_pdf_url, created_at, drivers(name)' as const

export async function getContracts(agencyId: string): Promise<{
  data: ContractWithDriver[] | null
  error: string | null
}> {
  try {
    const res = await fetch(`/api/contracts/list?agencyId=${agencyId}`)
    const result = await res.json()
    return { data: result.data as unknown as ContractWithDriver[], error: result.error }
  } catch (err) {
    return { data: null, error: err instanceof Error ? err.message : 'Failed to fetch contracts' }
  }
}

export async function getContractsByStatus(
  agencyId: string,
  status: ContractRow['status']
): Promise<{
  data: ContractWithDriver[] | null
  error: string | null
}> {
  const supabase = createBrowserSupabaseClient()

  try {
    const { data, error } = await supabase
      .from('contracts')
      .select(CONTRACT_SELECT_COLUMNS)
      .eq('agency_id', agencyId)
      .eq('status', status)
      .order('created_at', { ascending: false })

    if (error) throw error
    return { data: data as unknown as ContractWithDriver[], error: null }
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Failed to fetch contracts by status'
    return { data: null, error: message }
  }
}

/* ══════════════════════════════════════════════
   Contract Templates
   ══════════════════════════════════════════════ */

export async function getContractTemplates(agencyId: string, principalId?: string): Promise<{
  data: ContractTemplate[] | null
  error: string | null
}> {
  const supabase = createBrowserSupabaseClient()
  try {
    let query = supabase
      .from('contract_templates')
      .select('*, principals(name)')
      .or(`agency_id.eq.${agencyId},agency_id.is.null`)
      .eq('is_active', true)
      .order('created_at')

    if (principalId) {
      // 해당 카테고리용 + 전체 카테고리용(principal_id IS NULL) 둘 다 조회
      query = query.or(`principal_id.eq.${principalId},principal_id.is.null`)
    }

    const { data, error } = await query
    if (error) throw error
    return { data: data as ContractTemplate[], error: null }
  } catch (err) {
    return { data: null, error: err instanceof Error ? err.message : 'Failed to fetch templates' }
  }
}

export async function createContractTemplate(data: {
  agency_id: string
  principal_id?: string
  title: string
  content: string
}): Promise<{ data: ContractTemplate | null; error: string | null }> {
  const supabase = createBrowserSupabaseClient()
  try {
    const { data: row, error } = await supabase
      .from('contract_templates')
      .insert(data as never)
      .select('*')
      .single()
    if (error) throw error
    return { data: row as ContractTemplate, error: null }
  } catch (err) {
    return { data: null, error: err instanceof Error ? err.message : 'Failed to create template' }
  }
}

export async function updateContractTemplate(
  id: string,
  data: Partial<Pick<ContractTemplate, 'title' | 'content' | 'is_active'>>
): Promise<{ error: string | null }> {
  const supabase = createBrowserSupabaseClient()
  try {
    const { error } = await supabase.from('contract_templates').update(data as never).eq('id', id)
    if (error) throw error
    return { error: null }
  } catch (err) {
    return { error: err instanceof Error ? err.message : 'Failed to update template' }
  }
}

export async function deleteContractTemplate(id: string): Promise<{ error: string | null }> {
  const supabase = createBrowserSupabaseClient()
  try {
    const { error } = await supabase.from('contract_templates').delete().eq('id', id)
    if (error) throw error
    return { error: null }
  } catch (err) {
    return { error: err instanceof Error ? err.message : 'Failed to delete template' }
  }
}

/* ══════════════════════════════════════════════
   Variable Binding — 계약서 변수 치환
   ══════════════════════════════════════════════ */

export type ContractBindingData = Record<string, string>

/** 사용 가능한 변수 목록 */
export const CONTRACT_VARIABLES = [
  { key: '기사명', description: '기사 이름' },
  { key: '전화번호', description: '기사 전화번호' },
  { key: '주소', description: '기사 주소' },
  { key: '사번', description: '기사 사번/아이디' },
  { key: '카테고리명', description: '거래처(카테고리) 이름' },
  { key: '배송지역', description: '기사 배송 구역' },
  { key: '배송단가', description: '기사별 배송 단가' },
  { key: '반품단가', description: '기사별 반품 단가' },
  { key: '집하단가', description: '기사별 집하 단가' },
  { key: '노선별단가', description: '기사별 노선별 단가 목록' },
  { key: '계약시작일', description: '계약 시작일' },
  { key: '계약종료일', description: '계약 종료일' },
  { key: '계약일', description: '계약 생성일 (오늘)' },
  { key: '대리점명', description: '대리점 이름' },
  { key: '대리점사업자번호', description: '대리점 사업자등록번호' },
  { key: '대리점주소', description: '대리점 주소' },
  { key: '사업자번호', description: '기사 사업자등록번호' },
  { key: '대표자명', description: '기사 사업자 대표자명' },
  { key: '사업장주소', description: '기사 사업장 주소' },
  { key: '부가세구분', description: '부가세 포함/별도' },
  { key: '세금처리', description: '세금 처리 방식' },
  // 차량 임대 관련
  { key: '차종', description: '임대 차량 차종' },
  { key: '연식', description: '임대 차량 연식' },
  { key: '차량번호', description: '임대 차량 등록번호' },
  { key: '차대번호', description: '임대 차량 차대번호' },
  { key: '인도시주행거리', description: '차량 인도 시 주행거리(km)' },
  { key: '월임대료', description: '월 차량 임대료' },
  { key: '보증금', description: '차량 임대 보증금' },
  { key: '보험부담', description: '보험료 부담 주체 (임대인/임차인)' },
  // 사회보험료 관련
  { key: '고용보험_기사부담', description: '고용보험 기사 부담 비율/금액' },
  { key: '고용보험_사업주부담', description: '고용보험 사업주 부담 비율/금액' },
  { key: '산재보험_기사부담', description: '산재보험 기사 부담 비율/금액' },
  { key: '산재보험_사업주부담', description: '산재보험 사업주 부담 비율/금액' },
  // 신규허가 신청서 / 전속운송 계약서 관련
  { key: '택배사업자명', description: '택배서비스사업자 회사명 (갑)' },
  { key: '대리점대표자', description: '대리점 대표자명' },
  { key: '대리점연락처', description: '대리점 연락처' },
  { key: '전속계약기간', description: '전속운송 계약기간 (년)' },
  { key: '경력기간', description: '택배서비스종사 경력기간 (년)' },
  { key: '경력시작', description: '경력 시작일' },
  { key: '경력종료', description: '경력 종료일' },
  { key: '연료종류', description: '차량 연료 종류 (LPG/경유/전기 등)' },
  { key: '차명', description: '차량 이름 (포터, 봉고 등)' },
  { key: '최대적재량', description: '차량 최대적재량 (kg)' },
  { key: '차량형태', description: '차량 형태 (탑형/밴형)' },
  { key: '면허번호', description: '운전면허 번호' },
  { key: '면허종류', description: '운전면허 종류' },
  { key: '자격증번호', description: '화물운송종사 자격증번호' },
  { key: '자격취득일', description: '화물운송종사 자격취득일' },
  { key: '주민등록번호', description: '기사 주민등록번호' },
  { key: '생년월일', description: '기사 생년월일' },
  { key: '관할법원', description: '분쟁 관할 법원명' },
] as const

/** 템플릿 content 내 {{변수명}} 치환 */
export function bindContractVariables(content: string, data: Record<string, string>): string {
  let result = content
  for (const [key, value] of Object.entries(data)) {
    const escapedKey = key.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
    const safeValue = (value || '')
      .replace(/&/g, '&amp;').replace(/</g, '&lt;')
      .replace(/>/g, '&gt;').replace(/"/g, '&quot;')
    result = result.replace(new RegExp(`\\{\\{${escapedKey}\\}\\}`, 'g'), safeValue)
  }
  return result
}

/** SHA-256 해시 생성 (브라우저용) */
async function _sha256(text: string): Promise<string> {
  const encoder = new TextEncoder()
  const data = encoder.encode(text)
  const hashBuffer = await crypto.subtle.digest('SHA-256', data)
  const hashArray = Array.from(new Uint8Array(hashBuffer))
  return hashArray.map((b) => b.toString(16).padStart(2, '0')).join('')
}

/* ══════════════════════════════════════════════
   Contract Creation + Auto-Send
   ══════════════════════════════════════════════ */

export async function createAndSendContracts(
  agencyId: string,
  driverId: string,
  templateIds: string[],
  bindingData: Record<string, string>
): Promise<{ created: number; error: string | null }> {
  if (templateIds.length === 0) return { created: 0, error: null }

  try {
    // Server API route로 호출 (Service Role Key로 RLS 우회)
    const response = await fetch('/api/contracts/send', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        agencyId,
        driverId,
        templateIds,
        bindingData,
      }),
    })

    const result = await response.json()
    if (!response.ok) {
      return { created: 0, error: result.error || 'Failed to send contracts' }
    }

    return { created: result.created ?? 0, error: null }
  } catch (err) {
    return { created: 0, error: err instanceof Error ? err.message : 'Failed to create contracts' }
  }
}

/* ── Driver Contract List (for mobile app) ── */

export async function getDriverContracts(driverId: string): Promise<{
  data: ContractWithDriver[] | null
  error: string | null
}> {
  const supabase = createBrowserSupabaseClient()
  try {
    const { data, error } = await supabase
      .from('contracts')
      .select('id, template_id, driver_id, title, status, sent_at, signed_at, signed_pdf_url, created_at')
      .eq('driver_id', driverId)
      .order('created_at', { ascending: false })
    if (error) throw error
    const rows = (data ?? []) as { id: string; template_id: string | null; driver_id: string | null; title: string; status: string; sent_at: string | null; signed_at: string | null; signed_pdf_url: string | null; created_at: string }[]
    return { data: rows.map((c) => ({ ...c, drivers: null })) as ContractWithDriver[], error: null }
  } catch (err) {
    return { data: null, error: err instanceof Error ? err.message : 'Failed to fetch driver contracts' }
  }
}