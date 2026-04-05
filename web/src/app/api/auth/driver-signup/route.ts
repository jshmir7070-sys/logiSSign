import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { getClientIp } from '@/lib/get-ip'
import { rateLimitPublic } from '@/lib/rate-limit'

const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!,
  { auth: { autoRefreshToken: false, persistSession: false } }
)

/**
 * POST /api/auth/driver-signup
 * 기사 가입 — 모바일 앱에서 호출
 * service_role로 Auth 계정 생성 + driver row 연결까지 원자적으로 처리
 * 
 * ✅ 보안:
 *  - 초대코드 검증 포함 (별도 API 불필요)
 *  - rate limit 적용
 *  - driver row 연결은 서버에서만 수행
 *  - app_metadata 설정도 서버에서만 수행
 */
export async function POST(request: NextRequest) {
  const ip = getClientIp(request)
  const limited = rateLimitPublic(ip, '/api/auth/driver-signup')
  if (limited) return limited

  try {
    const { inviteCode, name, phone, email, password, birthDate, validateOnly } = await request.json()

    // 1. 입력 검증
    if (!inviteCode) {
      return NextResponse.json({ error: '초대코드를 입력하세요' }, { status: 400 })
    }

    // 2. 초대코드 검증 — service_role로 agencies 조회
    const { data: agency, error: agencyErr } = await supabaseAdmin
      .from('agencies')
      .select('id, name')
      .eq('invite_code', inviteCode.trim().toUpperCase())
      .single()

    if (agencyErr || !agency) {
      return NextResponse.json({ error: '유효하지 않은 초대코드입니다' }, { status: 404 })
    }

    // validateOnly 모드: 초대코드 검증만 하고 반환 (agency id는 노출하지 않음)
    if (validateOnly) {
      return NextResponse.json({ valid: true, agencyName: agency.name })
    }

    if (!name || !phone || !email || !password) {
      return NextResponse.json({ error: '필수 항목을 모두 입력하세요' }, { status: 400 })
    }
    if (password.length < 8) {
      return NextResponse.json({ error: '비밀번호는 8자 이상이어야 합니다' }, { status: 400 })
    }

    // 3. Supabase Auth 계정 생성
    const { data: authData, error: authError } = await supabaseAdmin.auth.admin.createUser({
      email: email.trim(),
      password,
      email_confirm: true,
      user_metadata: { name: name.trim(), role: 'driver' },
      app_metadata: { role: 'driver', agency_id: agency.id },
    })

    if (authError) {
      if (authError.message?.includes('already') || authError.message?.includes('exists')) {
        return NextResponse.json({ error: '이미 등록된 이메일입니다' }, { status: 409 })
      }
      return NextResponse.json({ error: authError.message }, { status: 400 })
    }

    const userId = authData.user?.id
    if (!userId) {
      return NextResponse.json({ error: '계정 생성 실패' }, { status: 500 })
    }

    // 4. driver row 연결/생성 — service_role로 RLS 우회
    const normalizedPhone = phone.trim().replace(/[^0-9]/g, '')

    // 4-1. 기존 driver row 조회 (대리점에서 미리 등록한 경우)
    const { data: existingDriver } = await supabaseAdmin
      .from('drivers')
      .select('id')
      .eq('agency_id', agency.id)
      .is('user_id', null)
      .or(`phone.eq."${normalizedPhone}",phone.eq."${phone.trim().replace(/"/g, '')}"`)
      .limit(1)
      .maybeSingle()

    if (existingDriver) {
      // 기존 row에 user_id 연결
      await supabaseAdmin.from('drivers').update({
        user_id: userId,
        email: email.trim(),
        birth_date: birthDate || null,
      }).eq('id', existingDriver.id)
    } else {
      // 신규 생성
      const { error: driverErr } = await supabaseAdmin.from('drivers').insert({
        user_id: userId,
        agency_id: agency.id,
        name: name.trim(),
        phone: phone.trim(),
        email: email.trim(),
        birth_date: birthDate || null,
        status: 'active',
      })
      if (driverErr) {
        // Auth 계정은 생성됨 — 롤백
        await supabaseAdmin.auth.admin.deleteUser(userId)
        return NextResponse.json({ error: '기사 등록 실패: ' + driverErr.message }, { status: 500 })
      }
    }

    return NextResponse.json({
      success: true,
      userId,
      agencyName: agency.name,
    })
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : '가입 처리 실패' },
      { status: 500 }
    )
  }
}
