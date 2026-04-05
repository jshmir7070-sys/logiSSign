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
 *
 * ✅ 퇴사 후 다른 업체 재가입 지원:
 *  - 기존 Auth 계정이 있는 이메일로 새 초대코드 가입 시
 *  - 이전 업체 driver 상태가 inactive(퇴사)이면
 *  - agency_id를 새 업체로 전환 + 새 driver 레코드 생성
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

    const trimmedEmail = email.trim().toLowerCase()
    const normalizedPhone = phone.trim().replace(/[^0-9]/g, '')

    // 3. 기존 Auth 계정 존재 여부 확인 (이메일 기준)
    // listUsers로 이메일 검색
    const { data: existingUsers } = await supabaseAdmin.auth.admin.listUsers({ perPage: 1 })
    // listUsers는 전체를 반환하므로, 이메일로 직접 조회
    let existingAuthUser = null
    try {
      // getUserByEmail은 없으므로 listUsers + filter 대신, createUser 시도 후 에러 처리
      // 먼저 createUser 시도
      const { data: authData, error: authError } = await supabaseAdmin.auth.admin.createUser({
        email: trimmedEmail,
        password,
        email_confirm: true,
        user_metadata: { name: name.trim(), role: 'driver' },
        app_metadata: { role: 'driver', agency_id: agency.id },
      })

      if (!authError && authData.user) {
        // 신규 계정 생성 성공 — 정상 플로우
        const userId = authData.user.id

        // driver row 연결/생성
        const newDriverId = await linkOrCreateDriver({
          userId,
          agencyId: agency.id,
          name: name.trim(),
          phone: phone.trim(),
          normalizedPhone,
          email: trimmedEmail,
          birthDate,
        })

        if (!newDriverId) {
          // driver 생성 실패 — Auth 롤백
          await supabaseAdmin.auth.admin.deleteUser(userId)
          return NextResponse.json({ error: '기사 등록 실패' }, { status: 500 })
        }

        return NextResponse.json({
          success: true,
          userId,
          agencyName: agency.name,
        })
      }

      // createUser 실패 — 이미 존재하는 이메일인지 확인
      if (authError && (authError.message?.includes('already') || authError.message?.includes('exists') || authError.message?.includes('unique'))) {
        existingAuthUser = 'email_exists'
      } else if (authError) {
        return NextResponse.json({ error: authError.message }, { status: 400 })
      }
    } catch {
      return NextResponse.json({ error: '계정 생성 중 오류' }, { status: 500 })
    }

    // 4. 기존 이메일 → 퇴사 후 다른 업체 재가입 처리
    if (existingAuthUser === 'email_exists') {
      // 기존 Auth 사용자 조회 (이메일로)
      const { data: allUsers } = await supabaseAdmin.auth.admin.listUsers({ perPage: 1000 })
      const foundUser = allUsers?.users?.find(u => u.email?.toLowerCase() === trimmedEmail)

      if (!foundUser) {
        return NextResponse.json({ error: '이미 등록된 이메일이지만 사용자를 찾을 수 없습니다. 고객센터에 문의하세요.' }, { status: 409 })
      }

      // 기존 업체 확인
      const oldAgencyId = foundUser.app_metadata?.agency_id as string | undefined
      const userRole = foundUser.app_metadata?.role as string | undefined

      // 기사가 아닌 계정이면 거부
      if (userRole !== 'driver') {
        return NextResponse.json({ error: '이미 등록된 이메일입니다 (기사 계정이 아님)' }, { status: 409 })
      }

      // 같은 업체에 다시 가입하려는 경우
      if (oldAgencyId === agency.id) {
        // 퇴사 상태인지 확인
        const { data: existingDriver } = await supabaseAdmin
          .from('drivers')
          .select('id, status')
          .eq('user_id', foundUser.id)
          .eq('agency_id', agency.id)
          .maybeSingle()

        if (existingDriver?.status === 'inactive') {
          // 같은 업체 복직 — driver 상태만 active로 변경
          await supabaseAdmin.from('drivers').update({
            status: 'active',
            resigned_at: null,
          }).eq('id', existingDriver.id)

          // 비밀번호 업데이트
          await supabaseAdmin.auth.admin.updateUserById(foundUser.id, { password })

          return NextResponse.json({
            success: true,
            userId: foundUser.id,
            agencyName: agency.name,
            reinstated: true,
          })
        }

        return NextResponse.json({ error: '이미 이 업체에 등록된 계정입니다. 로그인해주세요.' }, { status: 409 })
      }

      // 다른 업체로 이직 — 이전 업체 기사가 퇴사(inactive) 상태인지 확인
      if (oldAgencyId) {
        const { data: oldDriver } = await supabaseAdmin
          .from('drivers')
          .select('id, status')
          .eq('user_id', foundUser.id)
          .eq('agency_id', oldAgencyId)
          .maybeSingle()

        // 이전 업체에서 활동중인데 다른 업체 가입 시도 → 거부
        if (oldDriver && oldDriver.status !== 'inactive') {
          return NextResponse.json({
            error: '현재 다른 업체에 소속 중입니다. 기존 업체에서 퇴사 처리 후 재가입하세요.',
          }, { status: 409 })
        }
      }

      // ✅ 이전 업체 퇴사 확인됨 — 새 업체로 이직 처리
      const userId = foundUser.id

      // Auth 계정의 agency_id를 새 업체로 전환 + 비밀번호 업데이트
      await supabaseAdmin.auth.admin.updateUserById(userId, {
        password,
        user_metadata: { ...foundUser.user_metadata, name: name.trim() },
        app_metadata: { ...foundUser.app_metadata, agency_id: agency.id, previous_agency_id: oldAgencyId },
      })

      // 새 업체에 driver row 생성 (이전 업체 driver는 그대로 보존)
      const newDriverId = await linkOrCreateDriver({
        userId,
        agencyId: agency.id,
        name: name.trim(),
        phone: phone.trim(),
        normalizedPhone,
        email: trimmedEmail,
        birthDate,
      })

      if (!newDriverId) {
        // 롤백: agency_id를 원래대로
        await supabaseAdmin.auth.admin.updateUserById(userId, {
          app_metadata: { ...foundUser.app_metadata },
        })
        return NextResponse.json({ error: '새 업체 기사 등록 실패' }, { status: 500 })
      }

      return NextResponse.json({
        success: true,
        userId,
        agencyName: agency.name,
        transferred: true,
      })
    }

    return NextResponse.json({ error: '계정 생성 실패' }, { status: 500 })
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : '가입 처리 실패' },
      { status: 500 }
    )
  }
}

/**
 * 기존 driver row 연결 또는 신규 생성
 * 대리점에서 미리 등록한 driver가 있으면 연결, 없으면 신규 생성
 */
async function linkOrCreateDriver(params: {
  userId: string
  agencyId: string
  name: string
  phone: string
  normalizedPhone: string
  email: string
  birthDate?: string
}): Promise<string | null> {
  const { userId, agencyId, name, phone, normalizedPhone, email, birthDate } = params

  // 기존 driver row 조회 (대리점에서 미리 등록한 경우 — user_id 없는 레코드)
  const { data: existingDriver } = await supabaseAdmin
    .from('drivers')
    .select('id')
    .eq('agency_id', agencyId)
    .is('user_id', null)
    .or(`phone.eq."${normalizedPhone.replace(/"/g, '')}",phone.eq."${phone.replace(/"/g, '')}"`)
    .limit(1)
    .maybeSingle()

  if (existingDriver) {
    // 기존 row에 user_id 연결 + 활성화
    const { error } = await supabaseAdmin.from('drivers').update({
      user_id: userId,
      email,
      birth_date: birthDate || null,
      status: 'active',
      resigned_at: null,
    }).eq('id', existingDriver.id)

    return error ? null : existingDriver.id
  }

  // 신규 생성
  const { data: newDriver, error: driverErr } = await supabaseAdmin.from('drivers').insert({
    user_id: userId,
    agency_id: agencyId,
    name,
    phone,
    email,
    birth_date: birthDate || null,
    status: 'active',
  }).select('id').single()

  return driverErr ? null : newDriver.id
}
