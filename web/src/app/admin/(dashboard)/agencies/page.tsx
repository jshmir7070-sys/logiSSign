'use client'

import { useCallback, useEffect, useMemo, useState } from 'react'
import Badge from '@/components/shared/Badge'

interface AgencyRow {
  id: string
  name: string
  owner_name: string | null
  plan: string
  monthly_fee: number
  created_at: string
  status: string | null
  driver_count: number
  app_active_count: number
  payment_status: string
  latest_payment_title: string | null
  latest_payment_method: string | null
  latest_payment_at: string | null
}

const VALID_PLANS = ['free', 'basic', 'standard', 'pro', 'enterprise']

const PLAN_BADGE_VARIANT: Record<string, 'info' | 'success' | 'default' | 'warning'> = {
  free: 'default',
  basic: 'info',
  standard: 'success',
  pro: 'warning',
  enterprise: 'warning',
}

const STATUS_BADGE_VARIANT: Record<string, 'success' | 'error' | 'warning' | 'default'> = {
  active: 'success',
  paid: 'success',
  pending: 'warning',
  pending_payment: 'warning',
  overdue: 'error',
  failed: 'error',
  cancelled: 'default',
  inactive: 'default',
}

const STATUS_LABEL: Record<string, string> = {
  active: '정상',
  paid: '결제 완료',
  pending: '입금 대기',
  pending_payment: '입금 대기',
  overdue: '미납',
  failed: '결제 실패',
  cancelled: '취소',
  inactive: '비활성',
}

function formatKRW(value: number): string {
  return `₩${value.toLocaleString('ko-KR')}`
}

export default function AgenciesPage() {
  const [agencies, setAgencies] = useState<AgencyRow[]>([])
  const [loading, setLoading] = useState(true)
  const [filterPlan, setFilterPlan] = useState('all')
  const [search, setSearch] = useState('')

  const [changingAgency, setChangingAgency] = useState<AgencyRow | null>(null)
  const [newPlan, setNewPlan] = useState('')
  const [reason, setReason] = useState('')
  const [saving, setSaving] = useState(false)

  const loadAgencies = useCallback(async () => {
    setLoading(true)
    try {
      const response = await fetch('/api/admin/agencies')
      const payload = await response.json()
      if (!response.ok) {
        throw new Error(payload.error || '고객사 목록을 불러오지 못했습니다.')
      }
      setAgencies(payload.agencies ?? [])
    } catch (error) {
      alert(error instanceof Error ? error.message : '고객사 목록을 불러오지 못했습니다.')
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    void loadAgencies()
  }, [loadAgencies])

  const filtered = useMemo(() => {
    return agencies.filter((agency) => {
      if (filterPlan !== 'all' && agency.plan.toLowerCase() !== filterPlan.toLowerCase()) {
        return false
      }
      if (!search.trim()) return true

      const keyword = search.toLowerCase()
      return agency.name.toLowerCase().includes(keyword) || (agency.owner_name ?? '').toLowerCase().includes(keyword)
    })
  }, [agencies, filterPlan, search])

  async function handlePlanChange() {
    if (!changingAgency || !newPlan) return

    setSaving(true)
    try {
      const response = await fetch('/api/admin/plan-change', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          agencyId: changingAgency.id,
          newPlan,
          reason: reason || undefined,
        }),
      })

      const payload = await response.json()
      if (!response.ok) {
        throw new Error(payload.error || '플랜 변경에 실패했습니다.')
      }

      alert('플랜 변경이 완료되었습니다.')
      setChangingAgency(null)
      setReason('')
      setNewPlan('')
      await loadAgencies()
    } catch (error) {
      alert(error instanceof Error ? error.message : '플랜 변경에 실패했습니다.')
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="space-y-8">
      <div>
        <h2 className="font-headline text-[26px] font-bold tracking-tight text-on-surface">고객사 관리</h2>
        <p className="mt-1 text-[14px] text-on-surface-variant">
          고객사별 플랜, 소속 기사 수, 앱 활성화 현황, 결제 상태를 확인하고 플랜을 조정합니다.
        </p>
      </div>

      <div className="rounded-2xl bg-surface-container-lowest p-5 shadow-ambient">
        <div className="grid gap-4 md:grid-cols-[180px_1fr]">
          <select
            value={filterPlan}
            onChange={(event) => setFilterPlan(event.target.value)}
            className="h-11 rounded-xl border border-outline-variant/20 bg-surface px-3 text-sm text-on-surface"
          >
            <option value="all">전체 플랜</option>
            {VALID_PLANS.map((plan) => (
              <option key={plan} value={plan}>
                {plan.toUpperCase()}
              </option>
            ))}
          </select>

          <input
            type="text"
            value={search}
            onChange={(event) => setSearch(event.target.value)}
            placeholder="고객사명 또는 대표자명 검색"
            className="h-11 rounded-xl border border-outline-variant/20 bg-surface px-3 text-sm text-on-surface"
          />
        </div>
      </div>

      <div className="overflow-hidden rounded-2xl bg-surface-container-lowest shadow-ambient">
        <div className="overflow-x-auto">
          <table className="min-w-full text-sm">
            <thead className="bg-surface-container-low text-left text-on-surface-variant">
              <tr>
                <th className="px-5 py-4">고객사</th>
                <th className="px-5 py-4">플랜</th>
                <th className="px-5 py-4">기사 수</th>
                <th className="px-5 py-4">앱 활성화</th>
                <th className="px-5 py-4">월 기준 요금</th>
                <th className="px-5 py-4">결제 상태</th>
                <th className="px-5 py-4">최근 결제</th>
                <th className="px-5 py-4">가입일</th>
                <th className="px-5 py-4 text-right">관리</th>
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr>
                  <td colSpan={9} className="px-5 py-12 text-center text-on-surface-variant">
                    고객사 목록을 불러오는 중입니다...
                  </td>
                </tr>
              ) : filtered.length === 0 ? (
                <tr>
                  <td colSpan={9} className="px-5 py-12 text-center text-on-surface-variant">
                    조건에 맞는 고객사이 없습니다.
                  </td>
                </tr>
              ) : (
                filtered.map((agency) => (
                  <tr
                    key={agency.id}
                    className="border-t border-outline-variant/10 cursor-pointer hover:bg-surface-container-low/50 transition-colors"
                    onClick={() => window.open(
                      `/admin/agency-view/${agency.id}`,
                      `agency_${agency.id}`,
                      'popup=yes,width=1600,height=1000,scrollbars=yes',
                    )}
                  >
                    <td className="px-5 py-4">
                      <p className="font-medium text-on-surface">{agency.name}</p>
                      <p className="mt-1 text-xs text-on-surface-variant">대표자 {agency.owner_name || '-'}</p>
                    </td>
                    <td className="px-5 py-4">
                      <Badge
                        label={agency.plan.toUpperCase()}
                        variant={PLAN_BADGE_VARIANT[agency.plan] ?? 'default'}
                      />
                    </td>
                    <td className="px-5 py-4 text-on-surface">{agency.driver_count.toLocaleString()}명</td>
                    <td className="px-5 py-4">
                      <span className="text-on-surface">{agency.app_active_count.toLocaleString()}명</span>
                      <span className="ml-1 text-xs text-on-surface-variant">
                        / {agency.driver_count.toLocaleString()}
                      </span>
                    </td>
                    <td className="px-5 py-4 text-on-surface">{formatKRW(agency.monthly_fee ?? 0)}</td>
                    <td className="px-5 py-4">
                      <Badge
                        label={STATUS_LABEL[agency.payment_status] ?? agency.payment_status ?? '확인 필요'}
                        variant={STATUS_BADGE_VARIANT[agency.payment_status] ?? 'default'}
                      />
                    </td>
                    <td className="px-5 py-4">
                      <p className="text-on-surface">{agency.latest_payment_title || '-'}</p>
                      <p className="mt-1 text-xs text-on-surface-variant">
                        {agency.latest_payment_method || '-'}
                        {agency.latest_payment_at
                          ? ` · ${new Date(agency.latest_payment_at).toLocaleDateString('ko-KR')}`
                          : ''}
                      </p>
                    </td>
                    <td className="px-5 py-4 text-on-surface">
                      {new Date(agency.created_at).toLocaleDateString('ko-KR')}
                    </td>
                    <td className="px-5 py-4 text-right">
                      <button
                        type="button"
                        onClick={() => {
                          setChangingAgency(agency)
                          setNewPlan(agency.plan)
                          setReason('')
                        }}
                        className="rounded-lg bg-primary px-3 py-2 text-xs font-semibold text-white"
                      >
                        플랜 변경
                      </button>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {changingAgency ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
          <div className="w-full max-w-lg rounded-3xl bg-surface-container-lowest p-6 shadow-ambient">
            <h3 className="font-headline text-lg font-bold text-on-surface">
              {changingAgency.name} 플랜 변경
            </h3>
            <p className="mt-1 text-sm text-on-surface-variant">
              현재 플랜은 {changingAgency.plan.toUpperCase()}입니다. 변경 사유를 함께 기록하면 추후 이력
              확인이 쉬워집니다.
            </p>

            <div className="mt-5 space-y-4">
              <div>
                <label className="mb-2 block text-xs font-medium text-on-surface-variant">변경할 플랜</label>
                <select
                  value={newPlan}
                  onChange={(event) => setNewPlan(event.target.value)}
                  className="h-11 w-full rounded-xl border border-outline-variant/20 bg-surface px-3 text-sm text-on-surface"
                >
                  {VALID_PLANS.map((plan) => (
                    <option key={plan} value={plan}>
                      {plan.toUpperCase()}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="mb-2 block text-xs font-medium text-on-surface-variant">변경 사유</label>
                <textarea
                  value={reason}
                  onChange={(event) => setReason(event.target.value)}
                  placeholder="예: 운영 계약 변경, 수동 업그레이드 승인"
                  className="min-h-[120px] w-full rounded-xl border border-outline-variant/20 bg-surface px-3 py-3 text-sm text-on-surface"
                />
              </div>
            </div>

            <div className="mt-6 flex justify-end gap-3">
              <button
                type="button"
                onClick={() => {
                  setChangingAgency(null)
                  setReason('')
                  setNewPlan('')
                }}
                className="rounded-xl border border-outline-variant/20 px-4 py-2 text-sm font-medium text-on-surface-variant"
              >
                취소
              </button>
              <button
                type="button"
                onClick={() => void handlePlanChange()}
                disabled={saving || !newPlan}
                className="rounded-xl bg-primary px-4 py-2 text-sm font-semibold text-white disabled:opacity-50"
              >
                {saving ? '저장 중...' : '변경 저장'}
              </button>
            </div>
          </div>
        </div>
      ) : null}
    </div>
  )
}
