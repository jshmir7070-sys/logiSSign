import { createAdminSupabaseClient } from '@/lib/supabase'

/**
 * 보안 이벤트 로깅 모듈
 * 인증 실패, 권한 거부, 데이터 변경 등을 security_logs 테이블에 기록
 */

export type SecurityEventType =
  | 'auth_failure'        // 인증 실패
  | 'auth_success'        // 인증 성공 (로그인)
  | 'permission_denied'   // 권한 거부
  | 'cron_access'         // CRON 접근 (성공/실패)
  | 'data_modification'   // 민감 데이터 변경
  | 'rate_limit_hit'      // Rate limit 초과
  | 'integrity_failure'   // 무결성 검사 실패
  | 'suspicious_activity' // 의심스러운 활동

interface SecurityLogEntry {
  event_type: SecurityEventType
  actor_id?: string       // user ID (있으면)
  actor_ip?: string
  actor_user_agent?: string
  resource?: string       // 대상 리소스 (테이블/엔드포인트)
  resource_id?: string    // 대상 ID
  details?: Record<string, unknown>
  severity: 'info' | 'warning' | 'critical'
}

/**
 * 보안 이벤트 기록
 * 실패해도 주요 로직에 영향 없음 (fire-and-forget)
 */
export async function logSecurityEvent(entry: SecurityLogEntry): Promise<void> {
  try {
    const supabase = createAdminSupabaseClient()
    await supabase.from('security_logs').insert({
      event_type: entry.event_type,
      actor_id: entry.actor_id ?? null,
      actor_ip: entry.actor_ip ?? null,
      actor_user_agent: entry.actor_user_agent ?? null,
      resource: entry.resource ?? null,
      resource_id: entry.resource_id ?? null,
      details: entry.details ?? {},
      severity: entry.severity,
    })
  } catch {
    // 로깅 실패는 주요 로직에 영향 없음
    console.error('[SecurityLog] 기록 실패:', entry.event_type)
  }
}

// ── 편의 함수 ──

export function logAuthFailure(ip: string, endpoint: string, reason: string) {
  return logSecurityEvent({
    event_type: 'auth_failure',
    actor_ip: ip,
    resource: endpoint,
    details: { reason },
    severity: 'warning',
  })
}

export function logPermissionDenied(userId: string, ip: string, endpoint: string) {
  return logSecurityEvent({
    event_type: 'permission_denied',
    actor_id: userId,
    actor_ip: ip,
    resource: endpoint,
    severity: 'warning',
  })
}

export function logRateLimitHit(ip: string, endpoint: string) {
  return logSecurityEvent({
    event_type: 'rate_limit_hit',
    actor_ip: ip,
    resource: endpoint,
    severity: 'warning',
  })
}

export function logIntegrityFailure(contractId: string, reasons: string[]) {
  return logSecurityEvent({
    event_type: 'integrity_failure',
    resource: 'contracts',
    resource_id: contractId,
    details: { reasons },
    severity: 'critical',
  })
}
