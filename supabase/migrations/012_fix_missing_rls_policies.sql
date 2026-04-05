-- 012: driver 관련 테이블 RLS 정책 추가
-- driver_principals, driver_rates, driver_deductions: RLS 활성화 상태지만 정책 0개 → 전부 차단됨

-- 1. driver_principals: 소속 대리점 기사 연결
CREATE POLICY "dp_agency" ON driver_principals FOR ALL
  USING (driver_id IN (
    SELECT id FROM drivers WHERE agency_id = (auth.jwt()->'app_metadata'->>'agency_id')::uuid
  ));

-- 2. driver_rates: 소속 대리점 기사 단가
CREATE POLICY "dr_agency" ON driver_rates FOR ALL
  USING (driver_id IN (
    SELECT id FROM drivers WHERE agency_id = (auth.jwt()->'app_metadata'->>'agency_id')::uuid
  ));

-- 3. driver_deductions: 소속 대리점 기사 공제
CREATE POLICY "dd_agency" ON driver_deductions FOR ALL
  USING (driver_id IN (
    SELECT id FROM drivers WHERE agency_id = (auth.jwt()->'app_metadata'->>'agency_id')::uuid
  ));
