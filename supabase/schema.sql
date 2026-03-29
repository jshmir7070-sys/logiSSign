-- ============================================================
-- Precision Velocity — 라스트마일 전산 SaaS Database Schema
-- Supabase PostgreSQL
-- Updated: 2026-03-29 (M001/S02)
-- ============================================================

-- 제공사 (SaaS 운영 주체)
CREATE TABLE providers (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  created_at TIMESTAMPTZ DEFAULT now()
);

-- 운영사 (대리점)
CREATE TABLE agencies (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  provider_id UUID REFERENCES providers(id),
  name TEXT NOT NULL,
  business_number TEXT UNIQUE,
  owner_name TEXT,
  phone TEXT,
  address TEXT,
  plan TEXT CHECK (plan IN ('starter','pro','enterprise')) DEFAULT 'starter',
  monthly_fee INTEGER DEFAULT 49000,
  status TEXT CHECK (status IN ('active','suspended','cancelled')) DEFAULT 'active',
  invite_code TEXT UNIQUE,
  excel_config JSONB,        -- 엑셀 업로드 컬럼 매핑 설정
  field_config JSONB,        -- 커스텀 필드 설정
  created_at TIMESTAMPTZ DEFAULT now()
);

-- 기사
CREATE TABLE drivers (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  agency_id UUID REFERENCES agencies(id),
  user_id UUID REFERENCES auth.users(id),
  name TEXT NOT NULL,
  phone TEXT NOT NULL,
  email TEXT,
  birth_date TEXT,
  address TEXT,
  vehicle_number TEXT,
  license_number TEXT,
  employee_code TEXT,         -- 사번
  delivery_area TEXT,         -- 배송 구역
  is_business_owner BOOLEAN DEFAULT false,  -- 사업자 여부
  vat_included BOOLEAN DEFAULT false,       -- 부가세 포함 여부
  tax_type TEXT CHECK (tax_type IN ('individual','business')) DEFAULT 'individual',
  business_reg_number TEXT,   -- 사업자등록번호
  representative_name TEXT,   -- 대표자명
  business_address TEXT,      -- 사업장 주소
  business_type TEXT,         -- 업태
  business_category TEXT,     -- 종목
  custom_values JSONB,        -- 커스텀 필드 값
  fresh_incentive_pct NUMERIC(5,2) DEFAULT 0,   -- 신선 인센티브 %
  extra_incentive_pct NUMERIC(5,2) DEFAULT 0,   -- 추가 인센티브 %
  push_token TEXT,
  status TEXT CHECK (status IN ('active','inactive')) DEFAULT 'active',
  created_at TIMESTAMPTZ DEFAULT now()
);

-- 기사 서류
CREATE TABLE driver_documents (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  driver_id UUID REFERENCES drivers(id) ON DELETE CASCADE,
  type TEXT CHECK (type IN ('license','bankbook','insurance','id_card','other')),
  file_url TEXT,
  uploaded_at TIMESTAMPTZ DEFAULT now()
);

-- 원청사
CREATE TABLE principals (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  agency_id UUID REFERENCES agencies(id),
  name TEXT NOT NULL,
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT now()
);

-- 정산 규칙 (원청사별 단가)
CREATE TABLE settlement_rules (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  principal_id UUID REFERENCES principals(id) ON DELETE CASCADE,
  package_type TEXT CHECK (package_type IN ('normal','large','frozen')),
  base_unit_price INTEGER NOT NULL,
  rate_type TEXT CHECK (rate_type IN ('fixed','percentage')) DEFAULT 'fixed',
  created_at TIMESTAMPTZ DEFAULT now()
);

-- 기사별 단가 (개인별 오버라이드)
CREATE TABLE driver_rates (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  driver_id UUID REFERENCES drivers(id) ON DELETE CASCADE,
  principal_id UUID REFERENCES principals(id) ON DELETE CASCADE,
  package_type TEXT CHECK (package_type IN ('normal','large','frozen')),
  unit_price INTEGER NOT NULL,
  rate_type TEXT CHECK (rate_type IN ('fixed','percentage')) DEFAULT 'fixed',
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT now(),
  UNIQUE (driver_id, principal_id, package_type)
);

-- 기사별 노선 단가
CREATE TABLE driver_route_rates (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  driver_id UUID REFERENCES drivers(id) ON DELETE CASCADE,
  principal_id UUID REFERENCES principals(id) ON DELETE CASCADE,
  route_code TEXT NOT NULL,
  route_name TEXT,
  unit_price INTEGER NOT NULL,
  delivery_rate INTEGER,
  return_rate INTEGER DEFAULT 0,
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT now(),
  UNIQUE (driver_id, principal_id, route_code)
);

-- 공제 항목 (원청사별 기본 공제)
CREATE TABLE deduction_items (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  principal_id UUID REFERENCES principals(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  amount INTEGER NOT NULL,
  is_active BOOLEAN DEFAULT true,
  rate_type TEXT CHECK (rate_type IN ('fixed','percentage','per_unit')) DEFAULT 'fixed',
  rate_value NUMERIC(10,2) DEFAULT 0,
  unit_label TEXT DEFAULT ''
);

-- 기사별 공제 (개인별 오버라이드)
CREATE TABLE driver_deductions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  driver_id UUID REFERENCES drivers(id) ON DELETE CASCADE,
  principal_id UUID REFERENCES principals(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  amount INTEGER NOT NULL,
  deduction_type TEXT CHECK (deduction_type IN ('fixed','percentage','per_unit')) DEFAULT 'fixed',
  unit_label TEXT DEFAULT '',
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT now()
);

-- 인센티브 규칙
CREATE TABLE incentive_rules (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  principal_id UUID REFERENCES principals(id) ON DELETE CASCADE,
  min_count INTEGER NOT NULL,
  max_count INTEGER,
  bonus_per_unit INTEGER NOT NULL
);

-- 기사별 인센티브 (개인별 오버라이드)
CREATE TABLE driver_incentives (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  driver_id UUID REFERENCES drivers(id) ON DELETE CASCADE,
  principal_id UUID REFERENCES principals(id) ON DELETE CASCADE,
  min_count INTEGER NOT NULL,
  max_count INTEGER,
  bonus_per_unit INTEGER NOT NULL,
  created_at TIMESTAMPTZ DEFAULT now()
);

-- 월별 정산
CREATE TABLE settlements (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  agency_id UUID REFERENCES agencies(id),
  driver_id UUID REFERENCES drivers(id),
  principal_id UUID REFERENCES principals(id),
  year_month TEXT NOT NULL,
  delivery_count INTEGER DEFAULT 0,
  delivery_amount INTEGER DEFAULT 0,
  return_count INTEGER DEFAULT 0,
  return_amount INTEGER DEFAULT 0,
  pickup_count INTEGER DEFAULT 0,
  pickup_amount INTEGER DEFAULT 0,
  fresh_incentive INTEGER DEFAULT 0,
  extra_incentive INTEGER DEFAULT 0,
  base_amount INTEGER DEFAULT 0,
  gross_total INTEGER DEFAULT 0,
  incentive_amount INTEGER DEFAULT 0,
  total_amount INTEGER DEFAULT 0,
  total_deduction INTEGER DEFAULT 0,
  vat_amount INTEGER DEFAULT 0,           -- 부가세
  net_amount INTEGER DEFAULT 0,
  rate_mode TEXT DEFAULT 'fixed',
  rate_percentage NUMERIC(5,2) DEFAULT 0,
  is_business_owner BOOLEAN DEFAULT false,
  vat_included BOOLEAN DEFAULT false,
  route_details JSONB,
  deduction_detail JSONB,
  status TEXT CHECK (status IN ('draft','sent','confirmed')) DEFAULT 'draft',
  pdf_url TEXT,
  sent_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT now(),
  UNIQUE (driver_id, year_month, principal_id)
);

-- 세금계산서
CREATE TABLE tax_invoices (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  settlement_id UUID REFERENCES settlements(id),
  driver_id UUID REFERENCES drivers(id),
  agency_id UUID REFERENCES agencies(id),
  year_month TEXT NOT NULL,
  supply_amount INTEGER NOT NULL,
  tax_amount INTEGER NOT NULL,
  total_amount INTEGER NOT NULL,
  invoice_type TEXT CHECK (invoice_type IN ('tax','cash_receipt','none')) DEFAULT 'tax',
  status TEXT CHECK (status IN ('pending','issued','cancelled')) DEFAULT 'pending',
  issued_at TIMESTAMPTZ,
  pdf_url TEXT
);

-- 계약서 템플릿
CREATE TABLE contract_templates (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  agency_id UUID REFERENCES agencies(id),
  principal_id UUID REFERENCES principals(id),
  title TEXT NOT NULL,
  content TEXT NOT NULL,
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT now()
);

-- 계약서
CREATE TABLE contracts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  template_id UUID REFERENCES contract_templates(id),
  agency_id UUID REFERENCES agencies(id),
  driver_id UUID REFERENCES drivers(id),
  title TEXT NOT NULL,
  content TEXT NOT NULL,
  content_hash TEXT NOT NULL,
  sign_token TEXT UNIQUE,
  token_expires_at TIMESTAMPTZ,
  status TEXT CHECK (status IN ('draft','sent','viewed','signed','expired')) DEFAULT 'draft',
  sent_at TIMESTAMPTZ,
  signed_at TIMESTAMPTZ,
  signed_pdf_url TEXT,
  created_at TIMESTAMPTZ DEFAULT now()
);

-- 전자서명 기록
CREATE TABLE contract_signatures (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  contract_id UUID REFERENCES contracts(id) ON DELETE CASCADE,
  driver_id UUID REFERENCES drivers(id),
  phone_verified TEXT NOT NULL,
  otp_session_id TEXT,
  identity_verified_at TIMESTAMPTZ,
  signature_image_base64 TEXT,
  signed_pdf_hash TEXT,
  signer_ip TEXT,
  signer_user_agent TEXT,
  signed_at TIMESTAMPTZ,
  tsa_timestamp TEXT,
  audit_log JSONB
);

-- 공지사항
CREATE TABLE notices (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  created_by_type TEXT CHECK (created_by_type IN ('provider','agency')),
  provider_id UUID REFERENCES providers(id),
  agency_id UUID REFERENCES agencies(id),
  target_type TEXT CHECK (target_type IN ('all','agency')) DEFAULT 'agency',
  title TEXT NOT NULL,
  content TEXT NOT NULL,
  category TEXT CHECK (category IN ('notice','guide','update','etc')),
  attachment_url TEXT,
  appstore_url TEXT,
  playstore_url TEXT,
  status TEXT CHECK (status IN ('draft','published')) DEFAULT 'draft',
  published_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT now()
);

-- 구독 결제
CREATE TABLE subscriptions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  agency_id UUID REFERENCES agencies(id),
  plan TEXT NOT NULL,
  amount INTEGER NOT NULL,
  billing_date INTEGER DEFAULT 1,
  status TEXT CHECK (status IN ('active','overdue','cancelled')) DEFAULT 'active',
  last_paid_at TIMESTAMPTZ,
  next_billing_at TIMESTAMPTZ
);

-- ============================================================
-- RLS (Row Level Security)
-- ============================================================
ALTER TABLE drivers ENABLE ROW LEVEL SECURITY;
ALTER TABLE driver_documents ENABLE ROW LEVEL SECURITY;
ALTER TABLE driver_rates ENABLE ROW LEVEL SECURITY;
ALTER TABLE driver_route_rates ENABLE ROW LEVEL SECURITY;
ALTER TABLE driver_deductions ENABLE ROW LEVEL SECURITY;
ALTER TABLE driver_incentives ENABLE ROW LEVEL SECURITY;
ALTER TABLE settlements ENABLE ROW LEVEL SECURITY;
ALTER TABLE tax_invoices ENABLE ROW LEVEL SECURITY;
ALTER TABLE contracts ENABLE ROW LEVEL SECURITY;
ALTER TABLE contract_signatures ENABLE ROW LEVEL SECURITY;
ALTER TABLE notices ENABLE ROW LEVEL SECURITY;
ALTER TABLE principals ENABLE ROW LEVEL SECURITY;
ALTER TABLE settlement_rules ENABLE ROW LEVEL SECURITY;
ALTER TABLE deduction_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE incentive_rules ENABLE ROW LEVEL SECURITY;

-- 기사는 본인 데이터만
CREATE POLICY "drivers_own" ON drivers
  FOR ALL USING (user_id = auth.uid());

-- 운영사는 소속 기사 데이터
CREATE POLICY "agency_drivers" ON drivers
  FOR ALL USING (
    agency_id = (auth.jwt()->>'agency_id')::uuid
  );

-- 기사 서류: 본인 것만
CREATE POLICY "driver_documents_own" ON driver_documents
  FOR ALL USING (
    driver_id IN (SELECT id FROM drivers WHERE user_id = auth.uid())
  );

-- 기사 서류: 운영사 소속
CREATE POLICY "driver_documents_agency" ON driver_documents
  FOR ALL USING (
    driver_id IN (SELECT id FROM drivers WHERE agency_id = (auth.jwt()->>'agency_id')::uuid)
  );

-- 기사별 단가: 운영사만 관리
CREATE POLICY "driver_rates_agency" ON driver_rates
  FOR ALL USING (
    driver_id IN (SELECT id FROM drivers WHERE agency_id = (auth.jwt()->>'agency_id')::uuid)
  );

-- 기사별 노선단가: 운영사만 관리
CREATE POLICY "driver_route_rates_agency" ON driver_route_rates
  FOR ALL USING (
    driver_id IN (SELECT id FROM drivers WHERE agency_id = (auth.jwt()->>'agency_id')::uuid)
  );

-- 기사별 공제: 운영사만 관리
CREATE POLICY "driver_deductions_agency" ON driver_deductions
  FOR ALL USING (
    driver_id IN (SELECT id FROM drivers WHERE agency_id = (auth.jwt()->>'agency_id')::uuid)
  );

-- 기사별 인센티브: 운영사만 관리
CREATE POLICY "driver_incentives_agency" ON driver_incentives
  FOR ALL USING (
    driver_id IN (SELECT id FROM drivers WHERE agency_id = (auth.jwt()->>'agency_id')::uuid)
  );

-- 원청사: 운영사 소속만
CREATE POLICY "principals_agency" ON principals
  FOR ALL USING (
    agency_id = (auth.jwt()->>'agency_id')::uuid
  );

-- 정산 규칙: 운영사 소속 원청사의 것만
CREATE POLICY "settlement_rules_agency" ON settlement_rules
  FOR ALL USING (
    principal_id IN (SELECT id FROM principals WHERE agency_id = (auth.jwt()->>'agency_id')::uuid)
  );

-- 공제 항목: 운영사 소속 원청사의 것만
CREATE POLICY "deduction_items_agency" ON deduction_items
  FOR ALL USING (
    principal_id IN (SELECT id FROM principals WHERE agency_id = (auth.jwt()->>'agency_id')::uuid)
  );

-- 인센티브 규칙: 운영사 소속 원청사의 것만
CREATE POLICY "incentive_rules_agency" ON incentive_rules
  FOR ALL USING (
    principal_id IN (SELECT id FROM principals WHERE agency_id = (auth.jwt()->>'agency_id')::uuid)
  );

-- 정산: 기사 본인 것만
CREATE POLICY "settlements_driver" ON settlements
  FOR SELECT USING (
    driver_id IN (SELECT id FROM drivers WHERE user_id = auth.uid())
  );

-- 정산: 운영사 소속 기사 것
CREATE POLICY "settlements_agency" ON settlements
  FOR ALL USING (
    agency_id = (auth.jwt()->>'agency_id')::uuid
  );

-- 세금계산서: 운영사 소속
CREATE POLICY "tax_invoices_agency" ON tax_invoices
  FOR ALL USING (
    agency_id = (auth.jwt()->>'agency_id')::uuid
  );

-- 계약서: 기사 본인 것만
CREATE POLICY "contracts_driver" ON contracts
  FOR SELECT USING (
    driver_id IN (SELECT id FROM drivers WHERE user_id = auth.uid())
  );

-- 계약서: 운영사 소속 것
CREATE POLICY "contracts_agency" ON contracts
  FOR ALL USING (
    agency_id = (auth.jwt()->>'agency_id')::uuid
  );

-- 전자서명: 운영사 소속 것
CREATE POLICY "contract_signatures_agency" ON contract_signatures
  FOR ALL USING (
    contract_id IN (SELECT id FROM contracts WHERE agency_id = (auth.jwt()->>'agency_id')::uuid)
  );

-- 공지: 기사는 발행된 공지만 열람
CREATE POLICY "notices_read" ON notices
  FOR SELECT USING (
    status = 'published' AND (
      target_type = 'all' OR
      agency_id IN (
        SELECT agency_id FROM drivers WHERE user_id = auth.uid()
      )
    )
  );

-- 공지: 운영사는 자기 공지 관리
CREATE POLICY "notices_agency" ON notices
  FOR ALL USING (
    agency_id = (auth.jwt()->>'agency_id')::uuid
  );

-- ============================================================
-- Indexes
-- ============================================================
CREATE INDEX idx_drivers_agency ON drivers(agency_id);
CREATE INDEX idx_drivers_user ON drivers(user_id);
CREATE INDEX idx_drivers_employee_code ON drivers(agency_id, employee_code);
CREATE INDEX idx_driver_rates_driver ON driver_rates(driver_id);
CREATE INDEX idx_driver_route_rates_driver ON driver_route_rates(driver_id);
CREATE INDEX idx_driver_deductions_driver ON driver_deductions(driver_id);
CREATE INDEX idx_driver_incentives_driver ON driver_incentives(driver_id);
CREATE INDEX idx_settlements_driver_month ON settlements(driver_id, year_month);
CREATE INDEX idx_settlements_agency_month ON settlements(agency_id, year_month);
CREATE INDEX idx_contracts_driver ON contracts(driver_id);
CREATE INDEX idx_contracts_token ON contracts(sign_token);
CREATE INDEX idx_notices_agency ON notices(agency_id);
CREATE INDEX idx_notices_published ON notices(status, published_at DESC);
CREATE INDEX idx_subscriptions_agency ON subscriptions(agency_id);
CREATE INDEX idx_tax_invoices_agency ON tax_invoices(agency_id, year_month);

-- ============================================================
-- Storage Buckets (run via Supabase dashboard or API)
-- ============================================================
-- INSERT INTO storage.buckets (id, name, public) VALUES ('documents', 'documents', false);
-- INSERT INTO storage.buckets (id, name, public) VALUES ('contracts', 'contracts', false);
-- INSERT INTO storage.buckets (id, name, public) VALUES ('settlements', 'settlements', false);
