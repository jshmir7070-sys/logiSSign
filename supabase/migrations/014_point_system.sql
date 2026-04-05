-- 014: 포인트 충전형 플랜 지원
-- 구독형(월정액) + 포인트형(건별 차감) 이중 플랜 체계

-- 1. 포인트 잔액 테이블
CREATE TABLE IF NOT EXISTS point_balances (
  agency_id UUID PRIMARY KEY REFERENCES agencies(id) ON DELETE CASCADE,
  balance INTEGER NOT NULL DEFAULT 0 CHECK (balance >= 0),
  total_charged INTEGER NOT NULL DEFAULT 0,   -- 누적 충전
  total_used INTEGER NOT NULL DEFAULT 0,      -- 누적 사용
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- 2. 포인트 거래 내역
CREATE TABLE IF NOT EXISTS point_transactions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  agency_id UUID NOT NULL REFERENCES agencies(id) ON DELETE CASCADE,
  type TEXT NOT NULL CHECK (type IN ('charge', 'use', 'refund', 'bonus', 'expire')),
  amount INTEGER NOT NULL,                     -- 양수: 충전/환불/보너스, 음수: 사용
  balance_after INTEGER NOT NULL,              -- 거래 후 잔액
  description TEXT NOT NULL,                   -- "계약서 전송 3건", "10,000P 충전" 등
  reference_type TEXT,                         -- 'contract', 'settlement', 'driver', 'sms' 등
  reference_id TEXT,                           -- 관련 레코드 ID
  payment_id TEXT,                             -- 결제 연동 시 포트원 paymentId
  created_at TIMESTAMPTZ DEFAULT now(),
  created_by UUID REFERENCES auth.users(id)
);

-- 3. 포인트 충전 패키지 (관리자 설정)
CREATE TABLE IF NOT EXISTS point_packages (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,                          -- "5,000P", "10,000P" 등
  points INTEGER NOT NULL,                     -- 충전 포인트
  price INTEGER NOT NULL,                      -- 가격 (원)
  bonus_points INTEGER NOT NULL DEFAULT 0,     -- 보너스 포인트
  is_active BOOLEAN DEFAULT true,
  sort_order INTEGER DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT now()
);

-- 4. 기본 충전 패키지 시드
INSERT INTO point_packages (name, points, price, bonus_points, sort_order) VALUES
  ('5,000P',    5000,    5000,     0,  1),
  ('10,000P',  10000,   10000,   500,  2),
  ('30,000P',  30000,   30000,  2000,  3),
  ('50,000P',  50000,   50000,  5000,  4),
  ('100,000P',100000,  100000, 15000,  5);

-- 5. RLS 정책
ALTER TABLE point_balances ENABLE ROW LEVEL SECURITY;
ALTER TABLE point_transactions ENABLE ROW LEVEL SECURITY;
ALTER TABLE point_packages ENABLE ROW LEVEL SECURITY;

-- point_balances: 본인 대리점만
CREATE POLICY "point_balances_select" ON point_balances FOR SELECT
  USING (agency_id = (auth.jwt()->'app_metadata'->>'agency_id')::uuid);

CREATE POLICY "point_balances_service" ON point_balances FOR ALL
  USING (true) WITH CHECK (true);
-- service_role만 insert/update (API 서버에서만 처리)

-- point_transactions: 본인 대리점만 조회
CREATE POLICY "point_transactions_select" ON point_transactions FOR SELECT
  USING (agency_id = (auth.jwt()->'app_metadata'->>'agency_id')::uuid);

CREATE POLICY "point_transactions_service" ON point_transactions FOR ALL
  USING (true) WITH CHECK (true);

-- point_packages: 누구나 조회
CREATE POLICY "point_packages_select" ON point_packages FOR SELECT
  USING (true);

CREATE POLICY "point_packages_admin" ON point_packages FOR ALL
  USING (
    (auth.jwt()->'app_metadata'->>'role') IN ('provider_admin', 'super_admin')
  );

-- 6. 인덱스
CREATE INDEX IF NOT EXISTS idx_point_transactions_agency ON point_transactions(agency_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_point_transactions_type ON point_transactions(agency_id, type);

-- 7. agencies 테이블에 plan_type 컬럼 추가 (subscription vs point)
ALTER TABLE agencies ADD COLUMN IF NOT EXISTS plan_type TEXT DEFAULT 'subscription'
  CHECK (plan_type IN ('subscription', 'point'));
