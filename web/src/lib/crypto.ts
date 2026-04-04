/**
 * PII 필드 암호화/복호화 유틸리티
 *
 * AES-256-GCM 기반 — 개인정보보호법 제29조 (안전조치 의무) 준수
 * 암호화 대상: 계좌번호, 전화번호, 생년월일 등 고유식별정보
 *
 * 환경변수: PII_ENCRYPTION_KEY (32바이트 hex = 64자리)
 *   생성: node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"
 */

const ALGORITHM = 'AES-GCM'
const KEY_LENGTH = 256
const IV_LENGTH = 12  // GCM 권장 IV 길이
const TAG_LENGTH = 128 // 인증 태그 비트 수

function getEncryptionKey(): string {
  const key = process.env.PII_ENCRYPTION_KEY
  if (!key || key.length !== 64) {
    // 개발환경 폴백 (프로덕션에서는 절대 이 값 사용 금지)
    if (process.env.NODE_ENV === 'production') {
      throw new Error('[CRYPTO] PII_ENCRYPTION_KEY 환경변수가 설정되지 않았습니다 (64자리 hex)')
    }
    return 'a'.repeat(64) // dev fallback
  }
  return key
}

function hexToBytes(hex: string): Uint8Array {
  const bytes = new Uint8Array(hex.length / 2)
  for (let i = 0; i < hex.length; i += 2) {
    bytes[i / 2] = parseInt(hex.substring(i, i + 2), 16)
  }
  return bytes
}

function bytesToHex(bytes: Uint8Array): string {
  return Array.from(bytes).map(b => b.toString(16).padStart(2, '0')).join('')
}

async function importKey(keyHex: string): Promise<CryptoKey> {
  return crypto.subtle.importKey(
    'raw',
    hexToBytes(keyHex),
    { name: ALGORITHM, length: KEY_LENGTH },
    false,
    ['encrypt', 'decrypt']
  )
}

/**
 * PII 필드 암호화
 * @returns "iv_hex:ciphertext_hex" 형식 (DB 저장용)
 */
export async function encryptPii(plaintext: string): Promise<string> {
  if (!plaintext) return ''

  const key = await importKey(getEncryptionKey())
  const iv = crypto.getRandomValues(new Uint8Array(IV_LENGTH))
  const encoded = new TextEncoder().encode(plaintext)

  const encrypted = await crypto.subtle.encrypt(
    { name: ALGORITHM, iv, tagLength: TAG_LENGTH },
    key,
    encoded
  )

  return `${bytesToHex(iv)}:${bytesToHex(new Uint8Array(encrypted))}`
}

/**
 * PII 필드 복호화
 * @param ciphertext "iv_hex:ciphertext_hex" 형식
 */
export async function decryptPii(ciphertext: string): Promise<string> {
  if (!ciphertext || !ciphertext.includes(':')) return ciphertext // 평문 호환

  const [ivHex, dataHex] = ciphertext.split(':')
  if (!ivHex || !dataHex) return ciphertext

  try {
    const key = await importKey(getEncryptionKey())
    const iv = hexToBytes(ivHex)
    const data = hexToBytes(dataHex)

    const decrypted = await crypto.subtle.decrypt(
      { name: ALGORITHM, iv, tagLength: TAG_LENGTH },
      key,
      data
    )

    return new TextDecoder().decode(decrypted)
  } catch {
    // 복호화 실패 → 이미 평문이거나 키 불일치
    return ciphertext
  }
}

/**
 * 마스킹 유틸 (UI 표시용)
 */
export function maskBankAccount(account: string): string {
  if (!account || account.length < 6) return '***'
  return account.slice(0, 3) + '*'.repeat(account.length - 6) + account.slice(-3)
}

export function maskPhone(phone: string): string {
  const clean = phone.replace(/[^0-9]/g, '')
  if (clean.length >= 11) return `${clean.slice(0, 3)}-****-${clean.slice(7)}`
  if (clean.length >= 10) return `${clean.slice(0, 3)}-***-${clean.slice(6)}`
  return `***-****-${clean.slice(-4)}`
}

export function maskBirthDate(birth: string): string {
  if (!birth || birth.length < 6) return '****-**-**'
  return birth.slice(0, 4) + '-**-**'
}

/**
 * 여러 PII 필드 일괄 암호화 (DB 저장 전 호출)
 */
export async function encryptPiiFields<T extends Record<string, unknown>>(
  record: T,
  fields: (keyof T)[]
): Promise<T> {
  const result = { ...record }
  for (const field of fields) {
    const val = result[field]
    if (typeof val === 'string' && val) {
      (result as Record<string, unknown>)[field as string] = await encryptPii(val)
    }
  }
  return result
}

/**
 * 여러 PII 필드 일괄 복호화 (DB 조회 후 호출)
 */
export async function decryptPiiFields<T extends Record<string, unknown>>(
  record: T,
  fields: (keyof T)[]
): Promise<T> {
  const result = { ...record }
  for (const field of fields) {
    const val = result[field]
    if (typeof val === 'string' && val) {
      (result as Record<string, unknown>)[field as string] = await decryptPii(val)
    }
  }
  return result
}
