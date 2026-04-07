'use client';

import { useEffect, useState } from 'react';
import dynamic from 'next/dynamic';
import { createBrowserSupabaseClient } from '@/lib/supabase';

const RechartsChart = dynamic(() =>
  import('recharts').then((mod) => {
    const { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend } = mod;
    function Chart({ data }: { data: { month: string; revenue: number; expense: number }[] }) {
      return (
        <ResponsiveContainer width="100%" height="100%">
          <BarChart data={data}>
            <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
            <XAxis dataKey="month" tick={{ fontSize: 12 }} />
            <YAxis tickFormatter={(v: number) => `${(v / 10000).toFixed(0)}만`} tick={{ fontSize: 11 }} />
            <Tooltip formatter={((v: number) => `₩${v.toLocaleString('ko-KR')}`) as never} />
            <Legend />
            <Bar dataKey="revenue" name="매출" fill="#004ac6" radius={[4, 4, 0, 0]} />
            <Bar dataKey="expense" name="지출" fill="#ff6b6b" radius={[4, 4, 0, 0]} />
          </BarChart>
        </ResponsiveContainer>
      );
    }
    return Chart;
  }),
  { ssr: false, loading: () => <div className="h-full flex items-center justify-center"><span className="text-sm text-on-surface-variant">차트 로딩 중...</span></div> }
);

function formatKRW(n: number) { return `₩${n.toLocaleString('ko-KR')}` }

interface MonthlyStat { month: string; revenue: number; expense: number; profit: number }
interface DriverShare { name: string; total: number }

export default function ReportsPage() {
  const [monthly, setMonthly] = useState<MonthlyStat[]>([])
  const [driverShares, setDriverShares] = useState<DriverShare[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    async function load() {
      const supabase = createBrowserSupabaseClient()
      const { data: { user } } = await supabase.auth.getUser()
      const agencyId = user?.app_metadata?.agency_id as string | undefined
      if (!agencyId) { setLoading(false); return }

      // 최근 6개월 정산 데이터 집계
      const now = new Date()
      const months: string[] = []
      for (let i = 5; i >= 0; i--) {
        const d = new Date(now.getFullYear(), now.getMonth() - i, 1)
        months.push(`${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`)
      }

      const { data: settlements } = await supabase
        .from('settlements')
        .select('year_month, total_amount, total_deduction, net_amount, drivers(name)')
        .eq('agency_id', agencyId)
        .in('year_month', months)

      // 월별 집계
      const monthMap = new Map<string, MonthlyStat>()
      months.forEach(m => monthMap.set(m, { month: m.slice(5) + '월', revenue: 0, expense: 0, profit: 0 }))

      const driverMap = new Map<string, number>()

      for (const s of (settlements ?? []) as Record<string, unknown>[]) {
        const ym = s.year_month as string
        const stat = monthMap.get(ym)
        if (stat) {
          stat.revenue += (s.total_amount as number) || 0
          stat.expense += (s.total_deduction as number) || 0
          stat.profit += (s.net_amount as number) || 0
        }
        const driverName = ((s.drivers as Record<string, string>)?.name) ?? '미지정'
        driverMap.set(driverName, (driverMap.get(driverName) ?? 0) + ((s.total_amount as number) || 0))
      }

      setMonthly(Array.from(monthMap.values()))
      setDriverShares(
        Array.from(driverMap.entries())
          .map(([name, total]) => ({ name, total }))
          .sort((a, b) => b.total - a.total)
          .slice(0, 7)
      )
      setLoading(false)
    }
    load()
  }, [])

  const totalRevenue = monthly.reduce((s, m) => s + m.revenue, 0)
  const totalExpense = monthly.reduce((s, m) => s + m.expense, 0)
  const totalProfit = totalRevenue - totalExpense
  const prevProfit = monthly.length >= 2 ? monthly[monthly.length - 1].profit - monthly[monthly.length - 2].profit : 0

  return (
    <div className="space-y-8">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-headline font-bold text-on-surface font-korean">매출 리포트</h1>
          <p className="mt-1 text-sm text-on-surface-variant font-korean">대리점 매출 및 지출 현황을 분석하세요</p>
        </div>
      </div>

      {/* KPI */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-5">
        {[
          { title: '총 매출', value: formatKRW(totalRevenue), positive: true },
          { title: '총 지출', value: formatKRW(totalExpense), positive: false },
          { title: '순이익', value: formatKRW(totalProfit), positive: totalProfit >= 0 },
          { title: '전월 대비', value: `${prevProfit >= 0 ? '+' : ''}${formatKRW(prevProfit)}`, positive: prevProfit >= 0 },
        ].map(kpi => (
          <div key={kpi.title} className="bg-surface-container-lowest rounded-2xl shadow-ambient p-5">
            <p className="text-xs font-label text-on-surface-variant font-korean">{kpi.title}</p>
            <p className="mt-2 text-xl font-data font-bold text-on-surface">{loading ? '...' : kpi.value}</p>
          </div>
        ))}
      </div>

      {/* Charts */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-5">
        <div className="lg:col-span-2 bg-surface-container-lowest rounded-2xl shadow-ambient p-6">
          <h2 className="text-base font-headline font-semibold text-on-surface font-korean">월별 매출/지출 추이</h2>
          <p className="text-xs text-on-surface-variant mt-1 font-korean">최근 6개월</p>
          <div className="mt-4" style={{ width: '100%', height: 280 }}>
            {loading ? (
              <div className="h-full flex items-center justify-center"><span className="text-sm text-on-surface-variant font-korean">불러오는 중...</span></div>
            ) : (
              <RechartsChart data={monthly} />
            )}
          </div>
        </div>

        {/* Summary */}
        <div className="bg-surface-container-lowest rounded-2xl shadow-ambient p-6">
          <h2 className="text-base font-headline font-semibold text-on-surface font-korean">요약</h2>
          <div className="mt-4 space-y-3 text-sm font-korean">
            <p className="flex justify-between"><span>평균 매출</span><span className="font-semibold text-on-surface">{loading ? '-' : formatKRW(totalRevenue / (monthly.length || 1))}</span></p>
            <p className="flex justify-between"><span>평균 지출</span><span className="font-semibold text-on-surface">{loading ? '-' : formatKRW(totalExpense / (monthly.length || 1))}</span></p>
            <p className="flex justify-between"><span>평균 이익</span><span className="font-semibold text-on-surface">{loading ? '-' : formatKRW(totalProfit / (monthly.length || 1))}</span></p>
          </div>
        </div>
      </div>
      {/* 기사별 점유율 */}
      {!loading && driverShares.length > 0 && (
        <div className="bg-surface-container-lowest rounded-2xl shadow-ambient p-6">
          <h2 className="text-base font-headline font-semibold text-on-surface font-korean">기사별 매출 점유율</h2>
          <p className="text-xs text-on-surface-variant mt-1 mb-4 font-korean">상위 7명 기준</p>

          <div className="space-y-3">
            {(() => {
              const maxTotal = driverShares[0]?.total ?? 1;
              return driverShares.map((ds, idx) => {
                const pct = totalRevenue > 0 ? ((ds.total / totalRevenue) * 100).toFixed(1) : '0.0';
                const barWidth = Math.max((ds.total / maxTotal) * 100, 2);
                return (
                  <div key={ds.name} className="flex items-center gap-3">
                    <span className="w-5 text-xs font-data text-on-surface-variant text-right">{idx + 1}</span>
                    <span className="w-24 text-sm font-korean text-on-surface truncate">{ds.name}</span>
                    <div className="flex-1 h-7 bg-surface-container-low rounded-lg overflow-hidden relative">
                      <div
                        className="h-full bg-primary/80 rounded-lg transition-all"
                        style={{ width: `${barWidth}%` }}
                      />
                      <span className="absolute inset-y-0 right-2 flex items-center text-[11px] font-data text-on-surface-variant">
                        {formatKRW(ds.total)}
                      </span>
                    </div>
                    <span className="w-14 text-xs font-data text-on-surface-variant text-right">{pct}%</span>
                  </div>
                );
              });
            })()}
          </div>
        </div>
      )}
    </div>
  );
}