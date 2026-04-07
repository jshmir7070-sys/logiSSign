-- ═══════════════════════════════════════
-- 019: RLS 정책 보안 강화
--
-- 1) USING(true) 전체 접근 정책 제거 (service_role은 RLS 자동 우회)
-- 2) FOR ALL 정책 → 작업별 분리 (감사/결제 테이블은 읽기전용)
-- ═══════════════════════════════════════

-- ══════════ PART 1: 위험한 USING(true) 정책 제거 ══════════

-- point_balances: service_role만 쓰기 가능, 대리점은 읽기만
DROP POLICY IF EXISTS "point_balances_service" ON point_balances;
DROP POLICY IF EXISTS "point_balances_agency" ON point_balances;

CREATE POLICY "point_balances_agency_select" ON point_balances
  FOR SELECT USING (
    agency_id = (auth.jwt()->'app_metadata'->>'agency_id')::uuid
  );
-- INSERT/UPDATE/DELETE는 service_role만 (별도 정책 불필요)

-- point_transactions: service_role만 쓰기, 대리점은 읽기만
DROP POLICY IF EXISTS "point_transactions_service" ON point_transactions;
DROP POLICY IF EXISTS "point_transactions_agency" ON point_transactions;

CREATE POLICY "point_transactions_agency_select" ON point_transactions
  FOR SELECT USING (
    agency_id = (auth.jwt()->'app_metadata'->>'agency_id')::uuid
  );

-- contract_verification_logs: 이미 018에서 처리됨, 중복 방지
DROP POLICY IF EXISTS "contract_verification_logs_service" ON contract_verification_logs;

-- template_fields: 대리점 소속 템플릿만 읽기
DROP POLICY IF EXISTS "template_fields_select" ON contract_template_fields;
CREATE POLICY "template_fields_agency_select" ON contract_template_fields
  FOR SELECT USING (
    template_id IN (
      SELECT id FROM contract_templates
      WHERE agency_id = (auth.jwt()->'app_metadata'->>'agency_id')::uuid
         OR is_default = true
    )
  );

-- ══════════ PART 2: FOR ALL 정책 → 작업별 분리 ══════════

-- ── settlements: 읽기 + 쓰기 (삭제 불가) ──
DROP POLICY IF EXISTS "settlements_agency" ON settlements;

CREATE POLICY "settlements_agency_select" ON settlements
  FOR SELECT USING (
    agency_id = (auth.jwt()->'app_metadata'->>'agency_id')::uuid
  );
CREATE POLICY "settlements_agency_insert" ON settlements
  FOR INSERT WITH CHECK (
    agency_id = (auth.jwt()->'app_metadata'->>'agency_id')::uuid
  );
CREATE POLICY "settlements_agency_update" ON settlements
  FOR UPDATE USING (
    agency_id = (auth.jwt()->'app_metadata'->>'agency_id')::uuid
  );
-- DELETE 없음 → 정산 데이터 삭제 불가 (감사 추적)

-- ── payment_history: 읽기 전용 (결제 내역은 불변) ──
DROP POLICY IF EXISTS "agency_payments" ON payment_history;

CREATE POLICY "payment_history_agency_select" ON payment_history
  FOR SELECT USING (
    agency_id = (auth.jwt()->'app_metadata'->>'agency_id')::uuid
  );
-- INSERT/UPDATE/DELETE는 service_role만

-- ── contract_amendments: 읽기 + 생성만 (수정/삭제 불가) ──
DROP POLICY IF EXISTS "agency_amendments" ON contract_amendments;

CREATE POLICY "amendments_agency_select" ON contract_amendments
  FOR SELECT USING (
    agency_id = (auth.jwt()->'app_metadata'->>'agency_id')::uuid
  );
CREATE POLICY "amendments_agency_insert" ON contract_amendments
  FOR INSERT WITH CHECK (
    agency_id = (auth.jwt()->'app_metadata'->>'agency_id')::uuid
  );
-- UPDATE/DELETE 없음 → 변경 이력 보존

-- ── withholding_receipts: 읽기 전용 (세금 문서 불변) ──
DROP POLICY IF EXISTS "agency_withholding" ON withholding_receipts;

CREATE POLICY "withholding_agency_select" ON withholding_receipts
  FOR SELECT USING (
    agency_id = (auth.jwt()->'app_metadata'->>'agency_id')::uuid
  );

-- ── driver_principals: 읽기 + 생성 + 수정 (삭제 불가) ──
DROP POLICY IF EXISTS "dp_agency" ON driver_principals;

CREATE POLICY "driver_principals_select" ON driver_principals
  FOR SELECT USING (
    driver_id IN (
      SELECT id FROM drivers
      WHERE agency_id = (auth.jwt()->'app_metadata'->>'agency_id')::uuid
    )
  );
CREATE POLICY "driver_principals_insert" ON driver_principals
  FOR INSERT WITH CHECK (
    driver_id IN (
      SELECT id FROM drivers
      WHERE agency_id = (auth.jwt()->'app_metadata'->>'agency_id')::uuid
    )
  );
CREATE POLICY "driver_principals_update" ON driver_principals
  FOR UPDATE USING (
    driver_id IN (
      SELECT id FROM drivers
      WHERE agency_id = (auth.jwt()->'app_metadata'->>'agency_id')::uuid
    )
  );

-- ── driver_rates: 읽기 + 생성 + 수정 (삭제는 soft-delete) ──
DROP POLICY IF EXISTS "dr_agency" ON driver_rates;

CREATE POLICY "driver_rates_select" ON driver_rates
  FOR SELECT USING (
    driver_id IN (
      SELECT id FROM drivers
      WHERE agency_id = (auth.jwt()->'app_metadata'->>'agency_id')::uuid
    )
  );
CREATE POLICY "driver_rates_insert" ON driver_rates
  FOR INSERT WITH CHECK (
    driver_id IN (
      SELECT id FROM drivers
      WHERE agency_id = (auth.jwt()->'app_metadata'->>'agency_id')::uuid
    )
  );
CREATE POLICY "driver_rates_update" ON driver_rates
  FOR UPDATE USING (
    driver_id IN (
      SELECT id FROM drivers
      WHERE agency_id = (auth.jwt()->'app_metadata'->>'agency_id')::uuid
    )
  );

-- ── driver_deductions: 읽기 + 생성 + 수정 ──
DROP POLICY IF EXISTS "dd_agency" ON driver_deductions;

CREATE POLICY "driver_deductions_select" ON driver_deductions
  FOR SELECT USING (
    driver_id IN (
      SELECT id FROM drivers
      WHERE agency_id = (auth.jwt()->'app_metadata'->>'agency_id')::uuid
    )
  );
CREATE POLICY "driver_deductions_insert" ON driver_deductions
  FOR INSERT WITH CHECK (
    driver_id IN (
      SELECT id FROM drivers
      WHERE agency_id = (auth.jwt()->'app_metadata'->>'agency_id')::uuid
    )
  );
CREATE POLICY "driver_deductions_update" ON driver_deductions
  FOR UPDATE USING (
    driver_id IN (
      SELECT id FROM drivers
      WHERE agency_id = (auth.jwt()->'app_metadata'->>'agency_id')::uuid
    )
  );

-- ── plan_change_log: provider_admin 읽기 + 생성만 ──
DROP POLICY IF EXISTS "plan_change_log_provider" ON plan_change_log;

CREATE POLICY "plan_change_log_select" ON plan_change_log
  FOR SELECT USING (
    (auth.jwt()->'app_metadata'->>'role') = 'provider_admin'
    OR agency_id = (auth.jwt()->'app_metadata'->>'agency_id')::uuid
  );
CREATE POLICY "plan_change_log_insert" ON plan_change_log
  FOR INSERT WITH CHECK (
    (auth.jwt()->'app_metadata'->>'role') = 'provider_admin'
    OR agency_id = (auth.jwt()->'app_metadata'->>'agency_id')::uuid
  );
-- UPDATE/DELETE 없음 → 로그 불변
