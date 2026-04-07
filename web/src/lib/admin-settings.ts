import {
  EASY_PAY_PROVIDER_OPTIONS,
  PAYMENT_METHOD_OPTIONS,
  VIRTUAL_ACCOUNT_BANK_OPTIONS,
  type AgencyEasyPayProvider,
  type AgencyPaymentMethod,
} from '@/lib/payment-methods'

export interface AdminGeneralSettings {
  platformName: string
  supportEmail: string
  supportPhone: string
  settlementCloseDay: string
  privacyOfficerEmail: string
  privacyOfficerPhone: string
}

export interface AdminPaymentSettings {
  enabledMethods: AgencyPaymentMethod[]
  enabledEasyPayProviders: AgencyEasyPayProvider[]
  enabledVirtualAccountBanks: string[]
  defaultVirtualAccountBank: string
  virtualAccountExpireHours: number
  allowPlanPayments: boolean
  allowPointPayments: boolean
  subscriptionCardOnly: boolean
  allowBillingKeyManagement: boolean
  subscriptionExpiryNoticeDays: number[]
}

export interface AdminEmailTemplate {
  key: string
  name: string
  subject: string
  body: string
  isActive: boolean
}

export interface AdminSettingsPayload {
  general: AdminGeneralSettings
  payment: AdminPaymentSettings
  emailTemplates: AdminEmailTemplate[]
}

export const ADMIN_SETTINGS_KEYS = {
  general: 'general',
  payment: 'payment',
  emailTemplates: 'email_templates',
} as const

export const DEFAULT_ADMIN_GENERAL_SETTINGS: AdminGeneralSettings = {
  platformName: 'logiSSign',
  supportEmail: 'support@logissign.com',
  supportPhone: '1588-0000',
  settlementCloseDay: '매월 25일',
  privacyOfficerEmail: 'privacy@logissign.com',
  privacyOfficerPhone: '1588-0000',
}

export const DEFAULT_ADMIN_PAYMENT_SETTINGS: AdminPaymentSettings = {
  enabledMethods: PAYMENT_METHOD_OPTIONS.map((option) => option.value),
  enabledEasyPayProviders: EASY_PAY_PROVIDER_OPTIONS.map((option) => option.value),
  enabledVirtualAccountBanks: VIRTUAL_ACCOUNT_BANK_OPTIONS.map((option) => option.value),
  defaultVirtualAccountBank: VIRTUAL_ACCOUNT_BANK_OPTIONS[0]?.value ?? 'KOOKMIN_BANK',
  virtualAccountExpireHours: 24,
  allowPlanPayments: true,
  allowPointPayments: true,
  subscriptionCardOnly: true,
  allowBillingKeyManagement: true,
  subscriptionExpiryNoticeDays: [7, 3, 1],
}

export const DEFAULT_ADMIN_EMAIL_TEMPLATES: AdminEmailTemplate[] = [
  {
    key: 'agency_signup_approved',
    name: '가입 승인',
    subject: '가입이 승인되었습니다.',
    body: '안녕하세요.\n가입이 승인되었습니다. 관리자 페이지에서 바로 서비스를 시작해 주세요.',
    isActive: true,
  },
  {
    key: 'settlement_sent',
    name: '정산서 발송',
    subject: '[{yearMonth}] 정산서가 발송되었습니다.',
    body: '안녕하세요.\n이번 달 정산서가 발송되었습니다. 기사 앱에서 정산서를 확인해 주세요.',
    isActive: true,
  },
  {
    key: 'contract_signature_request',
    name: '전자계약 서명 요청',
    subject: '전자계약 서명 요청이 도착했습니다.',
    body: '안녕하세요.\n전자계약 서명 요청이 도착했습니다. 기사 앱에서 계약 내용을 확인하고 서명해 주세요.',
    isActive: true,
  },
  {
    key: 'payment_failed',
    name: '결제 실패 안내',
    subject: '결제에 실패했습니다. 결제 수단을 다시 확인해 주세요.',
    body: '안녕하세요.\n결제 처리에 실패했습니다. 결제 수단 또는 결제 정보를 다시 확인해 주세요.',
    isActive: false,
  },
  {
    key: 'payment_pending_virtual_account',
    name: '가상계좌 입금 안내',
    subject: '가상계좌가 발급되었습니다. 기한 내 입금해 주세요.',
    body: '안녕하세요.\n가상계좌가 발급되었습니다. 안내된 계좌로 기한 내 입금해 주세요.',
    isActive: true,
  },
  {
    key: 'subscription_expiry_notice',
    name: '플랜 만료 안내',
    subject: '이용 중인 플랜의 만료일이 가까워졌습니다.',
    body: '안녕하세요.\n이용 중인 플랜의 만료일이 가까워졌습니다. 결제 관리에서 카드 등록 상태와 다음 결제 일정을 확인해 주세요.',
    isActive: true,
  },
]

function uniqueStrings(values: unknown[], allowList?: readonly string[]): string[] {
  const normalized = values
    .filter((value): value is string => typeof value === 'string' && value.trim().length > 0)
    .map((value) => value.trim())
  const filtered = allowList ? normalized.filter((value) => allowList.includes(value)) : normalized
  return Array.from(new Set(filtered))
}

function uniqueIntegers(values: unknown[], min: number, max: number): number[] {
  const normalized = values
    .filter((value): value is number => typeof value === 'number' && Number.isFinite(value))
    .map((value) => Math.round(value))
    .filter((value) => value >= min && value <= max)

  return Array.from(new Set(normalized)).sort((a, b) => b - a)
}

export function normalizeAdminGeneralSettings(value: unknown): AdminGeneralSettings {
  const raw = typeof value === 'object' && value !== null ? (value as Record<string, unknown>) : {}

  return {
    platformName:
      typeof raw.platformName === 'string' && raw.platformName.trim()
        ? raw.platformName.trim()
        : DEFAULT_ADMIN_GENERAL_SETTINGS.platformName,
    supportEmail:
      typeof raw.supportEmail === 'string' && raw.supportEmail.trim()
        ? raw.supportEmail.trim()
        : DEFAULT_ADMIN_GENERAL_SETTINGS.supportEmail,
    supportPhone:
      typeof raw.supportPhone === 'string' && raw.supportPhone.trim()
        ? raw.supportPhone.trim()
        : DEFAULT_ADMIN_GENERAL_SETTINGS.supportPhone,
    settlementCloseDay:
      typeof raw.settlementCloseDay === 'string' && raw.settlementCloseDay.trim()
        ? raw.settlementCloseDay.trim()
        : DEFAULT_ADMIN_GENERAL_SETTINGS.settlementCloseDay,
    privacyOfficerEmail:
      typeof raw.privacyOfficerEmail === 'string' && raw.privacyOfficerEmail.trim()
        ? raw.privacyOfficerEmail.trim()
        : DEFAULT_ADMIN_GENERAL_SETTINGS.privacyOfficerEmail,
    privacyOfficerPhone:
      typeof raw.privacyOfficerPhone === 'string' && raw.privacyOfficerPhone.trim()
        ? raw.privacyOfficerPhone.trim()
        : DEFAULT_ADMIN_GENERAL_SETTINGS.privacyOfficerPhone,
  }
}

export function normalizeAdminPaymentSettings(value: unknown): AdminPaymentSettings {
  const raw = typeof value === 'object' && value !== null ? (value as Record<string, unknown>) : {}
  const enabledMethods = uniqueStrings(
    Array.isArray(raw.enabledMethods) ? raw.enabledMethods : [],
    PAYMENT_METHOD_OPTIONS.map((option) => option.value),
  ) as AgencyPaymentMethod[]
  const enabledEasyPayProviders = uniqueStrings(
    Array.isArray(raw.enabledEasyPayProviders) ? raw.enabledEasyPayProviders : [],
    EASY_PAY_PROVIDER_OPTIONS.map((option) => option.value),
  ) as AgencyEasyPayProvider[]
  const enabledVirtualAccountBanks = uniqueStrings(
    Array.isArray(raw.enabledVirtualAccountBanks) ? raw.enabledVirtualAccountBanks : [],
    VIRTUAL_ACCOUNT_BANK_OPTIONS.map((option) => option.value),
  )
  const subscriptionExpiryNoticeDays = uniqueIntegers(
    Array.isArray(raw.subscriptionExpiryNoticeDays) ? raw.subscriptionExpiryNoticeDays : [],
    1,
    30,
  )

  return {
    enabledMethods:
      enabledMethods.length > 0 ? enabledMethods : DEFAULT_ADMIN_PAYMENT_SETTINGS.enabledMethods,
    enabledEasyPayProviders:
      enabledEasyPayProviders.length > 0
        ? enabledEasyPayProviders
        : DEFAULT_ADMIN_PAYMENT_SETTINGS.enabledEasyPayProviders,
    enabledVirtualAccountBanks:
      enabledVirtualAccountBanks.length > 0
        ? enabledVirtualAccountBanks
        : DEFAULT_ADMIN_PAYMENT_SETTINGS.enabledVirtualAccountBanks,
    defaultVirtualAccountBank:
      typeof raw.defaultVirtualAccountBank === 'string' &&
      VIRTUAL_ACCOUNT_BANK_OPTIONS.some((bank) => bank.value === raw.defaultVirtualAccountBank)
        ? raw.defaultVirtualAccountBank
        : DEFAULT_ADMIN_PAYMENT_SETTINGS.defaultVirtualAccountBank,
    virtualAccountExpireHours:
      typeof raw.virtualAccountExpireHours === 'number' && Number.isFinite(raw.virtualAccountExpireHours)
        ? Math.max(1, Math.min(72, Math.round(raw.virtualAccountExpireHours)))
        : DEFAULT_ADMIN_PAYMENT_SETTINGS.virtualAccountExpireHours,
    allowPlanPayments:
      typeof raw.allowPlanPayments === 'boolean'
        ? raw.allowPlanPayments
        : DEFAULT_ADMIN_PAYMENT_SETTINGS.allowPlanPayments,
    allowPointPayments:
      typeof raw.allowPointPayments === 'boolean'
        ? raw.allowPointPayments
        : DEFAULT_ADMIN_PAYMENT_SETTINGS.allowPointPayments,
    subscriptionCardOnly:
      typeof raw.subscriptionCardOnly === 'boolean'
        ? raw.subscriptionCardOnly
        : DEFAULT_ADMIN_PAYMENT_SETTINGS.subscriptionCardOnly,
    allowBillingKeyManagement:
      typeof raw.allowBillingKeyManagement === 'boolean'
        ? raw.allowBillingKeyManagement
        : DEFAULT_ADMIN_PAYMENT_SETTINGS.allowBillingKeyManagement,
    subscriptionExpiryNoticeDays:
      subscriptionExpiryNoticeDays.length > 0
        ? subscriptionExpiryNoticeDays
        : DEFAULT_ADMIN_PAYMENT_SETTINGS.subscriptionExpiryNoticeDays,
  }
}

export function normalizeAdminEmailTemplates(value: unknown): AdminEmailTemplate[] {
  if (!Array.isArray(value)) {
    return DEFAULT_ADMIN_EMAIL_TEMPLATES
  }

  const normalized = value
    .filter((row): row is Record<string, unknown> => typeof row === 'object' && row !== null)
    .map((row) => ({
      key: typeof row.key === 'string' && row.key.trim() ? row.key.trim() : '',
      name: typeof row.name === 'string' && row.name.trim() ? row.name.trim() : '',
      subject: typeof row.subject === 'string' ? row.subject : '',
      body: typeof row.body === 'string' ? row.body : '',
      isActive: typeof row.isActive === 'boolean' ? row.isActive : true,
    }))
    .filter((row) => row.key && row.name)

  return normalized.length > 0 ? normalized : DEFAULT_ADMIN_EMAIL_TEMPLATES
}

export function buildAdminSettingsPayload(rows: Record<string, unknown>): AdminSettingsPayload {
  return {
    general: normalizeAdminGeneralSettings(rows[ADMIN_SETTINGS_KEYS.general]),
    payment: normalizeAdminPaymentSettings(rows[ADMIN_SETTINGS_KEYS.payment]),
    emailTemplates: normalizeAdminEmailTemplates(rows[ADMIN_SETTINGS_KEYS.emailTemplates]),
  }
}
