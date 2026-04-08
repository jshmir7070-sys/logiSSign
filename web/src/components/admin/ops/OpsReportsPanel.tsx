'use client'

import { useCallback, useEffect, useState } from 'react'
import dynamic from 'next/dynamic'

const WeeklyBarChart = dynamic(() => import('@/components/admin/charts/WeeklyBarChart'), {
  ssr: false,
  loading: () => <div className="h-[200px] animate-pulse rounded-xl bg-surface-container-low" />,
})

interface WeeklyItem {
  day: string
  revenue: number
  users: number
  errors: number
  payments: number
}

interface KpiData {
  revenue: { value: number }
  newUsers: { value: number }
  activeAgencies: { value: number }
  errorRate: { value: string }
  uptime: { value: string }
}

export default function OpsReportsPanel() {
  const [weekly, setWeekly] = useState<WeeklyItem[]>([])
  const [kpi, setKpi] = useState<KpiData | null>(null)
  const [loading, setLoading] = useState(true)

  const loadData = useCallback(async () => {
    setLoading(true)
    try {
      const [weeklyRes, kpiRes] = await Promise.all([
        fetch('/api/admin/ops/weekly'),
        fetch('/api/admin/ops/kpi'),
      ])
      if (weeklyRes.ok) {
        const payload = await weeklyRes.json()
        setWeekly(payload.weeklyData ?? [])
      }
      if (kpiRes.ok) {
        setKpi(await kpiRes.json())
      }
    } catch {
      // silent
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    void loadData()
  }, [loadData])

  const now = new Date()
  const dateStr = `${now.getFullYear()}.${String(now.getMonth() + 1).padStart(2, '0')}.${String(now.getDate()).padStart(2, '0')}`

  if (loading) {
    return (
      <div className="space-y-6">
        <div className="h-[300px] animate-pulse rounded-2xl bg-surface-container-lowest shadow-ambient" />
        <div className="h-[400px] animate-pulse rounded-2xl bg-surface-container-lowest shadow-ambient" />
      </div>
    )
  }

  return (
    <div className="space-y-6">
      {/* Weekly Charts */}
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

      {/* Daily AI Report */}
      <div className="rounded-2xl bg-surface-container-lowest p-6 shadow-ambient">
        <div className="mb-4 flex items-center justify-between">
          <h3 className="font-headline text-[16px] font-bold text-on-surface">AI 일일 보고서</h3>
          <span className="font-body text-[11px] text-on-surface-variant">{dateStr} 자동 생성</span>
        </div>
        <div className="whitespace-pre-wrap rounded-xl bg-surface-container-low p-5 font-body text-[13px] leading-7 text-on-surface">
{`SS로직스 / 로지사인 일일 운영 보고

■ 핵심 KPI
  • 매출(MRR): ₩${kpi ? kpi.revenue.value.toLocaleString() : '-'}
  • 신규 가입: ${kpi?.newUsers.value ?? '-'}건
  • 활성 배달대행사: ${kpi?.activeAgencies.value ?? '-'}개
  • 오류율: ${kpi?.errorRate.value ?? '-'}% | 업타임: ${kpi?.uptime.value ?? '-'}%

■ 주간 요약
  • 7일간 신규 가입: ${weekly.reduce((s, w) => s + w.users, 0)}건
  • 7일간 오류 합계: ${weekly.reduce((s, w) => s + w.errors, 0)}건
  • 7일간 결제 건수: ${weekly.reduce((s, w) => s + w.payments, 0)}건

이 보고서는 AI가 실제 데이터 기반으로 자동 생성했습니다.`}
        </div>
      </div>
    </div>
  )
}
