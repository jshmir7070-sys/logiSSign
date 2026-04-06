CREATE TABLE IF NOT EXISTS agency_payment_orders (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  agency_id UUID NOT NULL REFERENCES agencies(id) ON DELETE CASCADE,
  payment_id TEXT NOT NULL UNIQUE,
  purpose TEXT NOT NULL CHECK (purpose IN ('plan', 'point')),
  title TEXT NOT NULL,
  payment_method TEXT NOT NULL CHECK (payment_method IN ('CARD', 'EASY_PAY', 'TRANSFER', 'VIRTUAL_ACCOUNT')),
  easy_pay_provider TEXT,
  amount INTEGER NOT NULL CHECK (amount > 0),
  currency TEXT NOT NULL DEFAULT 'KRW',
  status TEXT NOT NULL CHECK (status IN ('paid', 'pending', 'failed', 'cancelled')) DEFAULT 'pending',
  plan TEXT,
  billing_cycle TEXT,
  point_package_id UUID REFERENCES point_packages(id) ON DELETE SET NULL,
  point_amount INTEGER DEFAULT 0,
  bonus_points INTEGER DEFAULT 0,
  virtual_account_bank TEXT,
  virtual_account_number TEXT,
  virtual_account_holder TEXT,
  deposit_expires_at TIMESTAMPTZ,
  paid_at TIMESTAMPTZ,
  applied_at TIMESTAMPTZ,
  portone_payload JSONB NOT NULL DEFAULT '{}'::jsonb,
  metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_by UUID,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_agency_payment_orders_agency_created
  ON agency_payment_orders(agency_id, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_agency_payment_orders_status
  ON agency_payment_orders(status, created_at DESC);

ALTER TABLE agency_payment_orders ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS agency_payment_orders_select ON agency_payment_orders;
CREATE POLICY agency_payment_orders_select ON agency_payment_orders
  FOR SELECT
  USING (
    agency_id = (auth.jwt() -> 'app_metadata' ->> 'agency_id')::uuid
    OR (auth.jwt() -> 'app_metadata' ->> 'role') = 'provider_admin'
  );
