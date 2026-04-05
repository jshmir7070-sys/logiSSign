-- 011: RLS 정책 수정 — user_metadata → app_metadata
-- user_metadata는 클라이언트에서 조작 가능하므로 보안 취약
-- app_metadata는 서버에서만 설정 가능 (안전)

-- 1. drivers
DROP POLICY IF EXISTS "agency_drivers" ON drivers;
CREATE POLICY "agency_drivers" ON drivers FOR ALL
  USING (agency_id = (auth.jwt()->'app_metadata'->>'agency_id')::uuid);

-- 2. settlements
DROP POLICY IF EXISTS "settlements_agency" ON settlements;
CREATE POLICY "settlements_agency" ON settlements FOR ALL
  USING (agency_id = (auth.jwt()->'app_metadata'->>'agency_id')::uuid);

-- 3. driver_route_rates
DROP POLICY IF EXISTS "agency_route_rates" ON driver_route_rates;
CREATE POLICY "agency_route_rates" ON driver_route_rates FOR ALL
  USING (driver_id IN (
    SELECT id FROM drivers
    WHERE agency_id = (auth.jwt()->'app_metadata'->>'agency_id')::uuid
  ));

-- 4. contract_amendments
DROP POLICY IF EXISTS "agency_amendments" ON contract_amendments;
CREATE POLICY "agency_amendments" ON contract_amendments FOR ALL
  USING (agency_id = (auth.jwt()->'app_metadata'->>'agency_id')::uuid);

-- 5. driver_contract_periods
DROP POLICY IF EXISTS "agency_periods" ON driver_contract_periods;
CREATE POLICY "agency_periods" ON driver_contract_periods FOR ALL
  USING (agency_id = (auth.jwt()->'app_metadata'->>'agency_id')::uuid);

-- 6. payment_history
DROP POLICY IF EXISTS "Agency can view own payments" ON payment_history;
CREATE POLICY "agency_payments" ON payment_history FOR ALL
  USING (agency_id = (auth.jwt()->'app_metadata'->>'agency_id')::uuid);

-- 7. excel_sheet_templates
DROP POLICY IF EXISTS "agency_templates" ON excel_sheet_templates;
CREATE POLICY "agency_templates" ON excel_sheet_templates FOR ALL
  USING (agency_id = (auth.jwt()->'app_metadata'->>'agency_id')::uuid);

-- 8. withholding_receipts
DROP POLICY IF EXISTS "agency_withholding" ON withholding_receipts;
CREATE POLICY "agency_withholding" ON withholding_receipts FOR ALL
  USING (agency_id = (auth.jwt()->'app_metadata'->>'agency_id')::uuid);

-- 9. contract_verification_logs
DROP POLICY IF EXISTS "agency_verification_logs" ON contract_verification_logs;
CREATE POLICY "agency_verification_logs" ON contract_verification_logs FOR ALL
  USING (contract_id IN (
    SELECT id FROM contracts
    WHERE agency_id = (auth.jwt()->'app_metadata'->>'agency_id')::uuid
  ));
