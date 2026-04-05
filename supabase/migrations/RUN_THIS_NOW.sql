-- ═══════════════════════════════════════════════════════
-- logiSSign — 미적용 마이그레이션 통합 SQL
-- Supabase 대시보드 → SQL Editor에서 한 번에 실행
-- 마지막 확인: 2026-04-05
-- ═══════════════════════════════════════════════════════

-- ✅ agencies.logo_url → 이미 적용됨 (스킵)

-- 1. agencies.plan_type 컬럼 추가
ALTER TABLE agencies ADD COLUMN IF NOT EXISTS plan_type TEXT DEFAULT 'subscription'
  CHECK (plan_type IN ('subscription', 'point'));

-- 2. 포인트 잔액 테이블
CREATE TABLE IF NOT EXISTS point_balances (
  agency_id UUID PRIMARY KEY REFERENCES agencies(id) ON DELETE CASCADE,
  balance INTEGER NOT NULL DEFAULT 0 CHECK (balance >= 0),
  total_charged INTEGER NOT NULL DEFAULT 0,
  total_used INTEGER NOT NULL DEFAULT 0,
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- 3. 포인트 거래 내역
CREATE TABLE IF NOT EXISTS point_transactions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  agency_id UUID NOT NULL REFERENCES agencies(id) ON DELETE CASCADE,
  type TEXT NOT NULL CHECK (type IN ('charge', 'use', 'refund', 'bonus', 'expire')),
  amount INTEGER NOT NULL,
  balance_after INTEGER NOT NULL,
  description TEXT NOT NULL,
  reference_type TEXT,
  reference_id TEXT,
  payment_id TEXT,
  created_at TIMESTAMPTZ DEFAULT now(),
  created_by UUID REFERENCES auth.users(id)
);

-- 4. 포인트 충전 패키지
CREATE TABLE IF NOT EXISTS point_packages (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  points INTEGER NOT NULL,
  price INTEGER NOT NULL,
  bonus_points INTEGER NOT NULL DEFAULT 0,
  is_active BOOLEAN DEFAULT true,
  sort_order INTEGER DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT now()
);

-- 5. 계약서 템플릿 필드 (바인딩 필드 메타데이터)
CREATE TABLE IF NOT EXISTS contract_template_fields (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  template_id UUID REFERENCES contract_templates(id) ON DELETE CASCADE,
  field_id TEXT NOT NULL,
  field_label TEXT NOT NULL,
  field_type TEXT DEFAULT 'text',
  required BOOLEAN DEFAULT false,
  sort_order INTEGER DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT now()
);

-- 6. 기본 충전 패키지 시드
INSERT INTO point_packages (name, points, price, bonus_points, sort_order) VALUES
  ('5,000P',    5000,    5000,     0,  1),
  ('10,000P',  10000,   10000,   500,  2),
  ('30,000P',  30000,   30000,  2000,  3),
  ('50,000P',  50000,   50000,  5000,  4),
  ('100,000P',100000,  100000, 15000,  5)
ON CONFLICT DO NOTHING;

-- 7. RLS 정책
ALTER TABLE point_balances ENABLE ROW LEVEL SECURITY;
ALTER TABLE point_transactions ENABLE ROW LEVEL SECURITY;
ALTER TABLE point_packages ENABLE ROW LEVEL SECURITY;
ALTER TABLE contract_template_fields ENABLE ROW LEVEL SECURITY;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'point_balances_select') THEN
    CREATE POLICY point_balances_select ON point_balances FOR SELECT
      USING (agency_id = (auth.jwt()->'app_metadata'->>'agency_id')::uuid);
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'point_balances_service') THEN
    CREATE POLICY point_balances_service ON point_balances FOR ALL USING (true) WITH CHECK (true);
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'point_transactions_select') THEN
    CREATE POLICY point_transactions_select ON point_transactions FOR SELECT
      USING (agency_id = (auth.jwt()->'app_metadata'->>'agency_id')::uuid);
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'point_transactions_service') THEN
    CREATE POLICY point_transactions_service ON point_transactions FOR ALL USING (true) WITH CHECK (true);
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'point_packages_select') THEN
    CREATE POLICY point_packages_select ON point_packages FOR SELECT USING (true);
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'point_packages_admin') THEN
    CREATE POLICY point_packages_admin ON point_packages FOR ALL
      USING ((auth.jwt()->'app_metadata'->>'role') IN ('provider_admin', 'super_admin'));
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'template_fields_select') THEN
    CREATE POLICY template_fields_select ON contract_template_fields FOR SELECT USING (true);
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'template_fields_admin') THEN
    CREATE POLICY template_fields_admin ON contract_template_fields FOR ALL
      USING ((auth.jwt()->'app_metadata'->>'role') IN ('provider_admin', 'agency_admin'));
  END IF;
END $$;

-- 8. 인덱스
CREATE INDEX IF NOT EXISTS idx_point_transactions_agency ON point_transactions(agency_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_point_transactions_type ON point_transactions(agency_id, type);
CREATE INDEX IF NOT EXISTS idx_template_fields_template ON contract_template_fields(template_id);

-- 9. 기존 대리점에 웰컴 보너스 5,000P 지급
INSERT INTO point_balances (agency_id, balance, total_charged)
SELECT id, 5000, 5000 FROM agencies
ON CONFLICT (agency_id) DO NOTHING;

-- 10. auth.users app_metadata 수정 (필요 시 주석 해제)
-- UPDATE auth.users 
-- SET raw_app_meta_data = raw_app_meta_data || '{"agency_id": "9397ea40-2ced-4bd8-ba50-6a353f142037"}'::jsonb
-- WHERE email = 'jshmir77@naver.com';

SELECT '✅ Migration complete! 적용 항목: plan_type, point_balances, point_transactions, point_packages, contract_template_fields' AS result;
