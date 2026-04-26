import { createHash, randomInt, timingSafeEqual } from 'crypto'
import { createAdminSupabaseClient } from '@/lib/supabase'

export type VerificationPurpose =
  | 'agency_find_id'
  | 'agency_reset_password'
  | 'admin_find_id'
  | 'admin_reset_password'
  | 'driver_find_id'
  | 'driver_reset_password'
  | 'login_mfa'
  | 'contract_signer'

type VerificationPayload = Record<string, unknown>

type VerificationRow = {
  verification_key: string
  purpose: VerificationPurpose
  phone: string
  code_hash: string
  payload: VerificationPayload | null
  attempts: number
  max_attempts: number
  expires_at: string
  resend_available_at: string
  verified_at: string | null
}

function hashVerificationCode(verificationKey: string, purpose: VerificationPurpose, code: string) {
  return createHash('sha256')
    .update(`${purpose}:${verificationKey}:${code}`)
    .digest('hex')
}

function hashesMatch(left: string, right: string) {
  const leftBuffer = Buffer.from(left, 'hex')
  const rightBuffer = Buffer.from(right, 'hex')
  if (leftBuffer.length !== rightBuffer.length) return false
  return timingSafeEqual(leftBuffer, rightBuffer)
}

export function normalizePhoneForVerification(phone: string) {
  return String(phone ?? '').replace(/[^0-9]/g, '')
}

export function generateVerificationCode() {
  return String(randomInt(100000, 1000000))
}

function secondsBetween(targetIso: string, now: Date) {
  const diff = new Date(targetIso).getTime() - now.getTime()
  return Math.max(0, Math.ceil(diff / 1000))
}

export async function issueVerificationCode(params: {
  verificationKey: string
  purpose: VerificationPurpose
  phone: string
  code: string
  payload?: VerificationPayload
  ttlSeconds?: number
  resendCooldownSeconds?: number
  maxAttempts?: number
}) {
  const supabase = createAdminSupabaseClient()
  const verificationKey = params.verificationKey.trim()
  const phone = normalizePhoneForVerification(params.phone)
  const ttlSeconds = params.ttlSeconds ?? 300
  const resendCooldownSeconds = params.resendCooldownSeconds ?? 60
  const maxAttempts = params.maxAttempts ?? 5
  const now = new Date()

  const { data: existing, error: fetchError } = await supabase
    .from('auth_verification_codes')
    .select(
      'verification_key, purpose, phone, code_hash, payload, attempts, max_attempts, expires_at, resend_available_at, verified_at'
    )
    .eq('verification_key', verificationKey)
    .eq('purpose', params.purpose)
    .maybeSingle()

  if (fetchError) {
    throw new Error(fetchError.message)
  }

  const existingRow = existing as VerificationRow | null
  if (existingRow && new Date(existingRow.resend_available_at).getTime() > now.getTime()) {
    return {
      issued: false,
      waitSeconds: secondsBetween(existingRow.resend_available_at, now),
    }
  }

  const expiresAt = new Date(now.getTime() + ttlSeconds * 1000).toISOString()
  const resendAvailableAt = new Date(now.getTime() + resendCooldownSeconds * 1000).toISOString()

  const { error } = await supabase
    .from('auth_verification_codes')
    .upsert(
      {
        verification_key: verificationKey,
        purpose: params.purpose,
        phone,
        code_hash: hashVerificationCode(verificationKey, params.purpose, params.code),
        payload: params.payload ?? {},
        attempts: 0,
        max_attempts: maxAttempts,
        expires_at: expiresAt,
        resend_available_at: resendAvailableAt,
        verified_at: null,
      },
      { onConflict: 'verification_key,purpose' }
    )

  if (error) {
    throw new Error(error.message)
  }

  return {
    issued: true,
    expiresInSeconds: ttlSeconds,
  }
}

export async function verifyVerificationCode(params: {
  verificationKey: string
  purpose: VerificationPurpose
  code: string
  mode?: 'consume' | 'mark-verified'
}) {
  const supabase = createAdminSupabaseClient()
  const verificationKey = params.verificationKey.trim()
  const now = new Date()

  const { data, error } = await supabase
    .from('auth_verification_codes')
    .select(
      'verification_key, purpose, phone, code_hash, payload, attempts, max_attempts, expires_at, resend_available_at, verified_at'
    )
    .eq('verification_key', verificationKey)
    .eq('purpose', params.purpose)
    .maybeSingle()

  if (error) {
    throw new Error(error.message)
  }

  const row = data as VerificationRow | null
  if (!row) {
    return { valid: false, error: '인증번호가 만료되었거나 다시 요청이 필요합니다.' }
  }

  if (new Date(row.expires_at).getTime() <= now.getTime()) {
    await supabase
      .from('auth_verification_codes')
      .delete()
      .eq('verification_key', verificationKey)
      .eq('purpose', params.purpose)
    return { valid: false, error: '인증번호가 만료되었습니다. 다시 요청해주세요.' }
  }

  const hashedInput = hashVerificationCode(verificationKey, params.purpose, params.code.trim())
  const matches = hashesMatch(row.code_hash, hashedInput)
  const nextAttempts = row.attempts + 1

  if (!matches) {
    if (nextAttempts >= row.max_attempts) {
      await supabase
        .from('auth_verification_codes')
        .delete()
        .eq('verification_key', verificationKey)
        .eq('purpose', params.purpose)
      return { valid: false, error: '인증 시도 횟수를 초과했습니다. 다시 요청해주세요.' }
    }

    await supabase
      .from('auth_verification_codes')
      .update({ attempts: nextAttempts })
      .eq('verification_key', verificationKey)
      .eq('purpose', params.purpose)

    return {
      valid: false,
      error: `인증번호가 일치하지 않습니다. (${row.max_attempts - nextAttempts}회 남음)`,
    }
  }

  if ((params.mode ?? 'consume') === 'mark-verified') {
    await supabase
      .from('auth_verification_codes')
      .update({ verified_at: now.toISOString(), attempts: nextAttempts })
      .eq('verification_key', verificationKey)
      .eq('purpose', params.purpose)

    return {
      valid: true,
      phone: row.phone,
      payload: row.payload ?? {},
    }
  }

  await supabase
    .from('auth_verification_codes')
    .delete()
    .eq('verification_key', verificationKey)
    .eq('purpose', params.purpose)

  return {
    valid: true,
    phone: row.phone,
    payload: row.payload ?? {},
  }
}

export async function consumeVerifiedCode(params: {
  verificationKey: string
  purpose: VerificationPurpose
}) {
  const supabase = createAdminSupabaseClient()
  const verificationKey = params.verificationKey.trim()
  const now = new Date()

  const { data, error } = await supabase
    .from('auth_verification_codes')
    .select(
      'verification_key, purpose, phone, code_hash, payload, attempts, max_attempts, expires_at, resend_available_at, verified_at'
    )
    .eq('verification_key', verificationKey)
    .eq('purpose', params.purpose)
    .maybeSingle()

  if (error) {
    throw new Error(error.message)
  }

  const row = data as VerificationRow | null
  if (!row || !row.verified_at) {
    return { valid: false, error: '휴대폰 인증을 먼저 완료해주세요.' }
  }

  if (new Date(row.expires_at).getTime() <= now.getTime()) {
    await supabase
      .from('auth_verification_codes')
      .delete()
      .eq('verification_key', verificationKey)
      .eq('purpose', params.purpose)
    return { valid: false, error: '인증 세션이 만료되었습니다. 다시 요청해주세요.' }
  }

  await supabase
    .from('auth_verification_codes')
    .delete()
    .eq('verification_key', verificationKey)
    .eq('purpose', params.purpose)

  return {
    valid: true,
    phone: row.phone,
    payload: row.payload ?? {},
  }
}
