/**
 * 플랜별 기능과 사용 한도 정의
 * 모든 플랜 정책 계산의 단일 기준점으로 사용한다.
 */

export type PlanType = 'free' | 'point' | 'basic' | 'standard' | 'pro' | 'enterprise'

export type PlanFeature =
  | 'dashboard'
  | 'drivers'
  | 'contracts'
  | 'contracts.templates'
  | 'settlements.basic'
  | 'settlements.builder'
  | 'settlements.tax'
  | 'settlements.upload'
  | 'reports'
  | 'notices'
  | 'settings'

export interface PlanLimits {
  maxDrivers: number | null
  maxAdminAccounts: number
  maxDefaultTemplates: number
  maxUploadTemplates: number
  monthlyFreeContracts: number | null
  features: Record<PlanFeature, boolean>
}

const PLAN_ORDER: PlanType[] = ['free', 'point', 'basic', 'standard', 'pro', 'enterprise']

const FREE_FEATURES: Record<PlanFeature, boolean> = {
  dashboard: true,
  drivers: true,
  contracts: false,
  'contracts.templates': false,
  'settlements.basic': true,
  'settlements.builder': false,
  'settlements.tax': false,
  'settlements.upload': false,
  reports: false,
  notices: true,
  settings: true,
}

const BASIC_FEATURES: Record<PlanFeature, boolean> = {
  dashboard: true,
  drivers: true,
  contracts: true,
  'contracts.templates': true,
  'settlements.basic': true,
  'settlements.builder': true,
  'settlements.tax': true,
  'settlements.upload': true,
  reports: false,
  notices: true,
  settings: true,
}

const STANDARD_FEATURES: Record<PlanFeature, boolean> = {
  dashboard: true,
  drivers: true,
  contracts: true,
  'contracts.templates': true,
  'settlements.basic': true,
  'settlements.builder': true,
  'settlements.tax': true,
  'settlements.upload': true,
  reports: true,
  notices: true,
  settings: true,
}

const ALL_FEATURES: Record<PlanFeature, boolean> = {
  dashboard: true,
  drivers: true,
  contracts: true,
  'contracts.templates': true,
  'settlements.basic': true,
  'settlements.builder': true,
  'settlements.tax': true,
  'settlements.upload': true,
  reports: true,
  notices: true,
  settings: true,
}

const POINT_FEATURES: Record<PlanFeature, boolean> = {
  dashboard: true,
  drivers: true,
  contracts: true,
  'contracts.templates': true,
  'settlements.basic': true,
  'settlements.builder': true,
  'settlements.tax': true,
  'settlements.upload': true,
  reports: false,
  notices: true,
  settings: true,
}

export const PLAN_LIMITS: Record<PlanType, PlanLimits> = {
  free: {
    maxDrivers: 5,
    maxAdminAccounts: 0,
    maxDefaultTemplates: 999,
    maxUploadTemplates: 999,
    monthlyFreeContracts: 60,
    features: FREE_FEATURES,
  },
  point: {
    maxDrivers: null,
    maxAdminAccounts: 2,
    maxDefaultTemplates: 999,
    maxUploadTemplates: 999,
    monthlyFreeContracts: 60,
    features: POINT_FEATURES,
  },
  basic: {
    maxDrivers: 30,
    maxAdminAccounts: 2,
    maxDefaultTemplates: 999,
    maxUploadTemplates: 999,
    monthlyFreeContracts: 160,
    features: BASIC_FEATURES,
  },
  standard: {
    maxDrivers: 80,
    maxAdminAccounts: 5,
    maxDefaultTemplates: 999,
    maxUploadTemplates: 999,
    monthlyFreeContracts: 300,
    features: STANDARD_FEATURES,
  },
  pro: {
    maxDrivers: 150,
    maxAdminAccounts: 10,
    maxDefaultTemplates: 999,
    maxUploadTemplates: 999,
    monthlyFreeContracts: null,
    features: ALL_FEATURES,
  },
  enterprise: {
    maxDrivers: null,
    maxAdminAccounts: 99,
    maxDefaultTemplates: 999,
    maxUploadTemplates: 999,
    monthlyFreeContracts: null,
    features: ALL_FEATURES,
  },
}

export const PLAN_LABELS: Record<PlanType, string> = {
  free: 'Free',
  point: '포인트형',
  basic: 'Basic',
  standard: 'Standard',
  pro: 'Pro',
  enterprise: 'Enterprise',
}

export const PLAN_PRICES: Record<PlanType, number> = {
  free: 0,
  point: 0,
  basic: 49900,
  standard: 99000,
  pro: 199000,
  enterprise: 0,
}

export const PLAN_DISCOUNTS: Record<string, number> = {
  monthly: 0,
  '1year': 20,
  '2year': 30,
  '3year': 40,
}

export const PLAN_HIGHLIGHTS: Record<PlanType, string[]> = {
  free: ['기사 5명 무료 (앱 제공)', '초과 시 3,000P/명/월', '기본 정산', '가입 축하 5,000P'],
  point: ['기사 5명 무료 (앱 제공)', '초과 시 3,000P/명/월', '사용량 기반 결제', '포인트 충전형'],
  basic: ['기사 30명 (앱 제공)', '전자계약 무제한', '정산서 빌더', '세금계산서'],
  standard: ['기사 80명 (앱 제공)', '전자계약 무제한', '매출 리포트', '실시간 알림'],
  pro: ['기사 150명 (앱 제공)', '전자계약 무제한', 'API 연동', '대량 처리'],
  enterprise: ['기사 무제한 (앱 제공)', '전자계약 무제한', '전담 매니저', '맞춤형 정산'],
}

export function getSubscriptionPrice(plan: PlanType, billing: string = 'monthly'): number {
  const monthly = PLAN_PRICES[plan] ?? 0
  if (monthly === 0) return 0
  const discount = PLAN_DISCOUNTS[billing] ?? 0
  const months = billing === '1year' ? 12 : billing === '2year' ? 24 : billing === '3year' ? 36 : 1
  return Math.round(monthly * (1 - discount / 100) * months)
}

export const FEATURE_LABELS: Record<PlanFeature, string> = {
  dashboard: '대시보드',
  drivers: '기사 관리',
  contracts: '계약 관리',
  'contracts.templates': '계약서 템플릿',
  'settlements.basic': '정산 관리',
  'settlements.builder': '정산서 빌더',
  'settlements.tax': '세금계산서',
  'settlements.upload': '정산 업로드',
  reports: '매출 리포트',
  notices: '공지사항',
  settings: '설정',
}

export function isPaidPlan(plan: PlanType): boolean {
  return plan !== 'free'
}

export function getPlanLimits(plan: string | undefined): PlanLimits {
  const key = (plan || 'free') as PlanType
  return PLAN_LIMITS[key] ?? PLAN_LIMITS.free
}

export function hasFeature(plan: string | undefined, feature: PlanFeature): boolean {
  const limits = getPlanLimits(plan)
  return limits.features[feature] ?? false
}

export function getMinimumPlan(feature: PlanFeature): PlanType {
  for (const plan of PLAN_ORDER) {
    if (PLAN_LIMITS[plan].features[feature]) return plan
  }
  return 'enterprise'
}

export function isPlanAtLeast(current: string | undefined, required: PlanType): boolean {
  const currentIdx = PLAN_ORDER.indexOf((current || 'free') as PlanType)
  const requiredIdx = PLAN_ORDER.indexOf(required)
  if (currentIdx === -1) return false
  return currentIdx >= requiredIdx
}

export type PointAction =
  | 'contract_send'
  | 'settlement_generate'
  | 'settlement_pdf'
  | 'driver_register'
  | 'driver_extra'
  | 'excel_upload'
  | 'tax_invoice'
  | 'report_generate'
  | 'template_upload'

export const POINT_COSTS: Record<PointAction, { cost: number; label: string; desc: string }> = {
  contract_send: { cost: 500, label: '계약서 발송', desc: '기사 1명에게 계약/서류 1건 발송' },
  settlement_generate: { cost: 700, label: '정산서 생성', desc: '기사 5명당 1회 정산서 생성' },
  settlement_pdf: { cost: 0, label: '정산 PDF', desc: '정산 PDF 다운로드' },
  driver_register: { cost: 0, label: '기사 등록', desc: '기사 신규 등록' },
  driver_extra: { cost: 3000, label: '추가 기사 등록', desc: '플랜 한도 초과 기사 1명 월 등록비' },
  excel_upload: { cost: 2500, label: '정산 업로드', desc: '정산 엑셀 1회 업로드 처리' },
  tax_invoice: { cost: 0, label: '세금계산서', desc: '세금계산서 발행 기능' },
  report_generate: { cost: 0, label: '리포트 생성', desc: '매출 리포트 생성' },
  template_upload: { cost: 0, label: '템플릿 업로드', desc: 'PDF 템플릿 업로드' },
}

export const WELCOME_BONUS_POINTS = 5000
export const EXTRA_DRIVER_MONTHLY_POINTS = 3000
export const FREE_PLAN_FREE_DRIVERS = 5

export const POINT_PACKAGES = [
  { points: 5000, price: 5000, bonus: 0 },
  { points: 10000, price: 10000, bonus: 500 },
  { points: 30000, price: 30000, bonus: 2000 },
  { points: 50000, price: 50000, bonus: 5000 },
  { points: 100000, price: 100000, bonus: 15000 },
]

export function estimatePointCost(actions: Partial<Record<PointAction, number>>): number {
  let total = 0
  for (const [action, count] of Object.entries(actions)) {
    const cost = POINT_COSTS[action as PointAction]?.cost ?? 0
    total += cost * (count ?? 0)
  }
  return total
}

export function getFeatureForRoute(pathname: string): PlanFeature | null {
  if (pathname.includes('/contracts/templates')) return 'contracts.templates'
  if (pathname.includes('/contracts')) return 'contracts'
  if (pathname.includes('/settlements/builder')) return 'settlements.builder'
  if (pathname.includes('/settlements/upload')) return 'settlements.upload'
  if (pathname.includes('/settlements/tax') || pathname.includes('/tax-invoices')) return 'settlements.tax'
  if (pathname.includes('/settlements')) return 'settlements.basic'
  if (pathname.includes('/reports')) return 'reports'
  if (pathname.includes('/drivers')) return 'drivers'
  if (pathname.includes('/dashboard')) return 'dashboard'
  if (pathname.includes('/notices')) return 'notices'
  if (pathname.includes('/settings')) return 'settings'
  return null
}
