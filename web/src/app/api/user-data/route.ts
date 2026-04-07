/**
 * 개인정보 처리 API — 개인정보보호법 제35~37조
 *
 * GET  /api/user-data          → 내 데이터 내보내기 (JSON)
 * POST /api/user-data          → 데이터 삭제 요청
 *   body: { action: 'export' | 'delete_request' }
 */

import { NextRequest, NextResponse } from 'next/server'
import { authenticateRequest } from '@/lib/api-auth'
import { createClient } from '@supabase/supabase-js'
import { rateLimitAuth } from '@/lib/rate-limit'
import { getClientIp } from '@/lib/get-ip'

const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!,
  { auth: { autoRefreshToken: false, persistSession: false } }
)

/**
 * GET /api/user-data — 내 데이터 내보내기
 * 개인정보보호법 제35조 (개인정보의 열람)
 */
export async function GET(request: NextRequest) {
  const ip = getClientIp(request)
  const limited = await rateLimitAuth(ip, '/api/user-data')
  if (limited) return limited

  const { auth, error } = await authenticateRequest(request)
  if (error || !auth) return error!

  try {
    // 사용자 기본 정보
    const { data: { user } } = await supabaseAdmin.auth.admin.getUserById(auth.userId)
    if (!user) return NextResponse.json({ error: '사용자 없음' }, { status: 404 })

    // 대리점 정보
    const { data: agency } = await supabaseAdmin
      .from('agencies')
      .select('name, owner_name, phone, business_number, address, plan, created_at')
      .eq('id', auth.agencyId)
      .single()

    // 기사 목록 (이름, 전화번호만)
    const { data: drivers } = await supabaseAdmin
      .from('drivers')
      .select('id, name, phone, status, created_at')
      .eq('agency_id', auth.agencyId)

    // 계약서 목록
    const { data: contracts } = await supabaseAdmin
      .from('contracts')
      .select('id, title, status, created_at')
      .eq('agency_id', auth.agencyId)

    // 정산 이력
    const { data: settlements } = await supabaseAdmin
      .from('settlements')
      .select('id, driver_id, year_month, total_income, total_deduction, net_amount, status, created_at')
      .eq('agency_id', auth.agencyId)

    // 동의 이력
    const { data: consents } = await supabaseAdmin
      .from('user_consents')
      .select('consent_type, agreed, agreed_at, revoked_at')
      .eq('user_id', auth.userId)

    const exportData = {
      exported_at: new Date().toISOString(),
      user: {
        id: user.id,
        email: user.email,
        role: user.app_metadata?.role,
        created_at: user.created_at,
      },
      agency: agency || null,
      drivers: drivers || [],
      contracts: (contracts || []).map(c => ({ id: c.id, title: c.title, status: c.status, created_at: c.created_at })),
      settlements: settlements || [],
      consents: consents || [],
    }

    return new NextResponse(JSON.stringify(exportData, null, 2), {
      status: 200,
      headers: {
        'Content-Type': 'application/json',
        'Content-Disposition': `attachment; filename="logissign_data_export_${new Date().toISOString().slice(0, 10)}.json"`,
      },
    })
  } catch (err) {
    console.error('[user-data export] error:', err)
    return NextResponse.json({ error: '데이터 내보내기 실패' }, { status: 500 })
  }
}

/**
 * POST /api/user-data — 데이터 삭제 요청
 * 개인정보보호법 제36조 (개인정보의 정정·삭제)
 */
export async function POST(request: NextRequest) {
  const ip = getClientIp(request)
  const limited = await rateLimitAuth(ip, '/api/user-data')
  if (limited) return limited

  const { auth, error } = await authenticateRequest(request)
  if (error || !auth) return error!

  try {
    const body = await request.json()
    const { action } = body as { action: string }

    if (action === 'delete_request') {
      // 삭제 요청 접수 (관리자 검토 후 처리)
      const { error: insertErr } = await supabaseAdmin
        .from('data_deletion_requests')
        .insert({
          user_id: auth.userId,
          agency_id: auth.agencyId,
          request_type: 'delete_all',
          status: 'pending',
          target_data: { scope: 'all_personal_data' },
        })

      if (insertErr) {
        return NextResponse.json({ error: '삭제 요청 등록 실패: ' + insertErr.message }, { status: 500 })
      }

      return NextResponse.json({
        success: true,
        message: '개인정보 삭제 요청이 접수되었습니다. 30일 이내에 처리됩니다.',
      })
    }

    return NextResponse.json({ error: '알 수 없는 action' }, { status: 400 })
  } catch {
    return NextResponse.json({ error: '요청 처리 중 오류가 발생했습니다' }, { status: 500 })
  }
}
