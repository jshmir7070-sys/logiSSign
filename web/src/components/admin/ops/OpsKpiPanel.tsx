'use client'

import { useCallback, useEffect, useState } from 'react'
import dynamic from 'next/dynamic'
import KpiCard from '@/components/admin/KpiCard'

const WeeklyBarChart = dynamic(() => import('@/components/admin/charts/WeeklyBarChart'), {
  ssr: false,
  loading: () => <div className="h-[200px] animate-pulse rounded-xl bg-surface-container-low" />,
})

interface KpiData {
  revenue: { value: number; change: string }
  newUsers: { value: number; change: string }
  activeAgencies: { value: number; change: string }
  apiCalls: { value: number; change: string }
  errorRate: { value: string; change: string }
  uptime: { value: string; change: string }
  linkedDrivers?: { value: number; change: string }
}

interface WeeklyItem {
  day: string
  revenue: number
  users: number
  errors: number
  payments: number
}

interface IncidentSummary {
  total: number
  autoHealed: number
  pending: number
}

function formatCurrency(value: number): string {
  return `₩${value.toLocaleString('ko-KR')}`
}

export default function OpsKpiPanel() {
  const [kpi, setKpi] = useState<KpiData | null>(null)
  const [weekly, setWeekly] = useState<WeeklyItem[]>([])
  const [incidents, setIncidents] = useState<IncidentSummary | null>(null)
  const [loading, setLoading] = useState(true)

  const loadData = useCallback(async () => {
    setLoading(true)
    try {
      const [kpiRes, weeklyRes, incidentsRes] = await Promise.all([
        fetch('/api/admin/ops/kpi'),
        fetch('/api/admin/ops/weekly'),
        fetch('/api/admin/ops/incidents'),
      ])

      if (kpiRes.ok) {
        setKpi(await kpiRes.json())
      }
      if (weeklyRes.ok) {
        const payload = await weeklyRes.json()
        setWeekly(payload.weeklyData ?? [])
      }
      if (incidentsRes.ok) {
        const payload = await incidentsRes.json()
        setIncidents(payload.summary ?? null)
      }
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    void loadData()
  }, [loadData])

  if (loading) {
    return (
      <div className="space-y-6">
        <div className="grid grid-cols-1 gap-5 md:grid-cols-2 xl:grid-cols-3">
          {[1, 2, 3, 4, 5, 6].map((index) => (
            <div key={index} className="h-[120px] animate-pulse rounded-2xl bg-surface-container-lowest shadow-ambient" />
          ))}
        </div>
        <div className="h-[280px] animate-pulse rounded-2xl bg-surface-container-lowest shadow-ambient" />
      </div>
    )
  }

  const kpiCards = [
    {
      label: '예상 월 매출',
      value: kpi ? formatCurrency(kpi.revenue.value) : '-',
      change: kpi ? `${kpi.revenue.change}%` : '',
      changeType: Number(kpi?.revenue.change ?? 0) >= 0 ? ('up' as const) : ('down' as const),
      icon: 'payments',
      accentColor: '#10B981',
    },
    {
      label: '오늘 신규 고객사',
      value: kpi ? `${kpi.newUsers.value}건` : '-',
      change: kpi ? `${kpi.newUsers.change}%` : '',
      changeType: Number(kpi?.newUsers.change ?? 0) >= 0 ? ('up' as const) : ('down' as const),
      icon: 'person_add',
      accentColor: '#3B82F6',
    },
    {
      label: '활성 고객사',
      value: kpi ? `${kpi.activeAgencies.value}곳` : '-',
      change: kpi ? `${kpi.activeAgencies.change}%` : '',
      changeType: Number(kpi?.activeAgencies.change ?? 0) >= 0 ? ('up' as const) : ('down' as const),
      icon: 'apartment',
      accentColor: '#8B5CF6',
    },
    {
      label: '오늘 결제 주문',
      value: kpi ? `${kpi.apiCalls.value}건` : '-',
      change: kpi ? `${kpi.apiCalls.change}%` : '',
      changeType: Number(kpi?.apiCalls.change ?? 0) >= 0 ? ('up' as const) : ('down' as const),
      icon: 'credit_card',
      accentColor: '#F59E0B',
    },
    {
      label: '연결된 소속 기사',
      value: kpi?.linkedDrivers ? `${kpi.linkedDrivers.value}명` : '-',
      change: kpi?.linkedDrivers ? `${kpi.linkedDrivers.change}%` : '',
      changeType: Number(kpi?.linkedDrivers?.change ?? 0) >= 0 ? ('up' as const) : ('down' as const),
      icon: 'local_shipping',
      accentColor: '#EC4899',
    },
    {
      label: '추정 가용성',
      value: kpi ? `${kpi.uptime.value}%` : '-',
      change: kpi ? `${kpi.uptime.change}%` : '',
      changeType: Number(kpi?.uptime.change ?? 0) >= 0 ? ('up' as const) : ('down' as const),
      icon: 'monitor_heart',
      accentColor: '#0EA5E9',
    },
  ]

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-1 gap-5 md:grid-cols-2 xl:grid-cols-3">
        {kpiCards.map((card) => (
          <KpiCard key={card.label} {...card} />
        ))}
      </div>

      <div className="grid grid-cols-1 gap-5 xl:grid-cols-3">
        <div className="rounded-2xl bg-surface-container-lowest p-6 shadow-ambient">
          <h3 className="font-headline text-[16px] font-bold text-on-surface">주간 매출 추이</h3>
          <p className="mt-1 text-[13px] text-on-surface-variant">최근 7일 동안 고객사 플랜 기준 예상 매출 흐름입니다.</p>
          <div className="mt-5">
            <WeeklyBarChart
              data={weekly}
              dataKey="revenue"
              color="#10B981"
              formatValue={(value) => `${Math.round(value / 10000)}만`}
            />
          </div>
        </div>

        <div className="rounded-2xl bg-surface-container-lowest p-6 shadow-ambient">
          <h3 className="font-headline text-[16px] font-bold text-on-surface">주간 신규 고객사</h3>
          <p className="mt-1 text-[13px] text-on-surface-variant">요일별 신규 가입 고객사 수를 빠르게 비교할 수 있습니다.</p>
          <div className="mt-5">
            <WeeklyBarChart data={weekly} dataKey="users" color="#3B82F6" />
          </div>
        </div>

        <div className="rounded-2xl bg-surface-container-lowest p-6 shadow-ambient">
          <h3 className="font-headline text-[16px] font-bold text-on-surface">이슈 자동 복구 요약</h3>
          <p className="mt-1 text-[13px] text-on-surface-variant">최근 이슈 중 자동 복구와 수동 확인 비중을 함께 봅니다.</p>

          {incidents ? (
            <div className="mt-5 grid grid-cols-3 gap-3">
              <div className="rounded-xl bg-surface-container-low p-4">
                <p className="text-xs text-on-surface-variant">전체 이슈</p>
                <p className="mt-1 font-data text-2xl font-bold text-on-surface">{incidents.total}</p>
              </div>
              <div className="rounded-xl bg-tertiary/[0.08] p-4">
                <p className="text-xs text-tertiary">자동 복구</p>
                <p className="mt-1 font-data text-2xl font-bold text-tertiary">{incidents.autoHealed}</p>
              </div>
              <div className="rounded-xl bg-amber-50 p-4">
                <p className="text-xs text-amber-600">수동 확인</p>
                <p className="mt-1 font-data text-2xl font-bold text-amber-600">{incidents.pending}</p>
              </div>
            </div>
          ) : (
            <div className="mt-5 rounded-xl bg-surface-container-low p-4 text-sm text-on-surface-variant">
              표시할 이슈 요약이 없습니다.
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
