'use client';

import { useEffect, useState } from 'react';
import Badge from '@/components/shared/Badge';
import KpiCard from '@/components/admin/KpiCard';
import { createBrowserSupabaseClient } from '@/lib/supabase';

interface SubscriptionRow {
  agency_id: string;
  plan: string;
  status: string;
  billing_cycle: string | null;
  monthly_amount: number;
  card_name: string | null;
  card_number_masked: string | null;
  updated_at: string | null;
  agencies: { name: string } | null;
}

function formatKRW(n: number): string {
  return `₩${n.toLocaleString('ko-KR')}`;
}

const statusVariant: Record<string, 'success' | 'error' | 'warning' | 'default'> = {
  active: 'success',
  overdue: 'error',
  cancelled: 'warning',
};

export default function BillingPage() {
  const [subscriptions, setSubscriptions] = useState<SubscriptionRow[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function load() {
      const supabase = createBrowserSupabaseClient();
      const { data } = await supabase
        .from('subscriptions')
        .select('agency_id, plan, status, billing_cycle, monthly_amount, card_name, card_number_masked, updated_at, agencies(name)')
        .order('updated_at', { ascending: false });
      setSubscriptions((data ?? []) as unknown as SubscriptionRow[]);
      setLoading(false);
    }
    load();
  }, []);

  const totalMrr = subscriptions
    .filter(s => s.status === 'active')
    .reduce((sum, s) => sum + (s.monthly_amount || 0), 0);
  const activeCount = subscriptions.filter(s => s.status === 'active').length;
  const overdueCount = subscriptions.filter(s => s.status === 'overdue').length;

  return (
    <div className="space-y-8">
      <div>
        <h2 className="font-headline text-on-surface text-[26px] font-bold tracking-tight">구독/결제 관리</h2>
        <p className="font-body text-on-surface-variant text-[14px] mt-1">구독 현황 및 결제 관리</p>
      </div>

      <div className="grid grid-cols-4 gap-5">
        <KpiCard label="활성 구독" value={loading ? '...' : `${activeCount}건`} change="" changeType="up" accentColor="#007d55" icon="check_circle" />
        <KpiCard label="월 매출 (MRR)" value={loading ? '...' : formatKRW(totalMrr)} change="" changeType="up" accentColor="#2563eb" icon="payments" />
        <KpiCard label="미수/연체" value={loading ? '...' : `${overdueCount}건`} change="" changeType={overdueCount > 0 ? 'up' : 'down'} accentColor="#ba1a1a" icon="warning" />
        <KpiCard label="총 구독사" value={loading ? '...' : `${subscriptions.length}건`} change="" changeType="up" accentColor="#565e74" icon="apartment" />
      </div>

      <div className="bg-surface-container-lowest rounded-2xl shadow-ambient overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left">
            <thead>
              <tr className="bg-surface-container-low">
                <th className="px-4 py-3 text-xs font-label font-semibold text-on-surface-variant">대리점</th>
                <th className="px-4 py-3 text-xs font-label font-semibold text-on-surface-variant">플랜</th>
                <th className="px-4 py-3 text-xs font-label font-semibold text-on-surface-variant">월액</th>
                <th className="px-4 py-3 text-xs font-label font-semibold text-on-surface-variant">결제수단</th>
                <th className="px-4 py-3 text-xs font-label font-semibold text-on-surface-variant">상태</th>
                <th className="px-4 py-3 text-xs font-label font-semibold text-on-surface-variant">최종 업데이트</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-outline-variant/20">
              {loading ? (
                <tr><td colSpan={6} className="px-4 py-8 text-center text-sm text-on-surface-variant">불러오는 중...</td></tr>
              ) : subscriptions.length === 0 ? (
                <tr><td colSpan={6} className="px-4 py-8 text-center text-sm text-on-surface-variant">구독 정보가 없습니다</td></tr>
              ) : subscriptions.map(s => (
                <tr key={s.agency_id} className="hover:bg-surface-container-low/50">
                  <td className="px-4 py-3 text-sm text-on-surface">{s.agencies?.name ?? '-'}</td>
                  <td className="px-4 py-3 text-xs font-semibold uppercase text-on-surface-variant">{s.plan}</td>
                  <td className="px-4 py-3 text-sm font-data text-on-surface">{formatKRW(s.monthly_amount || 0)}</td>
                  <td className="px-4 py-3 text-xs text-on-surface-variant">
                    {s.card_name ? `${s.card_name} ${s.card_number_masked ?? ''}` : '미등록'}
                  </td>
                  <td className="px-4 py-3">
                    <Badge label={s.status === 'active' ? '활성' : s.status === 'overdue' ? '연체' : '해지'} variant={statusVariant[s.status] ?? 'default'} />
                  </td>
                  <td className="px-4 py-3 text-xs text-on-surface-variant">
                    {s.updated_at ? new Date(s.updated_at).toLocaleDateString('ko-KR') : '-'}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
