'use client'

import { useEffect, useState } from 'react'
import KpiCard from '@/components/admin/KpiCard'
import { createBrowserSupabaseClient } from '@/lib/supabase'

interface PlanDetail {
  plan: string
  subscribers: number
  monthlyRevenue: number
  share: number
  averageRevenue: number
}

const PLAN_LABELS: Record<string, string> = {
  enterprise: '엔터프라이즈',
  standard: '스탠다드',
  basic: '베이직',
  free: '무료형',
}

const PLAN_FEES: Record<string, number> = {
  free: 0,
  basic: 49900,
  standard: 99000,
  enterprise: 199000,
}

function formatKRW(n: number): string {
  return `₩${n.toLocaleString('ko-KR')}`
}

export default function RevenuePage() {
  const [planDetails, setPlanDetails] = useState<PlanDetail[]>([])
  const [totalMonthlyRevenue, setTotalMonthlyRevenue] = useState(0)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    async function load() {
      const supabase = createBrowserSupabaseClient()
      const { data: agencies } = await supabase
        .from('agencies')
        .select('plan, monthly_fee, status')
        .eq('status', 'active')

      const counts: Record<string, { count: number; revenue: number }> = {}

      for (const agency of agencies ?? []) {
        const plan = (agency.plan as string) || 'free'
        if (!counts[plan]) counts[plan] = { count: 0, revenue: 0 }
        counts[plan].count += 1
        counts[plan].revenue += (agency.monthly_fee as number) || PLAN_FEES[plan] || 0
      }

      const monthlyRevenue = Object.values(counts).reduce((sum, current) => sum + current.revenue, 0)
      const details: PlanDetail[] = ['enterprise', 'standard', 'basic', 'free'].map((plan) => {
        const current = counts[plan] ?? { count: 0, revenue: 0 }
        return {
          plan: PLAN_LABELS[plan] ?? plan,
          subscribers: current.count,
          monthlyRevenue: current.revenue,
          share: monthlyRevenue > 0 ? Math.round((current.revenue / monthlyRevenue) * 1000) / 10 : 0,
          averageRevenue: current.count > 0 ? Math.round(current.revenue / current.count) : 0,
        }
      })

      setTotalMonthlyRevenue(monthlyRevenue)
      setPlanDetails(details)
      setLoading(false)
    }

    void load()
  }, [])

  const totalSubscribers = planDetails.reduce((sum, plan) => sum + plan.subscribers, 0)
  const yearlyRevenue = totalMonthlyRevenue * 12
  const averageRevenuePerAgency = totalSubscribers > 0 ? Math.round(totalMonthlyRevenue / totalSubscribers) : 0

  return (
    <div className="space-y-8">
      <div>
        <h2 className="font-headline text-[26px] font-bold tracking-tight text-on-surface">매출 분석</h2>
        <p className="mt-1 text-[14px] text-on-surface-variant">플랜별 구독 매출과 고객사 분포를 확인합니다.</p>
      </div>

      <div className="grid grid-cols-4 gap-5">
        <KpiCard
          label="월 반복 매출"
          value={loading ? '...' : formatKRW(totalMonthlyRevenue)}
          change=""
          changeType="up"
          accentColor="#2563eb"
          icon="trending_up"
        />
        <KpiCard
          label="연 반복 매출(추정)"
          value={loading ? '...' : formatKRW(yearlyRevenue)}
          change=""
          changeType="up"
          accentColor="#007d55"
          icon="monitoring"
        />
        <KpiCard
          label="구독 고객사 수"
          value={loading ? '...' : `${totalSubscribers}곳`}
          change=""
          changeType="up"
          accentColor="#6750a4"
          icon="group_add"
        />
        <KpiCard
          label="고객사당 평균 매출"
          value={loading ? '...' : formatKRW(averageRevenuePerAgency)}
          change=""
          changeType="up"
          accentColor="#565e74"
          icon="person"
        />
      </div>

      <div className="overflow-hidden rounded-2xl bg-surface-container-lowest shadow-ambient">
        <div className="p-6 pb-0">
          <h3 className="font-headline text-[16px] font-bold text-on-surface">플랜별 상세 현황</h3>
        </div>
        <div className="overflow-x-auto p-6 pt-4">
          <table className="w-full text-left">
            <thead>
              <tr className="bg-surface-container-low">
                <th className="px-4 py-3 text-right text-xs font-semibold text-on-surface-variant">플랜</th>
                <th className="px-4 py-3 text-right text-xs font-semibold text-on-surface-variant">구독 고객사</th>
                <th className="px-4 py-3 text-right text-xs font-semibold text-on-surface-variant">월 반복 매출</th>
                <th className="px-4 py-3 text-right text-xs font-semibold text-on-surface-variant">매출 비중</th>
                <th className="px-4 py-3 text-right text-xs font-semibold text-on-surface-variant">고객사당 평균 매출</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-outline-variant/20">
              {loading ? (
                <tr>
                  <td colSpan={5} className="px-4 py-8 text-center text-sm text-on-surface-variant">
                    데이터를 불러오는 중입니다...
                  </td>
                </tr>
              ) : (
                planDetails.map((plan) => (
                  <tr key={plan.plan} className="hover:bg-surface-container-low/50">
                    <td className="px-4 py-3 text-sm font-semibold text-on-surface">{plan.plan}</td>
                    <td className="px-4 py-3 text-right text-sm text-on-surface font-data">{plan.subscribers}곳</td>
                    <td className="px-4 py-3 text-right text-sm text-on-surface font-data">
                      {formatKRW(plan.monthlyRevenue)}
                    </td>
                    <td className="px-4 py-3 text-right text-sm text-on-surface-variant font-data">{plan.share}%</td>
                    <td className="px-4 py-3 text-right text-sm text-on-surface-variant font-data">
                      {formatKRW(plan.averageRevenue)}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
            {!loading ? (
              <tfoot>
                <tr className="bg-surface-container-low font-semibold">
                  <td className="px-4 py-3 text-sm text-on-surface">합계</td>
                  <td className="px-4 py-3 text-right text-sm text-on-surface font-data">{totalSubscribers}곳</td>
                  <td className="px-4 py-3 text-right text-sm text-on-surface font-data">
                    {formatKRW(totalMonthlyRevenue)}
                  </td>
                  <td className="px-4 py-3 text-right text-sm text-on-surface font-data">100%</td>
                  <td className="px-4 py-3 text-right text-sm text-on-surface font-data">
                    {formatKRW(averageRevenuePerAgency)}
                  </td>
                </tr>
              </tfoot>
            ) : null}
          </table>
        </div>
      </div>
    </div>
  )
}
