import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!,
  { auth: { autoRefreshToken: false, persistSession: false } }
)

/**
 * POST /api/auth/link-driver
 * 가입 완료 후 기존 driver row에 user_id 연결 or 신규 생성
 * service_role로 RLS 우회
 */
export async function POST(request: NextRequest) {
  try {
    const { userId, agencyId, name, phone, email, birthDate } = await request.json()
    if (!userId || !agencyId || !name || !phone) {
      return NextResponse.json({ error: '필수 파라미터 누락' }, { status: 400 })
    }

    const normalizedPhone = phone.replace(/[^0-9]/g, '')

    // 기존 driver row 조회 (같은 agency, 같은 전화번호, user_id 미연결)
    const { data: existingDriver } = await supabaseAdmin
      .from('drivers')
      .select('id')
      .eq('agency_id', agencyId)
      .is('user_id', null)
      .or(`phone.eq.${normalizedPhone},phone.eq.${phone}`)
      .limit(1)
      .maybeSingle()

    if (existingDriver) {
      // 기존 row에 user_id 연결
      await supabaseAdmin.from('drivers').update({
        user_id: userId,
        email: email || null,
        birth_date: birthDate || null,
      }).eq('id', existingDriver.id)

      // app_metadata에 role 설정
      await supabaseAdmin.auth.admin.updateUserById(userId, {
        app_metadata: { role: 'driver', agency_id: agencyId },
      })

      return NextResponse.json({ driverId: existingDriver.id, linked: true })
    }

    // 신규 driver 생성
    const { data: newDriver, error: insertErr } = await supabaseAdmin
      .from('drivers')
      .insert({
        user_id: userId,
        agency_id: agencyId,
        name,
        phone,
        email: email || null,
        birth_date: birthDate || null,
        status: 'active',
      })
      .select('id')
      .single()

    if (insertErr) {
      return NextResponse.json({ error: '기사 등록 실패: ' + insertErr.message }, { status: 500 })
    }

    // app_metadata 설정
    await supabaseAdmin.auth.admin.updateUserById(userId, {
      app_metadata: { role: 'driver', agency_id: agencyId },
    })

    return NextResponse.json({ driverId: newDriver.id, linked: false })
  } catch (err) {
    return NextResponse.json({ error: err instanceof Error ? err.message : '연결 실패' }, { status: 500 })
  }
}
