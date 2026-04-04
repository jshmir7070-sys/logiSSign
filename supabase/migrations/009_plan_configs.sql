-- 009: 플랜 설정 테이블 + 플랜 변경 감사 로그
-- 관리자가 플랜별 제한/기능을 동적으로 관리할 수 있도록 합니다.

-- 1. plan_configs: 플랜별 설정 (관리자 편집 가능)
CREATE TABLE IF NOT EXISTS plan_configs (
  plan TEXT PRIMARY KEY CHECK (plan IN ('free','basic','standard','pro','enterprise')),
  label TEXT NOT NULL,
  price_monthly INTEGER NOT NULL DEFAULT 0,
  max_drivers INTEGER,           -- null = 무제한
  max_admin_accounts INTEGER NOT NULL DEFAULT 0,
  max_default_templates INTEGER NOT NULL DEFAULT 0,
  max_upload_templates INTEGER NOT NULL DEFAULT 0,
  features JSONB NOT NULL DEFAULT '{}',
  description TEXT,
  sort_order INTEGER NOT NULL DEFAULT 0,
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- 초기 데이터 시드
INSERT INTO plan_configs (plan, label, price_monthly, max_drivers, max_admin_accounts, max_default_templates, max_upload_templates, features, description, sort_order)
VALUES
  ('free', 'Free', 0, 10, 0, 0, 0,
   '{"dashboard":true,"drivers":true,"contracts":false,"contracts.templates":false,"settlements.basic":true,"settlements.builder":false,"settlements.tax":false,"settlements.upload":false,"reports":false,"notices":true,"settings":true}',
   '기본 정산만 가능 (계약서, 빌더, 리포트 불가)', 0),
  ('basic', 'Basic', 49900, 30, 2, 3, 3,
   '{"dashboard":true,"drivers":true,"contracts":true,"contracts.templates":true,"settlements.basic":true,"settlements.builder":true,"settlements.tax":true,"settlements.upload":true,"reports":false,"notices":true,"settings":true}',
   '기사앱, 정산서, 전자계약서, 세금계산서', 1),
  ('standard', 'Standard', 99000, 80, 5, 6, 6,
   '{"dashboard":true,"drivers":true,"contracts":true,"contracts.templates":true,"settlements.basic":true,"settlements.builder":true,"settlements.tax":true,"settlements.upload":true,"reports":true,"notices":true,"settings":true}',
   'Basic + 매출 리포트, 푸시 알림, 전화 지원', 2),
  ('pro', 'Pro', 149000, 150, 10, 10, 10,
   '{"dashboard":true,"drivers":true,"contracts":true,"contracts.templates":true,"settlements.basic":true,"settlements.builder":true,"settlements.tax":true,"settlements.upload":true,"reports":true,"notices":true,"settings":true}',
   'Standard + 대용량 기사, API 연동', 3),
  ('enterprise', 'Enterprise', 199000, NULL, 99, 99, 99,
   '{"dashboard":true,"drivers":true,"contracts":true,"contracts.templates":true,"settlements.basic":true,"settlements.builder":true,"settlements.tax":true,"settlements.upload":true,"reports":true,"notices":true,"settings":true}',
   '무제한, 맞춤형 정산, 전담 매니저, SLA 99.9%', 4)
ON CONFLICT (plan) DO NOTHING;

-- 2. plan_change_log: 플랜 변경 감사 로그
CREATE TABLE IF NOT EXISTS plan_change_log (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  agency_id UUID NOT NULL REFERENCES agencies(id) ON DELETE CASCADE,
  old_plan TEXT,
  new_plan TEXT NOT NULL,
  changed_by UUID NOT NULL REFERENCES auth.users(id),
  change_type TEXT NOT NULL CHECK (change_type IN ('admin_override','self_upgrade','self_downgrade')) DEFAULT 'admin_override',
  reason TEXT,
  created_at TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_plan_change_log_agency ON plan_change_log(agency_id);
CREATE INDEX IF NOT EXISTS idx_plan_change_log_created ON plan_change_log(created_at DESC);

-- 3. RLS 정책
ALTER TABLE plan_configs ENABLE ROW LEVEL SECURITY;
ALTER TABLE plan_change_log ENABLE ROW LEVEL SECURITY;

-- plan_configs: 누구나 읽기 가능, 수정은 provider_admin만
CREATE POLICY "plan_configs_read" ON plan_configs FOR SELECT USING (true);
CREATE POLICY "plan_configs_admin_write" ON plan_configs FOR ALL
  USING ((auth.jwt()->'app_metadata'->>'role') = 'provider_admin');

-- plan_change_log: provider_admin은 전체, agency_admin은 자기 대리점만
CREATE POLICY "plan_change_log_provider" ON plan_change_log FOR ALL
  USING ((auth.jwt()->'app_metadata'->>'role') = 'provider_admin');
CREATE POLICY "plan_change_log_agency" ON plan_change_log FOR SELECT
  USING (agency_id = (auth.jwt()->'app_metadata'->>'agency_id')::uuid);
