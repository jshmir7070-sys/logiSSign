'use client'

import { useCallback, useEffect, useState } from 'react'
import dynamic from 'next/dynamic'

const WeeklyBarChart = dynamic(() => import('@/components/admin/charts/WeeklyBarChart'), {
  ssr: false,
  loading: () => <div className="h-[200px] animate-pulse rounded-xl bg-surface-container-low" />,
})

interface WeeklyItem {
  day: string
  date: string
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
  linkedDrivers?: { value: number }
}

function formatCurrency(value: number): string {
  return `₩${value.toLocaleString('ko-KR')}`
}

export default function OpsReportsPanel() {
  const [weekly, setWeekly] = useState<WeeklyItem[]>([])
  const [kpi, setKpi] = useState<KpiData | null>(null)
  const [loading, setLoading] = useState(true)

  const loadData = useCallback(async () => {
    setLoading(true)
    try {
      const [weeklyRes, kpiRes] = await Promise.all([fetch('/api/admin/ops/weekly'), fetch('/api/admin/ops/kpi')])

      if (weeklyRes.ok) {
        const payload = await weeklyRes.json()
        setWeekly(payload.weeklyData ?? [])
      }

      if (kpiRes.ok) {
        setKpi(await kpiRes.json())
      }
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    void loadData()
  }, [loadData])

  const now = new Date()
  const dateLabel = `${now.getFullYear()}.${String(now.getMonth() + 1).padStart(2, '0')}.${String(now.getDate()).padStart(2, '0')}`
  const weeklyRevenue = weekly.reduce((sum, item) => sum + item.revenue, 0)
  const weeklyUsers = weekly.reduce((sum, item) => sum + item.users, 0)
  const weeklyErrors = weekly.reduce((sum, item) => sum + item.errors, 0)
  const weeklyPayments = weekly.reduce((sum, item) => sum + item.payments, 0)

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
      <div className="rounded-2xl bg-surface-container-lowest p-6 shadow-ambient">
        <h3 className="font-headline text-[16px] font-bold text-on-surface">주간 운영 리포트</h3>
        <p className="mt-1 text-[13px] text-on-surface-variant">
          매출, 신규 고객사, 결제, 경고 로그를 한 번에 비교해 운영 흐름을 확인합니다.
        </p>

        <div className="mt-6 grid grid-cols-1 gap-6 xl:grid-cols-4">
          <div>
            <p className="mb-2 text-[12px] text-on-surface-variant">주간 예상 매출</p>
            <WeeklyBarChart
              data={weekly}
              dataKey="revenue"
              color="#10B981"
              formatValue={(value) => `${Math.round(value / 10000)}만`}
            />
          </div>
          <div>
            <p className="mb-2 text-[12px] text-on-surface-variant">주간 신규 고객사</p>
            <WeeklyBarChart data={weekly} dataKey="users" color="#3B82F6" />
          </div>
          <div>
            <p className="mb-2 text-[12px] text-on-surface-variant">주간 결제 주문</p>
            <WeeklyBarChart data={weekly} dataKey="payments" color="#F59E0B" />
          </div>
          <div>
            <p className="mb-2 text-[12px] text-on-surface-variant">주간 경고 로그</p>
            <WeeklyBarChart data={weekly} dataKey="errors" color="#EF4444" />
          </div>
        </div>
      </div>

      <div className="rounded-2xl bg-surface-container-lowest p-6 shadow-ambient">
        <div className="mb-4 flex items-center justify-between">
          <h3 className="font-headline text-[16px] font-bold text-on-surface">운영 요약 보고서</h3>
          <span className="text-[11px] text-on-surface-variant">{dateLabel} 기준 자동 집계</span>
        </div>

        <div className="rounded-2xl bg-surface-container-low p-5 text-[13px] leading-7 text-on-surface">
          <p className="font-semibold text-on-surface">오늘 운영 요약</p>
          <ul className="mt-3 space-y-2 text-on-surface-variant">
            <li>예상 월 매출은 {formatCurrency(kpi?.revenue.value ?? 0)} 수준으로 집계되었습니다.</li>
            <li>최근 7일 신규 고객사는 총 {weeklyUsers}곳, 활성 고객사는 현재 {kpi?.activeAgencies.value ?? 0}곳입니다.</li>
            <li>최근 7일 결제 주문은 {weeklyPayments}건, 경고 로그는 {weeklyErrors}건입니다.</li>
            <li>연결된 소속 기사는 {kpi?.linkedDrivers?.value ?? 0}명이며, 추정 가용성은 {kpi?.uptime.value ?? '-'}%입니다.</li>
            <li>계약 완료율 기준 위험 지표는 {kpi?.errorRate.value ?? '-'}%입니다.</li>
          </ul>
        </div>
      </div>

      <div className="grid grid-cols-1 gap-5 xl:grid-cols-4">
        <div className="rounded-2xl bg-surface-container-lowest p-5 shadow-ambient">
          <p className="text-xs text-on-surface-variant">주간 예상 매출 합계</p>
          <p className="mt-2 font-data text-2xl font-bold text-on-surface">{formatCurrency(weeklyRevenue)}</p>
        </div>
        <div className="rounded-2xl bg-surface-container-lowest p-5 shadow-ambient">
          <p className="text-xs text-on-surface-variant">주간 신규 고객사</p>
          <p className="mt-2 font-data text-2xl font-bold text-on-surface">{weeklyUsers}곳</p>
        </div>
        <div className="rounded-2xl bg-surface-container-lowest p-5 shadow-ambient">
          <p className="text-xs text-on-surface-variant">주간 결제 주문</p>
          <p className="mt-2 font-data text-2xl font-bold text-on-surface">{weeklyPayments}건</p>
        </div>
        <div className="rounded-2xl bg-surface-container-lowest p-5 shadow-ambient">
          <p className="text-xs text-on-surface-variant">주간 경고 로그</p>
          <p className="mt-2 font-data text-2xl font-bold text-on-surface">{weeklyErrors}건</p>
        </div>
      </div>
    </div>
  )
}
