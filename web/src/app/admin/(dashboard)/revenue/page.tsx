'use client';

import { useEffect, useState } from 'react';
import KpiCard from '@/components/admin/KpiCard';
import { createBrowserSupabaseClient } from '@/lib/supabase';

interface PlanDetail {
  plan: string;
  subscribers: number;
  mrr: number;
  share: number;
  arpu: number;
}

const PLAN_LABELS: Record<string, string> = {
  enterprise: 'Enterprise',
  standard: 'Standard',
  basic: 'Basic',
  free: 'Free',
};

const PLAN_FEES: Record<string, number> = {
  free: 0,
  basic: 49900,
  standard: 99000,
  enterprise: 199000,
};

function formatKRW(n: number): string {
  return `₩${n.toLocaleString('ko-KR')}`;
}

export default function RevenuePage() {
  const [planDetails, setPlanDetails] = useState<PlanDetail[]>([]);
  const [totalMrr, setTotalMrr] = useState(0);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function load() {
      const supabase = createBrowserSupabaseClient();
      const { data: agencies } = await supabase
        .from('agencies')
        .select('plan, monthly_fee, status')
        .eq('status', 'active');

      const counts: Record<string, { count: number; revenue: number }> = {};
      for (const a of agencies ?? []) {
        const plan = (a.plan as string) || 'free';
        if (!counts[plan]) counts[plan] = { count: 0, revenue: 0 };
        counts[plan].count++;
        counts[plan].revenue += (a.monthly_fee as number) || PLAN_FEES[plan] || 0;
      }

      const mrr = Object.values(counts).reduce((s, c) => s + c.revenue, 0);
      const details: PlanDetail[] = ['enterprise', 'standard', 'basic', 'free'].map(plan => {
        const c = counts[plan] ?? { count: 0, revenue: 0 };
        return {
          plan: PLAN_LABELS[plan] ?? plan,
          subscribers: c.count,
          mrr: c.revenue,
          share: mrr > 0 ? Math.round(c.revenue / mrr * 1000) / 10 : 0,
          arpu: c.count > 0 ? Math.round(c.revenue / c.count) : 0,
        };
      });

      setTotalMrr(mrr);
      setPlanDetails(details);
      setLoading(false);
    }
    load();
  }, []);

  const totalSubscribers = planDetails.reduce((s, p) => s + p.subscribers, 0);

  return (
    <div className="space-y-8">
      <div>
        <h2 className="font-headline text-on-surface text-[26px] font-bold tracking-tight">매출 분석</h2>
        <p className="font-body text-on-surface-variant text-[14px] mt-1">구독 매출 및 성장 지표</p>
      </div>

      <div className="grid grid-cols-4 gap-5">
        <KpiCard label="MRR" value={loading ? '...' : formatKRW(totalMrr)} change="" changeType="up" accentColor="#2563eb" icon="trending_up" />
        <KpiCard label="ARR (추정)" value={loading ? '...' : formatKRW(totalMrr * 12)} change="" changeType="up" accentColor="#007d55" icon="monitoring" />
        <KpiCard label="구독사 수" value={loading ? '...' : `${totalSubscribers}개`} change="" changeType="up" accentColor="#6750a4" icon="group_add" />
        <KpiCard label="ARPU" value={loading ? '...' : formatKRW(totalSubscribers > 0 ? Math.round(totalMrr / totalSubscribers) : 0)} change="" changeType="up" accentColor="#565e74" icon="person" />
      </div>

      {/* Plan breakdown table */}
      <div className="bg-surface-container-lowest rounded-2xl shadow-ambient overflow-hidden">
        <div className="p-6 pb-0">
          <h3 className="font-headline text-on-surface text-[16px] font-bold">플랜별 상세</h3>
        </div>
        <div className="overflow-x-auto p-6 pt-4">
          <table className="w-full text-left">
            <thead>
              <tr className="bg-surface-container-low">
                <th className="px-4 py-3 text-xs font-label font-semibold text-on-surface-variant">플랜</th>
                <th className="px-4 py-3 text-xs font-label font-semibold text-on-surface-variant text-right">구독사</th>
                <th className="px-4 py-3 text-xs font-label font-semibold text-on-surface-variant text-right">MRR</th>
                <th className="px-4 py-3 text-xs font-label font-semibold text-on-surface-variant text-right">비중</th>
                <th className="px-4 py-3 text-xs font-label font-semibold text-on-surface-variant text-right">ARPU</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-outline-variant/20">
              {loading ? (
                <tr><td colSpan={5} className="px-4 py-8 text-center text-sm text-on-surface-variant">불러오는 중...</td></tr>
              ) : planDetails.map(p => (
                <tr key={p.plan} className="hover:bg-surface-container-low/50">
                  <td className="px-4 py-3 text-sm font-semibold text-on-surface">{p.plan}</td>
                  <td className="px-4 py-3 text-sm text-on-surface text-right font-data">{p.subscribers}개</td>
                  <td className="px-4 py-3 text-sm text-on-surface text-right font-data">{formatKRW(p.mrr)}</td>
                  <td className="px-4 py-3 text-sm text-on-surface-variant text-right font-data">{p.share}%</td>
                  <td className="px-4 py-3 text-sm text-on-surface-variant text-right font-data">{formatKRW(p.arpu)}</td>
                </tr>
              ))}
            </tbody>
            {!loading && (
              <tfoot>
                <tr className="bg-surface-container-low font-semibold">
                  <td className="px-4 py-3 text-sm text-on-surface">합계</td>
                  <td className="px-4 py-3 text-sm text-on-surface text-right font-data">{totalSubscribers}개</td>
                  <td className="px-4 py-3 text-sm text-on-surface text-right font-data">{formatKRW(totalMrr)}</td>
                  <td className="px-4 py-3 text-sm text-on-surface text-right font-data">100%</td>
                  <td className="px-4 py-3 text-sm text-on-surface text-right font-data">{formatKRW(totalSubscribers > 0 ? Math.round(totalMrr / totalSubscribers) : 0)}</td>
                </tr>
              </tfoot>
            )}
          </table>
        </div>
      </div>
    </div>
  );
}
