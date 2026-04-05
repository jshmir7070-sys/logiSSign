/**
 * 플랜별 기능 제한 설정
 * 모든 플랜 제한 로직은 이 파일을 참조합니다.
 */

export type PlanType = 'free' | 'point' | 'basic' | 'standard' | 'pro' | 'enterprise';

/** 플랜별 접근 가능 기능 키 */
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
  | 'settings';

export interface PlanLimits {
  maxDrivers: number | null;        // 기사 수 제한 (null = 무제한)
  maxAdminAccounts: number;          // 추가 관리자 계정 수
  maxDefaultTemplates: number;       // 기본 템플릿 선택 가능 수
  maxUploadTemplates: number;        // 업로드 템플릿 수
  features: Record<PlanFeature, boolean>;
}

/** 플랜 등급 순서 (비교용) — point는 별도 트랙이므로 free와 동급 */
const PLAN_ORDER: PlanType[] = ['free', 'point', 'basic', 'standard', 'pro', 'enterprise'];

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
};

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
};

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
};

/** Pro & Enterprise: 모든 기능 활성 */
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
};

/** 포인트 플랜: 건별 포인트 차감. 리포트는 구독형 전용 */
const POINT_FEATURES: Record<PlanFeature, boolean> = {
  dashboard: true,
  drivers: true,
  contracts: true,
  'contracts.templates': true,
  'settlements.basic': true,
  'settlements.builder': true,
  'settlements.tax': true,
  'settlements.upload': true,
  reports: false,           // 구독형 Standard 이상 전용
  notices: true,
  settings: true,
};

export const PLAN_LIMITS: Record<PlanType, PlanLimits> = {
  free: {
    maxDrivers: 5,            // 무료 5명, 초과 시 계정당 ₩1,500/월
    maxAdminAccounts: 0,
    maxDefaultTemplates: 0,
    maxUploadTemplates: 0,
    features: FREE_FEATURES,
  },
  point: {
    maxDrivers: null,  // 무제한 (5명 초과 시 ₩1,500/명/월)
    maxAdminAccounts: 2,
    maxDefaultTemplates: 5,
    maxUploadTemplates: 5,
    features: POINT_FEATURES,
  },
  basic: {
    maxDrivers: 30,
    maxAdminAccounts: 2,
    maxDefaultTemplates: 3,
    maxUploadTemplates: 3,
    features: BASIC_FEATURES,
  },
  standard: {
    maxDrivers: 80,
    maxAdminAccounts: 5,
    maxDefaultTemplates: 6,
    maxUploadTemplates: 6,
    features: STANDARD_FEATURES,
  },
  pro: {
    maxDrivers: 150,
    maxAdminAccounts: 10,
    maxDefaultTemplates: 10,
    maxUploadTemplates: 10,
    features: ALL_FEATURES,
  },
  enterprise: {
    maxDrivers: null,
    maxAdminAccounts: 99,
    maxDefaultTemplates: 99,
    maxUploadTemplates: 99,
    features: ALL_FEATURES,
  },
};

export const PLAN_LABELS: Record<PlanType, string> = {
  free: 'Free',
  point: '포인트 충전형',
  basic: 'Basic',
  standard: 'Standard',
  pro: 'Pro',
  enterprise: 'Enterprise',
};

/** 플랜별 월 가격 (원) — 모든 가격 참조의 단일 소스 */
export const PLAN_PRICES: Record<PlanType, number> = {
  free: 0,
  point: 0,       // 포인트형은 월정액 없음 (충전제)
  basic: 49900,
  standard: 99000,
  pro: 149000,
  enterprise: 199000,
};

/** 연간 할인율 (%) */
export const PLAN_DISCOUNTS: Record<string, number> = {
  monthly: 0,
  '1year': 20,
  '2year': 30,
  '3year': 40,
};

/** 플랜별 주요 기능 요약 (UI 표시용) */
export const PLAN_HIGHLIGHTS: Record<PlanType, string[]> = {
  free: ['기사 5명 무료', '초과 시 1,500P/명/월 차감', '기본 정산', '가입 시 5,000P 지급'],
  point: ['기사 5명 무료', '초과 시 1,500P/명/월 차감', '사용한 만큼만 결제', '가입 시 5,000P 지급'],
  basic: ['기사 30명', '전자계약서', '정산서 빌더', '세금계산서', '엑셀 업로드'],
  standard: ['기사 80명', 'Basic 전체', '매출 리포트', '푸시 알림'],
  pro: ['기사 150명', 'Standard 전체', 'API 연동', '대용량 처리'],
  enterprise: ['기사 무제한', '전담 매니저', 'SLA 99.9%', '맞춤형 정산'],
};

/** 구독 금액 계산 (billing cycle 반영) */
export function getSubscriptionPrice(plan: PlanType, billing: string = 'monthly'): number {
  const monthly = PLAN_PRICES[plan] ?? 0;
  if (monthly === 0) return 0;
  const discount = PLAN_DISCOUNTS[billing] ?? 0;
  const months = billing === '1year' ? 12 : billing === '2year' ? 24 : billing === '3year' ? 36 : 1;
  return Math.round(monthly * (1 - discount / 100) * months);
}

/** 기능별 한글 라벨 (업그레이드 안내 UI용) */
export const FEATURE_LABELS: Record<PlanFeature, string> = {
  dashboard: '대시보드',
  drivers: '기사 관리',
  contracts: '계약 관리',
  'contracts.templates': '계약서 템플릿',
  'settlements.basic': '정산 관리',
  'settlements.builder': '정산서 빌더',
  'settlements.tax': '세금계산서',
  'settlements.upload': '엑셀 업로드 정산',
  reports: '매출 리포트',
  notices: '공지사항',
  settings: '설정',
};

/** 유료 플랜 여부 */
export function isPaidPlan(plan: PlanType): boolean {
  return plan !== 'free';
}

/** 플랜 제한 조회 (안전하게 — 잘못된 값이면 free 반환) */
export function getPlanLimits(plan: string | undefined): PlanLimits {
  const key = (plan || 'free') as PlanType;
  return PLAN_LIMITS[key] ?? PLAN_LIMITS.free;
}

/** 특정 기능 사용 가능 여부 */
export function hasFeature(plan: string | undefined, feature: PlanFeature): boolean {
  const limits = getPlanLimits(plan);
  return limits.features[feature] ?? false;
}

/** 특정 기능을 사용하려면 최소 어떤 플랜이 필요한지 */
export function getMinimumPlan(feature: PlanFeature): PlanType {
  for (const p of PLAN_ORDER) {
    if (PLAN_LIMITS[p].features[feature]) return p;
  }
  return 'enterprise';
}

/** 현재 플랜이 요구 플랜 이상인지 비교 */
export function isPlanAtLeast(current: string | undefined, required: PlanType): boolean {
  const currentIdx = PLAN_ORDER.indexOf((current || 'free') as PlanType);
  const requiredIdx = PLAN_ORDER.indexOf(required);
  if (currentIdx === -1) return false;
  return currentIdx >= requiredIdx;
}

/* ══════════════════════ 포인트 단가 체계 ══════════════════════ */

/** 포인트 차감 항목 키 */
export type PointAction =
  | 'contract_send'        // 계약서 전송 (건당)
  | 'settlement_generate'  // 정산서 생성 (5명 1세트)
  | 'settlement_pdf'       // 정산서 PDF 다운로드 (건당)
  | 'driver_register'      // 기사 등록 (건당)
  | 'driver_extra'         // 플랜 초과 기사 (명당/월)
  | 'excel_upload'         // 엑셀 업로드 정산 (회당)
  | 'tax_invoice'          // 세금계산서 발행 (건당)
  | 'report_generate'      // 리포트 생성 (건당)
  | 'template_upload'      // 템플릿 업로드 (건당)

/**
 * 항목별 포인트 차감 단가
 * ── 유료 항목 (4개) ──
 *   계약서 전송 1,200P · 정산서 생성 700P/5명 · 엑셀 업로드 2,500P · 플랜 초과 기사 1,500P/명/월
 * ── 무료 항목 ──
 *   정산서 PDF · 정산서 전송 · 기사 등록 · 템플릿 업로드
 * ── 별도 ──
 *   세금계산서 (개발중) · 리포트 (구독 전용)
 * ── 알림 ──
 *   알림톡(카카오)으로만 운영. SMS 별도 과금 없음.
 * ── 플랜 초과 기사 ──
 *   무료·포인트형: 기사 5명 초과 시 1,500P/명/월 자동 차감
 *   구독형: 플랜 내 기사 수까지 무료 (초과 불가, 플랜 업그레이드 필요)
 *   포인트 부족 시 → 플랜 변경 또는 포인트 충전 알림
 */
export const POINT_COSTS: Record<PointAction, { cost: number; label: string; desc: string }> = {
  contract_send:       { cost: 1200, label: '계약서 전송',       desc: '기사 1명에게 계약서 1건 전송' },
  settlement_generate: { cost: 700,  label: '정산서 생성',       desc: '기사 5명 1세트 정산서 생성 (전송 무료)' },
  settlement_pdf:      { cost: 0,    label: '정산서 PDF',        desc: '정산서 PDF 다운로드 (무료)' },
  driver_register:     { cost: 0,    label: '기사 등록',         desc: '기사 신규 등록 (무료)' },
  driver_extra:        { cost: 1500, label: '플랜 초과 기사',    desc: '플랜 기사 수 초과 시 명당 월 자동 차감' },
  excel_upload:        { cost: 2500, label: '엑셀 업로드 정산',  desc: '엑셀 파일 1회 업로드 처리' },
  tax_invoice:         { cost: 0,    label: '세금계산서 발행',   desc: '서비스 개발중 (오픈 미정)' },
  report_generate:     { cost: 0,    label: '리포트 생성',       desc: '구독형 전용 (Standard 이상)' },
  template_upload:     { cost: 0,    label: '템플릿 업로드',     desc: 'PDF 템플릿 업로드 (무료)' },
}

/** 신규 가입 시 웰컴 보너스 포인트 */
export const WELCOME_BONUS_POINTS = 5000;

/** 플랜 기사 초과 시 계정당 월 포인트 차감 (1P = ₩1) */
export const EXTRA_DRIVER_MONTHLY_POINTS = 1500;

/** 무료플랜 무료 기사 수 */
export const FREE_PLAN_FREE_DRIVERS = 5;

/** 포인트 충전 패키지 (클라이언트 표시용 — DB에도 동일 시드 있음) */
export const POINT_PACKAGES = [
  { points:   5000, price:   5000, bonus:     0 },
  { points:  10000, price:  10000, bonus:   500 },
  { points:  30000, price:  30000, bonus:  2000 },
  { points:  50000, price:  50000, bonus:  5000 },
  { points: 100000, price: 100000, bonus: 15000 },
]

/**
 * 구독형 vs 포인트형 월 예상 비용 계산
 * @param actions 월간 예상 사용량 { action: 횟수 }
 * @returns 포인트형 예상 비용
 */
export function estimatePointCost(actions: Partial<Record<PointAction, number>>): number {
  let total = 0
  for (const [action, count] of Object.entries(actions)) {
    const cost = POINT_COSTS[action as PointAction]?.cost ?? 0
    total += cost * (count ?? 0)
  }
  return total
}

/** URL 경로 → 기능 키 매핑 (사이드바 + 미들웨어용) */
export function getFeatureForRoute(pathname: string): PlanFeature | null {
  if (pathname.includes('/contracts/templates')) return 'contracts.templates';
  if (pathname.includes('/contracts')) return 'contracts';
  if (pathname.includes('/settlements/builder')) return 'settlements.builder';
  if (pathname.includes('/settlements/upload')) return 'settlements.upload';
  if (pathname.includes('/settlements/tax') || pathname.includes('/tax-invoices')) return 'settlements.tax';
  if (pathname.includes('/settlements')) return 'settlements.basic';
  if (pathname.includes('/reports')) return 'reports';
  if (pathname.includes('/drivers')) return 'drivers';
  if (pathname.includes('/dashboard')) return 'dashboard';
  if (pathname.includes('/notices')) return 'notices';
  if (pathname.includes('/settings')) return 'settings';
  return null;
}
