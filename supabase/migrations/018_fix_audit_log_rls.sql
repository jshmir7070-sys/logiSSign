-- ═══════════════════════════════════════
-- 018: 감사 로그 RLS 정책 보안 강화
-- 기존 contract_verification_logs_service 정책이
-- 모든 인증 사용자에게 전체 접근 권한을 부여하고 있어 수정
-- service_role은 RLS를 자동 우회하므로 별도 정책 불필요
-- ═══════════════════════════════════════

-- 1. 위험한 전체 접근 정책 제거
DROP POLICY IF EXISTS "contract_verification_logs_service" ON contract_verification_logs;

-- 2. 대리점 관리자는 자기 대리점 로그만 읽기 가능 (INSERT/UPDATE/DELETE 불가)
CREATE POLICY "contract_verification_logs_agency_read" ON contract_verification_logs
  FOR SELECT USING (
    contract_id IN (
      SELECT id FROM contracts
      WHERE agency_id = (auth.jwt()->'app_metadata'->>'agency_id')::uuid
    )
  );

-- 3. 기사는 자기 계약서 로그만 읽기 가능
CREATE POLICY "contract_verification_logs_driver_read" ON contract_verification_logs
  FOR SELECT USING (
    contract_id IN (
      SELECT c.id FROM contracts c
      JOIN drivers d ON c.driver_id = d.id
      WHERE d.user_id = auth.uid()
    )
  );

-- 4. INSERT는 서버(service_role)만 가능 → 별도 정책 없음 (service_role은 RLS 우회)

-- ═══════════════════════════════════════
-- 5. user_consents를 append-only로 변경 (감사 추적 보호)
-- ═══════════════════════════════════════
DROP POLICY IF EXISTS "user_consents_own" ON user_consents;

-- 사용자는 자기 동의 이력 조회 + 새 동의 추가만 가능 (수정/삭제 불가)
CREATE POLICY "user_consents_select_own" ON user_consents
  FOR SELECT USING (user_id = auth.uid());

CREATE POLICY "user_consents_insert_own" ON user_consents
  FOR INSERT WITH CHECK (user_id = auth.uid());
