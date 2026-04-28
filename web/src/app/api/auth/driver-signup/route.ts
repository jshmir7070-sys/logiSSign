import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { getClientIp } from '@/lib/get-ip'
import { rateLimitPublic } from '@/lib/rate-limit'
import { encryptPii } from '@/services/pii.service'

const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!,
  { auth: { autoRefreshToken: false, persistSession: false } },
)

type ExistingUser = Awaited<ReturnType<typeof supabaseAdmin.auth.admin.listUsers>>['data']['users'][0]

type DriverSignupBody = {
  inviteCode?: string
  name?: string
  driverCode?: string
  phone?: string
  email?: string
  password?: string
  birthDate?: string | null
  validateOnly?: boolean
}

type DriverLookupRow = {
  id: string
  agency_id: string | null
  user_id: string | null
  name: string
  phone: string
  email: string | null
  employee_code: string | null
  driver_code: string | null
  status: string
}

function normalizePhoneValue(phone: string | null | undefined): string {
  return String(phone ?? '').replace(/[^0-9]/g, '')
}

function normalizeNameValue(name: string | null | undefined): string {
  return String(name ?? '').trim().replace(/\s+/g, '').toLowerCase()
}

function normalizeDriverCodeValue(driverCode: string | null | undefined): string {
  return String(driverCode ?? '').trim().toUpperCase()
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

async function buildDriverUpdateFields(params: {
  userId: string
  name: string
  phone: string
  email: string
  employeeCode?: string | null
  driverCode: string
  birthDate?: string | null
}) {
  const encryptedBirthDate = params.birthDate ? await encryptPii(params.birthDate) : null

  return {
    user_id: params.userId,
    name: params.name,
    phone: params.phone,
    email: params.email,
    employee_code: params.employeeCode ?? null,
    driver_code: params.driverCode,
    birth_date: encryptedBirthDate,
    status: 'active' as const,
    resigned_at: null,
  }
}

function validateDriverIdentity(params: {
  driver: DriverLookupRow
  name: string
  email: string
  phone: string
}): string | null {
  const { driver, name, email, phone } = params

  if (driver.name && normalizeNameValue(driver.name) !== normalizeNameValue(name)) {
    return '등록된 기사명과 입력한 이름이 일치하지 않습니다. 대리점에 확인해주세요.'
  }

  if (driver.email && driver.email.toLowerCase() !== email.toLowerCase()) {
    return '등록된 이메일과 입력한 이메일이 일치하지 않습니다. 대리점에 확인해주세요.'
  }

  const storedPhone = normalizePhoneValue(driver.phone)
  const inputPhone = normalizePhoneValue(phone)
  if (storedPhone && storedPhone !== inputPhone) {
    return '등록된 전화번호와 입력한 전화번호가 일치하지 않습니다. 대리점에 확인해주세요.'
  }

  return null
}

async function findDriverByCode(agencyId: string, driverCode: string): Promise<{
  data: DriverLookupRow | null
  error?: string
}> {
  const { data, error } = await supabaseAdmin
    .from('drivers')
    .select('id, agency_id, user_id, name, phone, email, employee_code, driver_code, status')
    .eq('agency_id', agencyId)
    .ilike('driver_code', driverCode)
    .limit(2)

  if (error) {
    return { data: null, error: error.message }
  }

  if ((data ?? []).length > 1) {
    return { data: null, error: '같은 기사 고유코드가 중복 등록되어 있습니다. 대리점에 확인해주세요.' }
  }

  return { data: (data?.[0] as DriverLookupRow | undefined) ?? null }
}

async function linkDriverToUser(params: {
  driver: DriverLookupRow
  userId: string
  name: string
  email: string
  phone: string
  birthDate?: string | null
}) {
  const driverFields = await buildDriverUpdateFields({
    userId: params.userId,
    name: params.name,
    phone: params.phone,
    email: params.email,
    employeeCode: params.driver.employee_code,
    driverCode: params.driver.driver_code ?? '',
    birthDate: params.birthDate,
  })

  const { error } = await supabaseAdmin
    .from('drivers')
    .update(driverFields)
    .eq('id', params.driver.id)

  return error ? error.message : null
}

type AuthMetadataSnapshot = {
  user_metadata: Record<string, unknown>
  app_metadata: Record<string, unknown>
}

async function captureAuthMetadata(userId: string): Promise<AuthMetadataSnapshot | null> {
  const currentUser = await supabaseAdmin.auth.admin.getUserById(userId)
  const existingUser = currentUser.data.user
  if (!existingUser) return null
  return {
    user_metadata: { ...(existingUser.user_metadata ?? {}) },
    app_metadata: { ...(existingUser.app_metadata ?? {}) },
  }
}

async function applyDriverAuthMetadata(params: {
  userId: string
  name: string
  agencyId: string
  driver: DriverLookupRow
  baseline: AuthMetadataSnapshot
}): Promise<string | null> {
  const userMetadata = {
    ...params.baseline.user_metadata,
    name: params.name,
    employee_code: params.driver.employee_code,
    driver_code: params.driver.driver_code,
  }

  const appMetadata = {
    ...params.baseline.app_metadata,
    role: 'driver',
    agency_id: params.agencyId,
    driver_id: params.driver.id,
    driver_code: params.driver.driver_code,
  }

  const { error } = await supabaseAdmin.auth.admin.updateUserById(params.userId, {
    user_metadata: userMetadata,
    app_metadata: appMetadata,
  })

  return error ? error.message : null
}

async function restoreAuthMetadata(userId: string, snapshot: AuthMetadataSnapshot): Promise<void> {
  try {
    await supabaseAdmin.auth.admin.updateUserById(userId, {
      user_metadata: snapshot.user_metadata,
      app_metadata: snapshot.app_metadata,
    })
  } catch (rollbackError) {
    console.error('[driver-signup] auth metadata rollback failed', rollbackError)
  }
}

async function updateDriverUserPassword(userId: string, password: string): Promise<string | null> {
  const { error } = await supabaseAdmin.auth.admin.updateUserById(userId, { password })
  return error ? error.message : null
}

export async function POST(request: NextRequest) {
  const ip = getClientIp(request)
  const limited = await rateLimitPublic(ip, '/api/auth/driver-signup')
  if (limited) return limited

  try {
    const body = (await request.json()) as DriverSignupBody
    const { inviteCode, name, driverCode, phone, email, password, birthDate, validateOnly } = body

    if (!inviteCode) {
      return NextResponse.json({ error: '초대코드를 입력해주세요.' }, { status: 400 })
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
      return NextResponse.json({ valid: true, agencyId: agency.id, agencyName: agency.name })
    }

    if (!name || !driverCode || !phone || !email || !password) {
      return NextResponse.json({ error: '필수 입력 항목을 모두 입력해주세요.' }, { status: 400 })
    }

    if (String(password).length < 8) {
      return NextResponse.json({ error: '비밀번호는 8자 이상이어야 합니다.' }, { status: 400 })
    }

    const trimmedName = String(name).trim()
    const trimmedDriverCode = normalizeDriverCodeValue(driverCode)
    const trimmedPhone = String(phone).trim()
    const trimmedEmail = String(email).trim().toLowerCase()

    if (!/^[A-Z0-9]{3}-\d{6}$/.test(trimmedDriverCode)) {
      return NextResponse.json({ error: '기사 고유코드 형식이 올바르지 않습니다. 예: DRV-000001' }, { status: 400 })
    }

    const driverLookup = await findDriverByCode(agency.id, trimmedDriverCode)
    if (driverLookup.error) {
      return NextResponse.json({ error: driverLookup.error }, { status: 409 })
    }

    const driver = driverLookup.data
    if (!driver) {
      return NextResponse.json({ error: '등록된 기사 고유코드를 찾을 수 없습니다. 대리점에 확인해주세요.' }, { status: 404 })
    }

    const identityError = validateDriverIdentity({
      driver,
      name: trimmedName,
      email: trimmedEmail,
      phone: trimmedPhone,
    })
    if (identityError) {
      return NextResponse.json({ error: identityError }, { status: 409 })
    }

    const createResult = await supabaseAdmin.auth.admin.createUser({
      email: trimmedEmail,
      password,
      email_confirm: true,
      user_metadata: {
        name: trimmedName,
        role: 'driver',
        employee_code: driver.employee_code,
        driver_code: driver.driver_code,
      },
      app_metadata: {
        role: 'driver',
        agency_id: agency.id,
        driver_id: driver.id,
        driver_code: driver.driver_code,
      },
    })

    if (!createResult.error && createResult.data.user) {
      const newUserId = createResult.data.user.id

      const cleanupNewUser = async (reason: string) => {
        try {
          const { error: deleteError } = await supabaseAdmin.auth.admin.deleteUser(newUserId)
          if (deleteError) {
            console.error('[driver-signup] auth user cleanup failed', { newUserId, reason, error: deleteError.message })
          }
        } catch (cleanupError) {
          console.error('[driver-signup] auth user cleanup threw', { newUserId, reason, cleanupError })
        }
      }

      if (driver.user_id && driver.user_id !== newUserId) {
        await cleanupNewUser('driver-already-linked')
        return NextResponse.json(
          { error: '이 기사 고유코드는 이미 다른 계정과 연결되어 있습니다. 대리점에 확인해주세요.' },
          { status: 409 },
        )
      }

      const linkError = await linkDriverToUser({
        driver,
        userId: newUserId,
        name: trimmedName,
        email: trimmedEmail,
        phone: trimmedPhone,
        birthDate,
      })

      if (linkError) {
        await cleanupNewUser('driver-link-failed')
        return NextResponse.json({ error: linkError }, { status: 500 })
      }

      return NextResponse.json({
        success: true,
        userId: newUserId,
        driverId: driver.id,
        driverCode: driver.driver_code,
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
        { error: '이미 등록된 이메일이지만 계정을 찾지 못했습니다. 고객센터에 문의해주세요.' },
        { status: 409 },
      )
    }

    const userRole = foundUser.app_metadata?.role as string | undefined
    const oldAgencyId = foundUser.app_metadata?.agency_id as string | undefined

    if (userRole !== 'driver') {
      return NextResponse.json(
        { error: '이미 등록된 이메일입니다. 기사 계정이 아닌 다른 계정으로 사용 중입니다.' },
        { status: 409 },
      )
    }

    if (driver.user_id && driver.user_id !== foundUser.id) {
      return NextResponse.json(
        { error: '이 기사 고유코드는 이미 다른 계정과 연결되어 있습니다. 대리점에 확인해주세요.' },
        { status: 409 },
      )
    }

    if (oldAgencyId && oldAgencyId !== agency.id) {
      const { data: oldDriver } = await supabaseAdmin
        .from('drivers')
        .select('id, status')
        .eq('user_id', foundUser.id)
        .eq('agency_id', oldAgencyId)
        .maybeSingle()

      if (oldDriver && oldDriver.status !== 'inactive') {
        return NextResponse.json(
          { error: '현재 다른 대리점에 재직 중입니다. 기존 대리점에서 퇴사 처리 후 다시 가입해주세요.' },
          { status: 409 },
        )
      }
    }

    // 원자성 보장 순서:
    //   (1) 기존 auth 메타데이터 스냅샷 캡처
    //   (2) auth 메타데이터 갱신 (driver_id, agency_id, role 등) — 실패 시 drivers 미터치, 즉시 중단
    //   (3) drivers 행 갱신 — 실패 시 (2)를 원복해서 반쪽 상태 방지
    //   (4) 비밀번호 갱신 — 가장 마지막 단계 (실패해도 재로그인 시 비번 재설정으로 복구 가능)
    const baseline = await captureAuthMetadata(foundUser.id)
    if (!baseline) {
      return NextResponse.json(
        { error: '기존 계정 정보를 조회하지 못했습니다. 잠시 후 다시 시도해주세요.' },
        { status: 500 },
      )
    }

    const metadataError = await applyDriverAuthMetadata({
      userId: foundUser.id,
      name: trimmedName,
      agencyId: agency.id,
      driver,
      baseline,
    })

    if (metadataError) {
      return NextResponse.json({ error: `계정 메타데이터 갱신에 실패했습니다: ${metadataError}` }, { status: 500 })
    }

    const linkError = await linkDriverToUser({
      driver,
      userId: foundUser.id,
      name: trimmedName,
      email: trimmedEmail,
      phone: trimmedPhone,
      birthDate,
    })

    if (linkError) {
      await restoreAuthMetadata(foundUser.id, baseline)
      return NextResponse.json({ error: linkError }, { status: 500 })
    }

    const passwordError = await updateDriverUserPassword(foundUser.id, password)
    if (passwordError) {
      // drivers/auth 메타데이터는 이미 정상 — 비밀번호만 미반영. 사용자에게 비번 재설정 안내.
      console.error('[driver-signup] password update failed after successful link', {
        userId: foundUser.id,
        error: passwordError,
      })
      return NextResponse.json({
        success: true,
        userId: foundUser.id,
        driverId: driver.id,
        driverCode: driver.driver_code,
        agencyName: agency.name,
        passwordSet: false,
        warning: '계정은 정상 연결되었지만 비밀번호 갱신에 실패했습니다. 비밀번호 재설정 후 로그인해주세요.',
      })
    }

    const wasInactive = driver.status === 'inactive'

    return NextResponse.json({
      success: true,
      userId: foundUser.id,
      driverId: driver.id,
      driverCode: driver.driver_code,
      agencyName: agency.name,
      reinstated: oldAgencyId === agency.id && wasInactive,
      transferred: oldAgencyId !== undefined && oldAgencyId !== agency.id,
      passwordSet: true,
    })
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : '가입 처리에 실패했습니다.' },
      { status: 500 },
    )
  }
}
