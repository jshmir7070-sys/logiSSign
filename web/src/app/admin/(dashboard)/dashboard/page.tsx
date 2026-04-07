'use client'

import { useEffect, useMemo, useState } from 'react'
import dynamic from 'next/dynamic'
import KpiCard from '@/components/admin/KpiCard'

const MrrChart = dynamic(() => import('@/components/admin/charts/MrrChart'), { ssr: false })
const PlanDistribution = dynamic(() => import('@/components/admin/charts/PlanDistribution'), {
  ssr: false,
})

interface DashboardResponse {
  summary: {
    totalAgencies: number
    activeAgencies: number
    inactiveAgencies: number
    totalDrivers: number
    linkedDrivers: number
    pushEnabledDrivers: number
    totalContracts: number
    pendingContracts: number
    totalSettlements: number
    pendingSettlements: number
    mrrEstimate: number
    pendingPayments: number
    failedPayments: number
  }
  planCounts: Record<string, number>
  mrrHistory: { month: string; mrr: number }[]
  recentAgencies: { id: string; name: string; plan: string; status: string; created_at: string }[]
  recentPaymentOrders: {
    id: string
    status: string
    title: string
    created_at: string
    agencies?: { name?: string }[] | { name?: string } | null
  }[]
}

function formatKRW(value: number): string {
  return `₩${value.toLocaleString('ko-KR')}`
}

function getCurrentDate() {
  return new Date().toLocaleDateString('ko-KR', {
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    weekday: 'short',
  })
}

export default function AdminDashboardPage() {
  const [data, setData] = useState<DashboardResponse | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    async function load() {
      setLoading(true)
      try {
        const response = await fetch('/api/admin/dashboard')
        const payload = await response.json()
        if (!response.ok) {
          throw new Error(payload.error || '관리자 대시보드를 불러오지 못했습니다.')
        }
        setData(payload)
      } catch (error) {
        alert(error instanceof Error ? error.message : '관리자 대시보드를 불러오지 못했습니다.')
      } finally {
        setLoading(false)
      }
    }

    void load()
  }, [])

  const summary = data?.summary

  const churnRate = useMemo(() => {
    const total = summary?.totalAgencies ?? 0
    const inactive = summary?.inactiveAgencies ?? 0
    if (total === 0) return '0.0'
    return ((inactive / total) * 100).toFixed(1)
  }, [summary?.inactiveAgencies, summary?.totalAgencies])

  const planDistributionData = useMemo(
    () =>
      Object.entries(data?.planCounts ?? {})
        .filter(([, count]) => count > 0)
        .map(([plan, count]) => ({ name: plan.toUpperCase(), value: count })),
    [data?.planCounts],
  )

  return (
    <div className="space-y-8">
      <div>
        <h2 className="font-headline text-[26px] font-bold tracking-tight text-on-surface">
          관리자 대시보드
        </h2>
        <p className="mt-1 text-[14px] text-on-surface-variant">{getCurrentDate()}</p>
      </div>

      <div className="grid grid-cols-1 gap-5 md:grid-cols-2 xl:grid-cols-4">
        <KpiCard
          label="활성 대리점"
          value={loading ? '...' : `${summary?.activeAgencies ?? 0}개`}
          change={`전체 ${summary?.totalAgencies ?? 0}개 중`}
          changeType="up"
          accentColor="#2563eb"
          icon="apartment"
        />
        <KpiCard
          label="예상 월 매출"
          value={loading ? '...' : formatKRW(summary?.mrrEstimate ?? 0)}
          change={`입금 대기 ${summary?.pendingPayments ?? 0}건`}
          changeType="up"
          accentColor="#007d55"
          icon="trending_up"
        />
        <KpiCard
          label="기사 연결 현황"
          value={loading ? '...' : `${summary?.linkedDrivers ?? 0}/${summary?.totalDrivers ?? 0}`}
          change={`푸시 가능 ${summary?.pushEnabledDrivers ?? 0}명`}
          changeType="up"
          accentColor="#6750a4"
          icon="group"
        />
        <KpiCard
          label="이탈률"
          value={loading ? '...' : `${churnRate}%`}
          change={`비활성 ${summary?.inactiveAgencies ?? 0}개`}
          changeType={Number(churnRate) > 0 ? 'down' : 'up'}
          accentColor="#565e74"
          icon="trending_down"
        />
      </div>

      <div className="grid grid-cols-1 gap-5 xl:grid-cols-2">
        <div className="min-h-[320px] rounded-2xl bg-surface-container-lowest p-6 shadow-ambient">
          <h3 className="mb-1 font-headline text-[16px] font-bold text-on-surface">MRR 추이</h3>
          <p className="mb-6 text-[13px] text-on-surface-variant">
            최근 6개월 기준 반영 매출 추정치를 확인합니다.
          </p>
          <MrrChart data={data?.mrrHistory ?? []} />
        </div>

        <div className="min-h-[320px] rounded-2xl bg-surface-container-lowest p-6 shadow-ambient">
          <h3 className="mb-1 font-headline text-[16px] font-bold text-on-surface">플랜 분포</h3>
          <p className="mb-6 text-[13px] text-on-surface-variant">
            Free {data?.planCounts.free ?? 0} / Point {data?.planCounts.point ?? 0} / Basic{' '}
            {data?.planCounts.basic ?? 0} / Standard {data?.planCounts.standard ?? 0} / Pro{' '}
            {data?.planCounts.pro ?? 0}
          </p>
          <PlanDistribution data={planDistributionData} />
        </div>
      </div>

      <div className="grid grid-cols-1 gap-5 xl:grid-cols-2">
        <div className="rounded-2xl bg-surface-container-lowest p-6 shadow-ambient">
          <div className="mb-4 flex items-center justify-between">
            <h3 className="font-headline text-[16px] font-bold text-on-surface">최근 가입 대리점</h3>
          </div>
          <div className="space-y-3">
            {(data?.recentAgencies ?? []).map((agency) => (
              <div key={agency.id} className="rounded-xl border border-outline-variant/15 px-4 py-3">
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <p className="font-medium text-on-surface">{agency.name}</p>
                    <p className="mt-1 text-xs text-on-surface-variant">
                      {agency.plan.toUpperCase()} · {new Date(agency.created_at).toLocaleDateString('ko-KR')}
                    </p>
                  </div>
                  <span className="text-xs font-medium text-on-surface-variant">{agency.status}</span>
                </div>
              </div>
            ))}
          </div>
        </div>

        <div className="rounded-2xl bg-surface-container-lowest p-6 shadow-ambient">
          <div className="mb-4 flex items-center justify-between">
            <h3 className="font-headline text-[16px] font-bold text-on-surface">최근 결제 주문</h3>
          </div>
          <div className="space-y-3">
            {(data?.recentPaymentOrders ?? []).map((order) => (
              <div key={order.id} className="rounded-xl border border-outline-variant/15 px-4 py-3">
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <p className="font-medium text-on-surface">{order.title}</p>
                    <p className="mt-1 text-xs text-on-surface-variant">
                      {Array.isArray(order.agencies)
                        ? order.agencies[0]?.name ?? '-'
                        : order.agencies?.name ?? '-'}
                    </p>
                    <p className="mt-1 text-xs text-on-surface-variant">
                      {new Date(order.created_at).toLocaleString('ko-KR')}
                    </p>
                  </div>
                  <span className="text-xs font-medium text-on-surface-variant">{order.status}</span>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  )
}
