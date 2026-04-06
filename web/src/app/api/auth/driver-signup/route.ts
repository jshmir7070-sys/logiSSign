import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { getClientIp } from '@/lib/get-ip'
import { rateLimitPublic } from '@/lib/rate-limit'
import { encryptPii } from '@/services/pii.service'

const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!,
  { auth: { autoRefreshToken: false, persistSession: false } }
)

type ExistingUser = Awaited<ReturnType<typeof supabaseAdmin.auth.admin.listUsers>>['data']['users'][0]

export async function POST(request: NextRequest) {
  const ip = getClientIp(request)
  const limited = rateLimitPublic(ip, '/api/auth/driver-signup')
  if (limited) return limited

  try {
    const { inviteCode, name, phone, email, password, birthDate, validateOnly } = await request.json()

    if (!inviteCode) {
      return NextResponse.json({ error: '초대코드를 입력해 주세요.' }, { status: 400 })
    }

    const normalizedInviteCode = String(inviteCode).trim().toUpperCase()
    const { data: agency, error: agencyError } = await supabaseAdmin
      .from('agencies')
      .select('id, name')
      .eq('invite_code', normalizedInviteCode)
      .single()

    if (agencyError || !agency) {
      return NextResponse.json({ error: '유효하지 않은 초대코드입니다.' }, { status: 404 })
    }

    if (validateOnly) {
      return NextResponse.json({ valid: true, agencyName: agency.name })
    }

    if (!name || !phone || !email || !password) {
      return NextResponse.json({ error: '필수 항목을 모두 입력해 주세요.' }, { status: 400 })
    }

    if (String(password).length < 8) {
      return NextResponse.json({ error: '비밀번호는 8자 이상이어야 합니다.' }, { status: 400 })
    }

    const trimmedName = String(name).trim()
    const trimmedEmail = String(email).trim().toLowerCase()
    const trimmedPhone = String(phone).trim()
    const normalizedPhone = trimmedPhone.replace(/[^0-9]/g, '')

    const createResult = await supabaseAdmin.auth.admin.createUser({
      email: trimmedEmail,
      password,
      email_confirm: true,
      user_metadata: { name: trimmedName, role: 'driver' },
      app_metadata: { role: 'driver', agency_id: agency.id },
    })

    if (!createResult.error && createResult.data.user) {
      const userId = createResult.data.user.id
      const driverId = await linkOrCreateDriver({
        userId,
        agencyId: agency.id,
        name: trimmedName,
        phone: trimmedPhone,
        normalizedPhone,
        email: trimmedEmail,
        birthDate,
      })

      if (!driverId) {
        await supabaseAdmin.auth.admin.deleteUser(userId)
        return NextResponse.json({ error: '기사 등록에 실패했습니다.' }, { status: 500 })
      }

      await supabaseAdmin.auth.admin.updateUserById(userId, {
        app_metadata: { role: 'driver', agency_id: agency.id, driver_id: driverId },
      })

      return NextResponse.json({
        success: true,
        userId,
        driverId,
        agencyName: agency.name,
      })
    }

    const createMessage = createResult.error?.message ?? ''
    const isExistingEmailError =
      createMessage.includes('already') ||
      createMessage.includes('exists') ||
      createMessage.includes('unique')

    if (!isExistingEmailError) {
      return NextResponse.json({ error: createMessage || '계정 생성에 실패했습니다.' }, { status: 400 })
    }

    const foundUser = await findUserByEmail(trimmedEmail)
    if (!foundUser) {
      return NextResponse.json(
        { error: '이미 등록된 이메일이지만 사용자 계정을 찾지 못했습니다. 고객센터에 문의해 주세요.' },
        { status: 409 }
      )
    }

    const userRole = foundUser.app_metadata?.role as string | undefined
    const oldAgencyId = foundUser.app_metadata?.agency_id as string | undefined

    if (userRole !== 'driver') {
      return NextResponse.json(
        { error: '이미 등록된 이메일입니다. 기사 계정이 아닌 다른 계정으로 사용 중입니다.' },
        { status: 409 }
      )
    }

    if (oldAgencyId === agency.id) {
      const { data: existingDriver } = await supabaseAdmin
        .from('drivers')
        .select('id, status')
        .eq('user_id', foundUser.id)
        .eq('agency_id', agency.id)
        .maybeSingle()

      if (existingDriver?.status === 'inactive') {
        const { error: reinstateError } = await supabaseAdmin
          .from('drivers')
          .update({
            status: 'active',
            resigned_at: null,
          })
          .eq('id', existingDriver.id)

        if (reinstateError) {
          return NextResponse.json(
            { error: '기사 상태 복구 실패: ' + reinstateError.message },
            { status: 500 }
          )
        }

        await supabaseAdmin.auth.admin.updateUserById(foundUser.id, {
          password,
          app_metadata: {
            ...foundUser.app_metadata,
            agency_id: agency.id,
            driver_id: existingDriver.id,
          },
          user_metadata: {
            ...foundUser.user_metadata,
            name: trimmedName,
          },
        })

        return NextResponse.json({
          success: true,
          userId: foundUser.id,
          driverId: existingDriver.id,
          agencyName: agency.name,
          reinstated: true,
        })
      }

      return NextResponse.json(
        { error: '이미 같은 대리점에 등록된 기사 계정입니다. 로그인해 주세요.' },
        { status: 409 }
      )
    }

    if (oldAgencyId) {
      const { data: oldDriver } = await supabaseAdmin
        .from('drivers')
        .select('id, status')
        .eq('user_id', foundUser.id)
        .eq('agency_id', oldAgencyId)
        .maybeSingle()

      if (oldDriver && oldDriver.status !== 'inactive') {
        return NextResponse.json(
          { error: '현재 다른 대리점에 재직 중입니다. 기존 대리점에서 퇴사 처리 후 다시 가입해 주세요.' },
          { status: 409 }
        )
      }
    }

    await supabaseAdmin.auth.admin.updateUserById(foundUser.id, {
      password,
      user_metadata: {
        ...foundUser.user_metadata,
        name: trimmedName,
      },
      app_metadata: {
        ...foundUser.app_metadata,
        agency_id: agency.id,
        previous_agency_id: oldAgencyId,
      },
    })

    const linkedDriverId = await linkOrCreateDriver({
      userId: foundUser.id,
      agencyId: agency.id,
      name: trimmedName,
      phone: trimmedPhone,
      normalizedPhone,
      email: trimmedEmail,
      birthDate,
    })

    if (!linkedDriverId) {
      await supabaseAdmin.auth.admin.updateUserById(foundUser.id, {
        app_metadata: { ...foundUser.app_metadata },
      })
      return NextResponse.json({ error: '새 대리점 기사 등록에 실패했습니다.' }, { status: 500 })
    }

    await supabaseAdmin.auth.admin.updateUserById(foundUser.id, {
      app_metadata: {
        ...foundUser.app_metadata,
        agency_id: agency.id,
        previous_agency_id: oldAgencyId,
        driver_id: linkedDriverId,
      },
    })

    return NextResponse.json({
      success: true,
      userId: foundUser.id,
      driverId: linkedDriverId,
      agencyName: agency.name,
      transferred: true,
    })
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : '가입 처리에 실패했습니다.' },
      { status: 500 }
    )
  }
}

async function findUserByEmail(email: string): Promise<ExistingUser | null> {
  let page = 1

  while (true) {
    const { data } = await supabaseAdmin.auth.admin.listUsers({ page, perPage: 100 })
    const users = data?.users ?? []
    const foundUser = users.find((user) => user.email?.toLowerCase() === email) ?? null
    if (foundUser) return foundUser
    if (users.length < 100) return null
    page += 1
  }
}

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
  const encryptedBirthDate = birthDate ? await encryptPii(birthDate) : null

  const phoneCandidates = Array.from(new Set([normalizedPhone, phone].filter(Boolean)))
  const { data: existingDriver } = await supabaseAdmin
    .from('drivers')
    .select('id')
    .eq('agency_id', agencyId)
    .is('user_id', null)
    .in('phone', phoneCandidates)
    .limit(1)
    .maybeSingle()

  if (existingDriver) {
    const { error } = await supabaseAdmin
      .from('drivers')
      .update({
        user_id: userId,
        email,
        birth_date: encryptedBirthDate,
        status: 'active',
        resigned_at: null,
      })
      .eq('id', existingDriver.id)

    return error ? null : existingDriver.id
  }

  const { data: newDriver, error } = await supabaseAdmin
    .from('drivers')
    .insert({
      user_id: userId,
      agency_id: agencyId,
      name,
      phone,
      email,
      birth_date: encryptedBirthDate,
      status: 'active',
    })
    .select('id')
    .single()

  return error ? null : newDriver.id
}
