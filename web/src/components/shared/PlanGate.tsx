'use client';

import Link from 'next/link';
import { usePlan } from '@/contexts/PlanContext';
import { type PlanFeature, FEATURE_LABELS, getMinimumPlan, PLAN_LABELS } from '@/lib/plan-limits';

interface PlanGateProps {
  feature: PlanFeature;
  children: React.ReactNode;
}

/**
 * 플랜 기반 페이지 가드
 * 기능 접근 불가 시 업그레이드 안내 UI를 표시합니다.
 */
export default function PlanGate({ feature, children }: PlanGateProps) {
  const { hasFeature } = usePlan();

  if (hasFeature(feature)) {
    return <>{children}</>;
  }

  const minPlan = getMinimumPlan(feature);
  const featureLabel = FEATURE_LABELS[feature] || feature;
  const planLabel = PLAN_LABELS[minPlan] || minPlan;

  return (
    <div className="flex items-center justify-center min-h-[60vh]">
      <div className="text-center max-w-md">
        {/* Lock icon */}
        <div className="w-20 h-20 rounded-full bg-surface-container-high flex items-center justify-center mx-auto mb-6">
          <svg width="40" height="40" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" className="text-on-surface-variant/40">
            <rect x="3" y="11" width="18" height="11" rx="2" ry="2" />
            <path d="M7 11V7a5 5 0 0110 0v4" />
          </svg>
        </div>

        <h2 className="text-xl font-headline font-bold text-on-surface mb-2 font-korean">
          {featureLabel} 기능은 {planLabel} 플랜부터 이용 가능합니다
        </h2>
        <p className="text-sm text-on-surface-variant mb-6 font-korean leading-relaxed">
          플랜을 업그레이드하면 {featureLabel} 기능을 포함한
          다양한 프리미엄 기능을 이용하실 수 있습니다.
        </p>

        <Link
          href="/portal/settings?tab=billing"
          className="inline-flex items-center gap-2 h-11 px-8 rounded-xl bg-power-gradient text-white font-label font-semibold text-sm shadow-ambient hover:shadow-float transition-all"
        >
          <svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor">
            <path d="M12 4l-1.41 1.41L16.17 11H4v2h12.17l-5.58 5.59L12 20l8-8z" />
          </svg>
          플랜 업그레이드
        </Link>

        <p className="text-xs text-on-surface-variant/50 mt-4 font-korean">
          설정 &gt; 구독/결제에서 플랜을 변경할 수 있습니다
        </p>
      </div>
    </div>
  );
}
