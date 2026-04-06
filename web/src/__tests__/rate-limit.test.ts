import { describe, it, expect } from 'vitest'
import { checkRateLimit, rateLimitPublic, rateLimitAuth } from '@/lib/rate-limit'

describe('rate-limit', () => {
  // Rate limiter는 메모리 store를 사용하므로 테스트 간 간섭 가능
  // 각 테스트마다 고유한 IP+endpoint 조합 사용

  describe('checkRateLimit', () => {
    it('첫 요청 → 통과 (null)', () => {
      const result = checkRateLimit('1.1.1.1', '/test-1', { maxRequests: 5, windowMs: 60000 })
      expect(result).toBeNull()
    })

    it('제한 내 요청 → 통과', () => {
      const ip = '2.2.2.2'
      const endpoint = '/test-2'
      for (let i = 0; i < 5; i++) {
        const result = checkRateLimit(ip, endpoint, { maxRequests: 5, windowMs: 60000 })
        expect(result).toBeNull()
      }
    })

    it('제한 초과 → 429 응답', () => {
      const ip = '3.3.3.3'
      const endpoint = '/test-3'
      // 5건 허용
      for (let i = 0; i < 5; i++) {
        checkRateLimit(ip, endpoint, { maxRequests: 5, windowMs: 60000 })
      }
      // 6번째 → 차단
      const result = checkRateLimit(ip, endpoint, { maxRequests: 5, windowMs: 60000 })
      expect(result).not.toBeNull()
      expect(result!.status).toBe(429)
    })

    it('다른 IP → 독립 카운트', () => {
      const endpoint = '/test-4'
      // IP A에서 5건 소진
      for (let i = 0; i < 5; i++) {
        checkRateLimit('4.4.4.1', endpoint, { maxRequests: 5, windowMs: 60000 })
      }
      // IP B는 별도 카운트 → 통과
      const result = checkRateLimit('4.4.4.2', endpoint, { maxRequests: 5, windowMs: 60000 })
      expect(result).toBeNull()
    })

    it('다른 endpoint → 독립 카운트', () => {
      const ip = '5.5.5.5'
      for (let i = 0; i < 5; i++) {
        checkRateLimit(ip, '/test-5a', { maxRequests: 5, windowMs: 60000 })
      }
      const result = checkRateLimit(ip, '/test-5b', { maxRequests: 5, windowMs: 60000 })
      expect(result).toBeNull()
    })

    it('429 응답에 Retry-After 헤더 포함', () => {
      const ip = '6.6.6.6'
      const endpoint = '/test-6'
      for (let i = 0; i < 6; i++) {
        checkRateLimit(ip, endpoint, { maxRequests: 5, windowMs: 60000 })
      }
      const result = checkRateLimit(ip, endpoint, { maxRequests: 5, windowMs: 60000 })
      expect(result).not.toBeNull()
      expect(result!.headers.get('Retry-After')).toBeTruthy()
      expect(result!.headers.get('X-RateLimit-Remaining')).toBe('0')
    })
  })

  describe('rateLimitPublic', () => {
    it('분당 10회 제한', () => {
      const ip = '7.7.7.7'
      for (let i = 0; i < 10; i++) {
        expect(rateLimitPublic(ip, '/public-test')).toBeNull()
      }
      expect(rateLimitPublic(ip, '/public-test')).not.toBeNull()
    })
  })

  describe('rateLimitAuth', () => {
    it('분당 60회 제한', () => {
      const ip = '8.8.8.8'
      for (let i = 0; i < 60; i++) {
        expect(rateLimitAuth(ip, '/auth-test')).toBeNull()
      }
      expect(rateLimitAuth(ip, '/auth-test')).not.toBeNull()
    })
  })
})
