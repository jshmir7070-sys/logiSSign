-- ═══════════════════════════════════════════
-- 006: RLS 정책 완전 적용 + 기존 정책 보완
-- M007/S01: 보안 강화 마일스톤
-- ═══════════════════════════════════════════

-- ═══════════════════════════════════════════
-- 1. 누락 정책 추가: contract_amendments
--    기존: amendments_agency (FOR ALL, agency only)
--    추가: 기사도 자기 변경이력 조회 가능
-- ═══════════════════════════════════════════

CREATE POLICY "amendments_driver_read" ON contract_amendments
  FOR SELECT USING (
    driver_id IN (SELECT id FROM drivers WHERE user_id = auth.uid())
  );


-- ═══════════════════════════════════════════
-- 2. 누락 정책 추가: contract_verification_logs
--    기존: verification_logs_read_agency (SELECT only)
--    추가: 서비스에서 INSERT 필요 (공개 진위확인 API)
--    진위확인은 비로그인 상태에서도 호출하므로 service_role로 처리
--    → 별도 INSERT 정책 불필요 (service_role은 RLS 무시)
-- ═══════════════════════════════════════════

-- (의도적 미추가: service_role로 INSERT, 인증 계정 INSERT 불필요)


-- ═══════════════════════════════════════════
-- 3. 누락 정책 추가: integrity_check_results
--    기존: integrity_results_admin (SELECT, provider_admin only)
--    추가: agency_admin도 자기 운영사 관련 결과 조회 가능하도록
--    + INSERT는 cron/manual에서 service_role로 수행
-- ═══════════════════════════════════════════

-- agency_admin은 자기 기관과 관련된 무결성 결과 조회
-- (integrity_check_results에는 agency_id가 없으므로, 운영사별 필터는
--  application layer에서 처리하고, DB에서는 provider_admin만 허용이 적절)
-- → 현행 유지


-- ═══════════════════════════════════════════
-- 4. drivers 테이블: FOR ALL → 세분화
--    위험: 기사가 자기 row를 삭제하거나 agency_id를 변경할 수 있음
-- ═══════════════════════════════════════════

DROP POLICY IF EXISTS "drivers_own" ON drivers;

-- 기사: 자기 프로필 조회
CREATE POLICY "drivers_own_select" ON drivers
  FOR SELECT USING (user_id = auth.uid());

-- 기사: 자기 프로필 일부 수정 (push_token, bank 정보 등)
CREATE POLICY "drivers_own_update" ON drivers
  FOR UPDATE USING (user_id = auth.uid())
  WITH CHECK (user_id = auth.uid());

-- 기사: 삭제 불가 (운영사만 가능)
-- INSERT 불가 (운영사 또는 가입 API(service_role)만 가능)


-- ═══════════════════════════════════════════
-- 5. driver_rates / driver_route_rates / driver_deductions / driver_incentives
--    기존: FOR ALL (agency) → 기사도 자기 단가 조회 필요
-- ═══════════════════════════════════════════

-- driver_rates: 기사 조회 추가
CREATE POLICY "driver_rates_driver_read" ON driver_rates
  FOR SELECT USING (
    driver_id IN (SELECT id FROM drivers WHERE user_id = auth.uid())
  );

-- driver_route_rates: 기사 조회 추가
CREATE POLICY "driver_route_rates_driver_read" ON driver_route_rates
  FOR SELECT USING (
    driver_id IN (SELECT id FROM drivers WHERE user_id = auth.uid())
  );

-- driver_deductions: 기사 조회 추가
CREATE POLICY "driver_deductions_driver_read" ON driver_deductions
  FOR SELECT USING (
    driver_id IN (SELECT id FROM drivers WHERE user_id = auth.uid())
  );

-- driver_incentives: 기사 조회 추가
CREATE POLICY "driver_incentives_driver_read" ON driver_incentives
  FOR SELECT USING (
    driver_id IN (SELECT id FROM drivers WHERE user_id = auth.uid())
  );


-- ═══════════════════════════════════════════
-- 6. driver_contract_periods: 기사 조회 추가
--    기존: contract_periods_agency (FOR ALL, agency only)
-- ═══════════════════════════════════════════

CREATE POLICY "contract_periods_driver_read" ON driver_contract_periods
  FOR SELECT USING (
    driver_id IN (SELECT id FROM drivers WHERE user_id = auth.uid())
  );


-- ═══════════════════════════════════════════
-- 7. education_activity_logs: 운영사 조회 추가
--    기존: education_logs_driver (FOR ALL, driver only)
-- ═══════════════════════════════════════════

CREATE POLICY "education_logs_agency_read" ON education_activity_logs
  FOR SELECT USING (
    record_id IN (
      SELECT id FROM education_records
      WHERE driver_id IN (
        SELECT id FROM drivers
        WHERE agency_id = (auth.jwt()->'app_metadata'->>'agency_id')::uuid
      )
    )
  );


-- ═══════════════════════════════════════════
-- 8. tax_invoices: 기사 조회 추가
--    기존: tax_invoices_agency (FOR ALL)
-- ═══════════════════════════════════════════

CREATE POLICY "tax_invoices_driver_read" ON tax_invoices
  FOR SELECT USING (
    driver_id IN (SELECT id FROM drivers WHERE user_id = auth.uid())
  );


-- ═══════════════════════════════════════════
-- 9. security_logs: INSERT 정책 (service_role 전용)
--    현재 service_role로만 INSERT하므로 RLS 자동 우회.
--    명시적으로 authenticated 계정의 INSERT를 차단하기 위해 확인.
--    → RLS가 활성화되어 있고 INSERT 정책이 없으므로 이미 차단됨.
-- ═══════════════════════════════════════════

-- (의도적 미추가: RLS ON + no INSERT policy = authenticated INSERT 차단)


-- ═══════════════════════════════════════════
-- 9-2. driver_documents: 기사 FOR ALL → SELECT만 허용
--      위험: 기사가 자기 서류를 삭제하거나 위조 서류를 INSERT할 수 있음
-- ═══════════════════════════════════════════

DROP POLICY IF EXISTS "driver_documents_own" ON driver_documents;

CREATE POLICY "driver_documents_own_select" ON driver_documents
  FOR SELECT USING (
    driver_id IN (SELECT id FROM drivers WHERE user_id = auth.uid())
  );

-- 기사의 서류 업로드는 운영사(agency_drivers 정책) 또는 가입 API(service_role)에서만 가능


-- ═══════════════════════════════════════════
-- 9-3. education_records: 기사 FOR ALL → SELECT만 허용
--      위험: 기사가 자기 교육 이수 기록을 조작할 수 있음
-- ═══════════════════════════════════════════

DROP POLICY IF EXISTS "education_records_driver" ON education_records;

CREATE POLICY "education_records_driver_select" ON education_records
  FOR SELECT USING (
    driver_id IN (SELECT id FROM drivers WHERE user_id = auth.uid())
  );


-- ═══════════════════════════════════════════
-- 9-4. education_activity_logs: 기사 FOR ALL → SELECT + INSERT
--      기사는 교육 진행 로그를 기록(INSERT)하고 조회(SELECT)할 수 있지만
--      수정/삭제는 불가
-- ═══════════════════════════════════════════

DROP POLICY IF EXISTS "education_logs_driver" ON education_activity_logs;

CREATE POLICY "education_logs_driver_select" ON education_activity_logs
  FOR SELECT USING (
    record_id IN (
      SELECT id FROM education_records
      WHERE driver_id IN (SELECT id FROM drivers WHERE user_id = auth.uid())
    )
  );

CREATE POLICY "education_logs_driver_insert" ON education_activity_logs
  FOR INSERT WITH CHECK (
    record_id IN (
      SELECT id FROM education_records
      WHERE driver_id IN (SELECT id FROM drivers WHERE user_id = auth.uid())
    )
  );


-- ═══════════════════════════════════════════
-- 10. notices: 기사(driver) 조회 추가
--     기존 notices_read: agency_id 기반 조회만 있고,
--     기사는 agency_id가 아닌 소속 기반으로 조회해야 함
-- ═══════════════════════════════════════════

CREATE POLICY "notices_driver_read" ON notices
  FOR SELECT USING (
    agency_id IN (
      SELECT agency_id FROM drivers WHERE user_id = auth.uid()
    )
    OR target_type = 'all'
  );


-- ═══════════════════════════════════════════
-- 11. settlement_rules / deduction_items / incentive_rules: 기사 조회 추가
-- ═══════════════════════════════════════════

CREATE POLICY "settlement_rules_driver_read" ON settlement_rules
  FOR SELECT USING (
    agency_id IN (SELECT agency_id FROM drivers WHERE user_id = auth.uid())
  );

CREATE POLICY "deduction_items_driver_read" ON deduction_items
  FOR SELECT USING (
    rule_id IN (
      SELECT id FROM settlement_rules
      WHERE agency_id IN (SELECT agency_id FROM drivers WHERE user_id = auth.uid())
    )
  );

CREATE POLICY "incentive_rules_driver_read" ON incentive_rules
  FOR SELECT USING (
    agency_id IN (SELECT agency_id FROM drivers WHERE user_id = auth.uid())
  );


-- ═══════════════════════════════════════════
-- 검증 쿼리 (migration 적용 후 실행)
-- ═══════════════════════════════════════════

-- 아래 쿼리는 migration 적용 후 Supabase SQL Editor에서 실행하여
-- 모든 public 테이블에 RLS가 활성화되어 있는지 확인합니다:
--
-- SELECT schemaname, tablename, rowsecurity
-- FROM pg_tables
-- WHERE schemaname = 'public'
-- ORDER BY tablename;
--
-- RLS가 활성화된 테이블의 정책 수:
--
-- SELECT t.tablename, COUNT(p.policyname) as policy_count
-- FROM pg_tables t
-- LEFT JOIN pg_policies p ON p.tablename = t.tablename AND p.schemaname = t.schemaname
-- WHERE t.schemaname = 'public'
-- GROUP BY t.tablename
-- ORDER BY t.tablename;
