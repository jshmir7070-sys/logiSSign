import { describe, it, expect } from 'vitest'
import { addDays, addYears } from '@/lib/date-kst'

describe('addDays', () => {
  it('+1일', () => expect(addDays('2025-03-15', 1)).toBe('2025-03-16'))
  it('+30일 (월 넘김)', () => expect(addDays('2025-01-15', 30)).toBe('2025-02-14'))
  it('-1일', () => expect(addDays('2025-01-01', -1)).toBe('2024-12-31'))
  it('윤년 2월 28→29', () => expect(addDays('2024-02-28', 1)).toBe('2024-02-29'))
  it('윤년 아닌 해 2월 28→3/1', () => expect(addDays('2025-02-28', 1)).toBe('2025-03-01'))
  it('+0일', () => expect(addDays('2025-06-15', 0)).toBe('2025-06-15'))
  it('+365일', () => expect(addDays('2025-01-01', 365)).toBe('2026-01-01'))
})

describe('addYears', () => {
  it('+1년', () => expect(addYears('2025-03-15', 1)).toBe('2026-03-15'))
  it('+2년', () => expect(addYears('2025-06-01', 2)).toBe('2027-06-01'))
  it('-1년', () => expect(addYears('2025-03-15', -1)).toBe('2024-03-15'))
  it('윤년 2/29 + 1년 → 3/1 (JS Date 기본 동작)', () => expect(addYears('2024-02-29', 1)).toBe('2025-03-01'))
})
