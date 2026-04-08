'use client'

import { useEffect, useMemo, useState } from 'react'
import dynamic from 'next/dynamic'
import KpiCard from '@/components/admin/KpiCard'
import OpsTabBar, { type OpsTab } from '@/components/admin/ops/OpsTabBar'

const SparklineChart = dynamic(() => import('@/components/admin/charts/SparklineChart'), { ssr: false })
const WeeklyBarChart = dynamic(() => import('@/components/admin/charts/WeeklyBarChart'), { ssr: false })

interface KpiResponse {
  revenue: { value: number; change: string }
  newUsers: { value: number; change: string }
  activeAgencies: { value: number; change: string }
  apiCalls: { value: number; change: string }
  errorRate: { value: string; change: string }
  uptime: { value: string; change: string }
}

interface WeeklyDatum {
  day: string
  date: string
  revenue: number
  users: number
  errors: number
  payments: number
}

interface Incident {
  id: string
  time: string
  type: string
  severity: 'warning' | 'critical' | 'resolved' | 'info'
  msg: string
  dept: string
  autoHealed: boolean
}

interface IncidentResponse {
  incidents: Incident[]
  summary: {
    total: number
    autoHealed: number
    pending: number
    levels: {
      level1: number
      level2: number
      level3: number
      level4: number
    }
  }
}

interface Department {
  id: string
  name: string
  icon: string
  color: string
  agent: string
  metrics: Record<string, string | number>
}

interface DepartmentResponse {
  departments: Department[]
}

const formatCurrency = (value: number) => `₩${value.toLocaleString('ko-KR')}`

const severityTone: Record<Incident['severity'], string> = {
  critical: 'bg-error/10 text-error',
  warning: 'bg-tertiary/12 text-tertiary',
  resolved: 'bg-primary/10 text-primary',
  info: 'bg-surface-container text-on-surface-variant',
}

export default function AdminOpsPage() {
  const [activeTab, setActiveTab] = useState<OpsTab>('dashboard')
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [kpi, setKpi] = useState<KpiResponse | null>(null)
  const [weeklyData, setWeeklyData] = useState<WeeklyDatum[]>([])
  const [incidentData, setIncidentData] = useState<IncidentResponse | null>(null)
  const [departmentData, setDepartmentData] = useState<DepartmentResponse | null>(null)

  useEffect(() => {
    async function load() {
      setLoading(true)
      setError(null)

      try {
        const [kpiRes, weeklyRes, incidentRes, departmentRes] = await Promise.all([
          fetch('/api/admin/ops/kpi'),
          fetch('/api/admin/ops/weekly'),
          fetch('/api/admin/ops/incidents'),
          fetch('/api/admin/ops/departments'),
        ])

        const [kpiPayload, weeklyPayload, incidentPayload, departmentPayload] = await Promise.all([
          kpiRes.json(),
          weeklyRes.json(),
          incidentRes.json(),
          departmentRes.json(),
        ])

        if (!kpiRes.ok) throw new Error(kpiPayload.error || '운영 KPI를 불러오지 못했습니다.')
        if (!weeklyRes.ok) throw new Error(weeklyPayload.error || '주간 추이를 불러오지 못했습니다.')
        if (!incidentRes.ok) throw new Error(incidentPayload.error || '이슈 현황을 불러오지 못했습니다.')
        if (!departmentRes.ok) throw new Error(departmentPayload.error || '부서별 현황을 불러오지 못했습니다.')

        setKpi(kpiPayload)
        setWeeklyData(weeklyPayload.weeklyData ?? [])
        setIncidentData(incidentPayload)
        setDepartmentData(departmentPayload)
      } catch (loadError) {
        setError(loadError instanceof Error ? loadError.message : '운영 대시보드를 불러오지 못했습니다.')
      } finally {
        setLoading(false)
      }
    }

    void load()
  }, [])

  const sparklineRevenue = useMemo(() => weeklyData.map((item) => item.revenue), [weeklyData])
  const sparklineUsers = useMemo(() => weeklyData.map((item) => item.users), [weeklyData])
  const sparklineErrors = useMemo(() => weeklyData.map((item) => item.errors), [weeklyData])

  return (
    <div className="space-y-8">
      <div className="flex flex-col gap-3 lg:flex-row lg:items-end lg:justify-between">
        <div>
          <h2 className="font-headline text-[26px] font-bold tracking-tight text-on-surface">운영 대시보드</h2>
          <p className="mt-1 text-[14px] text-on-surface-variant">
            고객사 운영, 결제 흐름, 이슈 현황, 부서별 진행 상황을 한 화면에서 확인합니다.
          </p>
        </div>
        <div className="rounded-2xl bg-surface-container-lowest px-4 py-3 text-[13px] text-on-surface-variant shadow-ambient">
          최근 수집된 운영 데이터를 기준으로 집계합니다.
        </div>
      </div>

      <OpsTabBar activeTab={activeTab} onTabChange={setActiveTab} />

      {error ? (
        <div className="rounded-2xl border border-error/15 bg-error/5 px-5 py-4 text-sm text-error">{error}</div>
      ) : null}

      {activeTab === 'dashboard' ? (
        <div className="space-y-6">
          <div className="grid grid-cols-1 gap-5 md:grid-cols-2 xl:grid-cols-3">
            <KpiCard
              label="예상 월 매출"
              value={loading ? '...' : formatCurrency(kpi?.revenue.value ?? 0)}
              change={loading ? '' : `${kpi?.revenue.change ?? '0.0'}%`}
              changeType="up"
              accentColor="#2563eb"
              icon="payments"
            />
            <KpiCard
              label="오늘 신규 고객사"
              value={loading ? '...' : `${kpi?.newUsers.value ?? 0}개`}
              change={loading ? '' : `${kpi?.newUsers.change ?? '0.0'}%`}
              changeType="up"
              accentColor="#007d55"
              icon="person_add"
            />
            <KpiCard
              label="활성 고객사"
              value={loading ? '...' : `${kpi?.activeAgencies.value ?? 0}개`}
              change={loading ? '' : `${kpi?.activeAgencies.change ?? '0.0'}%`}
              changeType="up"
              accentColor="#6750a4"
              icon="apartment"
            />
            <KpiCard
              label="오늘 결제 이벤트"
              value={loading ? '...' : `${kpi?.apiCalls.value ?? 0}건`}
              change={loading ? '' : `${kpi?.apiCalls.change ?? '0.0'}%`}
              changeType="up"
              accentColor="#d97706"
              icon="credit_card"
            />
            <KpiCard
              label="계약 기준 오류율"
              value={loading ? '...' : `${kpi?.errorRate.value ?? '0.00'}%`}
              change={loading ? '' : `${kpi?.errorRate.change ?? '0.0'}%`}
              changeType="down"
              accentColor="#dc2626"
              icon="warning"
            />
            <KpiCard
              label="추정 가동률"
              value={loading ? '...' : `${kpi?.uptime.value ?? '0.00'}%`}
              change={loading ? '' : `${kpi?.uptime.change ?? '0.0'}%`}
              changeType="up"
              accentColor="#0ea5e9"
              icon="monitor_heart"
            />
          </div>

          <div className="grid grid-cols-1 gap-5 xl:grid-cols-3">
            <div className="rounded-2xl bg-surface-container-lowest p-6 shadow-ambient">
              <div className="flex items-start justify-between gap-4">
                <div>
                  <h3 className="font-headline text-[16px] font-bold text-on-surface">최근 7일 매출 추이</h3>
                  <p className="mt-1 text-[13px] text-on-surface-variant">가입 플랜을 기준으로 추정한 월 매출 흐름입니다.</p>
                </div>
                <span className="rounded-full bg-primary/8 px-3 py-1 text-xs font-semibold text-primary">실시간</span>
              </div>
              <div className="mt-5">
                <SparklineChart data={sparklineRevenue} height={80} />
              </div>
            </div>

            <div className="rounded-2xl bg-surface-container-lowest p-6 shadow-ambient">
              <h3 className="font-headline text-[16px] font-bold text-on-surface">최근 7일 신규 고객사</h3>
              <p className="mt-1 text-[13px] text-on-surface-variant">일자별 가입 추이를 빠르게 확인합니다.</p>
              <div className="mt-5">
                <SparklineChart data={sparklineUsers} color="#007d55" height={80} />
              </div>
            </div>

            <div className="rounded-2xl bg-surface-container-lowest p-6 shadow-ambient">
              <h3 className="font-headline text-[16px] font-bold text-on-surface">최근 7일 경고 이벤트</h3>
              <p className="mt-1 text-[13px] text-on-surface-variant">결제 실패와 경고 이상 로그를 기준으로 집계합니다.</p>
              <div className="mt-5">
                <SparklineChart data={sparklineErrors} color="#dc2626" height={80} />
              </div>
            </div>
          </div>
        </div>
      ) : null}

      {activeTab === 'weekly' ? (
        <div className="grid grid-cols-1 gap-5 xl:grid-cols-2">
          <div className="rounded-2xl bg-surface-container-lowest p-6 shadow-ambient">
            <h3 className="font-headline text-[16px] font-bold text-on-surface">주간 매출 추이</h3>
            <p className="mt-1 text-[13px] text-on-surface-variant">최근 7일 기준 매출 추정치를 막대 그래프로 표시합니다.</p>
            <div className="mt-6">
              <WeeklyBarChart data={weeklyData} dataKey="revenue" formatValue={(value) => `${Math.round(value / 10000)}만`} />
            </div>
          </div>

          <div className="rounded-2xl bg-surface-container-lowest p-6 shadow-ambient">
            <h3 className="font-headline text-[16px] font-bold text-on-surface">주간 신규 고객사</h3>
            <p className="mt-1 text-[13px] text-on-surface-variant">일자별 가입 건수 흐름을 같이 봅니다.</p>
            <div className="mt-6">
              <WeeklyBarChart data={weeklyData} dataKey="users" color="#007d55" />
            </div>
          </div>

          <div className="rounded-2xl bg-surface-container-lowest p-6 shadow-ambient">
            <h3 className="font-headline text-[16px] font-bold text-on-surface">주간 결제 이벤트</h3>
            <p className="mt-1 text-[13px] text-on-surface-variant">결제 주문이 발생한 수를 일자별로 집계합니다.</p>
            <div className="mt-6">
              <WeeklyBarChart data={weeklyData} dataKey="payments" color="#d97706" />
            </div>
          </div>

          <div className="rounded-2xl bg-surface-container-lowest p-6 shadow-ambient">
            <h3 className="font-headline text-[16px] font-bold text-on-surface">주간 오류 이벤트</h3>
            <p className="mt-1 text-[13px] text-on-surface-variant">경고 이상 수준의 이슈만 별도로 보여줍니다.</p>
            <div className="mt-6">
              <WeeklyBarChart data={weeklyData} dataKey="errors" color="#dc2626" />
            </div>
          </div>
        </div>
      ) : null}

      {activeTab === 'incidents' && incidentData ? (
        <div className="space-y-5">
          <div className="grid grid-cols-1 gap-5 md:grid-cols-3 xl:grid-cols-5">
            <KpiCard label="전체 이슈" value={`${incidentData.summary.total}건`} change="" changeType="up" icon="list_alt" />
            <KpiCard label="자동 복구" value={`${incidentData.summary.autoHealed}건`} change="" changeType="up" icon="healing" accentColor="#007d55" />
            <KpiCard label="수동 확인 필요" value={`${incidentData.summary.pending}건`} change="" changeType="down" icon="warning" accentColor="#dc2626" />
            <KpiCard label="경고" value={`${incidentData.summary.levels.level3}건`} change="" changeType="down" icon="report" accentColor="#d97706" />
            <KpiCard label="치명적" value={`${incidentData.summary.levels.level4}건`} change="" changeType="down" icon="report_gmailerrorred" accentColor="#b91c1c" />
          </div>

          <div className="rounded-2xl bg-surface-container-lowest p-6 shadow-ambient">
            <h3 className="font-headline text-[16px] font-bold text-on-surface">최근 이슈 이력</h3>
            <div className="mt-5 space-y-3">
              {incidentData.incidents.length === 0 ? (
                <div className="rounded-xl border border-outline-variant/15 px-4 py-6 text-sm text-on-surface-variant">
                  최근 감지된 이슈가 없습니다.
                </div>
              ) : (
                incidentData.incidents.slice(0, 20).map((incident) => (
                  <div key={incident.id} className="flex items-start justify-between gap-4 rounded-xl border border-outline-variant/15 px-4 py-4">
                    <div className="min-w-0">
                      <div className="flex flex-wrap items-center gap-2">
                        <span className={`rounded-full px-2.5 py-1 text-[11px] font-semibold ${severityTone[incident.severity]}`}>
                          {incident.type}
                        </span>
                        <span className="text-xs text-on-surface-variant">{incident.time}</span>
                        <span className="text-xs text-on-surface-variant">{incident.dept}</span>
                      </div>
                      <p className="mt-2 text-sm text-on-surface">{incident.msg}</p>
                    </div>
                    <span className="text-xs text-on-surface-variant">{incident.autoHealed ? '자동 처리' : '확인 필요'}</span>
                  </div>
                ))
              )}
            </div>
          </div>
        </div>
      ) : null}

      {activeTab === 'departments' && departmentData ? (
        <div className="grid grid-cols-1 gap-5 xl:grid-cols-2">
          {departmentData.departments.map((department) => (
            <div key={department.id} className="rounded-2xl bg-surface-container-lowest p-6 shadow-ambient">
              <div className="flex items-start justify-between gap-4">
                <div className="flex items-center gap-4">
                  <div className="flex h-12 w-12 items-center justify-center rounded-2xl" style={{ backgroundColor: `${department.color}18` }}>
                    <span className="material-symbols-outlined text-[24px]" style={{ color: department.color }}>
                      {department.icon}
                    </span>
                  </div>
                  <div>
                    <h3 className="font-headline text-[18px] font-bold text-on-surface">{department.name}</h3>
                    <p className="mt-1 text-[13px] text-on-surface-variant">{department.agent}</p>
                  </div>
                </div>
                <span className="rounded-full bg-surface px-3 py-1 text-xs text-on-surface-variant">실시간</span>
              </div>

              <div className="mt-5 grid grid-cols-2 gap-3">
                {Object.entries(department.metrics).map(([key, value]) => (
                  <div key={key} className="rounded-xl border border-outline-variant/15 bg-white px-4 py-3">
                    <p className="text-xs text-on-surface-variant">{key}</p>
                    <p className="mt-1 text-[15px] font-semibold text-on-surface">{String(value)}</p>
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>
      ) : null}
    </div>
  )
}
