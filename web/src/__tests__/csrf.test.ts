import { describe, it, expect } from 'vitest'
import { csrfCheck } from '@/lib/csrf'

// NextRequest 모킹
function mockRequest(method: string, pathname: string, headers: Record<string, string> = {}): any {
  return {
    method,
    nextUrl: { pathname },
    headers: {
      get: (name: string) => headers[name.toLowerCase()] ?? null,
    },
  }
}

describe('CSRF 검증', () => {
  it('GET 요청 → 통과', () => {
    const result = csrfCheck(mockRequest('GET', '/api/contracts/send'))
    expect(result).toBeNull()
  })

  it('POST + 허용된 origin → 통과', () => {
    const result = csrfCheck(mockRequest('POST', '/api/contracts/send', {
      origin: 'https://logissign.com',
    }))
    expect(result).toBeNull()
  })

  it('POST + 잘못된 origin → 차단', () => {
    const result = csrfCheck(mockRequest('POST', '/api/contracts/send', {
      origin: 'https://evil.com',
    }))
    expect(result).not.toBeNull()
  })

  it('공개 API (driver-signup) → CSRF 면제', () => {
    const result = csrfCheck(mockRequest('POST', '/api/auth/driver-signup', {
      origin: 'https://evil.com',
    }))
    expect(result).toBeNull()
  })

  it('공개 API (verify) → CSRF 면제', () => {
    const result = csrfCheck(mockRequest('POST', '/api/verify', {
      origin: 'https://evil.com',
    }))
    expect(result).toBeNull()
  })

  it('POST + origin/referer 없음 → 통과 (서버간 호출)', () => {
    const result = csrfCheck(mockRequest('POST', '/api/payment'))
    expect(result).toBeNull()
  })
})
