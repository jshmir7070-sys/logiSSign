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
  owner_birth_date TEXT,      -- 대표자 생년월일
  phone TEXT,
  email TEXT,
  address TEXT,               -- 사업장 주소
  address_detail TEXT,        -- 상세주소
  business_type TEXT,         -- 업태
  business_category TEXT,     -- 종목
  bank_name TEXT,             -- 정산 입금 은행
  bank_account TEXT,          -- 계좌번호
  bank_holder TEXT,           -- 예금주
  business_reg_file_url TEXT, -- 사업자등록증 파일
  plan TEXT CHECK (plan IN ('free','basic','standard','enterprise')) DEFAULT 'free',
  max_drivers INTEGER DEFAULT 10,
  monthly_fee INTEGER DEFAULT 0,
  status TEXT CHECK (status IN ('active','suspended','cancelled')) DEFAULT 'active',
  invite_code TEXT UNIQUE,
  excel_config JSONB,        -- 엑셀 업로드 컬럼 매핑 설정
  field_config JSONB,        -- 커스텀 필드 설정
  templates_locked BOOLEAN DEFAULT false,  -- 템플릿 선택 확정 여부 (true면 변경 불가)
  privacy_officer_name TEXT,     -- 개인정보보호 담당자 이름
  privacy_officer_phone TEXT,    -- 개인정보보호 담당자 연락처
  privacy_officer_email TEXT,    -- 개인정보보호 담당자 이메일
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
  vehicle_type TEXT,            -- 차종 (포터2, 봉고3 등)
  vehicle_year TEXT,            -- 연식
  vehicle_vin TEXT,             -- 차대번호
  vehicle_mileage INTEGER,      -- 인도 시 주행거리(km)
  vehicle_owner TEXT CHECK (vehicle_owner IN ('self','company')) DEFAULT 'self',  -- 자차/회사차
  vehicle_rent_monthly INTEGER DEFAULT 0,  -- 월 임대료
  vehicle_deposit INTEGER DEFAULT 0,       -- 보증금
  vehicle_insurance_by TEXT CHECK (vehicle_insurance_by IN ('lessor','lessee')) DEFAULT 'lessor', -- 보험 부담
  license_number TEXT,
  employee_code TEXT,         -- 사번
  delivery_area TEXT,         -- 배송 구역
  principal_id UUID REFERENCES principals(id),  -- 소속 원청사
  camp_name TEXT,             -- 캠프명
  rate_mode TEXT CHECK (rate_mode IN ('route','flat','percentage')) DEFAULT 'route',
  flat_rate INTEGER DEFAULT 0,
  rate_percentage NUMERIC(5,2) DEFAULT 0,
  is_business_owner BOOLEAN DEFAULT false,  -- 사업자 여부
  vat_included BOOLEAN DEFAULT false,       -- 부가세 포함 여부
  tax_type TEXT CHECK (tax_type IN ('individual','business','vat_invoice','withholding_3_3','manual_reverse','none')) DEFAULT 'individual',
  business_reg_number TEXT,   -- 사업자등록번호
  representative_name TEXT,   -- 대표자명
  business_address TEXT,      -- 사업장 주소
  business_type TEXT,         -- 업태
  business_category TEXT,     -- 종목
  custom_values JSONB,        -- 커스텀 필드 값
  fresh_incentive_pct NUMERIC(5,2) DEFAULT 0,   -- 신선 인센티브 %
  extra_incentive_pct NUMERIC(5,2) DEFAULT 0,   -- 추가 인센티브 %
  bank_name TEXT,              -- 정산 입금 은행
  bank_account TEXT,           -- 계좌번호
  bank_holder TEXT,            -- 예금주
  push_token TEXT,
  status TEXT CHECK (status IN ('active','inactive')) DEFAULT 'active',
  created_at TIMESTAMPTZ DEFAULT now()
);

-- 기사 서류
CREATE TABLE driver_documents (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  driver_id UUID REFERENCES drivers(id) ON DELETE CASCADE,
  type TEXT CHECK (type IN ('license','vehicle_registration','cargo_license','bankbook','insurance','id_card','business_reg','other')),
  title TEXT,
  file_url TEXT,
  uploaded_at TIMESTAMPTZ DEFAULT now()
);

-- 원청사
CREATE TABLE principals (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  agency_id UUID REFERENCES agencies(id),
  name TEXT NOT NULL,
  field_config JSONB,             -- 커스텀 필드 설정
  excel_config JSONB,             -- 엑셀 다운로드 컬럼 설정
  upload_column_mapping JSONB,    -- 엑셀 업로드 시 컬럼 매핑 설정
  excel_type TEXT CHECK (excel_type IN ('generic','coupang','cj','hanjin','lotte','logen','custom')) DEFAULT 'generic',
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT now()
);

-- 기사↔원청사 연결 (다대다: 기사 1명이 여러 카테고리 가능)
CREATE TABLE driver_principals (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  driver_id UUID REFERENCES drivers(id) ON DELETE CASCADE,
  principal_id UUID REFERENCES principals(id) ON DELETE CASCADE,
  status TEXT CHECK (status IN ('active','inactive')) DEFAULT 'active',
  joined_at TIMESTAMPTZ DEFAULT now(),
  created_at TIMESTAMPTZ DEFAULT now(),
  UNIQUE (driver_id, principal_id)
);

-- [레거시 - 미사용] 정산 규칙은 principals.field_config JSONB에서 통합 관리
-- settlement_rules 테이블은 더 이상 사용되지 않음 (카테고리 관리에서 통합)
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
  is_system BOOLEAN DEFAULT false,    -- 시스템 기본 양식 (삭제 불가)
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
  signed_pdf_hash TEXT,               -- 서명 PDF SHA-256 해시
  document_number TEXT UNIQUE,        -- 문서번호 (LSS-YYYY-NNNNNN)
  verification_code TEXT UNIQUE,      -- 8자리 진위확인 코드
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
  consent_contract BOOLEAN DEFAULT false,          -- 계약 내용 동의
  consent_privacy_collect BOOLEAN DEFAULT false,   -- 개인정보 수집·이용 동의
  consent_privacy_id BOOLEAN DEFAULT false,        -- 고유식별정보 수집·이용 동의
  consent_privacy_3rd BOOLEAN DEFAULT false,       -- 개인정보 제3자 제공 동의
  consent_privacy_3rd_id BOOLEAN DEFAULT false,    -- 고유식별정보 제3자 제공 동의
  audit_log JSONB,
  audit_certificate_url TEXT              -- 감사추적인증서 PDF URL
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
ALTER TABLE driver_principals ENABLE ROW LEVEL SECURITY;
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
    agency_id = (auth.jwt()->'app_metadata'->>'agency_id')::uuid
  );

-- 기사 서류: 본인 것만
CREATE POLICY "driver_documents_own" ON driver_documents
  FOR ALL USING (
    driver_id IN (SELECT id FROM drivers WHERE user_id = auth.uid())
  );

-- 기사 서류: 운영사 소속
CREATE POLICY "driver_documents_agency" ON driver_documents
  FOR ALL USING (
    driver_id IN (SELECT id FROM drivers WHERE agency_id = (auth.jwt()->'app_metadata'->>'agency_id')::uuid)
  );

-- 기사↔원청사 연결: 운영사만 관리
CREATE POLICY "driver_principals_agency" ON driver_principals
  FOR ALL USING (
    driver_id IN (SELECT id FROM drivers WHERE agency_id = (auth.jwt()->'app_metadata'->>'agency_id')::uuid)
  );

-- 기사별 단가: 운영사만 관리
CREATE POLICY "driver_rates_agency" ON driver_rates
  FOR ALL USING (
    driver_id IN (SELECT id FROM drivers WHERE agency_id = (auth.jwt()->'app_metadata'->>'agency_id')::uuid)
  );

-- 기사별 노선단가: 운영사만 관리
CREATE POLICY "driver_route_rates_agency" ON driver_route_rates
  FOR ALL USING (
    driver_id IN (SELECT id FROM drivers WHERE agency_id = (auth.jwt()->'app_metadata'->>'agency_id')::uuid)
  );

-- 기사별 공제: 운영사만 관리
CREATE POLICY "driver_deductions_agency" ON driver_deductions
  FOR ALL USING (
    driver_id IN (SELECT id FROM drivers WHERE agency_id = (auth.jwt()->'app_metadata'->>'agency_id')::uuid)
  );

-- 기사별 인센티브: 운영사만 관리
CREATE POLICY "driver_incentives_agency" ON driver_incentives
  FOR ALL USING (
    driver_id IN (SELECT id FROM drivers WHERE agency_id = (auth.jwt()->'app_metadata'->>'agency_id')::uuid)
  );

-- 원청사: 운영사 소속만
CREATE POLICY "principals_agency" ON principals
  FOR ALL USING (
    agency_id = (auth.jwt()->'app_metadata'->>'agency_id')::uuid
  );

-- 정산 규칙: 운영사 소속 원청사의 것만
CREATE POLICY "settlement_rules_agency" ON settlement_rules
  FOR ALL USING (
    principal_id IN (SELECT id FROM principals WHERE agency_id = (auth.jwt()->'app_metadata'->>'agency_id')::uuid)
  );

-- 공제 항목: 운영사 소속 원청사의 것만
CREATE POLICY "deduction_items_agency" ON deduction_items
  FOR ALL USING (
    principal_id IN (SELECT id FROM principals WHERE agency_id = (auth.jwt()->'app_metadata'->>'agency_id')::uuid)
  );

-- 인센티브 규칙: 운영사 소속 원청사의 것만
CREATE POLICY "incentive_rules_agency" ON incentive_rules
  FOR ALL USING (
    principal_id IN (SELECT id FROM principals WHERE agency_id = (auth.jwt()->'app_metadata'->>'agency_id')::uuid)
  );

-- 정산: 기사 본인 것만
CREATE POLICY "settlements_driver" ON settlements
  FOR SELECT USING (
    driver_id IN (SELECT id FROM drivers WHERE user_id = auth.uid())
  );

-- 정산: 운영사 소속 기사 것
CREATE POLICY "settlements_agency" ON settlements
  FOR ALL USING (
    agency_id = (auth.jwt()->'app_metadata'->>'agency_id')::uuid
  );

-- 세금계산서: 운영사 소속
CREATE POLICY "tax_invoices_agency" ON tax_invoices
  FOR ALL USING (
    agency_id = (auth.jwt()->'app_metadata'->>'agency_id')::uuid
  );

-- 계약서: 기사 본인 것만
CREATE POLICY "contracts_driver" ON contracts
  FOR SELECT USING (
    driver_id IN (SELECT id FROM drivers WHERE user_id = auth.uid())
  );

-- 계약서: 운영사 소속 것
-- SELECT, INSERT, DELETE는 허용하되, UPDATE는 서명되지 않은 계약서만 가능
CREATE POLICY "contracts_agency_read" ON contracts
  FOR SELECT USING (
    agency_id = (auth.jwt()->'app_metadata'->>'agency_id')::uuid
  );

CREATE POLICY "contracts_agency_insert" ON contracts
  FOR INSERT WITH CHECK (
    agency_id = (auth.jwt()->'app_metadata'->>'agency_id')::uuid
  );

CREATE POLICY "contracts_agency_update" ON contracts
  FOR UPDATE USING (
    agency_id = (auth.jwt()->'app_metadata'->>'agency_id')::uuid
    AND status NOT IN ('signed')
  );

CREATE POLICY "contracts_agency_delete" ON contracts
  FOR DELETE USING (
    agency_id = (auth.jwt()->'app_metadata'->>'agency_id')::uuid
    AND status NOT IN ('signed')
  );

-- 계약서: 기사 본인 — 서명 시 status 변경만 허용
-- 기사 본인 — 서명 관련 상태만 변경 허용 (content/title/template 변경 불가는 트리거로 강제)
CREATE POLICY "contracts_driver_update" ON contracts
  FOR UPDATE USING (
    driver_id IN (SELECT id FROM drivers WHERE user_id = auth.uid())
  );

-- 전자서명: INSERT만 허용 (수정/삭제 불가 — 서명 기록은 불변)
CREATE POLICY "contract_signatures_agency_read" ON contract_signatures
  FOR SELECT USING (
    contract_id IN (SELECT id FROM contracts WHERE agency_id = (auth.jwt()->'app_metadata'->>'agency_id')::uuid)
  );

CREATE POLICY "contract_signatures_insert" ON contract_signatures
  FOR INSERT WITH CHECK (
    contract_id IN (SELECT id FROM contracts WHERE agency_id = (auth.jwt()->'app_metadata'->>'agency_id')::uuid)
    OR contract_id IN (
      SELECT id FROM contracts WHERE driver_id IN (SELECT id FROM drivers WHERE user_id = auth.uid())
    )
  );

-- 서명 기록은 UPDATE/DELETE 불가 — 정책 없으면 RLS가 자동 차단

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
    agency_id = (auth.jwt()->'app_metadata'->>'agency_id')::uuid
  );

-- ============================================================
-- Indexes
-- ============================================================
CREATE INDEX idx_drivers_agency ON drivers(agency_id);
CREATE INDEX idx_drivers_user ON drivers(user_id);
CREATE INDEX idx_drivers_employee_code ON drivers(agency_id, employee_code);
CREATE INDEX idx_driver_principals_driver ON driver_principals(driver_id);
CREATE INDEX idx_driver_principals_principal ON driver_principals(principal_id);
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
-- Storage bucket setup is at the end of this file

-- ============================================================
-- 교육 콘텐츠 및 이수 관리
-- ============================================================

-- 교육 과목
CREATE TABLE education_courses (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  agency_id UUID REFERENCES agencies(id),
  title TEXT NOT NULL,                    -- 과목명 (산업안전보건, 성희롱예방 등)
  category TEXT CHECK (category IN (
    'safety','harassment','privacy','disability','platform','custom'
  )) NOT NULL,
  description TEXT,
  required_minutes INTEGER NOT NULL,      -- 법정 이수시간 (분)
  video_url TEXT,                         -- 교육 영상 URL
  video_duration_sec INTEGER,             -- 영상 길이 (초)
  content_text TEXT,                      -- 텍스트 교육 자료
  quiz_data JSONB,                        -- 퀴즈 문항 [{question, options[], answer, explanation}]
  quiz_pass_score INTEGER DEFAULT 70,     -- 퀴즈 합격 점수 (%)
  is_active BOOLEAN DEFAULT true,
  year INTEGER NOT NULL,                  -- 교육 연도
  created_at TIMESTAMPTZ DEFAULT now()
);

-- 기사별 교육 이수 기록
CREATE TABLE education_records (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  course_id UUID REFERENCES education_courses(id) ON DELETE CASCADE,
  driver_id UUID REFERENCES drivers(id) ON DELETE CASCADE,
  agency_id UUID REFERENCES agencies(id),
  -- 시간 추적
  video_watched_sec INTEGER DEFAULT 0,    -- 실제 영상 시청 시간 (초)
  text_read_sec INTEGER DEFAULT 0,        -- 텍스트 열람 시간 (초)
  quiz_time_sec INTEGER DEFAULT 0,        -- 퀴즈 소요 시간 (초)
  total_study_sec INTEGER DEFAULT 0,      -- 총 학습 시간 (초)
  -- 퀴즈 결과
  quiz_score INTEGER,                     -- 퀴즈 점수 (%)
  quiz_answers JSONB,                     -- 기사 답변 기록
  quiz_passed BOOLEAN DEFAULT false,
  -- 이수 상태
  status TEXT CHECK (status IN ('in_progress','completed','expired')) DEFAULT 'in_progress',
  completed_at TIMESTAMPTZ,
  -- 이수증
  certificate_url TEXT,                   -- 이수증 PDF URL
  certificate_number TEXT,                -- 이수증 번호
  -- 무결성
  last_activity_at TIMESTAMPTZ DEFAULT now(),
  ip_address TEXT,
  user_agent TEXT,
  created_at TIMESTAMPTZ DEFAULT now(),
  UNIQUE (course_id, driver_id)
);

-- 교육 진행 로그 (빨리감기 차단, 탭이탈 감지용)
CREATE TABLE education_activity_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  record_id UUID REFERENCES education_records(id) ON DELETE CASCADE,
  event_type TEXT CHECK (event_type IN (
    'video_play','video_pause','video_seek','video_end',
    'tab_leave','tab_return','popup_shown','popup_answered',
    'quiz_start','quiz_submit','text_scroll'
  )) NOT NULL,
  event_data JSONB,                       -- {position_sec, answer, ...}
  created_at TIMESTAMPTZ DEFAULT now()
);

ALTER TABLE education_courses ENABLE ROW LEVEL SECURITY;
ALTER TABLE education_records ENABLE ROW LEVEL SECURITY;
ALTER TABLE education_activity_logs ENABLE ROW LEVEL SECURITY;

-- 교육: 기사 본인 기록만
CREATE POLICY "education_records_driver" ON education_records
  FOR ALL USING (
    driver_id IN (SELECT id FROM drivers WHERE user_id = auth.uid())
  );

-- 교육: 운영사 소속 기록
CREATE POLICY "education_records_agency" ON education_records
  FOR ALL USING (
    agency_id = (auth.jwt()->'app_metadata'->>'agency_id')::uuid
  );

-- 교육 과목: 운영사 소속
CREATE POLICY "education_courses_agency" ON education_courses
  FOR ALL USING (
    agency_id = (auth.jwt()->'app_metadata'->>'agency_id')::uuid
  );

-- 활동 로그: 본인 기록만
CREATE POLICY "education_logs_driver" ON education_activity_logs
  FOR ALL USING (
    record_id IN (
      SELECT id FROM education_records
      WHERE driver_id IN (SELECT id FROM drivers WHERE user_id = auth.uid())
    )
  );

-- ═══════════════════════════════════════════════════════
-- 인덱스
-- ═══════════════════════════════════════════════════════

CREATE INDEX IF NOT EXISTS idx_contracts_agency_status ON contracts(agency_id, status);
CREATE INDEX IF NOT EXISTS idx_contracts_document_number ON contracts(document_number);
CREATE INDEX IF NOT EXISTS idx_contracts_verification_code ON contracts(verification_code);
CREATE INDEX IF NOT EXISTS idx_contract_signatures_contract ON contract_signatures(contract_id);
CREATE INDEX IF NOT EXISTS idx_settlements_agency_period ON settlements(agency_id, period_start);
CREATE INDEX IF NOT EXISTS idx_subscriptions_agency_status ON subscriptions(agency_id, status);
CREATE INDEX IF NOT EXISTS idx_payment_history_subscription ON payment_history(subscription_id);

-- ═══════════════════════════════════════════════════════
-- 누락 컬럼 추가: contracts 테이블
-- (마이그레이션으로 추가된 컬럼 — 기준 스키마에 반영)
-- ═══════════════════════════════════════════════════════

ALTER TABLE contracts ADD COLUMN IF NOT EXISTS signed_pdf_hash TEXT;
ALTER TABLE contracts ADD COLUMN IF NOT EXISTS document_number TEXT;
ALTER TABLE contracts ADD COLUMN IF NOT EXISTS verification_code TEXT;
ALTER TABLE contracts ADD COLUMN IF NOT EXISTS timestamp_hash TEXT;

-- 누락 컬럼 추가: contract_signatures 테이블
ALTER TABLE contract_signatures ADD COLUMN IF NOT EXISTS audit_log JSONB;
ALTER TABLE contract_signatures ADD COLUMN IF NOT EXISTS audit_certificate_url TEXT;

-- ═══════════════════════════════════════════════════════
-- 누락 테이블: contract_amendments (계약 변경)
-- ═══════════════════════════════════════════════════════

CREATE TABLE IF NOT EXISTS contract_amendments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  agency_id UUID NOT NULL REFERENCES agencies(id) ON DELETE CASCADE,
  contract_id UUID REFERENCES contracts(id) ON DELETE SET NULL,
  driver_id UUID NOT NULL REFERENCES drivers(id) ON DELETE CASCADE,
  amendment_type TEXT NOT NULL CHECK (amendment_type IN (
    'rate_change', 'insurance_change', 'deduction_change',
    'area_change', 'renewal', 'general_change'
  )),
  title TEXT NOT NULL,
  description TEXT,
  changes JSONB DEFAULT '{"before":{}, "after":{}}',
  effective_date DATE,
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'approved', 'rejected', 'cancelled')),
  approved_by UUID REFERENCES auth.users(id),
  approved_at TIMESTAMPTZ,
  rejection_reason TEXT,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

ALTER TABLE contract_amendments ENABLE ROW LEVEL SECURITY;

CREATE POLICY "amendments_agency" ON contract_amendments
  FOR ALL USING (agency_id = (auth.jwt()->'app_metadata'->>'agency_id')::uuid);

CREATE INDEX IF NOT EXISTS idx_amendments_agency ON contract_amendments(agency_id, status);
CREATE INDEX IF NOT EXISTS idx_amendments_driver ON contract_amendments(driver_id);

-- ═══════════════════════════════════════════════════════
-- 누락 테이블: driver_contract_periods (계약 기간)
-- ═══════════════════════════════════════════════════════

CREATE TABLE IF NOT EXISTS driver_contract_periods (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  driver_id UUID NOT NULL REFERENCES drivers(id) ON DELETE CASCADE,
  agency_id UUID NOT NULL REFERENCES agencies(id) ON DELETE CASCADE,
  contract_id UUID REFERENCES contracts(id) ON DELETE SET NULL,
  period_start DATE NOT NULL,
  period_end DATE,
  status TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'expired', 'terminated')),
  auto_renew BOOLEAN DEFAULT true,
  renewal_months INTEGER DEFAULT 12,
  notes TEXT,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

ALTER TABLE driver_contract_periods ENABLE ROW LEVEL SECURITY;

CREATE POLICY "contract_periods_agency" ON driver_contract_periods
  FOR ALL USING (agency_id = (auth.jwt()->'app_metadata'->>'agency_id')::uuid);

CREATE INDEX IF NOT EXISTS idx_contract_periods_driver ON driver_contract_periods(driver_id);
CREATE INDEX IF NOT EXISTS idx_contract_periods_agency ON driver_contract_periods(agency_id, status);

-- ═══════════════════════════════════════════════════════
-- 누락 테이블: contract_verification_logs (진위확인 로그)
-- ═══════════════════════════════════════════════════════

CREATE TABLE IF NOT EXISTS contract_verification_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  contract_id UUID NOT NULL REFERENCES contracts(id) ON DELETE CASCADE,
  verification_code TEXT NOT NULL,
  verifier_ip TEXT,
  verifier_user_agent TEXT,
  result TEXT NOT NULL CHECK (result IN ('valid', 'invalid', 'expired', 'not_found')),
  created_at TIMESTAMPTZ DEFAULT now()
);

ALTER TABLE contract_verification_logs ENABLE ROW LEVEL SECURITY;

CREATE POLICY "verification_logs_read_agency" ON contract_verification_logs
  FOR SELECT USING (
    contract_id IN (
      SELECT id FROM contracts WHERE agency_id = (auth.jwt()->'app_metadata'->>'agency_id')::uuid
    )
  );

CREATE INDEX IF NOT EXISTS idx_verification_logs_contract ON contract_verification_logs(contract_id);
CREATE INDEX IF NOT EXISTS idx_verification_logs_code ON contract_verification_logs(verification_code);

-- ═══════════════════════════════════════════════════════
-- 누락 테이블: integrity_check_results (무결성 검사 이력)
-- ═══════════════════════════════════════════════════════

CREATE TABLE IF NOT EXISTS integrity_check_results (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  checked_at TIMESTAMPTZ NOT NULL,
  triggered_by TEXT NOT NULL CHECK (triggered_by IN ('cron', 'manual')),
  checked_by_user_id UUID REFERENCES auth.users(id),
  total_contracts INTEGER NOT NULL DEFAULT 0,
  passed INTEGER NOT NULL DEFAULT 0,
  failed INTEGER NOT NULL DEFAULT 0,
  failures JSONB DEFAULT '[]',
  duration_ms INTEGER DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT now()
);

ALTER TABLE integrity_check_results ENABLE ROW LEVEL SECURITY;

CREATE POLICY "integrity_results_admin" ON integrity_check_results
  FOR SELECT USING (
    (auth.jwt()->'app_metadata'->>'role') IN ('provider_admin', 'agency_admin')
  );

CREATE INDEX IF NOT EXISTS idx_integrity_results_checked_at ON integrity_check_results(checked_at DESC);

-- ============================================================
-- RLS 보완: 기존 테이블 중 RLS 미적용 건
-- Added: 2026-03-31
-- ============================================================

-- agencies: 소속 사용자만 접근
ALTER TABLE agencies ENABLE ROW LEVEL SECURITY;

CREATE POLICY "agencies_own" ON agencies
  FOR ALL USING (
    id = (auth.jwt()->'app_metadata'->>'agency_id')::uuid
  );

CREATE POLICY "agencies_provider_admin" ON agencies
  FOR ALL USING (
    (auth.jwt()->'app_metadata'->>'role') = 'provider_admin'
  );

-- providers: 슈퍼관리자만
ALTER TABLE providers ENABLE ROW LEVEL SECURITY;

CREATE POLICY "providers_admin_only" ON providers
  FOR ALL USING (
    (auth.jwt()->'app_metadata'->>'role') = 'provider_admin'
  );

-- contract_templates: 소속 대리점 것만
ALTER TABLE contract_templates ENABLE ROW LEVEL SECURITY;

CREATE POLICY "templates_agency" ON contract_templates
  FOR ALL USING (
    agency_id = (auth.jwt()->'app_metadata'->>'agency_id')::uuid
  );

CREATE POLICY "templates_system_read" ON contract_templates
  FOR SELECT USING (is_system = true);

-- subscriptions: 소속 대리점 것만
ALTER TABLE subscriptions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "subscriptions_agency" ON subscriptions
  FOR SELECT USING (
    agency_id = (auth.jwt()->'app_metadata'->>'agency_id')::uuid
  );

CREATE POLICY "subscriptions_provider_admin" ON subscriptions
  FOR ALL USING (
    (auth.jwt()->'app_metadata'->>'role') = 'provider_admin'
  );

-- ============================================================
-- RPC: Amendment 승인 시 원자적 기간 전환
-- ============================================================

CREATE OR REPLACE FUNCTION approve_amendment_with_period(
  p_driver_id UUID,
  p_agency_id UUID,
  p_amendment_id UUID,
  p_effective_date DATE,
  p_period_end DATE,
  p_rate_config JSONB,
  p_memo TEXT DEFAULT ''
) RETURNS VOID AS $$
DECLARE
  v_caller_role TEXT;
  v_caller_agency_id UUID;
BEGIN
  -- ✅ 권한 검증: 호출자가 해당 agency의 admin인지 확인
  v_caller_role := (auth.jwt()->'app_metadata'->>'role');
  v_caller_agency_id := (auth.jwt()->'app_metadata'->>'agency_id')::uuid;

  IF v_caller_role NOT IN ('agency_admin', 'provider_admin') THEN
    RAISE EXCEPTION '권한이 없습니다 (role: %)', v_caller_role;
  END IF;

  IF v_caller_role = 'agency_admin' AND v_caller_agency_id != p_agency_id THEN
    RAISE EXCEPTION '다른 운영사의 데이터에 접근할 수 없습니다';
  END IF;

  -- 1. 기존 active 기간 만료 처리
  UPDATE driver_contract_periods
  SET status = 'expired',
      period_end = p_effective_date - INTERVAL '1 day',
      updated_at = now()
  WHERE driver_id = p_driver_id
    AND status = 'active';

  -- 2. 새 기간 생성
  INSERT INTO driver_contract_periods (
    agency_id, driver_id, period_start, period_end,
    rate_config, status, amendment_id, memo
  ) VALUES (
    p_agency_id, p_driver_id, p_effective_date, p_period_end,
    p_rate_config, 'active', p_amendment_id, p_memo
  );

  -- 3. 변경계약서 상태 업데이트
  UPDATE contract_amendments
  SET status = 'approved',
      approved_at = now(),
      updated_at = now()
  WHERE id = p_amendment_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ============================================================
-- 보안 로깅: security_logs 테이블
-- Added: 2026-03-31
-- ============================================================

CREATE TABLE IF NOT EXISTS security_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  event_type TEXT NOT NULL CHECK (event_type IN (
    'auth_failure', 'auth_success', 'permission_denied',
    'cron_access', 'data_modification', 'rate_limit_hit',
    'integrity_failure', 'suspicious_activity'
  )),
  actor_id UUID REFERENCES auth.users(id),
  actor_ip TEXT,
  actor_user_agent TEXT,
  resource TEXT,
  resource_id TEXT,
  details JSONB DEFAULT '{}',
  severity TEXT NOT NULL CHECK (severity IN ('info', 'warning', 'critical')),
  created_at TIMESTAMPTZ DEFAULT now()
);

ALTER TABLE security_logs ENABLE ROW LEVEL SECURITY;

-- 보안 로그는 서비스 롤 또는 provider_admin만 조회 가능
CREATE POLICY "security_logs_admin_read" ON security_logs
  FOR SELECT USING (
    (auth.jwt()->'app_metadata'->>'role') = 'provider_admin'
  );

-- 보안 로그 삽입은 서비스 롤(service_role)에서만 가능하므로 별도 INSERT 정책 불필요
-- security-logger.ts는 supabaseAdmin(service_role)으로 삽입

CREATE INDEX IF NOT EXISTS idx_security_logs_event_type ON security_logs(event_type);
CREATE INDEX IF NOT EXISTS idx_security_logs_created_at ON security_logs(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_security_logs_severity ON security_logs(severity);

-- ═══════════════════════════════════════════════
-- 도장(인장) 관리
-- ═══════════════════════════════════════════════
CREATE TABLE seals (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  owner_type TEXT NOT NULL CHECK (owner_type IN ('agency', 'driver')),
  owner_id UUID NOT NULL,               -- agencies.id or drivers.id
  category TEXT CHECK (category IN ('personal', 'corporate', 'upload')) DEFAULT 'personal',
  script TEXT CHECK (script IN ('hangul', 'hanja')) DEFAULT 'hangul',
  seal_image_url TEXT,                   -- Storage public URL
  seal_data_uri TEXT,                    -- base64 data URI (빠른 미리보기용)
  template_id TEXT,                      -- 사용된 템플릿 ID
  name_text TEXT NOT NULL,               -- 도장에 들어간 텍스트
  is_default BOOLEAN DEFAULT false,
  created_at TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX idx_seals_owner ON seals(owner_type, owner_id);
CREATE INDEX idx_seals_default ON seals(owner_type, owner_id) WHERE is_default = true;

ALTER TABLE seals ENABLE ROW LEVEL SECURITY;

CREATE POLICY "seals_select" ON seals FOR SELECT USING (true);
CREATE POLICY "seals_insert" ON seals FOR INSERT WITH CHECK (true);
CREATE POLICY "seals_update" ON seals FOR UPDATE USING (true);
CREATE POLICY "seals_delete" ON seals FOR DELETE USING (true);

-- ═══════════════════════════════════════════════
-- 문서 파일 관리 (업로드 → 도장 날인 → 전자서명 → 전송)
-- ═══════════════════════════════════════════════
CREATE TABLE document_files (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  agency_id UUID REFERENCES agencies(id) ON DELETE CASCADE,
  title TEXT NOT NULL,
  file_url TEXT NOT NULL,
  file_type TEXT CHECK (file_type IN ('pdf', 'docx', 'image')) DEFAULT 'pdf',
  file_size INTEGER DEFAULT 0,
  seal_positions JSONB,                  -- [{page, x, y, width, seal_id, signer_type}]
  status TEXT CHECK (status IN ('uploaded', 'sealed', 'signed', 'sent')) DEFAULT 'uploaded',
  recipients TEXT[],                     -- 전송 대상 driver_ids
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX idx_document_files_agency ON document_files(agency_id);
CREATE INDEX idx_document_files_status ON document_files(status);

ALTER TABLE document_files ENABLE ROW LEVEL SECURITY;

CREATE POLICY "doc_files_select" ON document_files FOR SELECT USING (true);
CREATE POLICY "doc_files_insert" ON document_files FOR INSERT WITH CHECK (true);
CREATE POLICY "doc_files_update" ON document_files FOR UPDATE USING (true);
CREATE POLICY "doc_files_delete" ON document_files FOR DELETE USING (true);

-- ═══════════════════════════════════════════════
-- 문서 배달 추적 (전송 → 열람 → 서명 상태 관리)
-- ═══════════════════════════════════════════════
CREATE TABLE document_deliveries (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  agency_id UUID REFERENCES agencies(id) ON DELETE CASCADE,
  document_file_id UUID REFERENCES document_files(id) ON DELETE SET NULL,
  contract_id UUID REFERENCES contracts(id) ON DELETE SET NULL,
  driver_id UUID NOT NULL REFERENCES drivers(id) ON DELETE CASCADE,
  send_type TEXT NOT NULL CHECK (send_type IN ('registration', 'renewal', 'amendment', 'general', 'education')),
  send_method TEXT NOT NULL CHECK (send_method IN ('push', 'sms', 'both')) DEFAULT 'push',
  title TEXT NOT NULL,
  message TEXT,
  status TEXT NOT NULL CHECK (status IN ('sent', 'delivered', 'viewed', 'signed', 'rejected')) DEFAULT 'sent',
  sent_at TIMESTAMPTZ DEFAULT now(),
  viewed_at TIMESTAMPTZ,
  signed_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX idx_document_deliveries_agency ON document_deliveries(agency_id);
CREATE INDEX idx_document_deliveries_driver ON document_deliveries(driver_id);
CREATE INDEX idx_document_deliveries_status ON document_deliveries(driver_id, status);

ALTER TABLE document_deliveries ENABLE ROW LEVEL SECURITY;

CREATE POLICY "doc_delivery_select" ON document_deliveries FOR SELECT USING (true);
CREATE POLICY "doc_delivery_insert" ON document_deliveries FOR INSERT WITH CHECK (true);
CREATE POLICY "doc_delivery_update" ON document_deliveries FOR UPDATE USING (true);
CREATE POLICY "doc_delivery_delete" ON document_deliveries FOR DELETE USING (true);

-- ═══════════════════════════════════════════════
-- 문서 서명 필드 (체크/도장/서명/날짜/텍스트 위치 정보)
-- 대리점이 PDF 업로드 후 필드 위치를 지정 → 기사가 앱에서 서명/체크/날인
-- ═══════════════════════════════════════════════
CREATE TABLE document_sign_fields (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  document_file_id UUID NOT NULL REFERENCES document_files(id) ON DELETE CASCADE,
  field_type TEXT NOT NULL CHECK (field_type IN (
    'checkbox',       -- 체크박스 (터치하면 ✓)
    'signature',      -- 자필서명 (서명패드 팝업)
    'seal',           -- 도장날인 (등록된 도장 자동 또는 선택)
    'date',           -- 날짜 (서명 시점 자동 입력)
    'text'            -- 텍스트 입력 (기사가 직접 입력)
  )),
  page_number INTEGER NOT NULL DEFAULT 1,     -- PDF 페이지 번호
  x REAL NOT NULL,                             -- 좌측 상단 X (% 비율, 0~100)
  y REAL NOT NULL,                             -- 좌측 상단 Y (% 비율, 0~100)
  width REAL NOT NULL DEFAULT 10,              -- 너비 (% 비율)
  height REAL NOT NULL DEFAULT 5,              -- 높이 (% 비율)
  label TEXT,                                  -- 필드 설명 (예: "계약동의", "대표인감")
  required BOOLEAN DEFAULT true,               -- 필수 여부
  sort_order INTEGER DEFAULT 0,                -- 정렬 순서 (기사 앱에서 순서대로 안내)
  default_value TEXT,                           -- 기본값 (date→format, text→placeholder)
  created_at TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX idx_doc_sign_fields_doc ON document_sign_fields(document_file_id);

ALTER TABLE document_sign_fields ENABLE ROW LEVEL SECURITY;
CREATE POLICY "sign_fields_select" ON document_sign_fields FOR SELECT USING (true);
CREATE POLICY "sign_fields_insert" ON document_sign_fields FOR INSERT WITH CHECK (true);
CREATE POLICY "sign_fields_update" ON document_sign_fields FOR UPDATE USING (true);
CREATE POLICY "sign_fields_delete" ON document_sign_fields FOR DELETE USING (true);

-- ═══════════════════════════════════════════════
-- 문서 서명 응답 (기사가 각 필드에 입력한 값)
-- ═══════════════════════════════════════════════
CREATE TABLE document_sign_responses (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  delivery_id UUID NOT NULL REFERENCES document_deliveries(id) ON DELETE CASCADE,
  field_id UUID NOT NULL REFERENCES document_sign_fields(id) ON DELETE CASCADE,
  driver_id UUID NOT NULL REFERENCES drivers(id) ON DELETE CASCADE,
  value TEXT,                    -- checkbox→'true', date→'2026-04-01', text→입력값
  image_data TEXT,               -- signature/seal→base64 PNG 이미지
  signed_at TIMESTAMPTZ DEFAULT now(),
  UNIQUE (delivery_id, field_id)
);

CREATE INDEX idx_doc_sign_responses_delivery ON document_sign_responses(delivery_id);

ALTER TABLE document_sign_responses ENABLE ROW LEVEL SECURITY;
CREATE POLICY "sign_resp_select" ON document_sign_responses FOR SELECT USING (true);
CREATE POLICY "sign_resp_insert" ON document_sign_responses FOR INSERT WITH CHECK (true);
CREATE POLICY "sign_resp_update" ON document_sign_responses FOR UPDATE USING (true);

-- ═══════════════════════════════════════════
-- Supabase Storage Buckets
-- ═══════════════════════════════════════════
INSERT INTO storage.buckets (id, name, public) VALUES ('contracts', 'contracts', false)
  ON CONFLICT (id) DO NOTHING;
INSERT INTO storage.buckets (id, name, public) VALUES ('documents', 'documents', false)
  ON CONFLICT (id) DO NOTHING;
INSERT INTO storage.buckets (id, name, public) VALUES ('education', 'education', false)
  ON CONFLICT (id) DO NOTHING;
INSERT INTO storage.buckets (id, name, public) VALUES ('seals', 'seals', true)
  ON CONFLICT (id) DO NOTHING;
INSERT INTO storage.buckets (id, name, public) VALUES ('settlements', 'settlements', false)
  ON CONFLICT (id) DO NOTHING;

-- Storage policies: 인증된 사용자만 업로드, 다운로드는 public
CREATE POLICY "storage_contracts_select" ON storage.objects FOR SELECT USING (bucket_id = 'contracts');
CREATE POLICY "storage_contracts_insert" ON storage.objects FOR INSERT WITH CHECK (bucket_id = 'contracts' AND auth.role() = 'authenticated');
CREATE POLICY "storage_documents_select" ON storage.objects FOR SELECT USING (bucket_id = 'documents');
CREATE POLICY "storage_documents_insert" ON storage.objects FOR INSERT WITH CHECK (bucket_id = 'documents' AND auth.role() = 'authenticated');
CREATE POLICY "storage_education_select" ON storage.objects FOR SELECT USING (bucket_id = 'education');
CREATE POLICY "storage_education_insert" ON storage.objects FOR INSERT WITH CHECK (bucket_id = 'education' AND auth.role() = 'authenticated');
CREATE POLICY "storage_seals_select" ON storage.objects FOR SELECT USING (bucket_id = 'seals');
CREATE POLICY "storage_seals_insert" ON storage.objects FOR INSERT WITH CHECK (bucket_id = 'seals' AND auth.role() = 'authenticated');