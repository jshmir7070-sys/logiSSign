/**
 * 플랜별 기능 제한 설정
 * 모든 플랜 제한 로직은 이 파일을 참조합니다.
 */

export type PlanType = 'free' | 'basic' | 'standard' | 'pro' | 'enterprise';

export interface PlanLimits {
  maxDrivers: number | null;
  maxAdminAccounts: number;
  maxDefaultTemplates: number;
  maxUploadTemplates: number;
}

export const PLAN_LIMITS: Record<PlanType, PlanLimits> = {
  free: {
    maxDrivers: 10,
    maxAdminAccounts: 0,
    maxDefaultTemplates: 0,
    maxUploadTemplates: 0,
  },
  basic: {
    maxDrivers: 30,
    maxAdminAccounts: 2,
    maxDefaultTemplates: 3,
    maxUploadTemplates: 3,
  },
  standard: {
    maxDrivers: 80,
    maxAdminAccounts: 5,
    maxDefaultTemplates: 6,
    maxUploadTemplates: 6,
  },
  pro: {
    maxDrivers: 150,
    maxAdminAccounts: 10,
    maxDefaultTemplates: 10,
    maxUploadTemplates: 10,
  },
  enterprise: {
    maxDrivers: null,
    maxAdminAccounts: 99,
    maxDefaultTemplates: 99,
    maxUploadTemplates: 99,
  },
};

export const PLAN_LABELS: Record<PlanType, string> = {
  free: 'Free',
  basic: 'Basic',
  standard: 'Standard',
  pro: 'Pro',
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
