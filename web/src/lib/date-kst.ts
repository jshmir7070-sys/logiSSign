/**
 * 한국 시간(KST, UTC+9) 기반 날짜 유틸리티
 *
 * new Date().toISOString().slice(0,10)은 UTC 기준이라
 * 한국 시간 21:00~23:59 사이에 하루 차이 발생.
 * 이 모듈의 함수를 사용하면 항상 KST 기준 날짜를 반환합니다.
 */

const KST_OFFSET_MS = 9 * 60 * 60 * 1000

/**
 * 현재 KST 날짜 문자열 (YYYY-MM-DD)
 */
export function todayKST(): string {
  const kst = new Date(Date.now() + KST_OFFSET_MS)
  return kst.toISOString().slice(0, 10)
}

/**
 * 현재 KST 기준 연월 (YYYY-MM)
 */
export function currentYearMonthKST(): string {
  const kst = new Date(Date.now() + KST_OFFSET_MS)
  return kst.toISOString().slice(0, 7)
}

/**
 * 날짜 문자열에 일 수 더하기
 */
export function addDays(dateStr: string, days: number): string {
  const d = new Date(dateStr + 'T00:00:00Z')
  d.setUTCDate(d.getUTCDate() + days)
  return d.toISOString().slice(0, 10)
}

/**
 * 날짜 문자열에 년 수 더하기
 */
export function addYears(dateStr: string, years: number): string {
  const d = new Date(dateStr + 'T00:00:00Z')
  d.setUTCFullYear(d.getUTCFullYear() + years)
  return d.toISOString().slice(0, 10)
}

/**
 * KST 기준 현재 ISO 문자열 (TIMESTAMPTZ용)
 */
export function nowISO(): string {
  return new Date().toISOString()
}
