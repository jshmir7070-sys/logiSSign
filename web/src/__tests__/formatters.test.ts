import { describe, it, expect } from 'vitest'
import {
  formatKRW,
  formatYearMonth,
  formatDate,
  formatCompact,
  formatChange,
  formatBusinessNumber,
  formatPhoneNumber,
  formatBirthDate,
  formatContractNumber,
  formatBankAccount,
} from '@/lib/formatters'

describe('formatKRW', () => {
  it('0원', () => expect(formatKRW(0)).toBe('₩0'))
  it('양수', () => expect(formatKRW(1234567)).toBe('₩1,234,567'))
  it('음수', () => expect(formatKRW(-500)).toBe('₩-500'))
})

describe('formatYearMonth', () => {
  it('2025-03 → 2025년 3월', () => expect(formatYearMonth('2025-03')).toBe('2025년 3월'))
  it('2026-12 → 2026년 12월', () => expect(formatYearMonth('2026-12')).toBe('2026년 12월'))
})

describe('formatDate', () => {
  it('ISO → YYYY.MM.DD', () => {
    const result = formatDate('2025-03-15T09:00:00Z')
    expect(result).toMatch(/^2025\.03\.1[45]$/) // TZ 차이 허용
  })
  it('Date 객체', () => {
    const result = formatDate(new Date('2025-01-01T00:00:00Z'))
    expect(result).toMatch(/^20(24|25)\./)
  })
})

describe('formatCompact', () => {
  it('1억 이상', () => expect(formatCompact(150000000)).toBe('1.5억'))
  it('1만 이상', () => expect(formatCompact(50000)).toBe('5만'))
  it('1만 미만', () => expect(formatCompact(9999)).toBe('9,999'))
  it('0', () => expect(formatCompact(0)).toBe('0'))
})

describe('formatChange', () => {
  it('양수 → +', () => expect(formatChange(12.34)).toBe('+12.3%'))
  it('음수 → -', () => expect(formatChange(-5.6)).toBe('-5.6%'))
  it('0 → +0.0%', () => expect(formatChange(0)).toBe('+0.0%'))
})

describe('formatBusinessNumber', () => {
  it('000-00-00000', () => expect(formatBusinessNumber('1234567890')).toBe('123-45-67890'))
  it('부분 입력', () => expect(formatBusinessNumber('12345')).toBe('123-45'))
  it('3자리 이하', () => expect(formatBusinessNumber('12')).toBe('12'))
  it('하이픈 포함 입력', () => expect(formatBusinessNumber('123-45-678')).toBe('123-45-678'))
})

describe('formatPhoneNumber', () => {
  it('010-0000-0000', () => expect(formatPhoneNumber('01012345678')).toBe('010-1234-5678'))
  it('02 번호', () => expect(formatPhoneNumber('0212345678')).toBe('02-1234-5678'))
  it('부분 입력 010-', () => expect(formatPhoneNumber('01012')).toBe('010-12'))
  it('하이픈 제거', () => expect(formatPhoneNumber('010-1234-5678')).toBe('010-1234-5678'))
})

describe('formatBirthDate', () => {
  it('0000-00-00', () => expect(formatBirthDate('19900315')).toBe('1990-03-15'))
  it('부분 입력', () => expect(formatBirthDate('199003')).toBe('1990-03'))
  it('4자리 이하', () => expect(formatBirthDate('1990')).toBe('1990'))
})

describe('formatContractNumber', () => {
  it('XXXX-XXXX-XXXX', () => expect(formatContractNumber('abcd12345678')).toBe('ABCD-1234-5678'))
  it('8자리', () => expect(formatContractNumber('ABCD1234')).toBe('ABCD-1234'))
  it('4자리 이하', () => expect(formatContractNumber('AB')).toBe('AB'))
})

describe('formatBankAccount', () => {
  it('국민은행 포맷', () => {
    expect(formatBankAccount('12345678901234', 'KB국민은행')).toBe('123-456789-01-234')
  })
  it('카카오뱅크 포맷', () => {
    expect(formatBankAccount('1234567890123', '카카오뱅크')).toBe('1234-56-7890123')
  })
  it('은행 없으면 4자리 기본', () => {
    expect(formatBankAccount('1234567890')).toBe('1234-5678-90')
  })
  it('하이픈 자동 제거 후 포맷', () => {
    // 입력 '123-456-7890' → digits '1234567890' (10자리) → 신한 포맷 3-3-6 → '123-456-7890'
    expect(formatBankAccount('123-456-7890', '신한은행')).toBe('123-456-7890')
  })
})
