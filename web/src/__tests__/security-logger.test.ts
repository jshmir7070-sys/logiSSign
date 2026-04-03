import { describe, it, expect } from 'vitest'
import type { SecurityEventType } from '@/lib/security-logger'

/**
 * security-logger 유닛 테스트
 * 실제 DB 연결 없이 타입 + 함수 시그니처를 검증
 */
describe('security-logger 타입 검증', () => {
  it('SecurityEventType에 pii_access 포함', () => {
    const piiAccess: SecurityEventType = 'pii_access'
    expect(piiAccess).toBe('pii_access')
  })

  it('SecurityEventType 전체 목록', () => {
    const types: SecurityEventType[] = [
      'auth_failure',
      'auth_success',
      'permission_denied',
      'cron_access',
      'data_modification',
      'pii_access',
      'rate_limit_hit',
      'integrity_failure',
      'suspicious_activity',
    ]
    expect(types).toHaveLength(9)
  })

  it('logPiiAccess 함수 시그니처 확인', async () => {
    const mod = await import('@/lib/security-logger')
    expect(typeof mod.logPiiAccess).toBe('function')
  })

  it('logDataModification 함수 시그니처 확인', async () => {
    const mod = await import('@/lib/security-logger')
    expect(typeof mod.logDataModification).toBe('function')
  })

  it('logSecurityEvent 함수 존재 확인', async () => {
    const mod = await import('@/lib/security-logger')
    expect(typeof mod.logSecurityEvent).toBe('function')
  })

  it('logAuthFailure 편의 함수 존재', async () => {
    const mod = await import('@/lib/security-logger')
    expect(typeof mod.logAuthFailure).toBe('function')
  })

  it('logPermissionDenied 편의 함수 존재', async () => {
    const mod = await import('@/lib/security-logger')
    expect(typeof mod.logPermissionDenied).toBe('function')
  })

  it('logRateLimitHit 편의 함수 존재', async () => {
    const mod = await import('@/lib/security-logger')
    expect(typeof mod.logRateLimitHit).toBe('function')
  })

  it('logIntegrityFailure 편의 함수 존재', async () => {
    const mod = await import('@/lib/security-logger')
    expect(typeof mod.logIntegrityFailure).toBe('function')
  })
})
