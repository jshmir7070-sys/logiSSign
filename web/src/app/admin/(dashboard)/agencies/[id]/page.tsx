'use client'

import { useCallback, useEffect, useState } from 'react'
import { useParams, useRouter } from 'next/navigation'
import Badge from '@/components/shared/Badge'
import KpiCard from '@/components/admin/KpiCard'

/* ────────── types ────────── */

interface AgencyInfo {
  id: string
  name: string
  owner_name: string | null
  phone: string | null
  email: string | null
  plan: string
  plan_type: string | null
  monthly_fee: number
  status: string
  created_at: string
  business_number: string | null
  address: string | null
  logo_url: string | null
  max_drivers: number | null
}

interface DriverRow {
  id: string
  name: string
  phone: string | null
  push_token: string | null
  created_at: string
  status: string | null
}

interface ContractRow {
  id: string
  title: string
  status: string
  sent_at: string | null
  signed_at: string | null
  created_at: string
}

interface SettlementRow {
  id: string
  year_month: string
  status: string
  total_amount: number | null
  net_amount: number | null
  sent_at: string | null
  created_at: string
}

interface PaymentOrderRow {
  id: string
  title: string
  status: string
  amount: number | null
  payment_method: string | null
  created_at: string
  paid_at: string | null
}

interface PointTransactionRow {
  id: string
  type: string
  amount: number
  balance_after: number
  description: string | null
  created_at: string
}

interface DashboardData {
  agency: AgencyInfo
  driverStats: {
    total: number
    appActive: number
    drivers: DriverRow[]
  }
  contractStats: {
    total: number
    counts: { draft: number; sent: number; viewed: number; signed: number; expired: number }
    signRate: number
    recent: ContractRow[]
  }
  settlementStats: {
    total: number
    counts: { draft: number; sent: number; confirmed: number }
    jobTotal: number
    jobCompleted: number
    jobFailed: number
    recent: SettlementRow[]
  }
  paymentStats: {
    total: number
    counts: { paid: number; pending: number; failed: number; cancelled: number }
    totalPaidAmount: number
    recent: PaymentOrderRow[]
  }
  pointStats: {
    balance: number
    totalCharged: number
    totalUsed: number
    lastUpdated: string | null
    recentTransactions: PointTransactionRow[]
  }
  usageStats: {
    planType: string
    maxDrivers: number
    currentAppActive: number
    overCount: number
  }
}

/* ────────── helpers ────────── */

function formatKRW(value: number): string {
  return `₩${value.toLocaleString('ko-KR')}`
}

function formatDate(dateStr: string): string {
  return new Date(dateStr).toLocaleDateString('ko-KR')
}

function formatDateTime(dateStr: string): string {
  return new Date(dateStr).toLocaleString('ko-KR', {
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
  })
}

const CONTRACT_STATUS_LABEL: Record<string, string> = {
  draft: '작성 중',
  sent: '전송됨',
  viewed: '열람됨',
  signed: '서명 완료',
  expired: '만료',
}

const CONTRACT_STATUS_VARIANT: Record<string, 'success' | 'warning' | 'error' | 'info' | 'default'> = {
  draft: 'default',
  sent: 'info',
  viewed: 'warning',
  signed: 'success',
  expired: 'error',
}

const SETTLEMENT_STATUS_LABEL: Record<string, string> = {
  draft: '작성 중',
  sent: '발송됨',
  confirmed: '확인 완료',
}

const SETTLEMENT_STATUS_VARIANT: Record<string, 'success' | 'warning' | 'info' | 'default'> = {
  draft: 'default',
  sent: 'info',
  confirmed: 'success',
}

const PAYMENT_STATUS_LABEL: Record<string, string> = {
  paid: '결제 완료',
  pending: '입금 대기',
  failed: '결제 실패',
  cancelled: '취소',
}

const PAYMENT_STATUS_VARIANT: Record<string, 'success' | 'warning' | 'error' | 'default'> = {
  paid: 'success',
  pending: 'warning',
  failed: 'error',
  cancelled: 'default',
}

const PLAN_BADGE_VARIANT: Record<string, 'info' | 'success' | 'default' | 'warning'> = {
  free: 'default',
  basic: 'info',
  standard: 'success',
  pro: 'warning',
  enterprise: 'warning',
}

const POINT_TX_LABEL: Record<string, string> = {
  charge: '충전',
  use: '사용',
  refund: '환불',
  bonus: '보너스',
  expire: '만료',
}

const POINT_TX_VARIANT: Record<string, 'success' | 'error' | 'warning' | 'info' | 'default'> = {
  charge: 'success',
  use: 'info',
  refund: 'warning',
  bonus: 'success',
  expire: 'error',
}

/* ────────── flow status bar component ────────── */

function FlowBar({
  items,
}: {
  items: { label: string; count: number; color: string }[]
}) {
  const total = items.reduce((sum, i) => sum + i.count, 0)
  if (total === 0) return <div className="h-3 w-full rounded-full bg-surface-container-low" />

  return (
    <div className="flex h-3 w-full overflow-hidden rounded-full bg-surface-container-low">
      {items.map((item) => {
        const pct = (item.count / total) * 100
        if (pct === 0) return null
        return (
          <div
            key={item.label}
            className="h-full transition-all duration-500"
            style={{ width: `${pct}%`, backgroundColor: item.color }}
            title={`${item.label}: ${item.count}건 (${pct.toFixed(1)}%)`}
          />
        )
      })}
    </div>
  )
}

function FlowLegend({ items }: { items: { label: string; count: number; color: string }[] }) {
  return (
    <div className="mt-3 flex flex-wrap gap-x-5 gap-y-1">
      {items.map((item) => (
        <div key={item.label} className="flex items-center gap-1.5 text-xs text-on-surface-variant">
          <span className="inline-block h-2.5 w-2.5 rounded-full" style={{ backgroundColor: item.color }} />
          <span>{item.label}</span>
          <span className="font-semibold text-on-surface">{item.count}건</span>
        </div>
      ))}
    </div>
  )
}

/* ────────── main page ────────── */

export default function AgencyDashboardPage() {
  const params = useParams()
  const router = useRouter()
  const agencyId = params.id as string

  const [data, setData] = useState<DashboardData | null>(null)
  const [loading, setLoading] = useState(true)

  const load = useCallback(async () => {
    setLoading(true)
    try {
      const response = await fetch(`/api/admin/agencies/${agencyId}/dashboard`)
      const payload = await response.json()
      if (!response.ok) throw new Error(payload.error || '데이터를 불러오지 못했습니다.')
      setData(payload)
    } catch (err) {
      alert(err instanceof Error ? err.message : '데이터를 불러오지 못했습니다.')
    } finally {
      setLoading(false)
    }
  }, [agencyId])

  useEffect(() => {
    void load()
  }, [load])

  if (loading) {
    return (
      <div className="flex h-[60vh] items-center justify-center">
        <div className="text-center">
          <span
            className="material-symbols-outlined animate-spin text-[32px] text-primary"
            style={{ fontVariationSettings: "'FILL' 0, 'wght' 300, 'GRAD' 0, 'opsz' 32" }}
          >
            progress_activity
          </span>
          <p className="mt-3 text-sm text-on-surface-variant">고객사 현황을 불러오는 중...</p>
        </div>
      </div>
    )
  }

  if (!data) return null

  const { agency, driverStats, contractStats, settlementStats, paymentStats, pointStats, usageStats } = data

  return (
    <div className="space-y-8">
      {/* ── Header ── */}
      <div className="flex items-start justify-between">
        <div className="flex items-center gap-4">
          <button
            type="button"
            onClick={() => router.push('/admin/agencies')}
            className="flex h-10 w-10 items-center justify-center rounded-xl bg-surface-container-low text-on-surface-variant hover:bg-surface-container-high"
          >
            <span
              className="material-symbols-outlined text-[20px]"
              style={{ fontVariationSettings: "'FILL' 0, 'wght' 300, 'GRAD' 0, 'opsz' 20" }}
            >
              arrow_back
            </span>
          </button>
          <div>
            <div className="flex items-center gap-3">
              <h2 className="font-headline text-[26px] font-bold tracking-tight text-on-surface">
                {agency.name}
              </h2>
              <Badge label={agency.plan.toUpperCase()} variant={PLAN_BADGE_VARIANT[agency.plan] ?? 'default'} />
              <Badge
                label={agency.status === 'active' ? '정상' : agency.status === 'suspended' ? '정지' : '해지'}
                variant={agency.status === 'active' ? 'success' : 'error'}
              />
            </div>
            <p className="mt-1 text-sm text-on-surface-variant">
              대표자 {agency.owner_name || '-'}
              {agency.phone ? ` · ${agency.phone}` : ''}
              {agency.business_number ? ` · 사업자 ${agency.business_number}` : ''}
              {` · 가입일 ${formatDate(agency.created_at)}`}
            </p>
          </div>
        </div>
      </div>

      {/* ── KPI Summary ── */}
      <div className="grid grid-cols-1 gap-5 md:grid-cols-2 xl:grid-cols-4">
        <KpiCard
          label="소속 기사"
          value={`${driverStats.total}명`}
          change={`앱 활성 ${driverStats.appActive}명`}
          changeType="up"
          accentColor="#2563eb"
          icon="groups"
        />
        <KpiCard
          label="계약서 서명률"
          value={`${contractStats.signRate}%`}
          change={`전체 ${contractStats.total}건 중 서명 ${contractStats.counts.signed}건`}
          changeType={contractStats.signRate >= 50 ? 'up' : 'down'}
          accentColor="#007d55"
          icon="description"
        />
        <KpiCard
          label="정산서"
          value={`${settlementStats.total}건`}
          change={settlementStats.jobFailed > 0 ? `실패 ${settlementStats.jobFailed}건` : `확인 완료 ${settlementStats.counts.confirmed}건`}
          changeType={settlementStats.jobFailed > 0 ? 'down' : 'up'}
          accentColor="#6750a4"
          icon="receipt_long"
        />
        <KpiCard
          label="누적 결제"
          value={formatKRW(paymentStats.totalPaidAmount)}
          change={paymentStats.counts.failed > 0 ? `실패 ${paymentStats.counts.failed}건` : `완료 ${paymentStats.counts.paid}건`}
          changeType={paymentStats.counts.failed > 0 ? 'down' : 'up'}
          accentColor="#565e74"
          icon="payments"
        />
      </div>

      {/* ── Plan Usage + Point Balance ── */}
      <div className="grid grid-cols-1 gap-5 xl:grid-cols-2">
        {/* Plan Usage */}
        <div className="rounded-2xl bg-surface-container-lowest p-6 shadow-ambient">
          <div className="mb-1 flex items-center gap-2">
            <span
              className="material-symbols-outlined text-[20px] text-primary"
              style={{ fontVariationSettings: "'FILL' 0, 'wght' 300, 'GRAD' 0, 'opsz' 20" }}
            >
              license
            </span>
            <h3 className="font-headline text-[16px] font-bold text-on-surface">플랜 사용 현황</h3>
          </div>
          <p className="mb-4 text-[13px] text-on-surface-variant">
            {agency.plan.toUpperCase()} 플랜 · {usageStats.planType === 'point' ? '포인트 충전형' : '구독형'}
            {usageStats.maxDrivers > 0 ? ` · 최대 ${usageStats.maxDrivers}명` : ''}
          </p>

          {/* Usage bar */}
          <div className="rounded-xl border border-outline-variant/15 p-4">
            <div className="flex items-end justify-between mb-3">
              <div>
                <p className="text-sm text-on-surface-variant">앱 활성 기사</p>
                <p className="text-2xl font-bold text-on-surface">
                  {usageStats.currentAppActive}
                  <span className="text-sm font-normal text-on-surface-variant">
                    {usageStats.maxDrivers > 0 ? ` / ${usageStats.maxDrivers}명` : '명'}
                  </span>
                </p>
              </div>
              {usageStats.overCount > 0 && (
                <Badge label={`초과 ${usageStats.overCount}명`} variant="error" />
              )}
            </div>

            {usageStats.maxDrivers > 0 && (
              <div className="flex h-4 w-full overflow-hidden rounded-full bg-surface-container-low">
                <div
                  className={`h-full transition-all duration-500 ${
                    usageStats.overCount > 0 ? 'bg-error' : 'bg-primary'
                  }`}
                  style={{
                    width: `${Math.min(100, (usageStats.currentAppActive / usageStats.maxDrivers) * 100)}%`,
                  }}
                />
              </div>
            )}

            {usageStats.overCount > 0 && (
              <p className="mt-2 text-xs text-error">
                플랜 한도 초과 {usageStats.overCount}명 → 포인트 차감으로 사용 중
              </p>
            )}

            <div className="mt-3 grid grid-cols-3 gap-3 text-center">
              <div className="rounded-lg bg-surface-container-low p-2">
                <p className="text-xs text-on-surface-variant">플랜 포함</p>
                <p className="text-sm font-semibold text-on-surface">
                  {Math.min(usageStats.currentAppActive, usageStats.maxDrivers)}명
                </p>
              </div>
              <div className="rounded-lg bg-surface-container-low p-2">
                <p className="text-xs text-on-surface-variant">포인트 사용</p>
                <p className="text-sm font-semibold text-error">
                  {usageStats.overCount}명
                </p>
              </div>
              <div className="rounded-lg bg-surface-container-low p-2">
                <p className="text-xs text-on-surface-variant">월 요금</p>
                <p className="text-sm font-semibold text-on-surface">
                  {formatKRW(agency.monthly_fee)}
                </p>
              </div>
            </div>
          </div>
        </div>

        {/* Point Balance */}
        <div className="rounded-2xl bg-surface-container-lowest p-6 shadow-ambient">
          <div className="mb-1 flex items-center gap-2">
            <span
              className="material-symbols-outlined text-[20px] text-primary"
              style={{ fontVariationSettings: "'FILL' 0, 'wght' 300, 'GRAD' 0, 'opsz' 20" }}
            >
              account_balance_wallet
            </span>
            <h3 className="font-headline text-[16px] font-bold text-on-surface">포인트 현황</h3>
          </div>
          <p className="mb-4 text-[13px] text-on-surface-variant">
            잔여 포인트 및 충전·사용 내역
            {pointStats.lastUpdated && ` · 최종 갱신 ${formatDateTime(pointStats.lastUpdated)}`}
          </p>

          <div className="grid grid-cols-3 gap-3 mb-4">
            <div className="rounded-xl border border-outline-variant/15 p-3 text-center">
              <p className="text-xs text-on-surface-variant">잔여 포인트</p>
              <p className="mt-1 text-xl font-bold text-primary">
                {pointStats.balance.toLocaleString('ko-KR')}
              </p>
            </div>
            <div className="rounded-xl border border-outline-variant/15 p-3 text-center">
              <p className="text-xs text-on-surface-variant">누적 충전</p>
              <p className="mt-1 text-xl font-bold text-tertiary">
                {pointStats.totalCharged.toLocaleString('ko-KR')}
              </p>
            </div>
            <div className="rounded-xl border border-outline-variant/15 p-3 text-center">
              <p className="text-xs text-on-surface-variant">누적 사용</p>
              <p className="mt-1 text-xl font-bold text-on-surface">
                {pointStats.totalUsed.toLocaleString('ko-KR')}
              </p>
            </div>
          </div>

          {/* Recent transactions */}
          <div className="max-h-[200px] overflow-y-auto">
            <table className="w-full text-sm">
              <thead className="sticky top-0 bg-surface-container-lowest">
                <tr className="text-left text-xs text-on-surface-variant">
                  <th className="pb-2 pr-3">유형</th>
                  <th className="pb-2 pr-3">금액</th>
                  <th className="pb-2 pr-3">잔액</th>
                  <th className="pb-2">일시</th>
                </tr>
              </thead>
              <tbody>
                {pointStats.recentTransactions.length === 0 ? (
                  <tr>
                    <td colSpan={4} className="py-6 text-center text-on-surface-variant">
                      포인트 거래 내역이 없습니다.
                    </td>
                  </tr>
                ) : (
                  pointStats.recentTransactions.map((tx) => (
                    <tr key={tx.id} className="border-t border-outline-variant/10">
                      <td className="py-2 pr-3">
                        <Badge
                          label={POINT_TX_LABEL[tx.type] ?? tx.type}
                          variant={POINT_TX_VARIANT[tx.type] ?? 'default'}
                        />
                      </td>
                      <td className={`py-2 pr-3 font-semibold ${
                        tx.type === 'charge' || tx.type === 'bonus' || tx.type === 'refund'
                          ? 'text-tertiary'
                          : 'text-error'
                      }`}>
                        {tx.type === 'charge' || tx.type === 'bonus' || tx.type === 'refund' ? '+' : '-'}
                        {Math.abs(tx.amount).toLocaleString('ko-KR')}
                      </td>
                      <td className="py-2 pr-3 text-on-surface-variant">
                        {tx.balance_after.toLocaleString('ko-KR')}
                      </td>
                      <td className="py-2 text-on-surface-variant">{formatDateTime(tx.created_at)}</td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      </div>

      {/* ── Contract Flow + Settlement Flow ── */}
      <div className="grid grid-cols-1 gap-5 xl:grid-cols-2">
        {/* Contract Flow */}
        <div className="rounded-2xl bg-surface-container-lowest p-6 shadow-ambient">
          <div className="mb-1 flex items-center gap-2">
            <span
              className="material-symbols-outlined text-[20px] text-primary"
              style={{ fontVariationSettings: "'FILL' 0, 'wght' 300, 'GRAD' 0, 'opsz' 20" }}
            >
              description
            </span>
            <h3 className="font-headline text-[16px] font-bold text-on-surface">계약서 흐름</h3>
          </div>
          <p className="mb-4 text-[13px] text-on-surface-variant">작성 → 전송 → 열람 → 서명 단계별 현황</p>

          <FlowBar
            items={[
              { label: '서명 완료', count: contractStats.counts.signed, color: '#007d55' },
              { label: '열람됨', count: contractStats.counts.viewed, color: '#f59e0b' },
              { label: '전송됨', count: contractStats.counts.sent, color: '#2563eb' },
              { label: '작성 중', count: contractStats.counts.draft, color: '#94a3b8' },
              { label: '만료', count: contractStats.counts.expired, color: '#ef4444' },
            ]}
          />
          <FlowLegend
            items={[
              { label: '서명 완료', count: contractStats.counts.signed, color: '#007d55' },
              { label: '열람됨', count: contractStats.counts.viewed, color: '#f59e0b' },
              { label: '전송됨', count: contractStats.counts.sent, color: '#2563eb' },
              { label: '작성 중', count: contractStats.counts.draft, color: '#94a3b8' },
              { label: '만료', count: contractStats.counts.expired, color: '#ef4444' },
            ]}
          />

          {/* Recent contracts table */}
          <div className="mt-5 max-h-[280px] overflow-y-auto">
            <table className="w-full text-sm">
              <thead className="sticky top-0 bg-surface-container-lowest">
                <tr className="text-left text-xs text-on-surface-variant">
                  <th className="pb-2 pr-3">제목</th>
                  <th className="pb-2 pr-3">상태</th>
                  <th className="pb-2 pr-3">전송일</th>
                  <th className="pb-2">서명일</th>
                </tr>
              </thead>
              <tbody>
                {contractStats.recent.length === 0 ? (
                  <tr>
                    <td colSpan={4} className="py-6 text-center text-on-surface-variant">
                      계약서가 없습니다.
                    </td>
                  </tr>
                ) : (
                  contractStats.recent.map((c) => (
                    <tr key={c.id} className="border-t border-outline-variant/10">
                      <td className="py-2.5 pr-3 text-on-surface">{c.title}</td>
                      <td className="py-2.5 pr-3">
                        <Badge
                          label={CONTRACT_STATUS_LABEL[c.status] ?? c.status}
                          variant={CONTRACT_STATUS_VARIANT[c.status] ?? 'default'}
                        />
                      </td>
                      <td className="py-2.5 pr-3 text-on-surface-variant">
                        {c.sent_at ? formatDateTime(c.sent_at) : '-'}
                      </td>
                      <td className="py-2.5 text-on-surface-variant">
                        {c.signed_at ? formatDateTime(c.signed_at) : '-'}
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>

        {/* Settlement Flow */}
        <div className="rounded-2xl bg-surface-container-lowest p-6 shadow-ambient">
          <div className="mb-1 flex items-center gap-2">
            <span
              className="material-symbols-outlined text-[20px] text-primary"
              style={{ fontVariationSettings: "'FILL' 0, 'wght' 300, 'GRAD' 0, 'opsz' 20" }}
            >
              receipt_long
            </span>
            <h3 className="font-headline text-[16px] font-bold text-on-surface">정산서 흐름</h3>
          </div>
          <p className="mb-4 text-[13px] text-on-surface-variant">작성 → 발송 → 확인 단계별 현황 및 일괄 처리 결과</p>

          <FlowBar
            items={[
              { label: '확인 완료', count: settlementStats.counts.confirmed, color: '#007d55' },
              { label: '발송됨', count: settlementStats.counts.sent, color: '#2563eb' },
              { label: '작성 중', count: settlementStats.counts.draft, color: '#94a3b8' },
            ]}
          />
          <FlowLegend
            items={[
              { label: '확인 완료', count: settlementStats.counts.confirmed, color: '#007d55' },
              { label: '발송됨', count: settlementStats.counts.sent, color: '#2563eb' },
              { label: '작성 중', count: settlementStats.counts.draft, color: '#94a3b8' },
            ]}
          />

          {/* Job processing summary */}
          {settlementStats.jobTotal > 0 && (
            <div className="mt-4 rounded-xl border border-outline-variant/15 p-3">
              <p className="text-xs font-medium text-on-surface-variant">일괄 정산 처리</p>
              <div className="mt-2 flex gap-4 text-sm">
                <span className="text-on-surface">
                  전체 <span className="font-semibold">{settlementStats.jobTotal}</span>건
                </span>
                <span className="text-tertiary">
                  성공 <span className="font-semibold">{settlementStats.jobCompleted}</span>건
                </span>
                {settlementStats.jobFailed > 0 && (
                  <span className="text-error">
                    실패 <span className="font-semibold">{settlementStats.jobFailed}</span>건
                  </span>
                )}
              </div>
            </div>
          )}

          {/* Recent settlements table */}
          <div className="mt-5 max-h-[220px] overflow-y-auto">
            <table className="w-full text-sm">
              <thead className="sticky top-0 bg-surface-container-lowest">
                <tr className="text-left text-xs text-on-surface-variant">
                  <th className="pb-2 pr-3">정산 월</th>
                  <th className="pb-2 pr-3">상태</th>
                  <th className="pb-2 pr-3">정산 금액</th>
                  <th className="pb-2">발송일</th>
                </tr>
              </thead>
              <tbody>
                {settlementStats.recent.length === 0 ? (
                  <tr>
                    <td colSpan={4} className="py-6 text-center text-on-surface-variant">
                      정산서가 없습니다.
                    </td>
                  </tr>
                ) : (
                  settlementStats.recent.map((s) => (
                    <tr key={s.id} className="border-t border-outline-variant/10">
                      <td className="py-2.5 pr-3 text-on-surface">{s.year_month}</td>
                      <td className="py-2.5 pr-3">
                        <Badge
                          label={SETTLEMENT_STATUS_LABEL[s.status] ?? s.status}
                          variant={SETTLEMENT_STATUS_VARIANT[s.status] ?? 'default'}
                        />
                      </td>
                      <td className="py-2.5 pr-3 text-on-surface">
                        {s.net_amount != null ? formatKRW(s.net_amount) : '-'}
                      </td>
                      <td className="py-2.5 text-on-surface-variant">
                        {s.sent_at ? formatDateTime(s.sent_at) : '-'}
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      </div>

      {/* ── Payment Flow + Driver List ── */}
      <div className="grid grid-cols-1 gap-5 xl:grid-cols-2">
        {/* Payment Orders */}
        <div className="rounded-2xl bg-surface-container-lowest p-6 shadow-ambient">
          <div className="mb-1 flex items-center gap-2">
            <span
              className="material-symbols-outlined text-[20px] text-primary"
              style={{ fontVariationSettings: "'FILL' 0, 'wght' 300, 'GRAD' 0, 'opsz' 20" }}
            >
              payments
            </span>
            <h3 className="font-headline text-[16px] font-bold text-on-surface">결제 현황</h3>
          </div>
          <p className="mb-4 text-[13px] text-on-surface-variant">결제 성공·실패·대기 현황</p>

          <FlowBar
            items={[
              { label: '결제 완료', count: paymentStats.counts.paid, color: '#007d55' },
              { label: '입금 대기', count: paymentStats.counts.pending, color: '#f59e0b' },
              { label: '결제 실패', count: paymentStats.counts.failed, color: '#ef4444' },
              { label: '취소', count: paymentStats.counts.cancelled, color: '#94a3b8' },
            ]}
          />
          <FlowLegend
            items={[
              { label: '결제 완료', count: paymentStats.counts.paid, color: '#007d55' },
              { label: '입금 대기', count: paymentStats.counts.pending, color: '#f59e0b' },
              { label: '결제 실패', count: paymentStats.counts.failed, color: '#ef4444' },
              { label: '취소', count: paymentStats.counts.cancelled, color: '#94a3b8' },
            ]}
          />

          <div className="mt-5 max-h-[260px] overflow-y-auto">
            <table className="w-full text-sm">
              <thead className="sticky top-0 bg-surface-container-lowest">
                <tr className="text-left text-xs text-on-surface-variant">
                  <th className="pb-2 pr-3">항목</th>
                  <th className="pb-2 pr-3">상태</th>
                  <th className="pb-2 pr-3">금액</th>
                  <th className="pb-2">결제일</th>
                </tr>
              </thead>
              <tbody>
                {paymentStats.recent.length === 0 ? (
                  <tr>
                    <td colSpan={4} className="py-6 text-center text-on-surface-variant">
                      결제 내역이 없습니다.
                    </td>
                  </tr>
                ) : (
                  paymentStats.recent.map((p) => (
                    <tr key={p.id} className="border-t border-outline-variant/10">
                      <td className="py-2.5 pr-3 text-on-surface">{p.title}</td>
                      <td className="py-2.5 pr-3">
                        <Badge
                          label={PAYMENT_STATUS_LABEL[p.status] ?? p.status}
                          variant={PAYMENT_STATUS_VARIANT[p.status] ?? 'default'}
                        />
                      </td>
                      <td className="py-2.5 pr-3 text-on-surface">
                        {p.amount != null ? formatKRW(p.amount) : '-'}
                      </td>
                      <td className="py-2.5 text-on-surface-variant">
                        {p.paid_at ? formatDateTime(p.paid_at) : '-'}
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>

      </div>

      {/* ── 소속 기사 전체 목록 ── */}
      <div className="rounded-2xl bg-surface-container-lowest p-6 shadow-ambient">
        <div className="mb-1 flex items-center gap-2">
          <span
            className="material-symbols-outlined text-[20px] text-primary"
            style={{ fontVariationSettings: "'FILL' 0, 'wght' 300, 'GRAD' 0, 'opsz' 20" }}
          >
            groups
          </span>
          <h3 className="font-headline text-[16px] font-bold text-on-surface">소속 기사 전체 목록</h3>
        </div>
        <p className="mb-4 text-[13px] text-on-surface-variant">
          전체 {driverStats.total}명 · 앱 활성 {driverStats.appActive}명
          {driverStats.total > 0 && (
            <span className="ml-1 font-semibold text-primary">
              ({Math.round((driverStats.appActive / driverStats.total) * 100)}%)
            </span>
          )}
        </p>

        {/* Active ratio bar */}
        <div className="flex h-3 w-full overflow-hidden rounded-full bg-surface-container-low mb-5">
          {driverStats.total > 0 && (
            <>
              <div
                className="h-full bg-primary transition-all duration-500"
                style={{ width: `${(driverStats.appActive / driverStats.total) * 100}%` }}
              />
              <div
                className="h-full bg-outline-variant/30 transition-all duration-500"
                style={{ width: `${((driverStats.total - driverStats.appActive) / driverStats.total) * 100}%` }}
              />
            </>
          )}
        </div>

        <div className="overflow-x-auto">
          <table className="min-w-full text-sm">
            <thead className="bg-surface-container-low text-left text-on-surface-variant">
              <tr>
                <th className="px-4 py-3 text-xs font-semibold">기사명</th>
                <th className="px-4 py-3 text-xs font-semibold">연락처</th>
                <th className="px-4 py-3 text-xs font-semibold">앱 상태</th>
                <th className="px-4 py-3 text-xs font-semibold">등록일</th>
              </tr>
            </thead>
            <tbody>
              {driverStats.drivers.length === 0 ? (
                <tr>
                  <td colSpan={4} className="px-4 py-8 text-center text-on-surface-variant">
                    소속 기사가 없습니다.
                  </td>
                </tr>
              ) : (
                driverStats.drivers.map((d) => (
                  <tr key={d.id} className="border-t border-outline-variant/10">
                    <td className="px-4 py-3 font-medium text-on-surface">{d.name}</td>
                    <td className="px-4 py-3 text-on-surface-variant">{d.phone || '-'}</td>
                    <td className="px-4 py-3">
                      <Badge
                        label={d.push_token ? '활성' : '미활성'}
                        variant={d.push_token ? 'success' : 'default'}
                      />
                    </td>
                    <td className="px-4 py-3 text-on-surface-variant">{formatDate(d.created_at)}</td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  )
}
