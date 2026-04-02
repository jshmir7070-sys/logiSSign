import { describe, it, expect } from 'vitest'
import { generateVerificationCode, getVerificationPageUrl } from '@/services/verification.service'

describe('generateVerificationCode', () => {
  it('8자리 문자열', () => {
    const code = generateVerificationCode()
    expect(code).toHaveLength(8)
  })

  it('허용 문자만 포함 (O/0, I/1 제외)', () => {
    for (let i = 0; i < 10; i++) {
      const code = generateVerificationCode()
      expect(code).toMatch(/^[ABCDEFGHJKLMNPQRSTUVWXYZ23456789]{8}$/)
    }
  })

  it('매 호출마다 다른 값 (높은 확률)', () => {
    const codes = new Set<string>()
    for (let i = 0; i < 20; i++) {
      codes.add(generateVerificationCode())
    }
    expect(codes.size).toBeGreaterThan(15) // 20개 중 15개 이상 고유
  })
})

describe('getVerificationPageUrl', () => {
  it('기본 URL', () => {
    const url = getVerificationPageUrl('ABCD1234')
    expect(url).toContain('/verify/ABCD1234')
  })

  it('URL 형식', () => {
    const url = getVerificationPageUrl('TESTCODE')
    expect(url).toMatch(/^https?:\/\/.+\/verify\/TESTCODE$/)
  })
})
