'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import dynamic from 'next/dynamic';
import KpiCard from '@/components/portal/KpiCard';
import Badge from '@/components/shared/Badge';
import { createBrowserSupabaseClient } from '@/lib/supabase';
import { getDashboardStats, type DashboardStats } from '@/services/dashboard.service';
import { getSettlements, type SettlementWithDriver } from '@/services/settlement.service';

const RevenueChart = dynamic(() => import('@/components/portal/charts/RevenueChart'), { ssr: false, loading: () => <div className="h-64 bg-surface-container-low rounded-xl animate-pulse" /> });
const ExpenseDonut = dynamic(() => import('@/components/portal/charts/ExpenseDonut'), { ssr: false, loading: () => <div className="h-64 bg-surface-container-low rounded-xl animate-pulse" /> });

/* ── 구독 정보 타입 ── */
interface SubscriptionInfo {
  plan: string;
  billingCycle: string;
  status: string;           // active, trialing, pending_payment, expired
  trialEndsAt: string | null;
  pendingPlan: string | null;
  monthlyAmount: number;
  startedAt: string | null;
}

const PLAN_NAMES: Record<string, string> = {
  free: 'Free', basic: 'Basic', standard: 'Standard', enterprise: 'Enterprise',
};
const CYCLE_NAMES: Record<string, string> = {
  monthly: '월결제', '1year': '1년', '2year': '2년', '3year': '3년',
};
const STATUS_MAP: Record<string, { label: string; color: string }> = {
  active: { label: '이용 중', color: 'text-tertiary' },
  trialing: { label: '무료 체험', color: 'text-amber-600' },
  pending_payment: { label: '입금 대기', color: 'text-amber-600' },
  expired: { label: '만료', color: 'text-error' },
};

const settlementStatusMap: Record<string, { label: string; variant: 'success' | 'warning' | 'error' | 'default' }> = {
  draft: { label: '작성중', variant: 'default' },
  confirmed: { label: '확정', variant: 'success' },
  sent: { label: '발송완료', variant: 'success' },
  pending: { label: '대기중', variant: 'warning' },
};

function formatKRW(amount: number): string {
  return `₩${amount.toLocaleString('ko-KR')}`;
}

export default function DashboardPage() {
  const [stats, setStats] = useState<DashboardStats | null>(null);
  const [settlements, setSettlements] = useState<SettlementWithDriver[]>([]);
  const [subscription, setSubscription] = useState<SubscriptionInfo | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function load() {
      const supabase = createBrowserSupabaseClient();
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      const agencyId = user.app_metadata?.agency_id as string | undefined;
      if (!agencyId) return;

      const now = new Date();
      const yearMonth = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;

      const [statsResult, settlementsResult, subResult] = await Promise.all([
        getDashboardStats(agencyId),
        getSettlements(agencyId, yearMonth),
        supabase
          .from('subscriptions')
          .select('plan, billing_cycle, status, trial_ends_at, pending_plan, monthly_amount, started_at')
          .eq('agency_id', agencyId)
          .order('created_at', { ascending: false })
          .limit(1)
          .maybeSingle(),
      ]);

      if (statsResult.data) setStats(statsResult.data);
      if (settlementsResult.data) setSettlements(settlementsResult.data);

      if (subResult.data) {
        const s = subResult.data as Record<string, unknown>;
        setSubscription({
          plan: (s.plan as string) ?? 'free',
          billingCycle: (s.billing_cycle as string) ?? 'monthly',
          status: (s.status as string) ?? 'active',
          trialEndsAt: (s.trial_ends_at as string) ?? null,
          pendingPlan: (s.pending_plan as string) ?? null,
          monthlyAmount: (s.monthly_amount as number) ?? 0,
          startedAt: (s.started_at as string) ?? null,
        });
      }

      setLoading(false);
    }
    load();
  }, []);

  /* 잔여일수 계산 */
  const getTrialDaysLeft = (): number | null => {
    if (!subscription?.trialEndsAt) return null;
    const end = new Date(subscription.trialEndsAt);
    const now = new Date();
    const diff = Math.ceil((end.getTime() - now.getTime()) / (1000 * 60 * 60 * 24));
    return Math.max(0, diff);
  };

  const trialDaysLeft = getTrialDaysLeft();

  return (
    <div className="space-y-8">
      {/* Page Header */}
      <div>
        <h1 className="text-2xl font-headline font-bold text-on-surface">
          <span className="font-korean">배송 현황 요약</span>
        </h1>
        <p className="mt-1 text-sm text-on-surface-variant font-korean">
          이번 달 대리점 운영 현황을 한눈에 확인하세요
        </p>
      </div>

      {/* Subscription Status Banner */}
      {!loading && subscription && (
        <div className={`rounded-2xl shadow-ambient p-5 ${
          subscription.status === 'trialing'
            ? 'bg-gradient-to-r from-amber-50 to-orange-50 border border-amber-200/50'
            : subscription.status === 'pending_payment'
            ? 'bg-gradient-to-r from-amber-50 to-yellow-50 border border-amber-200/50'
            : 'bg-surface-container-lowest'
        }`}>
          <div className="flex items-center justify-between flex-wrap gap-4">
            {/* 왼쪽: 플랜 정보 */}
            <div className="flex items-center gap-4">
              <div className={`w-11 h-11 rounded-xl flex items-center justify-center ${
                subscription.status === 'trialing' ? 'bg-amber-100' :
                subscription.status === 'active' ? 'bg-primary/10' : 'bg-surface-container-high'
              }`}>
                {subscription.status === 'trialing' ? (
                  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#d97706" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/>
                  </svg>
                ) : (
                  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#004ac6" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/>
                    <polyline points="9 12 11 14 15 10"/>
                  </svg>
                )}
              </div>
              <div>
                <div className="flex items-center gap-2">
                  <span className="text-base font-bold text-on-surface">
                    {PLAN_NAMES[subscription.plan] ?? subscription.plan} 플랜
                  </span>
                  <span className={`text-xs font-bold ${STATUS_MAP[subscription.status]?.color ?? 'text-on-surface-variant'}`}>
                    {STATUS_MAP[subscription.status]?.label ?? subscription.status}
                  </span>
                </div>
                <div className="flex items-center gap-3 mt-0.5 text-xs text-on-surface-variant">
                  <span>{CYCLE_NAMES[subscription.billingCycle] ?? subscription.billingCycle}</span>
                  {subscription.monthlyAmount > 0 && (
                    <span className="font-data">₩{subscription.monthlyAmount.toLocaleString('ko-KR')}/월</span>
                  )}
                  {subscription.pendingPlan && subscription.status === 'trialing' && (
                    <span className="text-primary font-medium">
                      → {PLAN_NAMES[subscription.pendingPlan]} 업그레이드 대기
                    </span>
                  )}
                </div>
              </div>
            </div>

            {/* 오른쪽: 잔여일수 또는 액션 */}
            <div className="flex items-center gap-3">
              {subscription.status === 'trialing' && trialDaysLeft !== null && (
                <div className="text-right">
                  <div className="flex items-center gap-2">
                    <div className={`text-2xl font-extrabold font-data ${
                      trialDaysLeft <= 3 ? 'text-error' : trialDaysLeft <= 7 ? 'text-amber-600' : 'text-primary'
                    }`}>
                      {trialDaysLeft}
                    </div>
                    <div className="text-xs text-on-surface-variant leading-tight">
                      <p className="font-medium">일 남음</p>
                      <p className="text-[10px]">
                        {subscription.trialEndsAt && new Date(subscription.trialEndsAt).toLocaleDateString('ko-KR', { month: 'long', day: 'numeric' })}까지
                      </p>
                    </div>
                  </div>
                  {/* 프로그레스 바 */}
                  <div className="w-32 h-1.5 bg-surface-container-high rounded-full mt-1.5">
                    <div
                      className={`h-full rounded-full transition-all ${
                        trialDaysLeft <= 3 ? 'bg-error' : trialDaysLeft <= 7 ? 'bg-amber-500' : 'bg-primary'
                      }`}
                      style={{ width: `${Math.max(5, ((14 - trialDaysLeft) / 14) * 100)}%` }}
                    />
                  </div>
                </div>
              )}
              {(subscription.status === 'trialing' || subscription.plan === 'free') && (
                <Link
                  href="/portal/settings"
                  className="h-9 px-4 rounded-xl bg-power-gradient text-white text-xs font-bold flex items-center gap-1.5 hover:shadow-md transition-all"
                >
                  {subscription.status === 'trialing' ? '지금 결제하기' : '플랜 업그레이드'}
                  <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><path d="m9 18 6-6-6-6"/></svg>
                </Link>
              )}
            </div>
          </div>
        </div>
      )}

      {/* KPI Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-5">
        <KpiCard
          title="이번달 총 정산액"
          value={loading ? '불러오는 중...' : formatKRW(stats?.totalSettlement ?? 0)}
          accent="blue"
        />
        <KpiCard
          title="소속 기사 수"
          value={loading ? '...' : `${stats?.driverCount ?? 0}명`}
          accent="green"
        />
        <KpiCard
          title="미서명 계약서"
          value={loading ? '...' : `${stats?.unsignedContracts ?? 0}건`}
          accent="amber"
          warning={!loading && (stats?.unsignedContracts ?? 0) > 0}
          href="/portal/contracts"
        />
        <KpiCard
          title="미발행 세금계산서"
          value={loading ? '...' : `${stats?.unpaidInvoices ?? 0}건`}
          accent="violet"
        />
      </div>

      {/* Charts Row */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-5">
        <div className="lg:col-span-2 bg-surface-container-lowest rounded-2xl shadow-ambient p-6">
          <h2 className="text-base font-headline font-semibold text-on-surface font-korean">
            매출 / 지출 / 수익 추이
          </h2>
          <p className="text-xs text-on-surface-variant mt-1 font-korean">최근 6개월</p>
          <RevenueChart />
        </div>

        <div className="bg-surface-container-lowest rounded-2xl shadow-ambient p-6">
          <h2 className="text-base font-headline font-semibold text-on-surface font-korean">
            지출 항목 분포
          </h2>
          <p className="text-xs text-on-surface-variant mt-1 font-korean">이번 달</p>
          <ExpenseDonut />
        </div>
      </div>

      {/* Settlement Status Table */}
      <div className="bg-surface-container-lowest rounded-2xl shadow-ambient">
        <div className="px-6 py-5 flex items-center justify-between">
          <h2 className="text-base font-headline font-semibold text-on-surface font-korean">
            기사 정산 현황
          </h2>
          <Link
            href="/portal/settlements/generate"
            className="text-sm text-primary font-label hover:underline font-korean"
          >
            전체 보기
          </Link>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-left">
            <thead>
              <tr className="bg-surface-container-low">
                <th className="px-6 py-3 text-xs font-label font-semibold text-on-surface-variant uppercase tracking-wider font-korean">
                  이름
                </th>
                <th className="px-6 py-3 text-xs font-label font-semibold text-on-surface-variant uppercase tracking-wider font-korean">
                  정산액
                </th>
                <th className="px-6 py-3 text-xs font-label font-semibold text-on-surface-variant uppercase tracking-wider font-korean">
                  공제액
                </th>
                <th className="px-6 py-3 text-xs font-label font-semibold text-on-surface-variant uppercase tracking-wider font-korean">
                  실수령액
                </th>
                <th className="px-6 py-3 text-xs font-label font-semibold text-on-surface-variant uppercase tracking-wider font-korean">
                  상태
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-outline-variant/30">
              {loading ? (
                <tr>
                  <td colSpan={5} className="px-6 py-8 text-center text-sm text-on-surface-variant font-korean">
                    데이터를 불러오는 중...
                  </td>
                </tr>
              ) : settlements.length === 0 ? (
                <tr>
                  <td colSpan={5} className="px-6 py-8 text-center text-sm text-on-surface-variant font-korean">
                    이번 달 정산 데이터가 없습니다
                  </td>
                </tr>
              ) : (
                settlements.map((row) => {
                  const statusInfo = settlementStatusMap[row.status] ?? { label: row.status, variant: 'default' as const };
                  return (
                    <tr key={row.id} className="hover:bg-surface-container-low/50 transition-colors">
                      <td className="px-6 py-4 text-sm font-body text-on-surface font-korean">
                        {row.drivers?.name ?? '이름 없음'}
                      </td>
                      <td className="px-6 py-4 text-sm font-data text-on-surface">
                        {formatKRW(row.total_amount)}
                      </td>
                      <td className="px-6 py-4 text-sm font-data text-on-surface-variant">
                        {formatKRW(row.total_deduction)}
                      </td>
                      <td className="px-6 py-4 text-sm font-data font-semibold text-on-surface">
                        {formatKRW(row.net_amount)}
                      </td>
                      <td className="px-6 py-4">
                        <Badge label={statusInfo.label} variant={statusInfo.variant} />
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Recent Activity Log */}
      <RecentActivityLog agencyId={stats ? undefined : undefined} />

      {/* Floating Action Button */}
      <Link
        href="/portal/settlements/generate"
        className="fixed bottom-8 right-8 bg-power-gradient text-white px-6 py-3.5 rounded-2xl shadow-card font-label font-semibold text-sm hover:shadow-lg transition-shadow flex items-center gap-2"
      >
        <svg width="20" height="20" viewBox="0 0 24 24" fill="currentColor">
          <path d="M19 13h-6v6h-2v-6H5v-2h6V5h2v6h6v2z" />
        </svg>
        <span className="font-korean">신규 정산 생성</span>
      </Link>
    </div>
  );
}

/* ── 최근 활동 로그 컴포넌트 ── */

function RecentActivityLog({ agencyId: _agencyId }: { agencyId?: string }) {
  return (
    <div className="space-y-4">
      <h3 className="text-lg font-headline font-semibold text-on-surface font-korean">최근 활동</h3>
      <p className="text-sm text-on-surface-variant font-korean">최근 활동 로그는 준비 중입니다.</p>
    </div>
  );
}