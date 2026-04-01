/**
 * 플랜별 기능 제한 설정
 * 모든 플랜 제한 로직은 이 파일을 참조합니다.
 */

export type PlanType = 'free' | 'basic' | 'standard' | 'enterprise';

export interface PlanLimits {
  maxDrivers: number | null;        // 기사 수 제한 (null = 무제한)
  maxAdminAccounts: number;          // 추가 관리자 계정 수 (대표가입자 제외)
  maxDefaultTemplates: number;       // 기본 템플릿 선택 가능 수
  maxUploadTemplates: number;        // 업로드 템플릿 수
}

export const PLAN_LIMITS: Record<PlanType, PlanLimits> = {
  free: {
    maxDrivers: 10,
    maxAdminAccounts: 0,             // 추가 관리자 불가
    maxDefaultTemplates: 0,          // 기본 템플릿 사용 불가
    maxUploadTemplates: 0,           // 업로드 불가
  },
  basic: {
    maxDrivers: 50,
    maxAdminAccounts: 3,             // 관리자 3명 추가 가능
    maxDefaultTemplates: 3,          // 기본 템플릿 3개 선택
    maxUploadTemplates: 3,           // 업로드 3개
  },
  standard: {
    maxDrivers: 100,
    maxAdminAccounts: 3,
    maxDefaultTemplates: 6,
    maxUploadTemplates: 6,
  },
  enterprise: {
    maxDrivers: null,
    maxAdminAccounts: 3,
    maxDefaultTemplates: 10,
    maxUploadTemplates: 10,
  },
};

/** 플랜 라벨 */
export const PLAN_LABELS: Record<PlanType, string> = {
  free: 'Free',
  basic: 'Basic',
  standard: 'Standard',
  enterprise: 'Enterprise',
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
