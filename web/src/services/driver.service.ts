import { createBrowserSupabaseClient } from '@/lib/supabase'
import { generateUniqueDriverCode } from '@/lib/driver-code'
import type { Database } from '@/types/database'

type DriverRow = Database['public']['Tables']['drivers']['Row']
type DriverInsert = Database['public']['Tables']['drivers']['Insert']
type DriverUpdate = Database['public']['Tables']['drivers']['Update']

/* ══════════════════════ Types ══════════════════════ */

export interface DriverListItem {
  id: string
  name: string
  phone: string | null
  status: string
  delivery_area: string | null
  employee_code: string | null
  driver_code: string | null
  created_at: string | null
  // 소속 원청사들 (driver_principals 조인)
  principal_names: string[]
}

export interface DriverPrincipalLink {
  id: string
  driver_id: string
  principal_id: string
  status: string
  joined_at: string
  principal_name?: string
}

/* ══════════════════════ 기사 목록 조회 ══════════════════════ */

/**
 * 기사 목록 조회 — 원청사별 필터 지원
 * @param principalId  null이면 전체, 값이면 해당 원청사 기사만
 */
export async function getDrivers(agencyId: string, principalId?: string | null): Promise<{
  data: DriverListItem[] | null
  error: string | null
}> {
  const supabase = createBrowserSupabaseClient()

  try {
    if (principalId) {
      // 원청사 필터: driver_principals 중간 테이블 통해 조회
      const { data: links, error: linkErr } = await supabase
        .from('driver_principals')
        .select('driver_id')
        .eq('principal_id', principalId)

      if (linkErr) throw linkErr
      const driverIds = (links ?? []).map(l => l.driver_id)

      if (driverIds.length === 0) return { data: [], error: null }

      const { data, error } = await supabase
        .from('drivers')
        .select('id, name, phone, status, delivery_area, employee_code, driver_code, created_at')
        .eq('agency_id', agencyId)
        .in('id', driverIds)
        .order('created_at', { ascending: false })

      if (error) throw error

      // 각 기사의 원청사 목록
      const items = await attachPrincipalNames(supabase, data ?? [])
      return { data: items, error: null }
    } else {
      // 전체 기사
      const { data, error } = await supabase
        .from('drivers')
        .select('id, name, phone, status, delivery_area, employee_code, driver_code, created_at')
        .eq('agency_id', agencyId)
        .order('created_at', { ascending: false })

      if (error) throw error

      const items = await attachPrincipalNames(supabase, data ?? [])
      return { data: items, error: null }
    }
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Failed to fetch drivers'
    return { data: null, error: message }
  }
}

/** 기사 배열에 소속 원청사명 배열을 붙여줌 */
async function attachPrincipalNames(
  supabase: ReturnType<typeof createBrowserSupabaseClient>,
  drivers: { id: string; name: string; phone: string | null; status: string; delivery_area: string | null; employee_code: string | null; driver_code: string | null; created_at: string | null }[],
): Promise<DriverListItem[]> {
  if (drivers.length === 0) return []

  const driverIds = drivers.map(d => d.id)

  // driver_principals + principals 조인으로 원청사명 가져오기
  const { data: links } = await supabase
    .from('driver_principals')
    .select('driver_id, principals(name)')
    .in('driver_id', driverIds)
    .eq('status', 'active')

  const nameMap = new Map<string, string[]>()
  for (const link of (links ?? []) as unknown as { driver_id: string; principals: { name: string } | null }[]) {
    const names = nameMap.get(link.driver_id) ?? []
    if (link.principals?.name) names.push(link.principals.name)
    nameMap.set(link.driver_id, names)
  }

  return drivers.map(d => ({
    ...d,
    principal_names: nameMap.get(d.id) ?? [],
  }))
}

/* ══════════════════════ 기사 수 ══════════════════════ */

export async function getDriverCount(agencyId: string, principalId?: string | null): Promise<{
  data: number | null
  error: string | null
}> {
  const supabase = createBrowserSupabaseClient()

  try {
    if (principalId) {
      const { count, error } = await supabase
        .from('driver_principals')
        .select('id', { count: 'exact', head: true })
        .eq('principal_id', principalId)
        .eq('status', 'active')

      if (error) throw error
      return { data: count ?? 0, error: null }
    }

    const { count, error } = await supabase
      .from('drivers')
      .select('id', { count: 'exact', head: true })
      .eq('agency_id', agencyId)
      .eq('status', 'active')

    if (error) throw error
    return { data: count ?? 0, error: null }
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Failed to fetch driver count'
    return { data: null, error: message }
  }
}

/* ══════════════════════ 기사 생성 ══════════════════════ */

/**
 * 기사 생성 + 원청사 연결
 * @param principalIds 소속 원청사 ID 배열 (최소 1개)
 */
export async function createDriver(data: {
  agency_id: string
  name: string
  phone: string
  employee_code?: string | null
  principalIds?: string[]
  sendInviteSms?: boolean     // 초대코드 SMS 자동 전송 여부
}): Promise<{
  data: DriverRow | null
  error: string | null
  inviteSent?: boolean
}> {
  const supabase = createBrowserSupabaseClient()

  const insertData: DriverInsert = {
    agency_id: data.agency_id,
    name: data.name,
    phone: data.phone,
    employee_code: data.employee_code?.trim() || null,
  }

  try {
    const { data: agencyInfo, error: agencyError } = await supabase
      .from('agencies')
      .select('name, invite_code')
      .eq('id', data.agency_id)
      .single()

    if (agencyError) throw agencyError

    if (insertData.employee_code) {
      const { data: duplicateDriver } = await supabase
        .from('drivers')
        .select('id')
        .eq('agency_id', data.agency_id)
        .ilike('employee_code', insertData.employee_code)
        .limit(1)
        .maybeSingle()

      if (duplicateDriver) {
        return { data: null, error: '이미 등록된 사번입니다.' }
      }
    }

    insertData.driver_code = await generateUniqueDriverCode(
      supabase,
      data.agency_id,
      agencyInfo?.invite_code ?? agencyInfo?.name ?? null,
    )

    const { data: driver, error } = await supabase
      .from('drivers')
      .insert(insertData)
      .select('*')
      .single()

    if (error) throw error

    // 원청사 연결
    if (driver && data.principalIds && data.principalIds.length > 0) {
      const links = data.principalIds.map(pid => ({
        driver_id: driver.id,
        principal_id: pid,
      }))
      const { error: linkErr } = await supabase
        .from('driver_principals')
        .insert(links)
      if (linkErr) console.error('driver_principals insert error:', linkErr)
    }

    // 초대코드 SMS 전송
    let inviteSent = false
    if (driver && data.sendInviteSms !== false) {
      try {
        if (agencyInfo?.invite_code && data.phone) {
          // SMS API 호출 (서버사이드 route를 통해)
          const res = await fetch('/api/sms/invite', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              driverPhone: data.phone,
              driverName: data.name,
              inviteCode: agencyInfo.invite_code,
              agencyName: agencyInfo.name,
              driverCode: driver.driver_code,
            }),
          })
          inviteSent = res.ok
        }
      } catch (smsErr) {
        console.error('초대 SMS 전송 실패:', smsErr)
        // SMS 실패는 기사 생성 자체는 성공으로 처리
      }
    }

    return { data: driver, error: null, inviteSent }
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Failed to create driver'
    return { data: null, error: message }
  }
}

/* ══════════════════════ 기사 수정 ══════════════════════ */

export async function updateDriver(
  id: string,
  data: DriverUpdate
): Promise<{
  data: DriverRow | null
  error: string | null
}> {
  const supabase = createBrowserSupabaseClient()

  try {
    const { data: driver, error } = await supabase
      .from('drivers')
      .update(data)
      .eq('id', id)
      .select('*')
      .single()

    if (error) throw error
    return { data: driver, error: null }
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Failed to update driver'
    return { data: null, error: message }
  }
}

/* ══════════════════════ 기사↔원청사 연결 관리 ══════════════════════ */

/** 기사의 소속 원청사 목록 */
export async function getDriverPrincipals(driverId: string): Promise<DriverPrincipalLink[]> {
  const supabase = createBrowserSupabaseClient()
  const { data } = await supabase
    .from('driver_principals')
    .select('id, driver_id, principal_id, status, joined_at, principals(name)')
    .eq('driver_id', driverId)
    .order('joined_at', { ascending: true })

  return ((data ?? []) as unknown as (DriverPrincipalLink & { principals: { name: string } | null })[]).map(d => ({
    id: d.id,
    driver_id: d.driver_id,
    principal_id: d.principal_id,
    status: d.status,
    joined_at: d.joined_at,
    principal_name: d.principals?.name ?? '',
  }))
}

/** 기사에 원청사 추가 연결 */
export async function linkDriverToPrincipal(driverId: string, principalId: string): Promise<{ error: string | null }> {
  const supabase = createBrowserSupabaseClient()
  const { error } = await supabase
    .from('driver_principals')
    .upsert({ driver_id: driverId, principal_id: principalId, status: 'active' }, { onConflict: 'driver_id,principal_id' })
  return { error: error?.message ?? null }
}

/** 기사에서 원청사 연결 해제 (비활성화) */
export async function unlinkDriverFromPrincipal(driverId: string, principalId: string): Promise<{ error: string | null }> {
  const supabase = createBrowserSupabaseClient()
  const { error } = await supabase
    .from('driver_principals')
    .update({ status: 'inactive' })
    .eq('driver_id', driverId)
    .eq('principal_id', principalId)
  return { error: error?.message ?? null }
}

/** 기사의 원청사 연결 일괄 업데이트 (기사 편집 시 사용) */
export async function updateDriverPrincipals(driverId: string, principalIds: string[]): Promise<{ error: string | null }> {
  const supabase = createBrowserSupabaseClient()

  try {
    // 기존 연결 모두 비활성화
    await supabase
      .from('driver_principals')
      .update({ status: 'inactive' })
      .eq('driver_id', driverId)

    // 새 연결 upsert
    if (principalIds.length > 0) {
      const links = principalIds.map(pid => ({
        driver_id: driverId,
        principal_id: pid,
        status: 'active' as const,
      }))
      const { error } = await supabase
        .from('driver_principals')
        .upsert(links, { onConflict: 'driver_id,principal_id' })
      if (error) throw error
    }

    return { error: null }
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Failed to update driver principals'
    return { error: message }
  }
}
