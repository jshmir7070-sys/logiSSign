'use client'

import { useEffect, useMemo, useState } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { getSubscriptionPrice, type PlanType } from '@/lib/plan-limits'
import {
  EASY_PAY_PROVIDER_OPTIONS,
  PAYMENT_METHOD_OPTIONS,
  VIRTUAL_ACCOUNT_BANK_OPTIONS,
  type AgencyEasyPayProvider,
  type AgencyPaymentMethod,
} from '@/lib/payment-methods'
import type { AdminPaymentSettings } from '@/lib/admin-settings'
import { requestAgencyPayment } from '@/lib/portone-client'
import { createBrowserSupabaseClient } from '@/lib/supabase'

type BillingCycle = 'monthly' | '1year' | '2year'
type PaymentSchedule = 'one_time' | 'recurring'
type SelectablePlan = 'free' | Extract<PlanType, 'basic' | 'standard' | 'pro'>

const PLANS: Array<{
  id: SelectablePlan
  name: string
  description: string
  highlight: string
}> = [
  {
    id: 'free',
    name: 'Free',
    description: '가입 직후 바로 시작할 수 있는 기본 플랜입니다.',
    highlight: '가입 즉시 5,000P 지급',
  },
  {
    id: 'basic',
    name: 'Basic',
    description: '기사 30명 규모에 적합한 기본 운영 플랜입니다.',
    highlight: '전자계약 60건 포함',
  },
  {
    id: 'standard',
    name: 'Standard',
    description: '기사 80명 규모의 정산·알림 운영에 적합합니다.',
    highlight: '전자계약 160건 포함',
  },
  {
    id: 'pro',
    name: 'Pro',
    description: '기사 150명 이상 대량 운영에 적합한 플랜입니다.',
    highlight: '전자계약 300건 포함',
  },
]

const BILLING_OPTIONS: Array<{
  value: BillingCycle
  label: string
  description: string
  discount?: string
}> = [
  { value: 'monthly', label: '월 결제', description: '매월 한 번 결제합니다.' },
  { value: '1year', label: '1년 선결제', description: '1년치 비용을 한 번에 결제합니다.', discount: '20% 할인' },
  { value: '2year', label: '2년 선결제', description: '2년치 비용을 한 번에 결제합니다.', discount: '30% 할인' },
]

function formatKRW(value: number): string {
  return `₩${value.toLocaleString('ko-KR')}`
}

function getBillingLabel(value: BillingCycle): string {
  if (value === 'monthly') return '월 결제'
  if (value === '1year') return '1년 선결제'
  return '2년 선결제'
}

export default function PortalPlanSelectPage() {
  const router = useRouter()
  const [loading, setLoading] = useState(true)
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [agencyId, setAgencyId] = useState<string | null>(null)
  const [companyName, setCompanyName] = useState('')
  const [contactEmail, setContactEmail] = useState('')
  const [selectedPlan, setSelectedPlan] = useState<SelectablePlan>('free')
  const [billing, setBilling] = useState<BillingCycle>('monthly')
  const [paymentSchedule, setPaymentSchedule] = useState<PaymentSchedule>('one_time')
  const [paymentMethod, setPaymentMethod] = useState<AgencyPaymentMethod>('CARD')
  const [easyPayProvider, setEasyPayProvider] = useState<AgencyEasyPayProvider>('KAKAOPAY')
  const [virtualAccountBank, setVirtualAccountBank] = useState('KOOKMIN_BANK')
  const [paymentSettings, setPaymentSettings] = useState<AdminPaymentSettings | null>(null)

  useEffect(() => {
    let mounted = true

    async function load() {
      const supabase = createBrowserSupabaseClient()
      const {
        data: { user },
      } = await supabase.auth.getUser()

      if (!user) {
        router.replace('/portal/login')
        return
      }

      const userRole = (user.app_metadata?.role ?? user.user_metadata?.role) as string | undefined
      const currentAgencyId = user.app_metadata?.agency_id as string | undefined

      if (!currentAgencyId || userRole !== 'agency_admin') {
        await supabase.auth.signOut()
        router.replace('/portal/login')
        return
      }

      const [agencyResult, paymentSettingsResult] = await Promise.all([
        supabase.from('agencies').select('company_name').eq('id', currentAgencyId).maybeSingle(),
        fetch('/api/runtime-settings/payment').then(async (response) => {
          if (!response.ok) return null
          return (await response.json()) as AdminPaymentSettings
        }),
      ])

      if (!mounted) return

      setAgencyId(currentAgencyId)
      setCompanyName((agencyResult.data?.company_name as string | undefined) ?? '')
      setContactEmail(user.email ?? '')
      setPaymentSettings(paymentSettingsResult)

      if (paymentSettingsResult?.enabledMethods?.length) {
        setPaymentMethod((previous) =>
          paymentSettingsResult.enabledMethods.includes(previous)
            ? previous
            : paymentSettingsResult.enabledMethods[0],
        )
      }

      if (paymentSettingsResult?.enabledEasyPayProviders?.length) {
        setEasyPayProvider((previous) =>
          paymentSettingsResult.enabledEasyPayProviders.includes(previous)
            ? previous
            : paymentSettingsResult.enabledEasyPayProviders[0],
        )
      }

      if (paymentSettingsResult?.defaultVirtualAccountBank) {
        setVirtualAccountBank(paymentSettingsResult.defaultVirtualAccountBank)
      }

      setLoading(false)
    }

    void load()

    return () => {
      mounted = false
    }
  }, [router])

  useEffect(() => {
    if (selectedPlan === 'free') {
      setPaymentSchedule('one_time')
    }
  }, [selectedPlan])

  useEffect(() => {
    if (billing !== 'monthly' && paymentSchedule !== 'one_time') {
      setPaymentSchedule('one_time')
    }
  }, [billing, paymentSchedule])

  const isRecurringSubscription = selectedPlan !== 'free' && billing === 'monthly' && paymentSchedule === 'recurring'

  useEffect(() => {
    if (isRecurringSubscription && paymentMethod !== 'CARD') {
      setPaymentMethod('CARD')
    }
  }, [isRecurringSubscription, paymentMethod])

  const enabledMethods = useMemo(() => {
    const configured = paymentSettings?.enabledMethods?.length
      ? PAYMENT_METHOD_OPTIONS.filter((option) => paymentSettings.enabledMethods.includes(option.value))
      : PAYMENT_METHOD_OPTIONS

    return isRecurringSubscription ? configured.filter((option) => option.value === 'CARD') : configured
  }, [isRecurringSubscription, paymentSettings])

  useEffect(() => {
    if (enabledMethods.length === 0) return

    if (!enabledMethods.some((option) => option.value === paymentMethod)) {
      setPaymentMethod(enabledMethods[0].value)
    }
  }, [enabledMethods, paymentMethod])

  const amount = useMemo(() => {
    if (selectedPlan === 'free') return 0
    return getSubscriptionPrice(selectedPlan, billing)
  }, [billing, selectedPlan])

  async function redirectToLogin(notice: string) {
    const supabase = createBrowserSupabaseClient()
    await supabase.auth.signOut()
    router.replace(`/portal/login?notice=${notice}`)
  }

  async function handleContinue() {
    if (!agencyId) return

    if (selectedPlan === 'free') {
      await redirectToLogin('signup-complete')
      return
    }

    if (paymentSettings && !paymentSettings.allowPlanPayments) {
      setError('현재 플랜 결제가 비활성화되어 있습니다. 관리자에게 문의해 주세요.')
      return
    }

    setSubmitting(true)
    setError(null)

    try {
      const paymentId = `plan_${agencyId}_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`
      const paymentResult = await requestAgencyPayment({
        paymentId,
        orderName: `logiSSign ${selectedPlan.toUpperCase()} 플랜`,
        amount,
        method: isRecurringSubscription ? 'CARD' : paymentMethod,
        easyPayProvider:
          !isRecurringSubscription && paymentMethod === 'EASY_PAY' ? easyPayProvider : undefined,
        virtualAccountBankCode:
          !isRecurringSubscription && paymentMethod === 'VIRTUAL_ACCOUNT' ? virtualAccountBank : undefined,
        customer: {
          customerId: agencyId,
          fullName: companyName || 'logiSSign 고객사',
          email: contactEmail,
        },
      })

      const response = await fetch('/api/payment', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'record-plan-payment',
          paymentId: paymentResult.paymentId,
          plan: selectedPlan,
          billing,
          amount,
          paymentMethod: isRecurringSubscription ? 'CARD' : paymentMethod,
          easyPayProvider:
            !isRecurringSubscription && paymentMethod === 'EASY_PAY' ? easyPayProvider : undefined,
          paymentSchedule: isRecurringSubscription ? 'recurring' : 'one_time',
        }),
      })

      const payload = await response.json()
      if (!response.ok) {
        throw new Error(payload.error ?? '플랜 결제를 완료하지 못했습니다.')
      }

      if (payload.status === 'pending') {
        window.alert(
          [
            '가입이 완료되었습니다.',
            '결제가 입금 대기 상태로 등록되었습니다.',
            payload.virtualAccountBank ? `은행: ${payload.virtualAccountBank}` : null,
            payload.virtualAccountNumber ? `가상계좌: ${payload.virtualAccountNumber}` : null,
          ]
            .filter(Boolean)
            .join('\n'),
        )

        await redirectToLogin('signup-payment-pending')
        return
      }

      await redirectToLogin('signup-payment-complete')
    } catch (paymentError) {
      setError(paymentError instanceof Error ? paymentError.message : '플랜 결제 중 오류가 발생했습니다.')
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <div className="min-h-screen bg-surface px-6 py-12">
      <div className="mx-auto max-w-[1100px]">
        <div className="mb-8 text-center">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src="/logo-light.png" alt="logiSSign" className="mx-auto mb-5 w-[260px] object-contain" />
          <h1 className="font-headline text-[30px] font-bold text-on-surface">플랜 선택</h1>
          <p className="mt-2 text-sm text-on-surface-variant">
            회원가입이 완료되었습니다. 이제 무료로 시작하거나 원하는 플랜을 선택해 결제를 진행해 주세요.
          </p>
        </div>

        {loading ? (
          <div className="rounded-3xl bg-surface-container-lowest p-10 text-center text-sm text-on-surface-variant shadow-ambient">
            플랜 정보를 불러오는 중입니다...
          </div>
        ) : (
          <div className="grid gap-6 xl:grid-cols-[1.2fr_0.8fr]">
            <div className="space-y-6 rounded-3xl bg-surface-container-lowest p-7 shadow-ambient">
              <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-4">
                {PLANS.map((plan) => {
                  const monthlyPrice = plan.id === 'free' ? 0 : getSubscriptionPrice(plan.id, 'monthly')

                  return (
                    <button
                      key={plan.id}
                      type="button"
                      onClick={() => setSelectedPlan(plan.id)}
                      className={`rounded-2xl border p-5 text-left transition-colors ${
                        selectedPlan === plan.id ? 'border-primary bg-primary/5' : 'border-outline-variant/20'
                      }`}
                    >
                      <p className="text-base font-bold text-on-surface">{plan.name}</p>
                      <p className="mt-2 text-sm text-on-surface-variant">{plan.description}</p>
                      <p className="mt-4 text-xs font-semibold text-primary">{plan.highlight}</p>
                      <p className="mt-4 text-2xl font-bold text-on-surface">
                        {plan.id === 'free' ? '무료' : formatKRW(monthlyPrice)}
                      </p>
                      {plan.id !== 'free' ? <p className="mt-1 text-xs text-on-surface-variant">월 기준 금액</p> : null}
                    </button>
                  )
                })}
              </div>

              {selectedPlan !== 'free' ? (
                <>
                  <section className="space-y-4 rounded-2xl border border-outline-variant/15 bg-surface-container-low p-5">
                    <p className="text-sm font-semibold text-on-surface">결제 주기</p>
                    <div className="grid gap-3 md:grid-cols-3">
                      {BILLING_OPTIONS.map((option) => (
                        <button
                          key={option.value}
                          type="button"
                          onClick={() => {
                            setBilling(option.value)
                            if (option.value !== 'monthly') {
                              setPaymentSchedule('one_time')
                            }
                          }}
                          className={`rounded-2xl border p-4 text-left ${
                            billing === option.value ? 'border-primary bg-primary/5' : 'border-outline-variant/20'
                          }`}
                        >
                          <p className="text-sm font-semibold text-on-surface">{option.label}</p>
                          <p className="mt-1 text-xs text-on-surface-variant">{option.description}</p>
                          {option.discount ? <p className="mt-3 text-xs font-semibold text-error">{option.discount}</p> : null}
                        </button>
                      ))}
                    </div>

                    {billing === 'monthly' ? (
                      <div className="grid gap-3 md:grid-cols-2">
                        <button
                          type="button"
                          onClick={() => setPaymentSchedule('one_time')}
                          className={`rounded-2xl border p-4 text-left ${
                            paymentSchedule === 'one_time' ? 'border-primary bg-primary/5' : 'border-outline-variant/20'
                          }`}
                        >
                          <p className="text-sm font-semibold text-on-surface">한 달 이용</p>
                          <p className="mt-1 text-xs text-on-surface-variant">
                            카드, 간편결제, 계좌이체, 가상계좌로 한 번만 결제합니다.
                          </p>
                        </button>
                        <button
                          type="button"
                          onClick={() => setPaymentSchedule('recurring')}
                          className={`rounded-2xl border p-4 text-left ${
                            paymentSchedule === 'recurring' ? 'border-primary bg-primary/5' : 'border-outline-variant/20'
                          }`}
                        >
                          <p className="text-sm font-semibold text-on-surface">월 정기구독</p>
                          <p className="mt-1 text-xs text-on-surface-variant">
                            매월 자동 갱신됩니다. 월 정기구독은 카드 결제만 가능합니다.
                          </p>
                        </button>
                      </div>
                    ) : null}
                  </section>

                  <section className="space-y-4 rounded-2xl border border-outline-variant/15 bg-surface-container-low p-5">
                    <p className="text-sm font-semibold text-on-surface">결제 수단</p>
                    <p className="text-xs text-on-surface-variant">
                      {isRecurringSubscription
                        ? '월 정기구독은 카드 결제만 가능합니다.'
                        : '원하는 결제 수단을 선택하면 PortOne 결제 화면으로 이동합니다.'}
                    </p>

                    <div className="grid gap-3 md:grid-cols-2">
                      {enabledMethods.map((option) => (
                        <label
                          key={option.value}
                          className={`rounded-2xl border p-4 ${
                            paymentMethod === option.value ? 'border-primary bg-primary/5' : 'border-outline-variant/20'
                          }`}
                        >
                          <div className="flex items-start gap-3">
                            <input
                              type="radio"
                              name="payment-method"
                              className="mt-1 accent-primary"
                              checked={paymentMethod === option.value}
                              onChange={() => setPaymentMethod(option.value)}
                            />
                            <div>
                              <p className="text-sm font-semibold text-on-surface">{option.label}</p>
                              <p className="mt-1 text-xs text-on-surface-variant">{option.description}</p>
                            </div>
                          </div>
                        </label>
                      ))}
                    </div>

                    {!isRecurringSubscription && paymentMethod === 'EASY_PAY' ? (
                      <div className="grid grid-cols-2 gap-3">
                        {EASY_PAY_PROVIDER_OPTIONS.filter((option) =>
                          paymentSettings?.enabledEasyPayProviders?.length
                            ? paymentSettings.enabledEasyPayProviders.includes(option.value)
                            : true,
                        ).map((option) => (
                          <button
                            key={option.value}
                            type="button"
                            onClick={() => setEasyPayProvider(option.value)}
                            className={`h-10 rounded-xl text-sm font-medium ${
                              easyPayProvider === option.value ? 'bg-primary text-white' : 'bg-surface text-on-surface-variant'
                            }`}
                          >
                            {option.label}
                          </button>
                        ))}
                      </div>
                    ) : null}

                    {!isRecurringSubscription && paymentMethod === 'VIRTUAL_ACCOUNT' ? (
                      <select
                        value={virtualAccountBank}
                        onChange={(event) => setVirtualAccountBank(event.target.value)}
                        className="h-11 w-full rounded-xl bg-surface px-4 text-sm text-on-surface outline-none focus:ring-2 focus:ring-primary/30"
                      >
                        {VIRTUAL_ACCOUNT_BANK_OPTIONS.filter((option) =>
                          paymentSettings?.enabledVirtualAccountBanks?.length
                            ? paymentSettings.enabledVirtualAccountBanks.includes(option.value)
                            : true,
                        ).map((option) => (
                          <option key={option.value} value={option.value}>
                            {option.label}
                          </option>
                        ))}
                      </select>
                    ) : null}
                  </section>
                </>
              ) : null}
            </div>

            <aside className="space-y-6">
              <section className="rounded-3xl bg-surface-container-lowest p-7 shadow-ambient">
                <h2 className="font-headline text-lg font-bold text-on-surface">선택 요약</h2>
                <div className="mt-5 space-y-3 text-sm">
                  <div className="flex items-center justify-between gap-4">
                    <span className="text-on-surface-variant">선택 플랜</span>
                    <span className="font-semibold text-on-surface">
                      {selectedPlan === 'free' ? '무료 시작' : selectedPlan.toUpperCase()}
                    </span>
                  </div>
                  {selectedPlan !== 'free' ? (
                    <>
                      <div className="flex items-center justify-between gap-4">
                        <span className="text-on-surface-variant">결제 주기</span>
                        <span className="font-semibold text-on-surface">{getBillingLabel(billing)}</span>
                      </div>
                      <div className="flex items-center justify-between gap-4">
                        <span className="text-on-surface-variant">이용 방식</span>
                        <span className="font-semibold text-on-surface">
                          {billing === 'monthly' ? (isRecurringSubscription ? '월 정기구독' : '한 달 이용') : '기간권'}
                        </span>
                      </div>
                      <div className="flex items-center justify-between gap-4">
                        <span className="text-on-surface-variant">결제 금액</span>
                        <span className="font-semibold text-on-surface">{formatKRW(amount)}</span>
                      </div>
                    </>
                  ) : (
                    <div className="rounded-2xl bg-primary/5 p-4 text-xs leading-5 text-on-surface-variant">
                      무료 플랜으로 바로 시작할 수 있습니다. 이후 로그인 후 원하는 플랜으로 전환할 수도 있습니다.
                    </div>
                  )}
                </div>
              </section>

              <section className="rounded-3xl bg-surface-container-lowest p-7 shadow-ambient">
                <h2 className="font-headline text-lg font-bold text-on-surface">다음 단계</h2>
                <div className="mt-5 space-y-3 text-sm text-on-surface-variant">
                  <p>1. 원하는 플랜을 선택합니다.</p>
                  <p>2. 무료 시작 또는 결제를 완료합니다.</p>
                  <p>3. 완료 후 로그인 페이지로 이동해 바로 서비스를 시작합니다.</p>
                </div>
              </section>

              {error ? (
                <section className="rounded-3xl border border-error/20 bg-error/5 p-5 text-sm leading-6 text-error">
                  {error}
                </section>
              ) : null}

              <button
                type="button"
                onClick={handleContinue}
                disabled={submitting || loading}
                className="h-12 w-full rounded-2xl bg-power-gradient text-sm font-semibold text-white shadow-ambient disabled:opacity-60"
              >
                {submitting
                  ? '처리 중입니다...'
                  : selectedPlan === 'free'
                    ? '무료로 시작하고 로그인하기'
                    : '결제 후 로그인하기'}
              </button>

              <Link href="/portal/login" className="block text-center text-sm font-medium text-on-surface-variant underline">
                나중에 로그인 페이지로 이동
              </Link>
            </aside>
          </div>
        )}
      </div>
    </div>
  )
}
