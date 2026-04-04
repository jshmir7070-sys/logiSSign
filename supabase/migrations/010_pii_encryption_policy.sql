-- 010: PII 암호화 정책 및 데이터 삭제/이동 지원
-- 개인정보보호법 제29조 (안전조치 의무) 준수

-- 1. 동의 관리 테이블 (필수/선택 항목 분리)
CREATE TABLE IF NOT EXISTS user_consents (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  agency_id UUID REFERENCES agencies(id) ON DELETE CASCADE,
  consent_type TEXT NOT NULL CHECK (consent_type IN (
    'required_service',        -- 필수: 서비스 이용
    'required_pii',            -- 필수: 개인정보 수집/이용
    'optional_marketing',      -- 선택: 마케팅 정보 수신
    'optional_third_party',    -- 선택: 제3자 제공
    'optional_analytics'       -- 선택: 서비스 분석
  )),
  agreed BOOLEAN NOT NULL DEFAULT false,
  agreed_at TIMESTAMPTZ,
  revoked_at TIMESTAMPTZ,
  ip_address TEXT,
  user_agent TEXT,
  created_at TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_user_consents_user ON user_consents(user_id);
CREATE INDEX IF NOT EXISTS idx_user_consents_type ON user_consents(consent_type);

ALTER TABLE user_consents ENABLE ROW LEVEL SECURITY;

CREATE POLICY "user_consents_own" ON user_consents
  FOR ALL USING (user_id = auth.uid());
CREATE POLICY "user_consents_agency" ON user_consents
  FOR SELECT USING (agency_id = (auth.jwt()->'app_metadata'->>'agency_id')::uuid);
CREATE POLICY "user_consents_admin" ON user_consents
  FOR ALL USING ((auth.jwt()->'app_metadata'->>'role') = 'provider_admin');

-- 2. 데이터 삭제 요청 테이블 (개인정보보호법 제36조)
CREATE TABLE IF NOT EXISTS data_deletion_requests (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id),
  agency_id UUID REFERENCES agencies(id),
  request_type TEXT NOT NULL CHECK (request_type IN ('delete_all', 'delete_partial', 'export')),
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'processing', 'completed', 'rejected')),
  target_data JSONB,              -- 삭제 대상 데이터 범위
  processed_by UUID REFERENCES auth.users(id),
  processed_at TIMESTAMPTZ,
  rejection_reason TEXT,
  created_at TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_deletion_requests_user ON data_deletion_requests(user_id);
CREATE INDEX IF NOT EXISTS idx_deletion_requests_status ON data_deletion_requests(status);

ALTER TABLE data_deletion_requests ENABLE ROW LEVEL SECURITY;

CREATE POLICY "deletion_own" ON data_deletion_requests
  FOR ALL USING (user_id = auth.uid());
CREATE POLICY "deletion_admin" ON data_deletion_requests
  FOR ALL USING ((auth.jwt()->'app_metadata'->>'role') = 'provider_admin');

-- 3. PII 암호화 상태 추적 컬럼 (마이그레이션 진행 추적용)
ALTER TABLE agencies ADD COLUMN IF NOT EXISTS pii_encrypted BOOLEAN DEFAULT false;
ALTER TABLE drivers ADD COLUMN IF NOT EXISTS pii_encrypted BOOLEAN DEFAULT false;
