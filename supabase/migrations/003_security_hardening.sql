-- ═══════════════════════════════════════════
-- 003: RLS 보안 강화 + 누락 컬럼 + 스토리지 수정
-- Supabase SQL Editor에서 실행
-- ═══════════════════════════════════════════

-- 1. RLS 오버퍼미시브 정책 수정 (CRITICAL)

-- seals
DROP POLICY IF EXISTS "seals_select" ON seals;
DROP POLICY IF EXISTS "seals_insert" ON seals;
DROP POLICY IF EXISTS "seals_update" ON seals;
DROP POLICY IF EXISTS "seals_delete" ON seals;
DROP POLICY IF EXISTS "seals_all" ON seals;

CREATE POLICY "seals_select" ON seals FOR SELECT USING (
  (owner_type = 'agency' AND owner_id = (auth.jwt()->'app_metadata'->>'agency_id')::uuid)
  OR (owner_type = 'driver' AND owner_id IN (SELECT id FROM drivers WHERE user_id = auth.uid()))
);
CREATE POLICY "seals_insert" ON seals FOR INSERT WITH CHECK (
  (owner_type = 'agency' AND owner_id = (auth.jwt()->'app_metadata'->>'agency_id')::uuid)
  OR (owner_type = 'driver' AND owner_id IN (SELECT id FROM drivers WHERE user_id = auth.uid()))
);
CREATE POLICY "seals_update" ON seals FOR UPDATE USING (
  (owner_type = 'agency' AND owner_id = (auth.jwt()->'app_metadata'->>'agency_id')::uuid)
  OR (owner_type = 'driver' AND owner_id IN (SELECT id FROM drivers WHERE user_id = auth.uid()))
);
CREATE POLICY "seals_delete" ON seals FOR DELETE USING (
  (owner_type = 'agency' AND owner_id = (auth.jwt()->'app_metadata'->>'agency_id')::uuid)
  OR (owner_type = 'driver' AND owner_id IN (SELECT id FROM drivers WHERE user_id = auth.uid()))
);

-- document_files
DROP POLICY IF EXISTS "doc_files_select" ON document_files;
DROP POLICY IF EXISTS "doc_files_insert" ON document_files;
DROP POLICY IF EXISTS "doc_files_update" ON document_files;
DROP POLICY IF EXISTS "doc_files_delete" ON document_files;

CREATE POLICY "doc_files_select" ON document_files FOR SELECT USING (
  agency_id = (auth.jwt()->'app_metadata'->>'agency_id')::uuid
);
CREATE POLICY "doc_files_insert" ON document_files FOR INSERT WITH CHECK (
  agency_id = (auth.jwt()->'app_metadata'->>'agency_id')::uuid
);
CREATE POLICY "doc_files_update" ON document_files FOR UPDATE USING (
  agency_id = (auth.jwt()->'app_metadata'->>'agency_id')::uuid
);
CREATE POLICY "doc_files_delete" ON document_files FOR DELETE USING (
  agency_id = (auth.jwt()->'app_metadata'->>'agency_id')::uuid
);

-- document_deliveries
DROP POLICY IF EXISTS "doc_delivery_select" ON document_deliveries;
DROP POLICY IF EXISTS "doc_delivery_insert" ON document_deliveries;
DROP POLICY IF EXISTS "doc_delivery_update" ON document_deliveries;
DROP POLICY IF EXISTS "doc_delivery_delete" ON document_deliveries;

CREATE POLICY "doc_delivery_select" ON document_deliveries FOR SELECT USING (
  agency_id = (auth.jwt()->'app_metadata'->>'agency_id')::uuid
  OR driver_id IN (SELECT id FROM drivers WHERE user_id = auth.uid())
);
CREATE POLICY "doc_delivery_insert" ON document_deliveries FOR INSERT WITH CHECK (
  agency_id = (auth.jwt()->'app_metadata'->>'agency_id')::uuid
);
CREATE POLICY "doc_delivery_update" ON document_deliveries FOR UPDATE USING (
  agency_id = (auth.jwt()->'app_metadata'->>'agency_id')::uuid
  OR driver_id IN (SELECT id FROM drivers WHERE user_id = auth.uid())
);
CREATE POLICY "doc_delivery_delete" ON document_deliveries FOR DELETE USING (
  agency_id = (auth.jwt()->'app_metadata'->>'agency_id')::uuid
);

-- document_sign_fields (기사도 서명 시 필드를 읽어야 하므로 SELECT은 인증 사용자 전체 허용)
DROP POLICY IF EXISTS "sign_fields_select" ON document_sign_fields;
DROP POLICY IF EXISTS "sign_fields_insert" ON document_sign_fields;
DROP POLICY IF EXISTS "sign_fields_update" ON document_sign_fields;
DROP POLICY IF EXISTS "sign_fields_delete" ON document_sign_fields;

CREATE POLICY "sign_fields_select" ON document_sign_fields FOR SELECT USING (auth.role() = 'authenticated');
CREATE POLICY "sign_fields_insert" ON document_sign_fields FOR INSERT WITH CHECK (
  document_file_id IN (SELECT id FROM document_files WHERE agency_id = (auth.jwt()->'app_metadata'->>'agency_id')::uuid)
);
CREATE POLICY "sign_fields_update" ON document_sign_fields FOR UPDATE USING (
  document_file_id IN (SELECT id FROM document_files WHERE agency_id = (auth.jwt()->'app_metadata'->>'agency_id')::uuid)
);
CREATE POLICY "sign_fields_delete" ON document_sign_fields FOR DELETE USING (
  document_file_id IN (SELECT id FROM document_files WHERE agency_id = (auth.jwt()->'app_metadata'->>'agency_id')::uuid)
);

-- document_sign_responses
DROP POLICY IF EXISTS "sign_resp_select" ON document_sign_responses;
DROP POLICY IF EXISTS "sign_resp_insert" ON document_sign_responses;
DROP POLICY IF EXISTS "sign_resp_update" ON document_sign_responses;

CREATE POLICY "sign_resp_select" ON document_sign_responses FOR SELECT USING (
  driver_id IN (SELECT id FROM drivers WHERE user_id = auth.uid())
  OR delivery_id IN (SELECT id FROM document_deliveries WHERE agency_id = (auth.jwt()->'app_metadata'->>'agency_id')::uuid)
);
CREATE POLICY "sign_resp_insert" ON document_sign_responses FOR INSERT WITH CHECK (
  driver_id IN (SELECT id FROM drivers WHERE user_id = auth.uid())
);
CREATE POLICY "sign_resp_update" ON document_sign_responses FOR UPDATE USING (
  driver_id IN (SELECT id FROM drivers WHERE user_id = auth.uid())
);

-- 2. 스토리지 버킷 private 확인 (이미 실행했으면 무시)
UPDATE storage.buckets SET public = false WHERE id IN ('contracts', 'documents', 'education');

-- 3. 누락 컬럼 추가
ALTER TABLE agencies ADD COLUMN IF NOT EXISTS templates_locked BOOLEAN DEFAULT false;
ALTER TABLE agencies ADD COLUMN IF NOT EXISTS privacy_officer_name TEXT;
ALTER TABLE agencies ADD COLUMN IF NOT EXISTS privacy_officer_phone TEXT;
ALTER TABLE agencies ADD COLUMN IF NOT EXISTS privacy_officer_email TEXT;
ALTER TABLE drivers ADD COLUMN IF NOT EXISTS bank_name TEXT;
ALTER TABLE drivers ADD COLUMN IF NOT EXISTS bank_account TEXT;
ALTER TABLE drivers ADD COLUMN IF NOT EXISTS bank_holder TEXT;
ALTER TABLE driver_documents ADD COLUMN IF NOT EXISTS title TEXT;
ALTER TABLE subscriptions ADD COLUMN IF NOT EXISTS billing_key TEXT;
ALTER TABLE subscriptions ADD COLUMN IF NOT EXISTS card_name TEXT;
ALTER TABLE subscriptions ADD COLUMN IF NOT EXISTS card_number_masked TEXT;
ALTER TABLE subscriptions ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ;

-- driver_documents type 확장
ALTER TABLE driver_documents DROP CONSTRAINT IF EXISTS driver_documents_type_check;
ALTER TABLE driver_documents ADD CONSTRAINT driver_documents_type_check
  CHECK (type IN ('license','vehicle_registration','cargo_license','bankbook','insurance','id_card','business_reg','other'));

-- driver_contract_periods 누락 컬럼
ALTER TABLE driver_contract_periods ADD COLUMN IF NOT EXISTS rate_config JSONB;
ALTER TABLE driver_contract_periods ADD COLUMN IF NOT EXISTS amendment_id UUID;
ALTER TABLE driver_contract_periods ADD COLUMN IF NOT EXISTS memo TEXT;

-- 4. 성능 인덱스 추가
CREATE INDEX IF NOT EXISTS idx_education_records_driver ON education_records(driver_id);
CREATE INDEX IF NOT EXISTS idx_education_records_course ON education_records(course_id);
CREATE INDEX IF NOT EXISTS idx_contract_amendments_agency ON contract_amendments(agency_id);
CREATE INDEX IF NOT EXISTS idx_contract_amendments_driver ON contract_amendments(driver_id);
CREATE INDEX IF NOT EXISTS idx_security_logs_created ON security_logs(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_security_logs_event ON security_logs(event_type);
CREATE INDEX IF NOT EXISTS idx_notices_agency_status ON notices(agency_id, status);
CREATE INDEX IF NOT EXISTS idx_settlements_agency_month ON settlements(agency_id, year_month);
