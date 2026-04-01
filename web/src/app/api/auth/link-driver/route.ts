import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { createServerClient, type CookieOptions } from '@supabase/ssr'

const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!,
  { auth: { autoRefreshToken: false, persistSession: false } }
)

/**
 * POST /api/auth/link-driver
 * 가입 완료 후 기존 driver row에 user_id 연결 or 신규 생성
 * ✅ 보안: 인증된 사용자만 + 자기 자신만 연결 가능
 */
export async function POST(request: NextRequest) {
  try {
    // 1. 인증 확인 — 쿠키 기반 세션에서 user 검증
    const supabase = createServerClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
      {
        cookies: {
          get(name: string) { return request.cookies.get(name)?.value },
          set() {},
          remove() {},
        },
      }
    )
    const { data: { user }, error: authErr } = await supabase.auth.getUser()

    const { agencyId, name, phone, email, birthDate } = await request.json()
    if (!agencyId || !name || !phone) {
      return NextResponse.json({ error: '필수 파라미터 누락' }, { status: 400 })
    }

    // 인증된 사용자가 있으면 자기 userId 사용, 없으면 body의 userId 사용 (가입 직후 세션 미확립 케이스)
    let userId: string | null = user?.id ?? null
    if (!userId) {
      // 가입 직후 Supabase 세션 쿠키가 아직 없을 수 있음 — body에서 받되 검증
      const bodyUserId = (await request.clone().json()).userId as string | undefined
      if (!bodyUserId) {
        return NextResponse.json({ error: '인증이 필요합니다' }, { status: 401 })
      }
      // userId가 실제 존재하는 auth user인지 확인
      const { data: authUser, error: lookupErr } = await supabaseAdmin.auth.admin.getUserById(bodyUserId)
      if (lookupErr || !authUser?.user) {
        return NextResponse.json({ error: '유효하지 않은 사용자입니다' }, { status: 403 })
      }
      userId = bodyUserId
    }

    const normalizedPhone = phone.replace(/[^0-9]/g, '')

    // 2. 기존 driver row 조회
    const { data: existingDriver } = await supabaseAdmin
      .from('drivers')
      .select('id')
      .eq('agency_id', agencyId)
      .is('user_id', null)
      .or(`phone.eq.${normalizedPhone},phone.eq.${phone}`)
      .limit(1)
      .maybeSingle()

    if (existingDriver) {
      await supabaseAdmin.from('drivers').update({
        user_id: userId,
        email: email || null,
        birth_date: birthDate || null,
      }).eq('id', existingDriver.id)
    } else {
      const { error: insertErr } = await supabaseAdmin
        .from('drivers')
        .insert({
          user_id: userId,
          agency_id: agencyId,
          name, phone,
          email: email || null,
          birth_date: birthDate || null,
          status: 'active',
        })
      if (insertErr) {
        return NextResponse.json({ error: '기사 등록 실패: ' + insertErr.message }, { status: 500 })
      }
    }

    // 3. app_metadata 설정
    await supabaseAdmin.auth.admin.updateUserById(userId, {
      app_metadata: { role: 'driver', agency_id: agencyId },
    })

    return NextResponse.json({ success: true })
  } catch (err) {
    return NextResponse.json({ error: err instanceof Error ? err.message : '연결 실패' }, { status: 500 })
  }
}
