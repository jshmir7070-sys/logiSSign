import { describe, it, expect } from 'vitest'
import { csrfCheck } from '@/lib/csrf'

import type { NextRequest } from 'next/server'

// NextRequest 모킹 — 최소한의 필수 속성만 구현
function mockRequest(method: string, pathname: string, headers: Record<string, string> = {}): NextRequest {
  return {
    method,
    nextUrl: { pathname },
    headers: {
      get: (name: string) => headers[name.toLowerCase()] ?? null,
    },
  } as unknown as NextRequest
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
