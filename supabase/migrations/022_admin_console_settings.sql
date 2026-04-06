CREATE TABLE IF NOT EXISTS admin_settings (
  key TEXT PRIMARY KEY,
  value JSONB NOT NULL DEFAULT '{}'::jsonb,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_by UUID
);

CREATE INDEX IF NOT EXISTS idx_admin_settings_updated_at ON admin_settings(updated_at DESC);

ALTER TABLE admin_settings ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS admin_settings_provider_admin_select ON admin_settings;
CREATE POLICY admin_settings_provider_admin_select ON admin_settings
  FOR SELECT
  USING ((auth.jwt() -> 'app_metadata' ->> 'role') = 'provider_admin');

DROP POLICY IF EXISTS admin_settings_provider_admin_update ON admin_settings;
CREATE POLICY admin_settings_provider_admin_update ON admin_settings
  FOR ALL
  USING ((auth.jwt() -> 'app_metadata' ->> 'role') = 'provider_admin')
  WITH CHECK ((auth.jwt() -> 'app_metadata' ->> 'role') = 'provider_admin');

INSERT INTO admin_settings (key, value)
VALUES
  (
    'general',
    jsonb_build_object(
      'platformName', 'logiSSign',
      'supportEmail', 'admin@precision.io',
      'supportPhone', '1588-0000',
      'settlementCloseDay', '매월 25일',
      'privacyOfficerEmail', 'privacy@precision.io',
      'privacyOfficerPhone', '1588-0000'
    )
  ),
  (
    'payment',
    jsonb_build_object(
      'enabledMethods', jsonb_build_array('CARD', 'EASY_PAY', 'TRANSFER', 'VIRTUAL_ACCOUNT'),
      'enabledEasyPayProviders', jsonb_build_array('KAKAOPAY', 'NAVERPAY', 'TOSSPAY', 'PAYCO'),
      'enabledVirtualAccountBanks', jsonb_build_array('KOOKMIN_BANK', 'SHINHAN_BANK', 'WOORI_BANK', 'HANA_BANK', 'KAKAO_BANK', 'TOSS_BANK'),
      'defaultVirtualAccountBank', 'KOOKMIN_BANK',
      'virtualAccountExpireHours', 24,
      'allowPlanPayments', true,
      'allowPointPayments', true
    )
  ),
  (
    'email_templates',
    jsonb_build_array(
      jsonb_build_object(
        'key', 'agency_signup_approved',
        'name', '회원가입 승인',
        'subject', '회원가입이 승인되었습니다.',
        'body', '안녕하세요.\n회원가입이 정상 승인되었습니다. 관리자 페이지에서 서비스 이용을 시작해 주세요.',
        'isActive', true
      ),
      jsonb_build_object(
        'key', 'settlement_sent',
        'name', '정산서 발송',
        'subject', '[{yearMonth}] 정산서가 발송되었습니다.',
        'body', '안녕하세요.\n이번 달 정산서가 발송되었습니다. 기사 앱에서 확인해 주세요.',
        'isActive', true
      ),
      jsonb_build_object(
        'key', 'contract_signature_request',
        'name', '전자계약 서명 요청',
        'subject', '전자계약 서명 요청이 도착했습니다.',
        'body', '안녕하세요.\n전자계약 서명 요청이 도착했습니다. 기사 앱에서 내용을 확인하고 서명해 주세요.',
        'isActive', true
      ),
      jsonb_build_object(
        'key', 'payment_failed',
        'name', '결제 실패 안내',
        'subject', '결제가 실패했습니다. 결제 수단을 확인해 주세요.',
        'body', '안녕하세요.\n결제 처리에 실패했습니다. 결제 수단을 다시 확인해 주세요.',
        'isActive', false
      ),
      jsonb_build_object(
        'key', 'payment_pending_virtual_account',
        'name', '가상계좌 입금 안내',
        'subject', '가상계좌가 발급되었습니다. 기한 내 입금해 주세요.',
        'body', '안녕하세요.\n가상계좌가 발급되었습니다. 안내된 계좌로 기한 내 입금해 주세요.',
        'isActive', true
      )
    )
  )
ON CONFLICT (key) DO NOTHING;
