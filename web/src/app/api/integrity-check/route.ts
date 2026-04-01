import { getClientIp } from '@/lib/get-ip'
import { rateLimitAuth } from '@/lib/rate-limit'
/**
 * 수동 무결성 검사 API (관리자용)
 *
 * POST /api/integrity-check         → 전체 검사
 * POST /api/integrity-check         → { contractId } 단건 검사
 * GET  /api/integrity-check         → 최근 검사 이력 조회
 */

import { NextRequest, NextResponse } from 'next/server'
import { createServerSupabaseClient } from '@/lib/supabase'
import { runIntegrityCheck, checkSingleContract } from '@/services/integrity-check.service'
import { apiError } from '@/lib/api-error'
import { integrityCheckSchema, validateInput } from '@/lib/api-schemas'

export const dynamic = 'force-dynamic'
export const maxDuration = 300

/** POST: 무결성 검사 실행 */
export async function POST(request: NextRequest) {
  const ip = getClientIp(request)
  const limited = rateLimitAuth(ip, '/api/integrity-check')
  if (limited) return limited

  const supabase = await createServerSupabaseClient()
  const { data: { user } } = await supabase.auth.getUser()

  if (!user) {
    return NextResponse.json({ error: '로그인 필요' }, { status: 401 })
  }

  // 관리자 권한 확인 — ⚠️ app_metadata 사용 (user_metadata는 클라이언트 조작 가능)
  const role = user.app_metadata?.role as string | undefined
  if (role !== 'provider_admin' && role !== 'agency_admin') {
    return NextResponse.json({ error: '관리자 권한이 필요합니다' }, { status: 403 })
  }

  try {
    const body = await request.json().catch(() => ({}))
    const { data: validated, error: validationError } = validateInput(integrityCheckSchema, body)
    if (validationError) {
      return NextResponse.json({ error: validationError }, { status: 400 })
    }

    const contractId = validated?.contractId

    if (contractId) {
      // 단건 검사
      const failure = await checkSingleContract(contractId)
      return NextResponse.json({
        success: true,
        contractId,
        passed: !failure,
        failure: failure ?? null,
      })
    }

    // 전체 검사
    const result = await runIntegrityCheck('manual', user.id)

    return NextResponse.json({
      success: true,
      ...result,
    })
  } catch (err) {
    return apiError(err, 500, '무결성 검사 실패')
  }
}

/** GET: 최근 검사 이력 */
export async function GET() {
  const supabase = await createServerSupabaseClient()
  const { data: { user } } = await supabase.auth.getUser()

  if (!user) {
    return NextResponse.json({ error: '로그인 필요' }, { status: 401 })
  }

  // 관리자 권한 확인 — ⚠️ app_metadata 사용 (user_metadata는 클라이언트 조작 가능)
  const role = user.app_metadata?.role as string | undefined
  if (role !== 'provider_admin' && role !== 'agency_admin') {
    return NextResponse.json({ error: '관리자 권한이 필요합니다' }, { status: 403 })
  }

  try {
    const { data, error } = await supabase
      .from('integrity_check_logs')
      .select('*')
      .order('created_at', { ascending: false })
      .limit(50)

    if (error) throw error

    return NextResponse.json({
      success: true,
      logs: data ?? [],
    })
  } catch (err) {
    return apiError(err, 500, '검사 이력 조회 실패')
  }
}