/**
 * KRW 포맷터 — 한국 원화 형식
 */
export const formatKRW = (amount: number): string => {
  return '₩' + amount.toLocaleString('ko-KR')
}

/**
 * 년월 포맷터 — '2025-03' → '2025년 3월'
 */
export const formatYearMonth = (ym: string): string => {
  const [y, m] = ym.split('-')
  return `${y}년 ${parseInt(m)}월`
}

/**
 * 날짜 포맷터 — ISO → '2025.03.15'
 */
export const formatDate = (date: string | Date): string => {
  const d = new Date(date)
  return `${d.getFullYear()}.${String(d.getMonth() + 1).padStart(2, '0')}.${String(d.getDate()).padStart(2, '0')}`
}

/**
 * 숫자 축약 — 100000000 → '1억'
 */
export const formatCompact = (num: number): string => {
  if (num >= 100000000) return `${(num / 100000000).toFixed(1)}억`
  if (num >= 10000) return `${(num / 10000).toFixed(0)}만`
  return num.toLocaleString('ko-KR')
}

/**
 * 퍼센트 변화량 포맷
 */
export const formatChange = (value: number): string => {
  const prefix = value >= 0 ? '+' : ''
  return `${prefix}${value.toFixed(1)}%`
}

/* ══════════════════════════════════════════════════
   자동 하이픈 포맷터 — 입력 시 실시간 적용
   ══════════════════════════════════════════════════ */

/**
 * 사업자등록번호: 000-00-00000
 */
export function formatBusinessNumber(value: string): string {
  const digits = value.replace(/\D/g, '').slice(0, 10)
  if (digits.length <= 3) return digits
  if (digits.length <= 5) return `${digits.slice(0, 3)}-${digits.slice(3)}`
  return `${digits.slice(0, 3)}-${digits.slice(3, 5)}-${digits.slice(5)}`
}

/**
 * 전화번호: 010-0000-0000 또는 02-000-0000 등
 */
export function formatPhoneNumber(value: string): string {
  const digits = value.replace(/\D/g, '').slice(0, 11)
  if (digits.startsWith('02')) {
    if (digits.length <= 2) return digits
    if (digits.length <= 5) return `${digits.slice(0, 2)}-${digits.slice(2)}`
    if (digits.length <= 9) return `${digits.slice(0, 2)}-${digits.slice(2, 5)}-${digits.slice(5)}`
    return `${digits.slice(0, 2)}-${digits.slice(2, 6)}-${digits.slice(6)}`
  }
  if (digits.length <= 3) return digits
  if (digits.length <= 7) return `${digits.slice(0, 3)}-${digits.slice(3)}`
  return `${digits.slice(0, 3)}-${digits.slice(3, 7)}-${digits.slice(7)}`
}

/**
 * 생년월일: 0000-00-00
 */
export function formatBirthDate(value: string): string {
  const digits = value.replace(/\D/g, '').slice(0, 8)
  if (digits.length <= 4) return digits
  if (digits.length <= 6) return `${digits.slice(0, 4)}-${digits.slice(4)}`
  return `${digits.slice(0, 4)}-${digits.slice(4, 6)}-${digits.slice(6)}`
}

/**
 * 계약번호: XXXX-XXXX-XXXX (4자리 구분)
 * 숫자+영문 허용, 12자리까지
 */
export function formatContractNumber(value: string): string {
  const clean = value.replace(/[^A-Za-z0-9]/g, '').slice(0, 12).toUpperCase()
  if (clean.length <= 4) return clean
  if (clean.length <= 8) return `${clean.slice(0, 4)}-${clean.slice(4)}`
  return `${clean.slice(0, 4)}-${clean.slice(4, 8)}-${clean.slice(8)}`
}

/* ── 은행별 계좌번호 포맷 ── */

const BANK_ACCOUNT_FORMATS: Record<string, number[]> = {
  // 은행명: [각 구간 자릿수]
  '국민은행':   [3, 6, 2, 3],   // 000-000000-00-000  (14자리)
  'KB국민은행': [3, 6, 2, 3],
  '신한은행':   [3, 3, 6],      // 000-000-000000     (12자리)
  '우리은행':   [4, 3, 6],      // 0000-000-000000    (13자리)
  '하나은행':   [3, 6, 5],      // 000-000000-00000   (14자리)
  'KEB하나은행':[3, 6, 5],
  '농협':       [3, 4, 4, 2],   // 000-0000-0000-00   (13자리)
  'NH농협':     [3, 4, 4, 2],
  'NH농협은행': [3, 4, 4, 2],
  '기업은행':   [3, 6, 2, 3],   // 000-000000-00-000  (14자리)
  'IBK기업은행':[3, 6, 2, 3],
  '카카오뱅크': [4, 2, 7],      // 0000-00-0000000    (13자리)
  '토스뱅크':   [4, 4, 4],      // 0000-0000-0000     (12자리)
  '케이뱅크':   [3, 3, 6],      // 000-000-000000     (12자리)
  'SC제일은행': [3, 2, 6],      // 000-00-000000      (11자리)
  '대구은행':   [3, 2, 6, 1],   // 000-00-000000-0    (12자리)
  '부산은행':   [3, 4, 4, 2],   // 000-0000-0000-00   (13자리)
  '경남은행':   [3, 4, 4, 2],
  '광주은행':   [3, 3, 6],
  '전북은행':   [3, 2, 7],      // 000-00-0000000     (12자리)
  '제주은행':   [3, 2, 6],
  '수협':       [3, 2, 6, 1],
  '수협은행':   [3, 2, 6, 1],
  '산업은행':   [3, 6, 4],      // 000-000000-0000    (13자리)
  '우체국':     [6, 2, 6],      // 000000-00-000000   (14자리)
  '새마을금고': [4, 2, 6],      // 0000-00-000000     (12자리)
  '신협':       [3, 3, 6],
  '씨티은행':   [3, 6, 3],      // 000-000000-000     (12자리)
}

/**
 * 은행명에 따른 계좌번호 자동 하이픈
 * bankName이 없거나 매칭되지 않으면 4자리씩 기본 구분
 */
export function formatBankAccount(value: string, bankName?: string): string {
  const digits = value.replace(/\D/g, '')

  // 은행 포맷 매칭
  const format = bankName ? BANK_ACCOUNT_FORMATS[bankName] : undefined
  if (format) {
    const maxLen = format.reduce((a, b) => a + b, 0)
    const trimmed = digits.slice(0, maxLen)
    const parts: string[] = []
    let pos = 0
    for (const len of format) {
      if (pos >= trimmed.length) break
      parts.push(trimmed.slice(pos, pos + len))
      pos += len
    }
    return parts.join('-')
  }

  // 기본: 4자리씩 구분 (최대 16자리)
  const trimmed = digits.slice(0, 16)
  const parts: string[] = []
  for (let i = 0; i < trimmed.length; i += 4) {
    parts.push(trimmed.slice(i, i + 4))
  }
  return parts.join('-')
}

/**
 * 은행 목록 (select 옵션용)
 */
export const BANK_LIST = [
  'KB국민은행', '신한은행', '우리은행', '하나은행', 'NH농협은행',
  'IBK기업은행', '카카오뱅크', '토스뱅크', '케이뱅크',
  'SC제일은행', '대구은행', '부산은행', '경남은행', '광주은행',
  '전북은행', '제주은행', '수협은행', '산업은행', '우체국',
  '새마을금고', '신협', '씨티은행',
] as const
