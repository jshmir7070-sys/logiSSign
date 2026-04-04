/**
 * MFA (Multi-Factor Authentication) — 로그인 2단계 인증
 *
 * 플로우:
 *  1. 이메일+비밀번호 로그인 성공
 *  2. /api/auth/send-login-otp → 등록된 휴대폰으로 6자리 OTP 발송
 *  3. /portal/verify-otp 또는 /admin/verify-otp 에서 OTP 입력
 *  4. /api/auth/verify-login-otp → OTP 검증 → MFA 쿠키 발급
 *  5. middleware에서 세션 + MFA 쿠키 동시 검증
 *
 * MFA 쿠키는 세션 쿠키 (브라우저 닫으면 삭제) → 재접속 시 OTP 재인증 필수
 */

// ── 상수 ──
export const MFA_COOKIE = '__logissign_mfa'
export const OTP_TTL_MS = 5 * 60 * 1000        // OTP 유효기간: 5분
export const OTP_MAX_ATTEMPTS = 5               // OTP 최대 시도 횟수
export const MFA_TOKEN_TTL_MS = 24 * 60 * 60 * 1000 // MFA 토큰 최대 유효기간: 24시간
export const OTP_RESEND_COOLDOWN_MS = 30 * 1000 // 재발송 쿨다운: 30초

// ── HMAC-SHA256 서명 (Edge + Node.js 호환) ──
async function hmacSign(data: string, secret: string): Promise<string> {
  const enc = new TextEncoder()
  const key = await crypto.subtle.importKey(
    'raw',
    enc.encode(secret),
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['sign']
  )
  const sig = await crypto.subtle.sign('HMAC', key, enc.encode(data))
  return Array.from(new Uint8Array(sig))
    .map((b) => b.toString(16).padStart(2, '0'))
    .join('')
}

function getHmacSecret(): string {
  return process.env.MFA_HMAC_SECRET || process.env.SUPABASE_SERVICE_ROLE_KEY || ''
}

// ── MFA 토큰 생성/검증 ──

/** MFA 토큰 생성 (OTP 검증 성공 후 쿠키에 저장) */
export async function generateMfaToken(userId: string): Promise<string> {
  const ts = Date.now().toString()
  const sig = await hmacSign(`${userId}:${ts}`, getHmacSecret())
  return `${userId}:${ts}:${sig}`
}

/** MFA 토큰 검증 (middleware에서 호출) */
export async function verifyMfaToken(
  token: string,
  expectedUserId?: string
): Promise<boolean> {
  try {
    if (!token) return false
    const parts = token.split(':')
    if (parts.length !== 3) return false

    const [uid, ts, sig] = parts
    const timestamp = parseInt(ts, 10)
    if (isNaN(timestamp)) return false
    if (Date.now() - timestamp > MFA_TOKEN_TTL_MS) return false
    if (expectedUserId && uid !== expectedUserId) return false

    const secret = getHmacSecret()
    if (!secret) return false

    const expected = await hmacSign(`${uid}:${ts}`, secret)
    // 타이밍 세이프 비교
    if (sig.length !== expected.length) return false
    let mismatch = 0
    for (let i = 0; i < sig.length; i++) {
      mismatch |= sig.charCodeAt(i) ^ expected.charCodeAt(i)
    }
    return mismatch === 0
  } catch {
    return false
  }
}

// ── OTP 저장소 (인메모리, TTL 기반) ──

// ── OTP 저장소 (globalThis 기반, HMR/모듈 재로드에도 유지) ──

interface OtpEntry {
  code: string
  expiresAt: number
  attempts: number
  phone: string
  sentAt: number
}

const globalForOtp = globalThis as unknown as { __otpStore?: Map<string, OtpEntry> }
if (!globalForOtp.__otpStore) {
  globalForOtp.__otpStore = new Map<string, OtpEntry>()
}
const otpStore = globalForOtp.__otpStore

// 만료된 항목 정기 정리 (메모리 누수 방지) — 중복 등록 방지
const globalForTimer = globalThis as unknown as { __otpCleanupSet?: boolean }
if (!globalForTimer.__otpCleanupSet) {
  globalForTimer.__otpCleanupSet = true
  setInterval(() => {
    const now = Date.now()
    const keys = Array.from(otpStore.keys())
    for (const key of keys) {
      const entry = otpStore.get(key)
      if (entry && now > entry.expiresAt + 60_000) otpStore.delete(key)
    }
  }, 60_000)
}

/** OTP 저장 */
export function storeOtp(userId: string, code: string, phone: string): void {
  otpStore.set(userId, {
    code,
    expiresAt: Date.now() + OTP_TTL_MS,
    attempts: 0,
    phone,
    sentAt: Date.now(),
  })
}

/** OTP 재발송 가능 여부 (쿨다운 체크) */
export function canResendOtp(userId: string): { canResend: boolean; waitMs: number } {
  const entry = otpStore.get(userId)
  if (!entry) return { canResend: true, waitMs: 0 }
  const elapsed = Date.now() - entry.sentAt
  if (elapsed >= OTP_RESEND_COOLDOWN_MS) return { canResend: true, waitMs: 0 }
  return { canResend: false, waitMs: OTP_RESEND_COOLDOWN_MS - elapsed }
}

/** OTP 검증 */
export function verifyOtp(
  userId: string,
  code: string
): { valid: boolean; error?: string } {
  const entry = otpStore.get(userId)
  if (!entry) {
    return { valid: false, error: '인증번호를 먼저 요청해주세요.' }
  }
  if (Date.now() > entry.expiresAt) {
    otpStore.delete(userId)
    return { valid: false, error: '인증번호가 만료되었습니다. 다시 요청해주세요.' }
  }
  entry.attempts++
  if (entry.attempts > OTP_MAX_ATTEMPTS) {
    otpStore.delete(userId)
    return { valid: false, error: '인증 시도 횟수를 초과했습니다. 다시 요청해주세요.' }
  }
  if (entry.code !== code) {
    const remaining = OTP_MAX_ATTEMPTS - entry.attempts
    return {
      valid: false,
      error: `인증번호가 일치하지 않습니다. (${remaining}회 남음)`,
    }
  }
  otpStore.delete(userId) // 일회용
  return { valid: true }
}

/** 6자리 OTP 코드 생성 */
export function generateOtpCode(): string {
  const array = new Uint32Array(1)
  crypto.getRandomValues(array)
  return (100000 + (array[0] % 900000)).toString()
}

/** 전화번호 마스킹 (010-****-5678) */
export function maskPhone(phone: string): string {
  const clean = phone.replace(/[^0-9]/g, '')
  if (clean.length >= 11) return `${clean.slice(0, 3)}-****-${clean.slice(7)}`
  if (clean.length >= 10) return `${clean.slice(0, 3)}-***-${clean.slice(6)}`
  return `***-****-${clean.slice(-4)}`
}
