'use client';

import { useEffect, useState } from 'react';
import KpiCard from '@/components/admin/KpiCard';
import dynamic from 'next/dynamic';
import { createBrowserSupabaseClient } from '@/lib/supabase';

const MrrChart = dynamic(() => import('@/components/admin/charts/MrrChart'), { ssr: false });
const PlanDistribution = dynamic(() => import('@/components/admin/charts/PlanDistribution'), { ssr: false });

interface AdminStats {
  activeAgencies: number;
  totalDrivers: number;
  totalContracts: number;
  totalSettlements: number;
  mrrEstimate: number;
  planCounts: Record<string, number>;
  recentAgencies: { id: string; name: string; plan: string; status: string; created_at: string }[];
  recentLogs: { id: string; event_type: string; created_at: string; resource: string | null }[];
}

function getCurrentDate() {
  const now = new Date();
  const year = now.getFullYear();
  const month = String(now.getMonth() + 1).padStart(2, '0');
  const day = String(now.getDate()).padStart(2, '0');
  const weekdays = ['일', '월', '화', '수', '목', '금', '토'];
  const weekday = weekdays[now.getDay()];
  return `${year}. ${month}. ${day}. (${weekday})`;
}

function formatKRW(n: number): string {
  return `₩${n.toLocaleString('ko-KR')}`;
}

const PLAN_FEES: Record<string, number> = {
  free: 0,
  basic: 49900,
  standard: 99000,
  pro: 199000,
  enterprise: 0,
};

export default function DashboardPage() {
  const currentDate = getCurrentDate();
  const [stats, setStats] = useState<AdminStats | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function load() {
      const supabase = createBrowserSupabaseClient();

      const [
        agenciesRes,
        driversRes,
        contractsRes,
        settlementsRes,
        logsRes,
      ] = await Promise.all([
        supabase.from('agencies').select('id, name, plan, status, created_at, monthly_fee').order('created_at', { ascending: false }),
        supabase.from('drivers').select('id', { count: 'exact', head: true }),
        supabase.from('contracts').select('id', { count: 'exact', head: true }),
        supabase.from('settlements').select('id', { count: 'exact', head: true }),
        supabase.from('security_logs').select('id, event_type, created_at, resource').order('created_at', { ascending: false }).limit(10),
      ]);

      const agencies = agenciesRes.data ?? [];
      const active = agencies.filter(a => a.status === 'active');

      // Plan distribution
      const planCounts: Record<string, number> = { free: 0, basic: 0, standard: 0, pro: 0, enterprise: 0 };
      for (const a of active) {
        const plan = (a.plan as string) || 'free';
        planCounts[plan] = (planCounts[plan] ?? 0) + 1;
      }

      // MRR estimate from active agencies
      const mrrEstimate = active.reduce((sum, a) => {
        const fee = (a.monthly_fee as number) || PLAN_FEES[(a.plan as string) || 'free'] || 0;
        return sum + fee;
      }, 0);

      setStats({
        activeAgencies: active.length,
        totalDrivers: driversRes.count ?? 0,
        totalContracts: contractsRes.count ?? 0,
        totalSettlements: settlementsRes.count ?? 0,
        mrrEstimate,
        planCounts,
        recentAgencies: agencies.slice(0, 10).map(a => ({
          id: a.id as string,
          name: a.name as string,
          plan: (a.plan as string) || 'free',
          status: (a.status as string) || 'active',
          created_at: a.created_at as string,
        })),
        recentLogs: (logsRes.data ?? []).map(l => ({
          id: l.id as string,
          event_type: l.event_type as string,
          created_at: l.created_at as string,
          resource: l.resource as string | null,
        })),
      });
      setLoading(false);
    }
    load();
  }, []);

  const activeCount = stats?.activeAgencies ?? 0;
  const totalAgencies = (stats?.recentAgencies.length ?? 0);
  const churnRate = totalAgencies > 0
    ? ((totalAgencies - activeCount) / totalAgencies * 100).toFixed(1)
    : '0';

  return (
    <div className="space-y-8">
      {/* Header */}
      <div>
        <h2 className="font-headline text-on-surface text-[26px] font-bold tracking-tight">
          플랫폼 현황
        </h2>
        <p className="font-body text-on-surface-variant text-[14px] mt-1">
          {currentDate}
        </p>
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-4 gap-5">
        <KpiCard
          label="활성 구독사"
          value={loading ? '...' : `${activeCount}개`}
          change=""
          changeType="up"
          accentColor="#2563eb"
          icon="apartment"
        />
        <KpiCard
          label="이번달 MRR"
          value={loading ? '...' : formatKRW(stats?.mrrEstimate ?? 0)}
          change=""
          changeType="up"
          accentColor="#007d55"
          icon="trending_up"
        />
        <KpiCard
          label="등록 기사 수"
          value={loading ? '...' : `${stats?.totalDrivers ?? 0}명`}
          change=""
          changeType="up"
          accentColor="#6750a4"
          icon="group"
        />
        <KpiCard
          label="이탈률"
          value={loading ? '...' : `${churnRate}%`}
          change=""
          changeType="down"
          accentColor="#565e74"
          icon="trending_down"
        />
      </div>

      {/* Charts Row */}
      <div className="grid grid-cols-2 gap-5">
        <div className="bg-surface-container-lowest rounded-2xl shadow-ambient p-6 min-h-[320px]">
          <h3 className="font-headline text-on-surface text-[16px] font-bold mb-1">MRR 추이</h3>
          <p className="font-body text-on-surface-variant text-[13px] mb-6">월간 구독 매출 추이</p>
          <MrrChart />
        </div>
        <div className="bg-surface-container-lowest rounded-2xl shadow-ambient p-6 min-h-[320px]">
          <h3 className="font-headline text-on-surface text-[16px] font-bold mb-1">플랜별 구독 분포</h3>
          <p className="font-body text-on-surface-variant text-[13px] mb-6">
            Free {stats?.planCounts.free ?? 0} · Basic {stats?.planCounts.basic ?? 0} · Standard {stats?.planCounts.standard ?? 0} · Pro {stats?.planCounts.pro ?? 0} · Enterprise {stats?.planCounts.enterprise ?? 0}
          </p>
          <PlanDistribution />
        </div>
      </div>

      {/* Subscriber Table */}
      <div className="bg-surface-container-lowest rounded-2xl shadow-ambient p-6">
        <h3 className="font-headline text-on-surface text-[16px] font-bold mb-4">최근 구독사</h3>
        <div className="overflow-x-auto">
          <table className="w-full text-left">
            <thead>
              <tr className="bg-surface-container-low">
                <th className="px-4 py-3 text-xs font-label font-semibold text-on-surface-variant">이름</th>
                <th className="px-4 py-3 text-xs font-label font-semibold text-on-surface-variant">플랜</th>
                <th className="px-4 py-3 text-xs font-label font-semibold text-on-surface-variant">상태</th>
                <th className="px-4 py-3 text-xs font-label font-semibold text-on-surface-variant">등록일</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-outline-variant/20">
              {loading ? (
                <tr><td colSpan={4} className="px-4 py-8 text-center text-sm text-on-surface-variant">불러오는 중...</td></tr>
              ) : (stats?.recentAgencies ?? []).map(a => (
                <tr key={a.id} className="hover:bg-surface-container-low/50">
                  <td className="px-4 py-3 text-sm text-on-surface">{a.name}</td>
                  <td className="px-4 py-3 text-xs font-semibold uppercase text-on-surface-variant">{a.plan}</td>
                  <td className="px-4 py-3">
                    <span className={`text-xs font-semibold ${a.status === 'active' ? 'text-tertiary' : 'text-error'}`}>
                      {a.status === 'active' ? '활성' : a.status}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-xs text-on-surface-variant">{new Date(a.created_at).toLocaleDateString('ko-KR')}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* Bottom Row: Recent Logs */}
      <div className="bg-surface-container-lowest rounded-2xl shadow-ambient p-6">
        <h3 className="font-headline text-on-surface text-[16px] font-bold mb-4">최근 활동 로그</h3>
        <div className="space-y-2">
          {loading ? (
            <p className="text-sm text-on-surface-variant text-center py-4">불러오는 중...</p>
          ) : (stats?.recentLogs ?? []).length === 0 ? (
            <p className="text-sm text-on-surface-variant text-center py-4">기록된 로그가 없습니다</p>
          ) : (stats?.recentLogs ?? []).map(log => (
            <div key={log.id} className="flex items-center justify-between py-2 px-3 rounded-lg hover:bg-surface-container-low/50">
              <div className="flex items-center gap-3">
                <span className={`w-2 h-2 rounded-full ${
                  log.event_type.includes('fail') || log.event_type.includes('denied') ? 'bg-error' :
                  log.event_type.includes('success') ? 'bg-tertiary' : 'bg-outline'
                }`} />
                <span className="text-sm text-on-surface">{log.event_type}</span>
                {log.resource && <span className="text-xs text-on-surface-variant">· {log.resource}</span>}
              </div>
              <span className="text-xs text-on-surface-variant">{new Date(log.created_at).toLocaleString('ko-KR')}</span>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
