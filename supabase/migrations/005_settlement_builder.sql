-- ═══════════════════════════════════════════
-- 005: 커스텀 정산서 빌더 테이블
-- Supabase SQL Editor에서 실행
-- ═══════════════════════════════════════════

-- 정산서 템플릿
CREATE TABLE IF NOT EXISTS settlement_templates (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  agency_id UUID REFERENCES agencies(id) ON DELETE CASCADE,
  name VARCHAR(100) NOT NULL,
  description TEXT,
  template_config JSONB NOT NULL DEFAULT '{}',
  column_mapping JSONB,
  is_default BOOLEAN DEFAULT false,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- 정산 작업 이력
CREATE TABLE IF NOT EXISTS settlement_jobs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  agency_id UUID REFERENCES agencies(id) ON DELETE CASCADE,
  template_id UUID REFERENCES settlement_templates(id) ON DELETE SET NULL,
  uploaded_file_url TEXT NOT NULL,
  original_filename TEXT,
  status VARCHAR(20) DEFAULT 'queued' CHECK (status IN ('queued','processing','completed','failed','cancelled')),
  total_drivers INT NOT NULL DEFAULT 0,
  completed_drivers INT DEFAULT 0,
  failed_drivers INT DEFAULT 0,
  output_url TEXT,
  output_expires_at TIMESTAMPTZ,
  error_log JSONB,
  processing_time_ms INT,
  year_month TEXT,
  created_at TIMESTAMPTZ DEFAULT now(),
  completed_at TIMESTAMPTZ
);

-- 개별 정산 기록 (작업별)
CREATE TABLE IF NOT EXISTS settlement_records (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  job_id UUID REFERENCES settlement_jobs(id) ON DELETE CASCADE,
  agency_id UUID REFERENCES agencies(id),
  driver_name VARCHAR(50),
  driver_id_code VARCHAR(50),
  income_total NUMERIC(12,0) DEFAULT 0,
  deduction_total NUMERIC(12,0) DEFAULT 0,
  net_amount NUMERIC(12,0) DEFAULT 0,
  income_details JSONB DEFAULT '{}',
  deduction_details JSONB DEFAULT '{}',
  formula_log JSONB,
  verification_status VARCHAR(20) CHECK (verification_status IN ('match','mismatch','warning')),
  verification_details JSONB,
  pdf_url TEXT,
  created_at TIMESTAMPTZ DEFAULT now()
);

-- RLS
ALTER TABLE settlement_templates ENABLE ROW LEVEL SECURITY;
ALTER TABLE settlement_jobs ENABLE ROW LEVEL SECURITY;
ALTER TABLE settlement_records ENABLE ROW LEVEL SECURITY;

CREATE POLICY "settlement_templates_agency" ON settlement_templates
  FOR ALL USING (agency_id = (auth.jwt()->'app_metadata'->>'agency_id')::uuid);

CREATE POLICY "settlement_jobs_agency" ON settlement_jobs
  FOR ALL USING (agency_id = (auth.jwt()->'app_metadata'->>'agency_id')::uuid);

CREATE POLICY "settlement_records_agency" ON settlement_records
  FOR ALL USING (agency_id = (auth.jwt()->'app_metadata'->>'agency_id')::uuid);

-- 인덱스
CREATE INDEX IF NOT EXISTS idx_stpl_agency ON settlement_templates(agency_id);
CREATE INDEX IF NOT EXISTS idx_sjobs_agency ON settlement_jobs(agency_id);
CREATE INDEX IF NOT EXISTS idx_sjobs_status ON settlement_jobs(status);
CREATE INDEX IF NOT EXISTS idx_srecs_job ON settlement_records(job_id);
CREATE INDEX IF NOT EXISTS idx_srecs_driver ON settlement_records(driver_name);
