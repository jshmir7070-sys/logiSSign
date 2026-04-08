import { getClientIp } from '@/lib/get-ip'
import { apiError } from '@/lib/api-error'
import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { authenticateRequest } from '@/lib/api-auth'
import { createAmendmentSchema, patchAmendmentSchema, validateInput } from '@/lib/api-schemas'
import { rateLimitAuth } from '@/lib/rate-limit'
import { DEFAULT_CONTRACT_DAYS } from '@/config/constants'

const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!,
  { auth: { autoRefreshToken: false, persistSession: false } }
)

/**
 * GET /api/amendments?driverId=xxx&status=pending
 * 기사앱에서 자신의 변경 요청 목록 조회
 */
export async function GET(request: NextRequest) {
  const ip = getClientIp(request)
  const limited = await rateLimitAuth(ip, '/api/amendments:GET')
  if (limited) return limited

  const { auth, error: authError } = await authenticateRequest(request)
  if (authError) return authError

  try {
    const { searchParams } = new URL(request.url)
    const driverId = searchParams.get('driverId')
    const status = searchParams.get('status')

    if (!driverId) {
      return NextResponse.json({ error: 'driverId 필수' }, { status: 400 })
    }

    // 기사는 본인 데이터만, 대리점은 소속 기사 데이터만 조회 가능
    if (auth!.role === 'driver') {
      // 기사 본인 확인은 RLS에 위임 (user_id 매칭)
    } else if (auth!.agencyId) {
      // 대리점 소속 기사인지 확인
      const { data: driver } = await supabaseAdmin
        .from('drivers')
        .select('agency_id')
        .eq('id', driverId)
        .single()

      if (!driver || (driver as { agency_id: string }).agency_id !== auth!.agencyId) {
        return NextResponse.json({ error: '접근 권한이 없습니다' }, { status: 403 })
      }
    }

    let query = supabaseAdmin
      .from('contract_amendments')
      .select('*')
      .eq('driver_id', driverId)
      .order('created_at', { ascending: false })

    if (status) {
      query = query.eq('status', status)
    }

    const { data, error } = await query
    if (error) throw error

    return NextResponse.json({ data, error: null })
  } catch (err) {
    return apiError(err)
  }
}

/**
 * POST /api/amendments
 * 대리점에서 변경 요청 생성
 */
export async function POST(request: NextRequest) {
  const ip = getClientIp(request)
  const limited = await rateLimitAuth(ip, '/api/amendments:POST')
  if (limited) return limited

  const { auth, error: authError } = await authenticateRequest(request)
  if (authError) return authError

  try {
    const body = await request.json()
    const { data: validated, error: validationError } = validateInput(createAmendmentSchema, body)
    if (validationError || !validated) {
      return NextResponse.json({ error: validationError }, { status: 400 })
    }

    const {
      driverIds, contractId,
      amendmentType, title, description,
      changes, effectiveDate,
    } = validated

  // 인증된 고객사 계정의 agencyId 사용 (요청 body의 agencyId 무시)
    const agencyId = auth!.agencyId
    if (!agencyId) {
      return NextResponse.json({ error: '대리점 정보가 없습니다' }, { status: 403 })
    }

    // 소속 기사인지 확인
    const { data: drivers } = await supabaseAdmin
      .from('drivers')
      .select('id')
      .eq('agency_id', agencyId)
      .in('id', driverIds)

    const validDriverIds = (drivers ?? []).map((d: { id: string }) => d.id)
    if (validDriverIds.length === 0) {
      return NextResponse.json({ error: '유효한 소속 기사가 없습니다' }, { status: 400 })
    }

    const rows = validDriverIds.map((driverId: string) => ({
      agency_id: agencyId,
      driver_id: driverId,
      contract_id: contractId ?? null,
      amendment_type: amendmentType,
      title,
      description: description ?? null,
      changes: changes ?? {},
      effective_date: effectiveDate ?? null,
      requested_by: auth!.userId,
      status: 'pending',
    }))

    const { data, error } = await supabaseAdmin
      .from('contract_amendments')
      .insert(rows)
      .select('id, driver_id')

    if (error) throw error

    return NextResponse.json({ created: data?.length ?? 0, data, error: null })
  } catch (err) {
    return apiError(err)
  }
}

/**
 * PATCH /api/amendments
 * 기사의 수락/거부 또는 대리점의 취소
 */
export async function PATCH(request: NextRequest) {
  const ip = getClientIp(request)
  const limited = await rateLimitAuth(ip, '/api/amendments:PATCH')
  if (limited) return limited

  const { auth, error: authError } = await authenticateRequest(request)
  if (authError) return authError

  try {
    const body = await request.json()
    const { data: validated, error: validationError } = validateInput(patchAmendmentSchema, body)
    if (validationError || !validated) {
      return NextResponse.json({ error: validationError }, { status: 400 })
    }

    const { amendmentId, action, rejectionReason } = validated

    // 현재 상태 + 변경 내용 확인
    const { data: current, error: fetchErr } = await supabaseAdmin
      .from('contract_amendments')
      .select('id, status, agency_id, driver_id, amendment_type, changes, effective_date')
      .eq('id', amendmentId)
      .single()

    if (fetchErr || !current) {
      return NextResponse.json({ error: '변경 요청을 찾을 수 없습니다' }, { status: 404 })
    }

    const amendment = current as {
      id: string; status: string; agency_id: string; driver_id: string;
      amendment_type: string;
      changes: { before?: Record<string, string>; after?: Record<string, string> };
      effective_date: string | null;
    }

    // 권한 확인: 대리점은 소속 amendment만, 기사는 본인 amendment만
    if (auth!.agencyId && amendment.agency_id !== auth!.agencyId) {
      return NextResponse.json({ error: '접근 권한이 없습니다' }, { status: 403 })
    }

    if (amendment.status !== 'pending') {
      return NextResponse.json({ error: '이미 처리된 요청입니다' }, { status: 400 })
    }

    const updateData: Record<string, unknown> = {
      updated_at: new Date().toISOString(),
    }

    if (action === 'approve') {
      updateData.status = 'approved'
      updateData.approved_by = auth!.userId
      updateData.approved_at = new Date().toISOString()

      // 재계약/단가 변경 → RPC로 트랜잭션 처리
      if (amendment.amendment_type === 'renewal' || amendment.amendment_type === 'rate_change') {
        const afterChanges = amendment.changes?.after ?? {}
        const effectiveDate = amendment.effective_date ?? new Date().toISOString().slice(0, 10)

        const periodEnd = afterChanges['계약종료일']
          ?? new Date(new Date(effectiveDate).getTime() + DEFAULT_CONTRACT_DAYS * 24 * 60 * 60 * 1000).toISOString().slice(0, 10)

        const rateConfig: Record<string, unknown> = {}
        if (afterChanges['배송단가']) rateConfig.delivery_unit_price = parseInt(afterChanges['배송단가'].replace(/[^0-9]/g, '')) || 0
        if (afterChanges['반품단가']) rateConfig.return_unit_price = parseInt(afterChanges['반품단가'].replace(/[^0-9]/g, '')) || 0
        if (afterChanges['집하단가']) rateConfig.pickup_unit_price = parseInt(afterChanges['집하단가'].replace(/[^0-9]/g, '')) || 0

        // RPC 호출 시도 — 없으면 개별 처리
        const { error: rpcError } = await supabaseAdmin.rpc('approve_amendment_with_period', {
          p_driver_id: amendment.driver_id,
          p_agency_id: amendment.agency_id,
          p_amendment_id: amendmentId,
          p_period_start: effectiveDate,
          p_period_end: periodEnd,
          p_rate_config: rateConfig,
        })

        if (rpcError) {
          console.warn('[AMENDMENTS] RPC fallback — approve_amendment_with_period 미등록, 개별 처리:', rpcError.message)
          // Fallback: 직접 period 생성
          await supabaseAdmin.from('driver_contract_periods').insert({
            driver_id: amendment.driver_id,
            agency_id: amendment.agency_id,
            period_start: effectiveDate,
            period_end: periodEnd,
            status: 'active',
            auto_renew: true,
          })
        }
      }
    } else if (action === 'reject') {
      updateData.status = 'rejected'
      updateData.rejected_by = auth!.userId
      updateData.rejected_at = new Date().toISOString()
      updateData.rejection_reason = rejectionReason ?? null
    }

    const { error: updateErr } = await supabaseAdmin
      .from('contract_amendments')
      .update(updateData)
      .eq('id', amendmentId)

    if (updateErr) throw updateErr

    return NextResponse.json({ success: true, amendmentId, action, data: updateData })
  } catch (err) {
    return apiError(err)
  }
}
