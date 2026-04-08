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
}

interface WeeklyItem {
  day: string
  revenue: number
  users: number
  errors: number
}

interface IncidentSummary {
  total: number
  autoHealed: number
  pending: number
}

export default function OpsKpiPanel() {
  const [kpi, setKpi] = useState<KpiData | null>(null)
  const [weekly, setWeekly] = useState<WeeklyItem[]>([])
  const [incidents, setIncidents] = useState<IncidentSummary | null>(null)
  const [loading, setLoading] = useState(true)

  const loadData = useCallback(async () => {
    setLoading(true)
    try {
      const [kpiRes, weeklyRes, incRes] = await Promise.all([
        fetch('/api/admin/ops/kpi'),
        fetch('/api/admin/ops/weekly'),
        fetch('/api/admin/ops/incidents'),
      ])

      if (kpiRes.ok) {
        const kpiData = await kpiRes.json()
        setKpi(kpiData)
      }
      if (weeklyRes.ok) {
        const weeklyData = await weeklyRes.json()
        setWeekly(weeklyData.weeklyData ?? [])
      }
      if (incRes.ok) {
        const incData = await incRes.json()
        setIncidents(incData.summary ?? null)
      }
    } catch {
      // silently fail — panels show empty state
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
          {[1, 2, 3, 4, 5, 6].map((i) => (
            <div key={i} className="h-[120px] animate-pulse rounded-2xl bg-surface-container-lowest shadow-ambient" />
          ))}
        </div>
        <div className="h-[280px] animate-pulse rounded-2xl bg-surface-container-lowest shadow-ambient" />
      </div>
    )
  }

  const kpiCards = [
    {
      label: '월 매출 (MRR)',
      value: kpi ? `₩${(kpi.revenue.value / 10000).toFixed(0)}만` : '-',
      change: kpi ? `${kpi.revenue.change}%` : '',
      changeType: Number(kpi?.revenue.change ?? 0) >= 0 ? 'up' as const : 'down' as const,
      icon: 'payments',
      accentColor: '#10B981',
    },
    {
      label: '오늘 신규가입',
      value: kpi ? `${kpi.newUsers.value}건` : '-',
      change: kpi ? `${kpi.newUsers.change}%` : '',
      changeType: Number(kpi?.newUsers.change ?? 0) >= 0 ? 'up' as const : 'down' as const,
      icon: 'person_add',
      accentColor: '#3B82F6',
    },
    {
      label: '활성 대행사',
      value: kpi ? `${kpi.activeAgencies.value}개` : '-',
      change: kpi ? `${kpi.activeAgencies.change}%` : '',
      changeType: Number(kpi?.activeAgencies.change ?? 0) >= 0 ? 'up' as const : 'down' as const,
      icon: 'apartment',
      accentColor: '#8B5CF6',
    },
    {
      label: '오늘 결제 건',
      value: kpi ? `${kpi.apiCalls.value}건` : '-',
      change: kpi ? `${kpi.apiCalls.change}%` : '',
      changeType: Number(kpi?.apiCalls.change ?? 0) >= 0 ? 'up' as const : 'down' as const,
      icon: 'bolt',
      accentColor: '#F59E0B',
    },
    {
      label: '오류율',
      value: kpi ? `${kpi.errorRate.value}%` : '-',
      change: kpi ? `${kpi.errorRate.change}%` : '',
      changeType: Number(kpi?.errorRate.change ?? 0) <= 0 ? 'up' as const : 'down' as const,
      icon: 'bug_report',
      accentColor: '#EF4444',
    },
    {
      label: '업타임',
      value: kpi ? `${kpi.uptime.value}%` : '-',
      change: kpi ? `${kpi.uptime.change}%` : '',
      changeType: Number(kpi?.uptime.change ?? 0) >= 0 ? 'up' as const : 'down' as const,
      icon: 'check_circle',
      accentColor: '#10B981',
    },
  ]

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-1 gap-5 md:grid-cols-2 xl:grid-cols-3">
        {kpiCards.map((card) => (
          <KpiCard key={card.label} {...card} />
        ))}
      </div>

      {/* Weekly Charts */}
      {weekly.length > 0 && (
        <div className="rounded-2xl bg-surface-container-lowest p-6 shadow-ambient">
          <h3 className="mb-4 font-headline text-[16px] font-bold text-on-surface">주간 트렌드</h3>
          <div className="grid grid-cols-1 gap-6 xl:grid-cols-3">
            <div>
              <p className="mb-2 font-body text-[12px] text-on-surface-variant">주간 매출</p>
              <WeeklyBarChart
                data={weekly}
                dataKey="revenue"
                color="#10B981"
                formatValue={(v) => `${(v / 10000).toFixed(0)}만`}
              />
            </div>
            <div>
              <p className="mb-2 font-body text-[12px] text-on-surface-variant">신규 가입</p>
              <WeeklyBarChart data={weekly} dataKey="users" color="#3B82F6" />
            </div>
            <div>
              <p className="mb-2 font-body text-[12px] text-on-surface-variant">오류 건수</p>
              <WeeklyBarChart data={weekly} dataKey="errors" color="#EF4444" />
            </div>
          </div>
        </div>
      )}

      {/* Self-Healing Summary */}
      {incidents && (
        <div className="rounded-2xl bg-surface-container-lowest p-6 shadow-ambient">
          <h3 className="mb-4 font-headline text-[16px] font-bold text-on-surface">자동 복구 요약</h3>
          <div className="grid grid-cols-3 gap-4">
            <div className="rounded-xl bg-surface-container-low p-4">
              <p className="font-body text-xs text-on-surface-variant">전체 이슈</p>
              <p className="mt-1 font-data text-2xl font-bold text-on-surface">{incidents.total}</p>
            </div>
            <div className="rounded-xl bg-tertiary/[0.08] p-4">
              <p className="font-body text-xs text-tertiary">자동 복구</p>
              <p className="mt-1 font-data text-2xl font-bold text-tertiary">{incidents.autoHealed}</p>
            </div>
            <div className="rounded-xl bg-amber-50 p-4">
              <p className="font-body text-xs text-amber-600">수동 대기</p>
              <p className="mt-1 font-data text-2xl font-bold text-amber-600">{incidents.pending}</p>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
