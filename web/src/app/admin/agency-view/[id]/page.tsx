'use client'

import { useCallback, useEffect, useState } from 'react'
import { useParams } from 'next/navigation'
import Badge from '@/components/shared/Badge'
import KpiCard from '@/components/admin/KpiCard'
import { isPointBased } from '@/lib/plan-limits'

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
  reference_type: string | null
  reference_id: string | null
  created_at: string
}

interface DashboardData {
  agency: AgencyInfo
  driverStats: { total: number; appActive: number; drivers: DriverRow[] }
  contractStats: {
    total: number
    counts: { draft: number; sent: number; viewed: number; signed: number; expired: number }
    signRate: number
    recent: ContractRow[]
  }
  settlementStats: {
    total: number
    counts: { draft: number; sent: number; confirmed: number }
    jobTotal: number; jobCompleted: number; jobFailed: number
    recent: SettlementRow[]
  }
  paymentStats: {
    total: number
    counts: { paid: number; pending: number; failed: number; cancelled: number }
    totalPaidAmount: number
    recent: PaymentOrderRow[]
  }
  pointStats: {
    balance: number; totalCharged: number; totalUsed: number
    lastUpdated: string | null
    recentTransactions: PointTransactionRow[]
  }
  usageStats: { planType: string; maxDrivers: number; currentAppActive: number; overCount: number }
}

type TabId = 'overview' | 'points' | 'contracts' | 'settlements' | 'payments' | 'drivers'

/* ────────── helpers ────────── */

function formatKRW(v: number) { return `₩${v.toLocaleString('ko-KR')}` }
function formatDate(d: string) { return new Date(d).toLocaleDateString('ko-KR') }
function formatDT(d: string) {
  return new Date(d).toLocaleString('ko-KR', { year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit' })
}
function formatP(v: number) { return `${v.toLocaleString('ko-KR')}P` }

const MI = (icon: string, size = 20) => (
  <span
    className={`material-symbols-outlined text-[${size}px]`}
    style={{ fontVariationSettings: `'FILL' 0, 'wght' 300, 'GRAD' 0, 'opsz' ${size}` }}
  >{icon}</span>
)

const C_LABEL: Record<string, string> = { draft: '작성 중', sent: '전송됨', viewed: '열람됨', signed: '서명 완료', expired: '만료' }
const C_VAR: Record<string, 'success' | 'warning' | 'error' | 'info' | 'default'> = { draft: 'default', sent: 'info', viewed: 'warning', signed: 'success', expired: 'error' }
const S_LABEL: Record<string, string> = { draft: '작성 중', sent: '발송됨', confirmed: '확인 완료' }
const S_VAR: Record<string, 'success' | 'warning' | 'info' | 'default'> = { draft: 'default', sent: 'info', confirmed: 'success' }
const P_LABEL: Record<string, string> = { paid: '결제 완료', pending: '입금 대기', failed: '결제 실패', cancelled: '취소' }
const P_VAR: Record<string, 'success' | 'warning' | 'error' | 'default'> = { paid: 'success', pending: 'warning', failed: 'error', cancelled: 'default' }
const PLAN_VAR: Record<string, 'info' | 'success' | 'default' | 'warning'> = { free: 'default', basic: 'info', standard: 'success', pro: 'warning', enterprise: 'warning' }

const PT_LABEL: Record<string, string> = { charge: '충전', use: '사용', refund: '환불', bonus: '보너스', expire: '만료' }
const PT_VAR: Record<string, 'success' | 'error' | 'warning' | 'info' | 'default'> = { charge: 'success', use: 'info', refund: 'warning', bonus: 'success', expire: 'error' }
const REF_LABEL: Record<string, string> = {
  settlement: '정산서', contract: '전자계약서', document: '외부문서', sms: 'SMS발송',
  driver_app: '기사앱', plan_overage: '플랜 초과', manual: '수동 차감',
}

/* ────────── flow bar ────────── */

function FlowBar({ items }: { items: { label: string; count: number; color: string }[] }) {
  const total = items.reduce((s, i) => s + i.count, 0)
  if (total === 0) return <div className="h-3 w-full rounded-full bg-surface-container-low" />
  return (
    <div className="flex h-3 w-full overflow-hidden rounded-full bg-surface-container-low">
      {items.map((i) => {
        const p = (i.count / total) * 100
        return p > 0 ? <div key={i.label} className="h-full" style={{ width: `${p}%`, backgroundColor: i.color }} title={`${i.label}: ${i.count}건`} /> : null
      })}
    </div>
  )
}

function FlowLegend({ items }: { items: { label: string; count: number; color: string }[] }) {
  return (
    <div className="mt-3 flex flex-wrap gap-x-5 gap-y-1">
      {items.map((i) => (
        <div key={i.label} className="flex items-center gap-1.5 text-xs text-on-surface-variant">
          <span className="inline-block h-2.5 w-2.5 rounded-full" style={{ backgroundColor: i.color }} />
          <span>{i.label}</span>
          <span className="font-semibold text-on-surface">{i.count}건</span>
        </div>
      ))}
    </div>
  )
}

/* ────────── main page ────────── */

export default function AgencyViewPage() {
  const params = useParams()
  const agencyId = params.id as string

  const [data, setData] = useState<DashboardData | null>(null)
  const [loading, setLoading] = useState(true)
  const [activeTab, setActiveTab] = useState<TabId>('overview')

  const load = useCallback(async () => {
    setLoading(true)
    try {
      const res = await fetch(`/api/admin/agencies/${agencyId}/dashboard`)
      const payload = await res.json()
      if (!res.ok) throw new Error(payload.error || '데이터를 불러오지 못했습니다.')
      setData(payload)
    } catch (err) {
      alert(err instanceof Error ? err.message : '데이터를 불러오지 못했습니다.')
    } finally {
      setLoading(false)
    }
  }, [agencyId])

  useEffect(() => { void load() }, [load])

  if (loading) {
    return (
      <div className="flex h-screen items-center justify-center">
        <div className="text-center">
          <span className="material-symbols-outlined animate-spin text-[32px] text-primary" style={{ fontVariationSettings: "'FILL' 0, 'wght' 300, 'GRAD' 0, 'opsz' 32" }}>progress_activity</span>
          <p className="mt-3 text-sm text-on-surface-variant">고객사 현황을 불러오는 중...</p>
        </div>
      </div>
    )
  }

  if (!data) return null
  const { agency, driverStats, contractStats, settlementStats, paymentStats, pointStats, usageStats } = data

  const TABS: { id: TabId; label: string; icon: string; badge?: string }[] = [
    { id: 'overview', label: '현황 요약', icon: 'dashboard' },
    { id: 'points', label: '포인트', icon: 'account_balance_wallet', badge: formatP(pointStats.balance) },
    { id: 'contracts', label: '계약서', icon: 'description', badge: `${contractStats.total}건` },
    { id: 'settlements', label: '정산서', icon: 'receipt_long', badge: `${settlementStats.total}건` },
    { id: 'payments', label: '결제', icon: 'payments', badge: `${paymentStats.total}건` },
    { id: 'drivers', label: '기사 목록', icon: 'groups', badge: `${driverStats.total}명` },
  ]

  return (
    <div className="min-h-screen">
      {/* ── Sticky Header ── */}
      <header className="sticky top-0 z-50 border-b border-outline-variant/10 bg-surface">
        <div className="flex items-center justify-between px-8 py-4">
          <div>
            <div className="flex items-center gap-3">
              <h1 className="font-headline text-[22px] font-bold tracking-tight text-on-surface">{agency.name}</h1>
              <Badge label={agency.plan.toUpperCase()} variant={PLAN_VAR[agency.plan] ?? 'default'} />
              <Badge label={agency.status === 'active' ? '정상' : agency.status === 'suspended' ? '정지' : '해지'} variant={agency.status === 'active' ? 'success' : 'error'} />
              {isPointBased(agency.plan) && <Badge label="포인트 충전형" variant="info" />}
            </div>
            <p className="mt-0.5 text-[13px] text-on-surface-variant">
              대표자 {agency.owner_name || '-'}{agency.phone ? ` · ${agency.phone}` : ''}{agency.business_number ? ` · 사업자 ${agency.business_number}` : ''} · 가입일 {formatDate(agency.created_at)}
            </p>
          </div>
          <button type="button" onClick={() => window.close()} className="flex h-10 w-10 items-center justify-center rounded-xl bg-surface-container-low text-on-surface-variant hover:bg-error/10 hover:text-error transition-colors" title="창 닫기">
            {MI('close', 22)}
          </button>
        </div>

        {/* ── Tabs ── */}
        <div className="flex gap-1 px-8 pb-0 overflow-x-auto">
          {TABS.map((tab) => (
            <button
              key={tab.id}
              type="button"
              onClick={() => setActiveTab(tab.id)}
              className={`flex items-center gap-2 px-4 py-2.5 text-sm font-medium rounded-t-xl border-b-2 transition-colors whitespace-nowrap ${
                activeTab === tab.id
                  ? 'border-primary text-primary bg-primary/5'
                  : 'border-transparent text-on-surface-variant hover:text-on-surface hover:bg-surface-container-low'
              }`}
            >
              <span className="material-symbols-outlined text-[18px]" style={{ fontVariationSettings: `'FILL' ${activeTab === tab.id ? 1 : 0}, 'wght' 300, 'GRAD' 0, 'opsz' 18` }}>{tab.icon}</span>
              {tab.label}
              {tab.badge && (
                <span className={`text-[11px] px-1.5 py-0.5 rounded-md ${activeTab === tab.id ? 'bg-primary/10 text-primary' : 'bg-surface-container-low text-on-surface-variant'}`}>
                  {tab.badge}
                </span>
              )}
            </button>
          ))}
        </div>
      </header>

      {/* ── Content ── */}
      <div className="mx-auto max-w-[1600px] p-8">

        {/* ===== 현황 요약 탭 ===== */}
        {activeTab === 'overview' && (
          <div className="space-y-6">
            <div className="grid grid-cols-1 gap-5 md:grid-cols-2 xl:grid-cols-4">
              <div className="cursor-pointer" onClick={() => setActiveTab('drivers')}>
                <KpiCard label="소속 기사" value={`${driverStats.total}명`} change={`앱 활성 ${driverStats.appActive}명`} changeType="up" accentColor="#2563eb" icon="groups" />
              </div>
              <div className="cursor-pointer" onClick={() => setActiveTab('contracts')}>
                <KpiCard label="계약서 서명률" value={`${contractStats.signRate}%`} change={`전체 ${contractStats.total}건 중 서명 ${contractStats.counts.signed}건`} changeType={contractStats.signRate >= 50 ? 'up' : 'down'} accentColor="#007d55" icon="description" />
              </div>
              <div className="cursor-pointer" onClick={() => setActiveTab('settlements')}>
                <KpiCard label="정산서" value={`${settlementStats.total}건`} change={settlementStats.jobFailed > 0 ? `실패 ${settlementStats.jobFailed}건` : `확인 완료 ${settlementStats.counts.confirmed}건`} changeType={settlementStats.jobFailed > 0 ? 'down' : 'up'} accentColor="#6750a4" icon="receipt_long" />
              </div>
              <div className="cursor-pointer" onClick={() => setActiveTab('points')}>
                <KpiCard label="잔여 포인트" value={formatP(pointStats.balance)} change={`누적 충전 ${formatP(pointStats.totalCharged)}`} changeType="up" accentColor="#0891b2" icon="account_balance_wallet" />
              </div>
            </div>

            {/* Plan usage summary */}
            <div className="rounded-2xl bg-surface-container-lowest p-6 shadow-ambient">
              <h3 className="font-headline text-[16px] font-bold text-on-surface mb-4">플랜 사용 현황</h3>
              <div className="grid grid-cols-2 xl:grid-cols-5 gap-4">
                <div className="rounded-xl border border-outline-variant/15 p-4 text-center">
                  <p className="text-xs text-on-surface-variant">플랜</p>
                  <p className="mt-1 text-lg font-bold text-on-surface">{agency.plan.toUpperCase()}</p>
                  <p className="text-xs text-on-surface-variant">{isPointBased(agency.plan) ? '포인트 충전형' : '구독형'}</p>
                </div>
                <div className="rounded-xl border border-outline-variant/15 p-4 text-center">
                  <p className="text-xs text-on-surface-variant">플랜 기사수</p>
                  <p className="mt-1 text-lg font-bold text-on-surface">{usageStats.maxDrivers}명</p>
                </div>
                <div className="rounded-xl border border-outline-variant/15 p-4 text-center">
                  <p className="text-xs text-on-surface-variant">앱 활성</p>
                  <p className={`mt-1 text-lg font-bold ${usageStats.overCount > 0 ? 'text-error' : 'text-primary'}`}>{usageStats.currentAppActive}명</p>
                  {usageStats.overCount > 0 && <p className="text-xs text-error">+{usageStats.overCount} 초과</p>}
                </div>
                <div className="rounded-xl border border-outline-variant/15 p-4 text-center">
                  <p className="text-xs text-on-surface-variant">월 요금</p>
                  <p className="mt-1 text-lg font-bold text-on-surface">{formatKRW(agency.monthly_fee)}</p>
                </div>
                <div className="rounded-xl border border-outline-variant/15 p-4 text-center cursor-pointer hover:border-primary/30" onClick={() => setActiveTab('payments')}>
                  <p className="text-xs text-on-surface-variant">누적 결제</p>
                  <p className="mt-1 text-lg font-bold text-tertiary">{formatKRW(paymentStats.totalPaidAmount)}</p>
                  {paymentStats.counts.failed > 0 && <p className="text-xs text-error">실패 {paymentStats.counts.failed}건</p>}
                </div>
              </div>
            </div>

            {/* Quick flow summaries (2 col) */}
            <div className="grid grid-cols-1 xl:grid-cols-2 gap-5">
              <div className="rounded-2xl bg-surface-container-lowest p-6 shadow-ambient cursor-pointer hover:shadow-lg transition-shadow" onClick={() => setActiveTab('contracts')}>
                <h3 className="font-headline text-[16px] font-bold text-on-surface mb-3">계약서 흐름</h3>
                <FlowBar items={[
                  { label: '서명 완료', count: contractStats.counts.signed, color: '#007d55' },
                  { label: '열람됨', count: contractStats.counts.viewed, color: '#f59e0b' },
                  { label: '전송됨', count: contractStats.counts.sent, color: '#2563eb' },
                  { label: '작성 중', count: contractStats.counts.draft, color: '#94a3b8' },
                  { label: '만료', count: contractStats.counts.expired, color: '#ef4444' },
                ]} />
                <FlowLegend items={[
                  { label: '서명 완료', count: contractStats.counts.signed, color: '#007d55' },
                  { label: '열람됨', count: contractStats.counts.viewed, color: '#f59e0b' },
                  { label: '전송됨', count: contractStats.counts.sent, color: '#2563eb' },
                  { label: '작성 중', count: contractStats.counts.draft, color: '#94a3b8' },
                  { label: '만료', count: contractStats.counts.expired, color: '#ef4444' },
                ]} />
              </div>
              <div className="rounded-2xl bg-surface-container-lowest p-6 shadow-ambient cursor-pointer hover:shadow-lg transition-shadow" onClick={() => setActiveTab('settlements')}>
                <h3 className="font-headline text-[16px] font-bold text-on-surface mb-3">정산서 흐름</h3>
                <FlowBar items={[
                  { label: '확인 완료', count: settlementStats.counts.confirmed, color: '#007d55' },
                  { label: '발송됨', count: settlementStats.counts.sent, color: '#2563eb' },
                  { label: '작성 중', count: settlementStats.counts.draft, color: '#94a3b8' },
                ]} />
                <FlowLegend items={[
                  { label: '확인 완료', count: settlementStats.counts.confirmed, color: '#007d55' },
                  { label: '발송됨', count: settlementStats.counts.sent, color: '#2563eb' },
                  { label: '작성 중', count: settlementStats.counts.draft, color: '#94a3b8' },
                ]} />
              </div>
            </div>
          </div>
        )}

        {/* ===== 포인트 상세 탭 ===== */}
        {activeTab === 'points' && (
          <div className="space-y-6">
            {/* Summary cards */}
            <div className="grid grid-cols-1 md:grid-cols-4 gap-5">
              <div className="rounded-2xl bg-surface-container-lowest p-6 shadow-ambient text-center">
                <p className="text-sm text-on-surface-variant">잔여 포인트</p>
                <p className="mt-2 text-3xl font-bold text-primary">{formatP(pointStats.balance)}</p>
              </div>
              <div className="rounded-2xl bg-surface-container-lowest p-6 shadow-ambient text-center">
                <p className="text-sm text-on-surface-variant">누적 충전</p>
                <p className="mt-2 text-3xl font-bold text-tertiary">{formatP(pointStats.totalCharged)}</p>
              </div>
              <div className="rounded-2xl bg-surface-container-lowest p-6 shadow-ambient text-center">
                <p className="text-sm text-on-surface-variant">누적 사용</p>
                <p className="mt-2 text-3xl font-bold text-on-surface">{formatP(pointStats.totalUsed)}</p>
              </div>
              <div className="rounded-2xl bg-surface-container-lowest p-6 shadow-ambient text-center">
                <p className="text-sm text-on-surface-variant">초과 기사 (포인트 차감)</p>
                <p className={`mt-2 text-3xl font-bold ${usageStats.overCount > 0 ? 'text-error' : 'text-on-surface'}`}>{usageStats.overCount}명</p>
              </div>
            </div>

            {/* Transaction timeline */}
            <div className="rounded-2xl bg-surface-container-lowest p-6 shadow-ambient">
              <h3 className="font-headline text-[16px] font-bold text-on-surface mb-1">포인트 거래 내역</h3>
              <p className="text-[13px] text-on-surface-variant mb-5">
                충전·사용·환불 등 전체 내역 (최근 50건)
                {pointStats.lastUpdated && ` · 최종 갱신 ${formatDT(pointStats.lastUpdated)}`}
              </p>

              {pointStats.recentTransactions.length === 0 ? (
                <div className="py-12 text-center text-on-surface-variant">포인트 거래 내역이 없습니다.</div>
              ) : (
                <div className="space-y-2">
                  {pointStats.recentTransactions.map((tx) => {
                    const isPlus = tx.type === 'charge' || tx.type === 'bonus' || tx.type === 'refund'
                    return (
                      <div key={tx.id} className="flex items-center gap-4 rounded-xl border border-outline-variant/10 px-5 py-3 hover:bg-surface-container-low/50 transition-colors">
                        {/* Icon */}
                        <div className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-lg ${isPlus ? 'bg-tertiary/10' : 'bg-error/10'}`}>
                          <span className={`material-symbols-outlined text-[18px] ${isPlus ? 'text-tertiary' : 'text-error'}`} style={{ fontVariationSettings: "'FILL' 1, 'wght' 400, 'GRAD' 0, 'opsz' 18" }}>
                            {isPlus ? 'add_circle' : 'remove_circle'}
                          </span>
                        </div>

                        {/* Info */}
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2">
                            <Badge label={PT_LABEL[tx.type] ?? tx.type} variant={PT_VAR[tx.type] ?? 'default'} />
                            {tx.reference_type && (
                              <span className="text-xs text-on-surface-variant px-1.5 py-0.5 rounded bg-surface-container-low">
                                {REF_LABEL[tx.reference_type] ?? tx.reference_type}
                              </span>
                            )}
                          </div>
                          {tx.description && (
                            <p className="mt-0.5 text-xs text-on-surface-variant truncate">{tx.description}</p>
                          )}
                        </div>

                        {/* Amount */}
                        <div className="text-right shrink-0">
                          <p className={`text-base font-bold ${isPlus ? 'text-tertiary' : 'text-error'}`}>
                            {isPlus ? '+' : '-'}{formatP(Math.abs(tx.amount))}
                          </p>
                          <p className="text-xs text-on-surface-variant">잔액 {formatP(tx.balance_after)}</p>
                        </div>

                        {/* Date */}
                        <div className="text-right shrink-0 w-[130px]">
                          <p className="text-sm text-on-surface">{formatDT(tx.created_at)}</p>
                        </div>
                      </div>
                    )
                  })}
                </div>
              )}
            </div>
          </div>
        )}

        {/* ===== 계약서 상세 탭 ===== */}
        {activeTab === 'contracts' && (
          <div className="space-y-6">
            <div className="rounded-2xl bg-surface-container-lowest p-6 shadow-ambient">
              <div className="flex items-center justify-between mb-4">
                <div>
                  <h3 className="font-headline text-[16px] font-bold text-on-surface">계약서 현황</h3>
                  <p className="text-[13px] text-on-surface-variant">전체 {contractStats.total}건 · 서명률 {contractStats.signRate}%</p>
                </div>
              </div>
              <FlowBar items={[
                { label: '서명 완료', count: contractStats.counts.signed, color: '#007d55' },
                { label: '열람됨', count: contractStats.counts.viewed, color: '#f59e0b' },
                { label: '전송됨', count: contractStats.counts.sent, color: '#2563eb' },
                { label: '작성 중', count: contractStats.counts.draft, color: '#94a3b8' },
                { label: '만료', count: contractStats.counts.expired, color: '#ef4444' },
              ]} />
              <FlowLegend items={[
                { label: '서명 완료', count: contractStats.counts.signed, color: '#007d55' },
                { label: '열람됨', count: contractStats.counts.viewed, color: '#f59e0b' },
                { label: '전송됨', count: contractStats.counts.sent, color: '#2563eb' },
                { label: '작성 중', count: contractStats.counts.draft, color: '#94a3b8' },
                { label: '만료', count: contractStats.counts.expired, color: '#ef4444' },
              ]} />
            </div>

            <div className="rounded-2xl bg-surface-container-lowest p-6 shadow-ambient">
              <h3 className="font-headline text-[16px] font-bold text-on-surface mb-4">계약서 목록</h3>
              <div className="overflow-x-auto">
                <table className="min-w-full text-sm">
                  <thead className="bg-surface-container-low text-left text-on-surface-variant">
                    <tr>
                      <th className="px-4 py-3 text-xs font-semibold">제목</th>
                      <th className="px-4 py-3 text-xs font-semibold">상태</th>
                      <th className="px-4 py-3 text-xs font-semibold">전송일</th>
                      <th className="px-4 py-3 text-xs font-semibold">서명일</th>
                      <th className="px-4 py-3 text-xs font-semibold">생성일</th>
                    </tr>
                  </thead>
                  <tbody>
                    {contractStats.recent.length === 0 ? (
                      <tr><td colSpan={5} className="px-4 py-8 text-center text-on-surface-variant">계약서가 없습니다.</td></tr>
                    ) : contractStats.recent.map((c) => (
                      <tr key={c.id} className="border-t border-outline-variant/10 hover:bg-surface-container-low/50">
                        <td className="px-4 py-3 font-medium text-on-surface">{c.title}</td>
                        <td className="px-4 py-3"><Badge label={C_LABEL[c.status] ?? c.status} variant={C_VAR[c.status] ?? 'default'} /></td>
                        <td className="px-4 py-3 text-on-surface-variant">{c.sent_at ? formatDT(c.sent_at) : '-'}</td>
                        <td className="px-4 py-3 text-on-surface-variant">{c.signed_at ? formatDT(c.signed_at) : '-'}</td>
                        <td className="px-4 py-3 text-on-surface-variant">{formatDate(c.created_at)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        )}

        {/* ===== 정산서 상세 탭 ===== */}
        {activeTab === 'settlements' && (
          <div className="space-y-6">
            <div className="rounded-2xl bg-surface-container-lowest p-6 shadow-ambient">
              <div className="flex items-center justify-between mb-4">
                <div>
                  <h3 className="font-headline text-[16px] font-bold text-on-surface">정산서 현황</h3>
                  <p className="text-[13px] text-on-surface-variant">전체 {settlementStats.total}건</p>
                </div>
              </div>
              <FlowBar items={[
                { label: '확인 완료', count: settlementStats.counts.confirmed, color: '#007d55' },
                { label: '발송됨', count: settlementStats.counts.sent, color: '#2563eb' },
                { label: '작성 중', count: settlementStats.counts.draft, color: '#94a3b8' },
              ]} />
              <FlowLegend items={[
                { label: '확인 완료', count: settlementStats.counts.confirmed, color: '#007d55' },
                { label: '발송됨', count: settlementStats.counts.sent, color: '#2563eb' },
                { label: '작성 중', count: settlementStats.counts.draft, color: '#94a3b8' },
              ]} />

              {settlementStats.jobTotal > 0 && (
                <div className="mt-4 rounded-xl border border-outline-variant/15 p-3">
                  <p className="text-xs font-medium text-on-surface-variant">일괄 정산 처리</p>
                  <div className="mt-2 flex gap-4 text-sm">
                    <span className="text-on-surface">전체 <span className="font-semibold">{settlementStats.jobTotal}</span>건</span>
                    <span className="text-tertiary">성공 <span className="font-semibold">{settlementStats.jobCompleted}</span>건</span>
                    {settlementStats.jobFailed > 0 && <span className="text-error">실패 <span className="font-semibold">{settlementStats.jobFailed}</span>건</span>}
                  </div>
                </div>
              )}
            </div>

            <div className="rounded-2xl bg-surface-container-lowest p-6 shadow-ambient">
              <h3 className="font-headline text-[16px] font-bold text-on-surface mb-4">정산서 목록</h3>
              <div className="overflow-x-auto">
                <table className="min-w-full text-sm">
                  <thead className="bg-surface-container-low text-left text-on-surface-variant">
                    <tr>
                      <th className="px-4 py-3 text-xs font-semibold">정산 월</th>
                      <th className="px-4 py-3 text-xs font-semibold">상태</th>
                      <th className="px-4 py-3 text-xs font-semibold">정산 금액</th>
                      <th className="px-4 py-3 text-xs font-semibold">발송일</th>
                      <th className="px-4 py-3 text-xs font-semibold">생성일</th>
                    </tr>
                  </thead>
                  <tbody>
                    {settlementStats.recent.length === 0 ? (
                      <tr><td colSpan={5} className="px-4 py-8 text-center text-on-surface-variant">정산서가 없습니다.</td></tr>
                    ) : settlementStats.recent.map((s) => (
                      <tr key={s.id} className="border-t border-outline-variant/10 hover:bg-surface-container-low/50">
                        <td className="px-4 py-3 font-medium text-on-surface">{s.year_month}</td>
                        <td className="px-4 py-3"><Badge label={S_LABEL[s.status] ?? s.status} variant={S_VAR[s.status] ?? 'default'} /></td>
                        <td className="px-4 py-3 text-on-surface">{s.net_amount != null ? formatKRW(s.net_amount) : '-'}</td>
                        <td className="px-4 py-3 text-on-surface-variant">{s.sent_at ? formatDT(s.sent_at) : '-'}</td>
                        <td className="px-4 py-3 text-on-surface-variant">{formatDate(s.created_at)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        )}

        {/* ===== 결제 상세 탭 ===== */}
        {activeTab === 'payments' && (
          <div className="space-y-6">
            <div className="grid grid-cols-1 md:grid-cols-4 gap-5">
              <div className="rounded-2xl bg-surface-container-lowest p-6 shadow-ambient text-center">
                <p className="text-sm text-on-surface-variant">결제 완료</p>
                <p className="mt-2 text-3xl font-bold text-tertiary">{paymentStats.counts.paid}건</p>
              </div>
              <div className="rounded-2xl bg-surface-container-lowest p-6 shadow-ambient text-center">
                <p className="text-sm text-on-surface-variant">입금 대기</p>
                <p className="mt-2 text-3xl font-bold text-amber-500">{paymentStats.counts.pending}건</p>
              </div>
              <div className="rounded-2xl bg-surface-container-lowest p-6 shadow-ambient text-center">
                <p className="text-sm text-on-surface-variant">결제 실패</p>
                <p className="mt-2 text-3xl font-bold text-error">{paymentStats.counts.failed}건</p>
              </div>
              <div className="rounded-2xl bg-surface-container-lowest p-6 shadow-ambient text-center">
                <p className="text-sm text-on-surface-variant">누적 결제액</p>
                <p className="mt-2 text-3xl font-bold text-on-surface">{formatKRW(paymentStats.totalPaidAmount)}</p>
              </div>
            </div>

            <div className="rounded-2xl bg-surface-container-lowest p-6 shadow-ambient">
              <h3 className="font-headline text-[16px] font-bold text-on-surface mb-4">결제 내역</h3>
              <div className="overflow-x-auto">
                <table className="min-w-full text-sm">
                  <thead className="bg-surface-container-low text-left text-on-surface-variant">
                    <tr>
                      <th className="px-4 py-3 text-xs font-semibold">항목</th>
                      <th className="px-4 py-3 text-xs font-semibold">상태</th>
                      <th className="px-4 py-3 text-xs font-semibold">금액</th>
                      <th className="px-4 py-3 text-xs font-semibold">결제 수단</th>
                      <th className="px-4 py-3 text-xs font-semibold">결제일</th>
                      <th className="px-4 py-3 text-xs font-semibold">생성일</th>
                    </tr>
                  </thead>
                  <tbody>
                    {paymentStats.recent.length === 0 ? (
                      <tr><td colSpan={6} className="px-4 py-8 text-center text-on-surface-variant">결제 내역이 없습니다.</td></tr>
                    ) : paymentStats.recent.map((p) => (
                      <tr key={p.id} className="border-t border-outline-variant/10 hover:bg-surface-container-low/50">
                        <td className="px-4 py-3 font-medium text-on-surface">{p.title}</td>
                        <td className="px-4 py-3"><Badge label={P_LABEL[p.status] ?? p.status} variant={P_VAR[p.status] ?? 'default'} /></td>
                        <td className="px-4 py-3 text-on-surface">{p.amount != null ? formatKRW(p.amount) : '-'}</td>
                        <td className="px-4 py-3 text-on-surface-variant">{p.payment_method || '-'}</td>
                        <td className="px-4 py-3 text-on-surface-variant">{p.paid_at ? formatDT(p.paid_at) : '-'}</td>
                        <td className="px-4 py-3 text-on-surface-variant">{formatDate(p.created_at)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        )}

        {/* ===== 기사 목록 탭 ===== */}
        {activeTab === 'drivers' && (
          <div className="space-y-6">
            <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
              <div className="rounded-2xl bg-surface-container-lowest p-6 shadow-ambient text-center">
                <p className="text-sm text-on-surface-variant">전체 기사</p>
                <p className="mt-2 text-3xl font-bold text-on-surface">{driverStats.total}명</p>
              </div>
              <div className="rounded-2xl bg-surface-container-lowest p-6 shadow-ambient text-center">
                <p className="text-sm text-on-surface-variant">앱 활성</p>
                <p className="mt-2 text-3xl font-bold text-primary">{driverStats.appActive}명</p>
                {driverStats.total > 0 && <p className="text-xs text-on-surface-variant mt-1">{Math.round((driverStats.appActive / driverStats.total) * 100)}%</p>}
              </div>
              <div className="rounded-2xl bg-surface-container-lowest p-6 shadow-ambient text-center">
                <p className="text-sm text-on-surface-variant">미활성</p>
                <p className="mt-2 text-3xl font-bold text-on-surface-variant">{driverStats.total - driverStats.appActive}명</p>
              </div>
            </div>

            <div className="rounded-2xl bg-surface-container-lowest p-6 shadow-ambient">
              <h3 className="font-headline text-[16px] font-bold text-on-surface mb-2">기사 전체 목록</h3>
              <div className="flex h-3 w-full overflow-hidden rounded-full bg-surface-container-low mb-5">
                {driverStats.total > 0 && (
                  <>
                    <div className="h-full bg-primary" style={{ width: `${(driverStats.appActive / driverStats.total) * 100}%` }} />
                    <div className="h-full bg-outline-variant/30" style={{ width: `${((driverStats.total - driverStats.appActive) / driverStats.total) * 100}%` }} />
                  </>
                )}
              </div>

              <div className="overflow-x-auto">
                <table className="min-w-full text-sm">
                  <thead className="bg-surface-container-low text-left text-on-surface-variant">
                    <tr>
                      <th className="px-4 py-3 text-xs font-semibold">#</th>
                      <th className="px-4 py-3 text-xs font-semibold">기사명</th>
                      <th className="px-4 py-3 text-xs font-semibold">연락처</th>
                      <th className="px-4 py-3 text-xs font-semibold">앱 상태</th>
                      <th className="px-4 py-3 text-xs font-semibold">등록일</th>
                    </tr>
                  </thead>
                  <tbody>
                    {driverStats.drivers.length === 0 ? (
                      <tr><td colSpan={5} className="px-4 py-8 text-center text-on-surface-variant">소속 기사가 없습니다.</td></tr>
                    ) : driverStats.drivers.map((d, idx) => (
                      <tr key={d.id} className="border-t border-outline-variant/10 hover:bg-surface-container-low/50">
                        <td className="px-4 py-3 text-on-surface-variant">{idx + 1}</td>
                        <td className="px-4 py-3 font-medium text-on-surface">{d.name}</td>
                        <td className="px-4 py-3 text-on-surface-variant">{d.phone || '-'}</td>
                        <td className="px-4 py-3"><Badge label={d.push_token ? '활성' : '미활성'} variant={d.push_token ? 'success' : 'default'} /></td>
                        <td className="px-4 py-3 text-on-surface-variant">{formatDate(d.created_at)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        )}

      </div>
    </div>
  )
}
