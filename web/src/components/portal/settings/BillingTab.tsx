'use client'

import { useEffect, useMemo, useState } from 'react'
import { createBrowserSupabaseClient } from '@/lib/supabase'
import { type PlanType, getSubscriptionPrice, isPointBased } from '@/lib/plan-limits'
import { usePlan } from '@/contexts/PlanContext'
import {
  EASY_PAY_PROVIDER_OPTIONS,
  PAYMENT_METHOD_OPTIONS,
  VIRTUAL_ACCOUNT_BANK_OPTIONS,
  getAgencyPaymentMethodLabel,
  getEasyPayProviderLabel,
  type AgencyEasyPayProvider,
  type AgencyPaymentMethod,
} from '@/lib/payment-methods'
import type { AdminPaymentSettings } from '@/lib/admin-settings'
import { requestAgencyBillingKey, requestAgencyPayment } from '@/lib/portone-client'

type BillingTabMode = 'overview' | 'plan' | 'charge'
type BillingCycle = 'monthly' | '1year' | '2year'
type PlanPaymentSchedule = 'one_time' | 'recurring'

type PointBalanceData = {
  balance: number
  totalCharged: number
  totalUsed: number
}

type PointTx = {
  id: string
  type: string
  amount: number
  balanceAfter: number
  description: string
  createdAt: string
}

type PointPackage = {
  id: string
  name: string
  points: number
  price: number
  bonus_points: number
}

type LatestPaymentOrder = {
  title: string
  status: string
  payment_method: string
  easy_pay_provider: string | null
  amount: number
  created_at: string
}

type SubscriptionSnapshot = {
  id: string
  plan: string
  billing_cycle: BillingCycle
  status: string
  expires_at: string | null
  billing_key: string | null
  card_name: string | null
  card_number_masked: string | null
}

const PLAN_META: Array<{
  id: Extract<PlanType, 'basic' | 'standard' | 'pro' | 'enterprise'>
  name: string
  description: string
}> = [
  { id: 'basic', name: 'Basic', description: '기사 30명 규모에 적합한 기본 운영 플랜입니다.' },
  { id: 'standard', name: 'Standard', description: '기사, 정산, 알림을 함께 운영하는 중형 플랜입니다.' },
  { id: 'pro', name: 'Pro', description: '대량 처리와 확장 운영에 적합한 고급 플랜입니다.' },
  { id: 'enterprise', name: 'Enterprise', description: '대규모 운영과 별도 협의가 필요한 전용 플랜입니다.' },
]

const BILLING_CYCLE_OPTIONS: { value: BillingCycle; label: string; badge?: string }[] = [
  { value: 'monthly', label: '월 결제' },
  { value: '1year', label: '1년 연간권', badge: '20% 할인' },
  { value: '2year', label: '2년 연간권', badge: '30% 할인' },
]

const ORDER_STATUS_LABELS: Record<string, string> = {
  paid: '결제 완료',
  pending: '입금 대기',
  failed: '결제 실패',
  cancelled: '결제 취소',
}

function fmt(n: number): string {
  return n.toLocaleString('ko-KR')
}

function fmtKRW(n: number): string {
  return `₩${fmt(n)}`
}

function fmtPoints(n: number): string {
  return `${fmt(n)}P`
}

function formatDate(dateString: string | null | undefined) {
  if (!dateString) return '-'
  return new Date(dateString).toLocaleDateString('ko-KR')
}

function daysUntil(dateString: string | null | undefined) {
  if (!dateString) return null
  const today = new Date()
  const target = new Date(dateString)
  const midnightToday = new Date(today.getFullYear(), today.getMonth(), today.getDate())
  const midnightTarget = new Date(target.getFullYear(), target.getMonth(), target.getDate())
  return Math.round((midnightTarget.getTime() - midnightToday.getTime()) / (1000 * 60 * 60 * 24))
}

export default function BillingTab() {
  const { plan: currentPlan, refreshPlan, agencyId, companyName, ownerName, email } = usePlan()
  const [tab, setTab] = useState<BillingTabMode>('overview')
  const [loading, setLoading] = useState(true)
  const [processingKey, setProcessingKey] = useState<string | null>(null)
  const [planType, setPlanType] = useState<'subscription' | 'free'>('subscription')
  const [billingCycle, setBillingCycle] = useState<BillingCycle>('monthly')
  const [planPaymentSchedule, setPlanPaymentSchedule] = useState<PlanPaymentSchedule>('one_time')
  const [planPaymentMethod, setPlanPaymentMethod] = useState<AgencyPaymentMethod>('CARD')
  const [planEasyPayProvider, setPlanEasyPayProvider] = useState<AgencyEasyPayProvider>('KAKAOPAY')
  const [planVirtualAccountBank, setPlanVirtualAccountBank] = useState('KOOKMIN_BANK')
  const [paymentMethod, setPaymentMethod] = useState<AgencyPaymentMethod>('CARD')
  const [easyPayProvider, setEasyPayProvider] = useState<AgencyEasyPayProvider>('KAKAOPAY')
  const [virtualAccountBank, setVirtualAccountBank] = useState('KOOKMIN_BANK')
  const [pointBalance, setPointBalance] = useState<PointBalanceData | null>(null)
  const [pointTransactions, setPointTransactions] = useState<PointTx[]>([])
  const [packages, setPackages] = useState<PointPackage[]>([])
  const [selectedPointPackageId, setSelectedPointPackageId] = useState<string | null>(null)
  const [latestOrder, setLatestOrder] = useState<LatestPaymentOrder | null>(null)
  const [subscription, setSubscription] = useState<SubscriptionSnapshot | null>(null)
  const [paymentSettings, setPaymentSettings] = useState<AdminPaymentSettings | null>(null)

  useEffect(() => {
    async function load() {
      const supabase = createBrowserSupabaseClient()
      const {
        data: { user },
      } = await supabase.auth.getUser()

      if (!user || !agencyId) {
        setLoading(false)
        return
      }

      const [
        { data: agency },
        pointBalanceRes,
        pointTxRes,
        pointPackageRes,
        paymentSettingsRes,
        latestOrderRes,
        subscriptionRes,
      ] = await Promise.all([
        supabase.from('agencies').select('plan_type').eq('id', agencyId).maybeSingle(),
        fetch('/api/points?action=balance'),
        fetch('/api/points?action=transactions&limit=10'),
        fetch('/api/points?action=packages'),
        fetch('/api/runtime-settings/payment'),
        supabase
          .from('agency_payment_orders')
          .select('title, status, payment_method, easy_pay_provider, amount, created_at')
          .eq('agency_id', agencyId)
          .order('created_at', { ascending: false })
          .limit(1)
          .maybeSingle(),
        supabase
          .from('subscriptions')
          .select('id, plan, billing_cycle, status, expires_at, billing_key, card_name, card_number_masked')
          .eq('agency_id', agencyId)
          .order('updated_at', { ascending: false })
          .limit(1)
          .maybeSingle(),
      ])

      setPlanType(isPointBased(agency?.plan_type) ? 'free' : 'subscription')

      if (pointBalanceRes.ok) {
        setPointBalance(await pointBalanceRes.json())
      }
      if (pointTxRes.ok) {
        const data = await pointTxRes.json()
        setPointTransactions(data.transactions ?? [])
      }
      if (pointPackageRes.ok) {
        const data = await pointPackageRes.json()
        setPackages(data.packages ?? [])
      }
      if (paymentSettingsRes.ok) {
        setPaymentSettings((await paymentSettingsRes.json()) as AdminPaymentSettings)
      }
      if (latestOrderRes.data) {
        setLatestOrder(latestOrderRes.data as LatestPaymentOrder)
      }
      if (subscriptionRes.data) {
        setSubscription(subscriptionRes.data as SubscriptionSnapshot)
      }

      setLoading(false)
    }

    void load()
  }, [agencyId])

  const activePlanMeta = useMemo(
    () => PLAN_META.find((plan) => plan.id === currentPlan),
    [currentPlan],
  )
  const selectedPointPackage = useMemo(
    () => packages.find((pkg) => pkg.id === selectedPointPackageId) ?? packages[0] ?? null,
    [packages, selectedPointPackageId],
  )

  const expiryDays = useMemo(() => daysUntil(subscription?.expires_at), [subscription?.expires_at])
  const planExpiryNoticeDays = paymentSettings?.subscriptionExpiryNoticeDays ?? [7, 3, 1]
  const isExpiryNoticeVisible =
    expiryDays !== null && expiryDays >= 0 && planExpiryNoticeDays.includes(expiryDays)
  const isRecurringPlanPayment = billingCycle === 'monthly' && planPaymentSchedule === 'recurring'

  useEffect(() => {
    if (packages.length === 0) {
      if (selectedPointPackageId !== null) {
        setSelectedPointPackageId(null)
      }
      return
    }

    if (!selectedPointPackageId || !packages.some((pkg) => pkg.id === selectedPointPackageId)) {
      setSelectedPointPackageId(packages[0].id)
    }
  }, [packages, selectedPointPackageId])

  useEffect(() => {
    if (billingCycle !== 'monthly' && planPaymentSchedule !== 'one_time') {
      setPlanPaymentSchedule('one_time')
    }
  }, [billingCycle, planPaymentSchedule])

  useEffect(() => {
    if (isRecurringPlanPayment && planPaymentMethod !== 'CARD') {
      setPlanPaymentMethod('CARD')
    }
  }, [isRecurringPlanPayment, planPaymentMethod])

  async function reloadBillingState() {
    setLoading(true)
    const supabase = createBrowserSupabaseClient()

    const [latestOrderRes, subscriptionRes, pointBalanceRes] = await Promise.all([
      supabase
        .from('agency_payment_orders')
        .select('title, status, payment_method, easy_pay_provider, amount, created_at')
        .eq('agency_id', agencyId)
        .order('created_at', { ascending: false })
        .limit(1)
        .maybeSingle(),
      supabase
        .from('subscriptions')
        .select('id, plan, billing_cycle, status, expires_at, billing_key, card_name, card_number_masked')
        .eq('agency_id', agencyId)
        .order('updated_at', { ascending: false })
        .limit(1)
        .maybeSingle(),
      fetch('/api/points?action=balance'),
    ])

    if (latestOrderRes.data) setLatestOrder(latestOrderRes.data as LatestPaymentOrder)
    if (subscriptionRes.data) setSubscription(subscriptionRes.data as SubscriptionSnapshot)
    if (pointBalanceRes.ok) setPointBalance(await pointBalanceRes.json())
    await refreshPlan()
    setLoading(false)
  }

  async function handlePlanPurchase(plan: Extract<PlanType, 'basic' | 'standard' | 'pro' | 'enterprise'>) {
    if (!agencyId) return

    if (isRecurringPlanPayment && paymentSettings?.subscriptionCardOnly && planPaymentMethod !== 'CARD') {
      window.alert('구독형 플랜은 카드 결제만 사용할 수 있습니다.')
      return
    }

    const amount = getSubscriptionPrice(plan, billingCycle)
    const paymentId = `plan_${agencyId}_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`

    setProcessingKey(`plan:${plan}`)

    try {
      const paymentResult = await requestAgencyPayment({
        paymentId,
        orderName: `logiSSign ${plan.toUpperCase()} 플랜`,
        amount,
        method: isRecurringPlanPayment ? 'CARD' : planPaymentMethod,
        easyPayProvider: !isRecurringPlanPayment && planPaymentMethod === 'EASY_PAY' ? planEasyPayProvider : undefined,
        virtualAccountBankCode:
          !isRecurringPlanPayment && planPaymentMethod === 'VIRTUAL_ACCOUNT' ? planVirtualAccountBank : undefined,
        customer: {
          customerId: agencyId,
          fullName: companyName || ownerName,
          email,
        },
      })

      const response = await fetch('/api/payment', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'record-plan-payment',
          paymentId: paymentResult.paymentId,
          plan,
          billing: billingCycle,
          amount,
          paymentMethod: isRecurringPlanPayment ? 'CARD' : planPaymentMethod,
          easyPayProvider: !isRecurringPlanPayment && planPaymentMethod === 'EASY_PAY' ? planEasyPayProvider : undefined,
          paymentSchedule: isRecurringPlanPayment ? 'recurring' : 'one_time',
        }),
      })
      const payload = await response.json()

      if (!response.ok) {
        throw new Error(payload.error ?? '플랜 결제를 완료하지 못했습니다.')
      }

      window.alert('플랜 결제가 완료되었습니다.')
      await reloadBillingState()
      setPlanType('subscription')
      setTab('overview')
    } catch (error) {
      window.alert(error instanceof Error ? error.message : '플랜 결제에 실패했습니다.')
    } finally {
      setProcessingKey(null)
    }
  }

  async function handlePointCharge(pkg: PointPackage) {
    if (!agencyId) return

    setProcessingKey(`point:${pkg.id}`)
    try {
      const paymentId = `point_${agencyId}_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`
      const paymentResult = await requestAgencyPayment({
        paymentId,
        orderName: pkg.name,
        amount: pkg.price,
        method: paymentMethod,
        easyPayProvider: paymentMethod === 'EASY_PAY' ? easyPayProvider : undefined,
        virtualAccountBankCode: paymentMethod === 'VIRTUAL_ACCOUNT' ? virtualAccountBank : undefined,
        customer: {
          customerId: agencyId,
          fullName: companyName || ownerName,
          email,
        },
      })

      const response = await fetch('/api/points', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'charge',
          packageId: pkg.id,
          paymentId: paymentResult.paymentId,
          paymentMethod,
          easyPayProvider: paymentMethod === 'EASY_PAY' ? easyPayProvider : undefined,
        }),
      })
      const payload = await response.json()

      if (!response.ok) {
        throw new Error(payload.error ?? '포인트 결제를 완료하지 못했습니다.')
      }

      if (payload.status === 'pending') {
        window.alert('가상계좌 또는 계좌이체 결제가 접수되었습니다. 입금이 확인되면 포인트가 반영됩니다.')
      } else {
        window.alert('포인트 충전이 완료되었습니다.')
      }

      await reloadBillingState()
      setTab('overview')
    } catch (error) {
      window.alert(error instanceof Error ? error.message : '포인트 충전에 실패했습니다.')
    } finally {
      setProcessingKey(null)
    }
  }

  async function handleSwitchToPoint() {
    const confirmed = window.confirm(
      '포인트형으로 전환하면 이후 전자계약과 정산 생성은 포인트 차감 방식으로만 사용할 수 있습니다. 계속하시겠습니까?',
    )
    if (!confirmed) return

    setProcessingKey('switch-to-point')
    try {
      const response = await fetch('/api/payment', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'switch-to-point' }),
      })
      const payload = await response.json()
      if (!response.ok) {
        throw new Error(payload.error ?? '포인트형 전환에 실패했습니다.')
      }

      window.alert('포인트형으로 전환되었습니다. 기존 포인트는 그대로 유지됩니다.')
      setPlanType('free')
      await reloadBillingState()
    } catch (error) {
      window.alert(error instanceof Error ? error.message : '포인트형 전환에 실패했습니다.')
    } finally {
      setProcessingKey(null)
    }
  }

  async function handleRegisterBillingKey() {
    if (!agencyId || planType === 'free') {
      window.alert('구독형 플랜 이용 중일 때만 카드 등록이 가능합니다.')
      return
    }

    setProcessingKey('billing-key')
    try {
      const billingResult = await requestAgencyBillingKey({
        issueId: `billing_${agencyId}_${Date.now()}`,
        issueName: 'logiSSign 구독 결제 카드 등록',
        customer: {
          customerId: agencyId,
          fullName: companyName || ownerName,
          email,
        },
      })

      const response = await fetch('/api/payment', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'save-billing-key',
          billingKey: billingResult.billingKey,
          cardName: billingResult.cardName,
          cardNumberMasked: billingResult.cardNumberMasked,
        }),
      })
      const payload = await response.json()
      if (!response.ok) {
        throw new Error(payload.error ?? '카드 등록 정보를 저장하지 못했습니다.')
      }

      window.alert('구독 결제용 카드가 등록되었습니다.')
      await reloadBillingState()
    } catch (error) {
      window.alert(error instanceof Error ? error.message : '카드 등록에 실패했습니다.')
    } finally {
      setProcessingKey(null)
    }
  }

  if (loading) {
    return <p className="py-10 text-sm text-on-surface-variant">결제 정보를 불러오는 중입니다...</p>
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap gap-2">
        {[
          { id: 'overview' as const, label: '요약' },
          { id: 'plan' as const, label: '플랜 결제' },
          { id: 'charge' as const, label: '포인트 충전' },
        ].map((item) => (
          <button
            key={item.id}
            type="button"
            onClick={() => setTab(item.id)}
            className={`rounded-xl px-4 py-2 text-sm font-medium transition-colors ${
              tab === item.id
                ? 'bg-primary text-white'
                : 'bg-surface-container-low text-on-surface-variant hover:bg-surface-container-high'
            }`}
          >
            {item.label}
          </button>
        ))}
      </div>

      {tab === 'overview' ? (
        <div className="space-y-6 rounded-2xl bg-surface-container-lowest p-8 shadow-ambient">
          <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
            <div className="rounded-2xl border border-outline-variant/15 bg-surface-container-low p-5">
              <p className="text-xs text-on-surface-variant">현재 이용 방식</p>
              <p className="mt-2 text-xl font-bold text-on-surface">
                {planType === 'subscription' ? '구독형 플랜' : '무료 (포인트형)'}
              </p>
              <p className="mt-2 text-xs text-on-surface-variant">
                {planType === 'subscription'
                  ? '구독형 플랜은 포인트를 차감하지 않고 플랜 한도 내에서 사용합니다.'
                  : '포인트형은 사용한 기능만큼 포인트가 차감됩니다.'}
              </p>
            </div>

            <div className="rounded-2xl border border-outline-variant/15 bg-surface-container-low p-5">
              <p className="text-xs text-on-surface-variant">현재 플랜</p>
              <p className="mt-2 text-xl font-bold text-on-surface">
                {activePlanMeta?.name ?? (isPointBased(currentPlan) ? '무료 (포인트형)' : currentPlan.toUpperCase())}
              </p>
              <p className="mt-2 text-xs text-on-surface-variant">
                {subscription?.expires_at
                  ? `만료 예정일 ${formatDate(subscription.expires_at)}`
                  : '포인트형은 별도 만료일이 없습니다.'}
              </p>
            </div>

            <div className="rounded-2xl border border-outline-variant/15 bg-surface-container-low p-5">
              <p className="text-xs text-on-surface-variant">포인트 잔액</p>
              <p className="mt-2 text-xl font-bold text-on-surface">{fmtPoints(pointBalance?.balance ?? 0)}</p>
              <p className="mt-2 text-xs text-on-surface-variant">
                플랜 사용 중이더라도 기존 포인트는 유지되고 자동 차감되지 않습니다.
              </p>
            </div>
          </div>

          {isExpiryNoticeVisible ? (
            <div className="rounded-2xl border border-amber-200 bg-amber-50 p-5">
              <p className="text-sm font-bold text-amber-800">플랜 만료 예정 안내</p>
              <p className="mt-2 text-sm text-amber-700">
                현재 플랜은 {expiryDays}일 후 만료됩니다. 만료 전에 카드 등록 상태와 다음 결제 일정을 확인해 주세요.
              </p>
            </div>
          ) : null}

          <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
            <div className="rounded-2xl border border-outline-variant/15 p-5">
              <p className="text-sm font-bold text-on-surface">최근 결제</p>
              {latestOrder ? (
                <div className="mt-3 space-y-2 text-sm">
                  <div className="flex items-center justify-between gap-4">
                    <span className="text-on-surface-variant">주문명</span>
                    <span className="font-semibold text-on-surface">{latestOrder.title}</span>
                  </div>
                  <div className="flex items-center justify-between gap-4">
                    <span className="text-on-surface-variant">결제수단</span>
                    <span className="font-semibold text-on-surface">
                      {getAgencyPaymentMethodLabel(latestOrder.payment_method)}
                      {latestOrder.easy_pay_provider
                        ? ` (${getEasyPayProviderLabel(latestOrder.easy_pay_provider)})`
                        : ''}
                    </span>
                  </div>
                  <div className="flex items-center justify-between gap-4">
                    <span className="text-on-surface-variant">상태</span>
                    <span className="font-semibold text-on-surface">
                      {ORDER_STATUS_LABELS[latestOrder.status] ?? latestOrder.status}
                    </span>
                  </div>
                  <div className="flex items-center justify-between gap-4">
                    <span className="text-on-surface-variant">금액</span>
                    <span className="font-semibold text-on-surface">{fmtKRW(latestOrder.amount)}</span>
                  </div>
                </div>
              ) : (
                <p className="mt-3 text-sm text-on-surface-variant">아직 결제 이력이 없습니다.</p>
              )}
            </div>

            <div className="rounded-2xl border border-outline-variant/15 p-5">
              <p className="text-sm font-bold text-on-surface">구독 카드 등록 상태</p>
              <div className="mt-3 space-y-2 text-sm">
                <div className="flex items-center justify-between gap-4">
                  <span className="text-on-surface-variant">등록 여부</span>
                  <span className="font-semibold text-on-surface">{subscription?.billing_key ? '등록됨' : '미등록'}</span>
                </div>
                <div className="flex items-center justify-between gap-4">
                  <span className="text-on-surface-variant">카드명</span>
                  <span className="font-semibold text-on-surface">{subscription?.card_name ?? '-'}</span>
                </div>
                <div className="flex items-center justify-between gap-4">
                  <span className="text-on-surface-variant">카드번호</span>
                  <span className="font-semibold text-on-surface">{subscription?.card_number_masked ?? '-'}</span>
                </div>
              </div>
              <div className="mt-4 flex flex-wrap gap-2">
                <button
                  type="button"
                  onClick={() => void handleRegisterBillingKey()}
                  disabled={
                    processingKey === 'billing-key' ||
                    planType !== 'subscription' ||
                    !paymentSettings?.allowBillingKeyManagement
                  }
                  className="h-10 rounded-xl bg-primary px-4 text-sm font-semibold text-white transition-colors hover:bg-primary/90 disabled:opacity-60"
                >
                  {subscription?.billing_key ? '카드 변경' : '카드 등록'}
                </button>
                <button
                  type="button"
                  onClick={() => void handleSwitchToPoint()}
                  disabled={processingKey === 'switch-to-point'}
                  className="h-10 rounded-xl bg-surface-container-high px-4 text-sm font-medium text-on-surface-variant transition-colors hover:bg-surface-container-highest disabled:opacity-60"
                >
                  포인트형 전환
                </button>
              </div>
            </div>
          </div>
        </div>
      ) : null}

      {tab === 'plan' ? (
        <div className="space-y-6 rounded-2xl bg-surface-container-lowest p-8 shadow-ambient">
          <div className="rounded-2xl border border-primary/10 bg-primary/5 p-5">
            <p className="text-sm font-bold text-primary">플랜 결제 안내</p>
            <p className="mt-2 text-sm text-on-surface-variant">
              월 결제는 한 달 이용과 월 정기구독 중에서 선택할 수 있습니다. 월 정기구독만 카드 결제와 카드 등록을
              지원하며, 한 달 이용과 기간권은 카드, 간편결제, 계좌이체, 가상계좌를 사용할 수 있습니다.
            </p>
            <p className="mt-3 text-sm text-on-surface-variant">
              포인트형에서 구독형으로 변경되어도 기존 포인트는 그대로 유지되며, 구독 사용 중에는 포인트가 자동 차감되지 않습니다.
            </p>
          </div>

          <div className="flex flex-wrap gap-2">
            {BILLING_CYCLE_OPTIONS.map((option) => (
              <button
                key={option.value}
                type="button"
                onClick={() => {
                  setBillingCycle(option.value)
                  if (option.value !== 'monthly') {
                    setPlanPaymentSchedule('one_time')
                  }
                }}
                className={`rounded-xl border px-4 py-2 text-sm font-medium transition-colors ${
                  billingCycle === option.value
                    ? 'border-primary bg-primary/10 text-primary'
                    : 'border-outline-variant/20 bg-surface-container-low text-on-surface-variant hover:bg-surface-container-high'
                }`}
              >
                {option.label}
                {option.badge ? <span className="ml-2 text-xs">{option.badge}</span> : null}
              </button>
            ))}
          </div>

          {billingCycle === 'monthly' ? (
            <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
              <button
                type="button"
                onClick={() => setPlanPaymentSchedule('one_time')}
                className={`rounded-2xl border p-4 text-left ${
                  planPaymentSchedule === 'one_time'
                    ? 'border-primary bg-primary/10 text-primary'
                    : 'border-outline-variant/20 bg-surface-container-low text-on-surface-variant hover:bg-surface-container-high'
                }`}
              >
                <p className="text-sm font-semibold">한 달 이용</p>
                <p className="mt-1 text-xs">카드, 간편결제, 계좌이체, 가상계좌 중 원하는 수단으로 한 번만 결제합니다.</p>
              </button>
              <button
                type="button"
                onClick={() => setPlanPaymentSchedule('recurring')}
                className={`rounded-2xl border p-4 text-left ${
                  planPaymentSchedule === 'recurring'
                    ? 'border-primary bg-primary/10 text-primary'
                    : 'border-outline-variant/20 bg-surface-container-low text-on-surface-variant hover:bg-surface-container-high'
                }`}
              >
                <p className="text-sm font-semibold">월 정기구독</p>
                <p className="mt-1 text-xs">매달 자동 갱신되는 구독입니다. 월 정기구독은 카드 결제와 카드 등록만 지원합니다.</p>
              </button>
            </div>
          ) : null}

          <div className="space-y-4 rounded-2xl border border-outline-variant/15 bg-surface-container-low p-5">
            <p className="text-sm font-semibold text-on-surface">플랜 결제 수단</p>
            <p className="text-xs text-on-surface-variant">
              {isRecurringPlanPayment
                ? '월 정기구독은 카드 결제만 가능합니다.'
                : '한 달 이용과 기간권은 카드, 간편결제, 계좌이체, 가상계좌 중 원하는 수단으로 결제할 수 있습니다.'}
            </p>

            {isRecurringPlanPayment ? (
              <label className="block rounded-xl border border-primary bg-primary/5 p-4">
                <div className="flex items-start gap-3">
                  <input type="radio" checked readOnly className="mt-1 accent-primary" />
                  <div>
                    <p className="text-sm font-semibold text-on-surface">결제</p>
                    <p className="mt-1 text-xs text-on-surface-variant">월 정기구독은 등록된 카드로 자동 갱신됩니다.</p>
                  </div>
                </div>
              </label>
            ) : (
              <>
                <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
                  {PAYMENT_METHOD_OPTIONS.filter((option) => paymentSettings?.enabledMethods.includes(option.value) ?? true).map(
                    (option) => (
                      <label
                        key={option.value}
                        className={`rounded-xl border-2 p-4 transition-colors ${
                          planPaymentMethod === option.value
                            ? 'border-primary bg-primary/5'
                            : 'border-outline-variant/15 hover:border-outline-variant/40'
                        }`}
                      >
                        <div className="flex items-start gap-3">
                          <input
                            type="radio"
                            name="plan-payment-method"
                            className="mt-1 accent-primary"
                            checked={planPaymentMethod === option.value}
                            onChange={() => setPlanPaymentMethod(option.value)}
                          />
                          <div>
                            <p className="text-sm font-bold text-on-surface">{option.label}</p>
                            <p className="mt-1 text-xs text-on-surface-variant">{option.description}</p>
                          </div>
                        </div>
                      </label>
                    ),
                  )}
                </div>

                {planPaymentMethod === 'EASY_PAY' ? (
                  <div className="grid grid-cols-2 gap-2 md:grid-cols-4">
                    {EASY_PAY_PROVIDER_OPTIONS.filter(
                      (provider) => paymentSettings?.enabledEasyPayProviders.includes(provider.value) ?? true,
                    ).map((provider) => (
                      <button
                        key={provider.value}
                        type="button"
                        onClick={() => setPlanEasyPayProvider(provider.value)}
                        className={`h-10 rounded-xl text-sm font-semibold transition-colors ${
                          planEasyPayProvider === provider.value
                            ? 'bg-primary text-white'
                            : 'bg-surface-container text-on-surface-variant hover:bg-surface-container-high'
                        }`}
                      >
                        {provider.label}
                      </button>
                    ))}
                  </div>
                ) : null}

                {planPaymentMethod === 'VIRTUAL_ACCOUNT' ? (
                  <select
                    value={planVirtualAccountBank}
                    onChange={(event) => setPlanVirtualAccountBank(event.target.value)}
                    className="h-11 w-full rounded-xl border border-outline-variant/20 bg-surface-container-low px-4 text-sm text-on-surface outline-none focus:ring-2 focus:ring-primary/30"
                  >
                    {VIRTUAL_ACCOUNT_BANK_OPTIONS.filter(
                      (bank) => paymentSettings?.enabledVirtualAccountBanks.includes(bank.value) ?? true,
                    ).map((bank) => (
                      <option key={bank.value} value={bank.value}>
                        {bank.label}
                      </option>
                    ))}
                  </select>
                ) : null}
              </>
            )}
          </div>

          <div className="grid grid-cols-1 gap-4 xl:grid-cols-2">
            {PLAN_META.map((plan) => {
              const amount = getSubscriptionPrice(plan.id, billingCycle)
              return (
                <div key={plan.id} className="rounded-2xl border border-outline-variant/15 p-5">
                  <p className="text-lg font-bold text-on-surface">{plan.name}</p>
                  <p className="mt-2 text-sm text-on-surface-variant">{plan.description}</p>
                  <p className="mt-4 text-2xl font-bold text-primary">{fmtKRW(amount)}</p>
                  <p className="mt-1 text-xs text-on-surface-variant">
                    {billingCycle === 'monthly'
                      ? '월 단위 결제'
                      : billingCycle === '1year'
                        ? '1년 연간권'
                        : '2년 연간권'}
                  </p>
                  <button
                    type="button"
                    onClick={() => void handlePlanPurchase(plan.id)}
                    disabled={processingKey === `plan:${plan.id}`}
                    className="mt-5 h-11 w-full rounded-xl bg-primary text-sm font-semibold text-white transition-colors hover:bg-primary/90 disabled:opacity-60"
                  >
                    {processingKey === `plan:${plan.id}` ? '결제 진행 중...' : `${plan.name} 결제`}
                  </button>
                </div>
              )
            })}
          </div>
        </div>
      ) : null}

      {tab === 'charge' ? (
        <div className="space-y-6 rounded-2xl bg-surface-container-lowest p-8 shadow-ambient">
          <div className="rounded-2xl border border-outline-variant/15 bg-surface-container-low p-5">
            <p className="text-sm font-bold text-on-surface">포인트 충전</p>
            <p className="mt-2 text-sm text-on-surface-variant">
              포인트형은 계약 발송, 정산 생성 같은 유료 기능을 사용할 때만 포인트가 차감됩니다.
            </p>
          </div>

          <div className="space-y-4">
            <p className="text-sm font-semibold text-on-surface">결제 수단 선택</p>
            <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
              {PAYMENT_METHOD_OPTIONS.filter((option) => paymentSettings?.enabledMethods.includes(option.value) ?? true).map(
                (option) => (
                  <label
                    key={option.value}
                    className={`rounded-xl border-2 p-4 transition-colors ${
                      paymentMethod === option.value
                        ? 'border-primary bg-primary/5'
                        : 'border-outline-variant/15 hover:border-outline-variant/40'
                    }`}
                  >
                    <div className="flex items-start gap-3">
                      <input
                        type="radio"
                        name="point-payment-method"
                        className="mt-1 accent-primary"
                        checked={paymentMethod === option.value}
                        onChange={() => setPaymentMethod(option.value)}
                      />
                      <div>
                        <p className="text-sm font-bold text-on-surface">{option.label}</p>
                        <p className="mt-1 text-xs text-on-surface-variant">{option.description}</p>
                      </div>
                    </div>
                  </label>
                ),
              )}
            </div>

            {paymentMethod === 'EASY_PAY' ? (
              <div className="grid grid-cols-2 gap-2 md:grid-cols-4">
                {EASY_PAY_PROVIDER_OPTIONS.filter(
                  (provider) => paymentSettings?.enabledEasyPayProviders.includes(provider.value) ?? true,
                ).map((provider) => (
                  <button
                    key={provider.value}
                    type="button"
                    onClick={() => setEasyPayProvider(provider.value)}
                    className={`h-10 rounded-xl text-sm font-semibold transition-colors ${
                      easyPayProvider === provider.value
                        ? 'bg-primary text-white'
                        : 'bg-surface-container-low text-on-surface-variant hover:bg-surface-container-high'
                    }`}
                  >
                    {provider.label}
                  </button>
                ))}
              </div>
            ) : null}

            {paymentMethod === 'VIRTUAL_ACCOUNT' ? (
              <select
                value={virtualAccountBank}
                onChange={(event) => setVirtualAccountBank(event.target.value)}
                className="h-11 w-full rounded-xl border border-outline-variant/20 bg-surface-container-low px-4 text-sm text-on-surface outline-none focus:ring-2 focus:ring-primary/30"
              >
                {VIRTUAL_ACCOUNT_BANK_OPTIONS.filter(
                  (bank) => paymentSettings?.enabledVirtualAccountBanks.includes(bank.value) ?? true,
                ).map((bank) => (
                  <option key={bank.value} value={bank.value}>
                    {bank.label}
                  </option>
                ))}
              </select>
            ) : null}
          </div>

          <div className="grid grid-cols-1 gap-4 xl:grid-cols-3">
            {packages.map((pkg) => (
              <button
                key={pkg.id}
                type="button"
                onClick={() => setSelectedPointPackageId(pkg.id)}
                className={`rounded-2xl border p-5 text-left transition-colors ${
                  selectedPointPackage?.id === pkg.id
                    ? 'border-primary bg-primary/5'
                    : 'border-outline-variant/15 hover:border-outline-variant/40'
                }`}
              >
                <p className="text-lg font-bold text-on-surface">{pkg.name}</p>
                <p className="mt-3 text-2xl font-bold text-primary">
                  {fmtPoints(pkg.points + (pkg.bonus_points ?? 0))}
                </p>
                <p className="mt-1 text-xs text-on-surface-variant">
                  기본 {fmtPoints(pkg.points)} / 보너스 {fmtPoints(pkg.bonus_points ?? 0)}
                </p>
                <p className="mt-4 text-lg font-semibold text-on-surface">{fmtKRW(pkg.price)}</p>
                <p className="mt-5 text-sm font-medium text-primary">
                  {selectedPointPackage?.id === pkg.id ? '선택된 상품' : '상품 선택'}
                </p>
              </button>
            ))}
          </div>

          <div className="rounded-2xl border border-outline-variant/15 bg-surface-container-low p-5">
            <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
              <div>
                <p className="text-sm font-bold text-on-surface">선택한 상품</p>
                <p className="mt-2 text-lg font-semibold text-on-surface">
                  {selectedPointPackage ? selectedPointPackage.name : '상품을 선택해 주세요.'}
                </p>
                {selectedPointPackage ? (
                  <p className="mt-1 text-sm text-on-surface-variant">
                    {fmtPoints(selectedPointPackage.points + (selectedPointPackage.bonus_points ?? 0))} /{' '}
                    {fmtKRW(selectedPointPackage.price)}
                  </p>
                ) : (
                  <p className="mt-1 text-sm text-on-surface-variant">
                    먼저 포인트 상품을 선택한 뒤 결제를 진행해 주세요.
                  </p>
                )}
              </div>
              <button
                type="button"
                onClick={() => selectedPointPackage && void handlePointCharge(selectedPointPackage)}
                disabled={!selectedPointPackage || processingKey === `point:${selectedPointPackage.id}`}
                className="h-11 rounded-xl bg-primary px-6 text-sm font-semibold text-white transition-colors hover:bg-primary/90 disabled:opacity-60"
              >
                {selectedPointPackage && processingKey === `point:${selectedPointPackage.id}`
                  ? '결제 진행 중...'
                  : '선택한 상품 결제'}
              </button>
            </div>
          </div>

          <div className="rounded-2xl border border-outline-variant/15 p-5">
            <p className="text-sm font-bold text-on-surface">최근 포인트 이력</p>
            {pointTransactions.length === 0 ? (
              <p className="mt-3 text-sm text-on-surface-variant">아직 포인트 이력이 없습니다.</p>
            ) : (
              <div className="mt-3 space-y-3">
                {pointTransactions.slice(0, 5).map((item) => (
                  <div key={item.id} className="flex items-center justify-between gap-4 text-sm">
                    <div>
                      <p className="font-medium text-on-surface">{item.description}</p>
                      <p className="mt-1 text-xs text-on-surface-variant">
                        {new Date(item.createdAt).toLocaleString('ko-KR')}
                      </p>
                    </div>
                    <div className="text-right">
                      <p className="font-semibold text-on-surface">{fmtPoints(item.amount)}</p>
                      <p className="mt-1 text-xs text-on-surface-variant">잔액 {fmtPoints(item.balanceAfter)}</p>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      ) : null}
    </div>
  )
}
