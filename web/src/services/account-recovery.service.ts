import { createAdminSupabaseClient } from '@/lib/supabase'

export type RecoveryAccountType = 'agency' | 'admin' | 'driver'

type AuthUser = {
  id: string
  email: string | null
  user_metadata?: Record<string, unknown>
  app_metadata?: Record<string, unknown>
}

type AgencyRow = {
  id: string
  email: string | null
  owner_name: string | null
  phone: string | null
}

type DriverRow = {
  id: string
  agency_id: string | null
  user_id: string | null
  email: string | null
  name: string | null
  phone: string | null
  driver_code: string | null
}

export function normalizeRecoveryName(name: string | null | undefined) {
  return String(name ?? '').trim().replace(/\s+/g, '').toLowerCase()
}

export function normalizeRecoveryPhone(phone: string | null | undefined) {
  return String(phone ?? '').replace(/[^0-9]/g, '')
}

export function normalizeRecoveryEmail(email: string | null | undefined) {
  return String(email ?? '').trim().toLowerCase()
}

export function maskRecoveryEmail(email: string) {
  const [localPart, domain] = email.split('@')
  if (!domain || localPart.length <= 3) return `${localPart[0] ?? '*'}***@${domain ?? ''}`
  return `${localPart.slice(0, 3)}***${localPart.slice(-2)}@${domain}`
}

async function listAllAuthUsers() {
  const supabase = createAdminSupabaseClient()
  const users: AuthUser[] = []
  let page = 1

  while (true) {
    const { data, error } = await supabase.auth.admin.listUsers({ page, perPage: 100 })
    if (error) throw new Error(error.message)
    const chunk = (data?.users ?? []) as AuthUser[]
    users.push(...chunk)
    if (chunk.length < 100) break
    page += 1
  }

  return users
}

async function findProviderAdminByPhone(params: { phone: string; name?: string; email?: string }) {
  const phone = normalizeRecoveryPhone(params.phone)
  const name = normalizeRecoveryName(params.name)
  const email = normalizeRecoveryEmail(params.email)
  const users = await listAllAuthUsers()

  return (
    users.find((user) => {
      const role = user.app_metadata?.role
      const userPhone = normalizeRecoveryPhone(String(user.user_metadata?.phone ?? ''))
      const userName = normalizeRecoveryName(String(user.user_metadata?.name ?? ''))
      const userEmail = normalizeRecoveryEmail(user.email)

      if (role !== 'provider_admin' || userPhone !== phone) return false
      if (name && userName && userName !== name) return false
      if (email && userEmail !== email) return false
      return true
    }) ?? null
  )
}

export async function findAccountIdByNameAndPhone(params: {
  accountType: RecoveryAccountType
  name: string
  phone: string
}) {
  const supabase = createAdminSupabaseClient()
  const normalizedName = normalizeRecoveryName(params.name)
  const normalizedPhone = normalizeRecoveryPhone(params.phone)

  if (params.accountType === 'agency') {
    const { data, error } = await supabase
      .from('agencies')
      .select('id, email, owner_name, phone')
      .eq('phone', normalizedPhone)

    if (error) throw new Error(error.message)

    const match = ((data ?? []) as AgencyRow[]).find(
      (agency) =>
        normalizeRecoveryName(agency.owner_name) === normalizedName &&
        normalizeRecoveryPhone(agency.phone) === normalizedPhone &&
        !!agency.email
    )

    if (!match?.email) return null

    return {
      accountType: 'agency' as const,
      lookupKey: `agency:${match.id}`,
      email: match.email,
      phone: normalizedPhone,
      name: match.owner_name ?? params.name,
      userId: null,
    }
  }

  if (params.accountType === 'driver') {
    const { data, error } = await supabase
      .from('drivers')
      .select('id, agency_id, user_id, email, name, phone, driver_code')
      .eq('phone', normalizedPhone)

    if (error) throw new Error(error.message)

    const match = ((data ?? []) as DriverRow[]).find(
      (driver) =>
        normalizeRecoveryName(driver.name) === normalizedName &&
        normalizeRecoveryPhone(driver.phone) === normalizedPhone &&
        !!driver.email
    )

    if (!match?.email) return null

    return {
      accountType: 'driver' as const,
      lookupKey: `driver:${match.id}`,
      email: match.email,
      phone: normalizedPhone,
      name: match.name ?? params.name,
      userId: match.user_id,
      driverId: match.id,
      driverCode: match.driver_code,
    }
  }

  const admin = await findProviderAdminByPhone({ phone: normalizedPhone, name: params.name })
  if (!admin?.email) return null

  return {
    accountType: 'admin' as const,
    lookupKey: `admin:${admin.id}`,
    email: admin.email,
    phone: normalizedPhone,
    name: String(admin.user_metadata?.name ?? params.name),
    userId: admin.id,
  }
}

export async function findAccountForPasswordReset(params: {
  accountType: RecoveryAccountType
  email: string
  name?: string
  phone: string
}) {
  const supabase = createAdminSupabaseClient()
  const normalizedEmail = normalizeRecoveryEmail(params.email)
  const normalizedPhone = normalizeRecoveryPhone(params.phone)
  const normalizedName = normalizeRecoveryName(params.name)

  if (params.accountType === 'agency') {
    const { data, error } = await supabase
      .from('agencies')
      .select('id, email, owner_name, phone')
      .eq('email', normalizedEmail)
      .eq('phone', normalizedPhone)

    if (error) throw new Error(error.message)

    const agency = ((data ?? []) as AgencyRow[]).find((row) => {
      if (normalizeRecoveryPhone(row.phone) !== normalizedPhone) return false
      if (normalizedName && normalizeRecoveryName(row.owner_name) !== normalizedName) return false
      return true
    })

    if (!agency) return null

    const users = await listAllAuthUsers()
    const authUser =
      users.find(
        (user) =>
          normalizeRecoveryEmail(user.email) === normalizedEmail &&
          String(user.app_metadata?.agency_id ?? '') === agency.id
      ) ?? null

    if (!authUser) return null

    return {
      accountType: 'agency' as const,
      lookupKey: `agency:${agency.id}`,
      email: normalizedEmail,
      phone: normalizedPhone,
      userId: authUser.id,
      name: agency.owner_name ?? params.name ?? '',
    }
  }

  if (params.accountType === 'driver') {
    const { data, error } = await supabase
      .from('drivers')
      .select('id, agency_id, user_id, email, name, phone, driver_code')
      .eq('email', normalizedEmail)
      .eq('phone', normalizedPhone)

    if (error) throw new Error(error.message)

    const driver = ((data ?? []) as DriverRow[]).find((row) => {
      if (normalizeRecoveryPhone(row.phone) !== normalizedPhone) return false
      if (normalizedName && normalizeRecoveryName(row.name) !== normalizedName) return false
      return true
    })

    if (!driver?.user_id) return null

    return {
      accountType: 'driver' as const,
      lookupKey: `driver:${driver.id}`,
      email: normalizedEmail,
      phone: normalizedPhone,
      userId: driver.user_id,
      name: driver.name ?? params.name ?? '',
      driverId: driver.id,
      driverCode: driver.driver_code,
    }
  }

  const admin = await findProviderAdminByPhone({
    phone: normalizedPhone,
    name: params.name,
    email: normalizedEmail,
  })
  if (!admin) return null

  return {
    accountType: 'admin' as const,
    lookupKey: `admin:${admin.id}`,
    email: normalizedEmail,
    phone: normalizedPhone,
    userId: admin.id,
    name: String(admin.user_metadata?.name ?? params.name ?? ''),
  }
}
