-- ═══════════════════════════════════════════════════════
-- logiSSign — 필수 마이그레이션 통합 SQL
-- Supabase 대시보드 → SQL Editor에서 실행하세요
-- ═══════════════════════════════════════════════════════

-- 1. agencies.logo_url 컬럼 추가
ALTER TABLE agencies ADD COLUMN IF NOT EXISTS logo_url TEXT;

-- 2. agencies.plan_type 컬럼 추가 (subscription vs point)
ALTER TABLE agencies ADD COLUMN IF NOT EXISTS plan_type TEXT DEFAULT 'subscription'
  CHECK (plan_type IN ('subscription', 'point'));

-- 3. 포인트 잔액 테이블
CREATE TABLE IF NOT EXISTS point_balances (
  agency_id UUID PRIMARY KEY REFERENCES agencies(id) ON DELETE CASCADE,
  balance INTEGER NOT NULL DEFAULT 0 CHECK (balance >= 0),
  total_charged INTEGER NOT NULL DEFAULT 0,
  total_used INTEGER NOT NULL DEFAULT 0,
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- 4. 포인트 거래 내역
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

-- 5. 포인트 충전 패키지
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

CREATE POLICY IF NOT EXISTS "point_balances_select" ON point_balances FOR SELECT
  USING (agency_id = (auth.jwt()->'app_metadata'->>'agency_id')::uuid);
CREATE POLICY IF NOT EXISTS "point_balances_service" ON point_balances FOR ALL
  USING (true) WITH CHECK (true);

CREATE POLICY IF NOT EXISTS "point_transactions_select" ON point_transactions FOR SELECT
  USING (agency_id = (auth.jwt()->'app_metadata'->>'agency_id')::uuid);
CREATE POLICY IF NOT EXISTS "point_transactions_service" ON point_transactions FOR ALL
  USING (true) WITH CHECK (true);

CREATE POLICY IF NOT EXISTS "point_packages_select" ON point_packages FOR SELECT
  USING (true);
CREATE POLICY IF NOT EXISTS "point_packages_admin" ON point_packages FOR ALL
  USING ((auth.jwt()->'app_metadata'->>'role') IN ('provider_admin', 'super_admin'));

-- 8. 인덱스
CREATE INDEX IF NOT EXISTS idx_point_transactions_agency ON point_transactions(agency_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_point_transactions_type ON point_transactions(agency_id, type);

-- 9. 기존 대리점에 웰컴 보너스 5,000P 지급
INSERT INTO point_balances (agency_id, balance, total_charged)
SELECT id, 5000, 5000 FROM agencies
ON CONFLICT (agency_id) DO NOTHING;

-- 10. auth.users app_metadata 수정 (필요 시)
-- jshmir77@naver.com의 agency_id가 올바른지 확인:
-- UPDATE auth.users 
-- SET raw_app_meta_data = raw_app_meta_data || '{"agency_id": "9397ea40-2ced-4bd8-ba50-6a353f142037"}'::jsonb
-- WHERE email = 'jshmir77@naver.com';

SELECT 'Migration complete!' AS result;
