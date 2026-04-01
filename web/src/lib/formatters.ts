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
