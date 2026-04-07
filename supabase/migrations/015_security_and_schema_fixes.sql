-- 015: 보안 강화 + 스키마 수정
-- 1. contract_signatures 본인인증 ID 컬럼 추가
-- 2. tax_invoices invoice_type CHECK 수정 (코드에서 사용하는 값 허용)
-- 3. contracts 검증 로그 테이블
-- 4. contracts 문서번호 시퀀스

-- ═══════════════════════════════════════
-- 1. contract_signatures: 본인인증 certId 저장
-- ═══════════════════════════════════════
ALTER TABLE contract_signatures
  ADD COLUMN IF NOT EXISTS identity_cert_id TEXT;

COMMENT ON COLUMN contract_signatures.identity_cert_id
  IS '포트원 V2 본인인증 verificationId (서버 재검증용)';

-- ═══════════════════════════════════════
-- 2. tax_invoices: invoice_type CHECK 확장
--    기존: 'tax', 'cash_receipt', 'none'
--    추가: 'vat_invoice' (사업자 세금계산서), 'withholding_3_3' (3.3% 원천징수)
-- ═══════════════════════════════════════
ALTER TABLE tax_invoices DROP CONSTRAINT IF EXISTS tax_invoices_invoice_type_check;
ALTER TABLE tax_invoices ADD CONSTRAINT tax_invoices_invoice_type_check
  CHECK (invoice_type IN ('tax', 'cash_receipt', 'none', 'vat_invoice', 'withholding_3_3'));

-- ═══════════════════════════════════════
-- 3. 계약서 검증 로그 테이블
--    서명 검증, PDF 생성, 원본 대조 등 감사 기록
-- ═══════════════════════════════════════
CREATE TABLE IF NOT EXISTS contract_verification_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  contract_id UUID NOT NULL REFERENCES contracts(id) ON DELETE CASCADE,
  action TEXT NOT NULL,                -- 'signed', 'pdf_generated', 'identity_verified', 'viewed', 'hash_verified'
  actor_type TEXT NOT NULL,            -- 'driver', 'agency', 'system'
  actor_id UUID,                       -- driver_id 또는 user_id
  ip_address TEXT,
  user_agent TEXT,
  details JSONB DEFAULT '{}',          -- 액션별 추가 정보
  created_at TIMESTAMPTZ DEFAULT now()
);

ALTER TABLE contract_verification_logs ENABLE ROW LEVEL SECURITY;

-- 대리점: 소속 계약서 로그 조회
CREATE POLICY "contract_verification_logs_agency" ON contract_verification_logs FOR SELECT
  USING (
    contract_id IN (
      SELECT id FROM contracts
      WHERE agency_id = (auth.jwt()->'app_metadata'->>'agency_id')::uuid
    )
  );

-- 서비스 역할: 전체 접근
CREATE POLICY "contract_verification_logs_service" ON contract_verification_logs FOR ALL
  USING (true) WITH CHECK (true);

CREATE INDEX IF NOT EXISTS idx_contract_verification_logs_contract
  ON contract_verification_logs(contract_id, created_at DESC);

-- ═══════════════════════════════════════
-- 4. 계약서 문서번호 시퀀스 + RPC
--    형식: LOGISSIGN-YYYYMMDD-NNNNN
-- ═══════════════════════════════════════
CREATE SEQUENCE IF NOT EXISTS contract_doc_number_seq START WITH 1 INCREMENT BY 1;

-- contracts에 문서번호 + 타임스탬프 해시 컬럼
ALTER TABLE contracts ADD COLUMN IF NOT EXISTS doc_number TEXT;
ALTER TABLE contracts ADD COLUMN IF NOT EXISTS timestamp_hash TEXT;

-- 문서번호 자동 생성 RPC
CREATE OR REPLACE FUNCTION generate_contract_doc_number()
RETURNS TEXT
LANGUAGE plpgsql
AS $$
DECLARE
  seq_val BIGINT;
  doc_num TEXT;
BEGIN
  seq_val := nextval('contract_doc_number_seq');
  doc_num := 'LOGISSIGN-' || to_char(now(), 'YYYYMMDD') || '-' || lpad(seq_val::text, 5, '0');
  RETURN doc_num;
END;
$$;

-- 계약서 생성 시 자동 문서번호 부여 트리거
CREATE OR REPLACE FUNCTION trigger_set_contract_doc_number()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
BEGIN
  IF NEW.doc_number IS NULL THEN
    NEW.doc_number := generate_contract_doc_number();
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS set_contract_doc_number ON contracts;
CREATE TRIGGER set_contract_doc_number
  BEFORE INSERT ON contracts
  FOR EACH ROW
  EXECUTE FUNCTION trigger_set_contract_doc_number();

-- ════════════════════════════════════���══
-- 5. settlements: 누락 컬럼 추가
--    엑셀 업로드에서 개별 저장되지 않던 필드
-- ═══════════════════════════════════════
ALTER TABLE settlements ADD COLUMN IF NOT EXISTS return_count INTEGER DEFAULT 0;
ALTER TABLE settlements ADD COLUMN IF NOT EXISTS return_amount NUMERIC DEFAULT 0;
ALTER TABLE settlements ADD COLUMN IF NOT EXISTS pickup_count INTEGER DEFAULT 0;
ALTER TABLE settlements ADD COLUMN IF NOT EXISTS pickup_amount NUMERIC DEFAULT 0;
ALTER TABLE settlements ADD COLUMN IF NOT EXISTS fresh_incentive NUMERIC DEFAULT 0;
ALTER TABLE settlements ADD COLUMN IF NOT EXISTS extra_incentive NUMERIC DEFAULT 0;
ALTER TABLE settlements ADD COLUMN IF NOT EXISTS delivery_amount NUMERIC DEFAULT 0;
ALTER TABLE settlements ADD COLUMN IF NOT EXISTS gross_total NUMERIC DEFAULT 0;
ALTER TABLE settlements ADD COLUMN IF NOT EXISTS rate_mode TEXT DEFAULT 'flat';
ALTER TABLE settlements ADD COLUMN IF NOT EXISTS rate_percentage NUMERIC DEFAULT 0;
ALTER TABLE settlements ADD COLUMN IF NOT EXISTS route_details JSONB;
ALTER TABLE settlements ADD COLUMN IF NOT EXISTS pdf_url TEXT;

COMMENT ON COLUMN settlements.pdf_url IS '생성된 정산서 PDF URL (Supabase Storage)';
