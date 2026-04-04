/**
 * 플랜별 기능 제한 설정
 * 모든 플랜 제한 로직은 이 파일을 참조합니다.
 */

export type PlanType = 'free' | 'basic' | 'standard' | 'pro' | 'enterprise';

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

/** 플랜 등급 순서 (비교용) */
const PLAN_ORDER: PlanType[] = ['free', 'basic', 'standard', 'pro', 'enterprise'];

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

export const PLAN_LIMITS: Record<PlanType, PlanLimits> = {
  free: {
    maxDrivers: 10,
    maxAdminAccounts: 0,
    maxDefaultTemplates: 0,
    maxUploadTemplates: 0,
    features: FREE_FEATURES,
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
  basic: 'Basic',
  standard: 'Standard',
  pro: 'Pro',
  enterprise: 'Enterprise',
};

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
