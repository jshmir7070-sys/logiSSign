-- ═══════════════════════════════════════════
-- 007: PII 접근 감사 로그 이벤트 타입 추가
-- M007/S03: 보안 강화 마일스톤
-- ═══════════════════════════════════════════

-- security_logs event_type 확장: pii_access 추가
ALTER TABLE security_logs DROP CONSTRAINT IF EXISTS security_logs_event_type_check;
ALTER TABLE security_logs ADD CONSTRAINT security_logs_event_type_check
  CHECK (event_type IN (
    'auth_failure', 'auth_success', 'permission_denied',
    'cron_access', 'data_modification', 'pii_access',
    'rate_limit_hit', 'integrity_failure', 'suspicious_activity'
  ));

-- PII 접근 로그 전용 인덱스 (감사 조회 성능)
CREATE INDEX IF NOT EXISTS idx_security_logs_pii ON security_logs(event_type, resource, created_at DESC)
  WHERE event_type = 'pii_access';
