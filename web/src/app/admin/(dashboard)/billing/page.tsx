'use client'

import { useCallback, useEffect, useMemo, useState } from 'react'
import KpiCard from '@/components/admin/KpiCard'
import Badge from '@/components/shared/Badge'
import { getAgencyPaymentMethodLabel, getEasyPayProviderLabel } from '@/lib/payment-methods'

interface AgencyPaymentOrderRow {
  id: string
  agency_id: string
  payment_id: string
  title: string
  purpose: 'plan' | 'point'
  payment_method: string
  easy_pay_provider: string | null
  amount: number
  status: string
  created_at: string
  paid_at: string | null
  applied_at: string | null
  virtual_account_bank: string | null
  virtual_account_number: string | null
  deposit_expires_at: string | null
  agencies: { name: string } | { name: string }[] | null
  metadata: Record<string, unknown> | null
  portone_payload: Record<string, unknown> | null
}

interface PaymentOrdersResponse {
  orders: AgencyPaymentOrderRow[]
  summary: {
    totalOrders: number
    paidOrders: number
    pendingOrders: number
    failedOrders: number
    cancelledOrders: number
    paidAmount: number
  }
}

const STATUS_VARIANT: Record<string, 'success' | 'error' | 'warning' | 'default'> = {
  paid: 'success',
  pending: 'warning',
  failed: 'error',
  cancelled: 'default',
}

const STATUS_LABEL: Record<string, string> = {
  paid: '결제 완료',
  pending: '입금 대기',
  failed: '결제 실패',
  cancelled: '취소',
}

const PURPOSE_LABEL: Record<'plan' | 'point', string> = {
  plan: '플랜 결제',
  point: '포인트 충전',
}

function formatKRW(value: number): string {
  return `₩${value.toLocaleString('ko-KR')}`
}

function getAgencyName(value: AgencyPaymentOrderRow['agencies']): string {
  if (!value) return '-'
  if (Array.isArray(value)) return value[0]?.name ?? '-'
  return value.name
}

export default function BillingPage() {
  const [data, setData] = useState<PaymentOrdersResponse | null>(null)
  const [loading, setLoading] = useState(true)
  const [processingOrderId, setProcessingOrderId] = useState<string | null>(null)
  const [memoDrafts, setMemoDrafts] = useState<Record<string, string>>({})

  const loadOrders = useCallback(async () => {
    setLoading(true)
    try {
      const response = await fetch('/api/admin/payment-orders')
      const payload = await response.json()
      if (!response.ok) {
        throw new Error(payload.error || '결제 주문을 불러오지 못했습니다.')
      }
      setData(payload)
      setMemoDrafts(
        Object.fromEntries(
          ((payload.orders ?? []) as AgencyPaymentOrderRow[]).map((order) => [
            order.id,
            typeof order.metadata?.adminMemo === 'string' ? order.metadata.adminMemo : '',
          ]),
        ),
      )
    } catch (error) {
      alert(error instanceof Error ? error.message : '결제 주문을 불러오지 못했습니다.')
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    void loadOrders()
  }, [loadOrders])

  const pendingOrders = useMemo(
    () => (data?.orders ?? []).filter((order) => order.status === 'pending'),
    [data?.orders],
  )

  const handleOrderAction = useCallback(
    async (orderId: string, action: 'mark_paid' | 'cancel' | 'save_memo') => {
      setProcessingOrderId(orderId)
      try {
        const response = await fetch('/api/admin/payment-orders', {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            orderId,
            action,
            memo: memoDrafts[orderId] ?? '',
          }),
        })

        const payload = await response.json()
        if (!response.ok) {
          throw new Error(payload.error || '결제 주문 처리에 실패했습니다.')
        }

        alert(
          action === 'mark_paid'
            ? '입금 확인이 완료되었습니다.'
            : action === 'cancel'
              ? '주문 취소 처리가 완료되었습니다.'
              : '운영 메모를 저장했습니다.',
        )

        await loadOrders()
      } catch (error) {
        alert(error instanceof Error ? error.message : '결제 주문 처리에 실패했습니다.')
      } finally {
        setProcessingOrderId(null)
      }
    },
    [loadOrders, memoDrafts],
  )

  return (
    <div className="space-y-8">
      <div>
        <h2 className="font-headline text-[26px] font-bold tracking-tight text-on-surface">결제 관리</h2>
        <p className="mt-1 text-[14px] text-on-surface-variant">
          대리점의 플랜 결제와 포인트 결제를 조회하고, 가상계좌 입금 확인과 운영 메모를 처리합니다.
        </p>
      </div>

      <div className="grid grid-cols-1 gap-5 md:grid-cols-2 xl:grid-cols-4">
        <KpiCard
          label="총 주문"
          value={loading ? '...' : `${data?.summary.totalOrders ?? 0}건`}
          change={`결제 완료 ${data?.summary.paidOrders ?? 0}건`}
          changeType="up"
          accentColor="#2563eb"
          icon="receipt_long"
        />
        <KpiCard
          label="입금 대기"
          value={loading ? '...' : `${data?.summary.pendingOrders ?? 0}건`}
          change="가상계좌 및 대기 주문"
          changeType="down"
          accentColor="#d97706"
          icon="hourglass_top"
        />
        <KpiCard
          label="결제 실패"
          value={loading ? '...' : `${data?.summary.failedOrders ?? 0}건`}
          change={`취소 ${data?.summary.cancelledOrders ?? 0}건`}
          changeType="down"
          accentColor="#dc2626"
          icon="error_outline"
        />
        <KpiCard
          label="누적 결제 금액"
          value={loading ? '...' : formatKRW(data?.summary.paidAmount ?? 0)}
          change="완료된 결제 기준"
          changeType="up"
          accentColor="#007d55"
          icon="payments"
        />
      </div>

      <div className="grid gap-5 xl:grid-cols-[1.1fr_1fr]">
        <div className="rounded-2xl bg-surface-container-lowest p-6 shadow-ambient">
          <div className="mb-4 flex items-center justify-between">
            <div>
              <h3 className="font-headline text-[16px] font-bold text-on-surface">입금 대기 주문</h3>
              <p className="mt-1 text-sm text-on-surface-variant">
                가상계좌 입금 확인이 필요한 주문을 먼저 처리해 주세요.
              </p>
            </div>
          </div>

          <div className="space-y-3">
            {loading ? (
              <p className="text-sm text-on-surface-variant">주문을 불러오는 중입니다...</p>
            ) : pendingOrders.length === 0 ? (
              <p className="text-sm text-on-surface-variant">현재 입금 대기 중인 주문이 없습니다.</p>
            ) : (
              pendingOrders.map((order) => (
                <div key={order.id} className="rounded-xl border border-outline-variant/15 p-4">
                  <div className="flex flex-wrap items-start justify-between gap-3">
                    <div>
                      <p className="font-medium text-on-surface">{order.title}</p>
                      <p className="mt-1 text-xs text-on-surface-variant">
                        {getAgencyName(order.agencies)} · {PURPOSE_LABEL[order.purpose]}
                      </p>
                      <p className="mt-1 text-xs text-on-surface-variant">
                        {order.virtual_account_bank || '-'} / {order.virtual_account_number || '-'}
                      </p>
                      <p className="mt-1 text-xs text-on-surface-variant">
                        입금 기한{' '}
                        {order.deposit_expires_at
                          ? new Date(order.deposit_expires_at).toLocaleString('ko-KR')
                          : '-'}
                      </p>
                    </div>
                    <Badge label={STATUS_LABEL[order.status] ?? order.status} variant="warning" />
                  </div>

                  <div className="mt-4 flex flex-wrap gap-2">
                    <button
                      type="button"
                      onClick={() => void handleOrderAction(order.id, 'mark_paid')}
                      disabled={processingOrderId === order.id}
                      className="rounded-lg bg-primary px-3 py-2 text-xs font-semibold text-white disabled:opacity-50"
                    >
                      입금 확인
                    </button>
                    <button
                      type="button"
                      onClick={() => void handleOrderAction(order.id, 'cancel')}
                      disabled={processingOrderId === order.id}
                      className="rounded-lg border border-outline-variant/20 px-3 py-2 text-xs font-medium text-on-surface-variant disabled:opacity-50"
                    >
                      주문 취소
                    </button>
                  </div>
                </div>
              ))
            )}
          </div>
        </div>

        <div className="rounded-2xl bg-surface-container-lowest p-6 shadow-ambient">
          <h3 className="font-headline text-[16px] font-bold text-on-surface">전체 주문 이력</h3>
          <p className="mt-1 text-sm text-on-surface-variant">
            주문별 상태를 확인하고 운영 메모를 남길 수 있습니다.
          </p>

          <div className="mt-5 space-y-4">
            {(data?.orders ?? []).map((order) => (
              <div key={order.id} className="rounded-xl border border-outline-variant/15 p-4">
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div>
                    <p className="font-medium text-on-surface">{order.title}</p>
                    <p className="mt-1 text-xs text-on-surface-variant">
                      {getAgencyName(order.agencies)} · {PURPOSE_LABEL[order.purpose]}
                    </p>
                    <p className="mt-1 text-xs text-on-surface-variant">
                      {getAgencyPaymentMethodLabel(order.payment_method)}
                      {order.easy_pay_provider ? ` · ${getEasyPayProviderLabel(order.easy_pay_provider)}` : ''}
                      {` · ${formatKRW(order.amount)}`}
                    </p>
                    <p className="mt-1 text-xs text-on-surface-variant">
                      생성 {new Date(order.created_at).toLocaleString('ko-KR')}
                      {order.paid_at ? ` · 결제 ${new Date(order.paid_at).toLocaleString('ko-KR')}` : ''}
                    </p>
                  </div>
                  <Badge
                    label={STATUS_LABEL[order.status] ?? order.status}
                    variant={STATUS_VARIANT[order.status] ?? 'default'}
                  />
                </div>

                <textarea
                  value={memoDrafts[order.id] ?? ''}
                  onChange={(event) =>
                    setMemoDrafts((previous) => ({
                      ...previous,
                      [order.id]: event.target.value,
                    }))
                  }
                  placeholder="운영 메모를 남기면 이후 추적이 쉬워집니다."
                  className="mt-4 min-h-[88px] w-full rounded-xl border border-outline-variant/20 bg-surface px-3 py-3 text-sm text-on-surface"
                />

                <div className="mt-3 flex justify-end">
                  <button
                    type="button"
                    onClick={() => void handleOrderAction(order.id, 'save_memo')}
                    disabled={processingOrderId === order.id}
                    className="rounded-lg border border-outline-variant/20 px-3 py-2 text-xs font-medium text-on-surface-variant disabled:opacity-50"
                  >
                    메모 저장
                  </button>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  )
}
