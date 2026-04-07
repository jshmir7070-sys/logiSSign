'use client'

import { useEffect, useMemo, useState } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import AddressSearch, { type AddressValue } from '@/components/shared/AddressSearch'
import { formatBirthDate, formatBusinessNumber, formatPhoneNumber } from '@/lib/formatters'
import { getSubscriptionPrice, type PlanType } from '@/lib/plan-limits'
import {
  EASY_PAY_PROVIDER_OPTIONS,
  PAYMENT_METHOD_OPTIONS,
  VIRTUAL_ACCOUNT_BANK_OPTIONS,
  type AgencyEasyPayProvider,
  type AgencyPaymentMethod,
} from '@/lib/payment-methods'
import { requestAgencyPayment } from '@/lib/portone-client'
import { createBrowserSupabaseClient } from '@/lib/supabase'

type PlanMode = 'point' | 'subscription'
type BillingCycle = 'monthly' | '1year' | '2year'

type FormState = {
  planMode: PlanMode
  plan: PlanType
  billing: BillingCycle
  companyName: string
  businessNumber: string
  ownerName: string
  ownerBirthDate: string
  phone: string
  email: string
  address: string
  addressDetail: string
  businessType: string
  businessCategory: string
  bankName: string
  bankAccount: string
  bankHolder: string
  password: string
  passwordConfirm: string
  agreeTerms: boolean
  agreePrivacy: boolean
  identityVerified: boolean
  identityName: string
  identityPhone: string
  paymentMethod: AgencyPaymentMethod
  easyPayProvider: AgencyEasyPayProvider
  virtualAccountBank: string
}

const PLANS: Array<{ id: Extract<PlanType, 'basic' | 'standard' | 'pro'>; name: string; description: string }> = [
  { id: 'basic', name: 'Basic', description: '기사 30명 규모에 적합한 기본 운영 플랜입니다.' },
  { id: 'standard', name: 'Standard', description: '기사 80명 규모와 정산·알림 기능을 함께 운영합니다.' },
  { id: 'pro', name: 'Pro', description: '기사 150명 이상 대량 처리와 확장 운영에 적합합니다.' },
]

const BILLING_OPTIONS: Array<{ value: BillingCycle; label: string; description: string }> = [
  { value: 'monthly', label: '월 결제', description: '매월 1회 정기적으로 결제합니다.' },
  { value: '1year', label: '1년 선결제', description: '1년 단위 선결제로 할인 혜택을 받을 수 있습니다.' },
  { value: '2year', label: '2년 선결제', description: '2년 단위 선결제로 가장 큰 할인 혜택을 받습니다.' },
]

const INPUT_CLASS =
  'w-full h-11 rounded-xl bg-surface-container-low px-4 text-sm text-on-surface placeholder:text-on-surface-variant/50 outline-none focus:ring-2 focus:ring-primary/30'

function formatKRW(value: number): string {
  return `₩${value.toLocaleString('ko-KR')}`
}

function SummaryRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-center justify-between gap-4 text-sm">
      <span className="text-on-surface-variant">{label}</span>
      <span className="font-semibold text-on-surface">{value}</span>
    </div>
  )
}

export default function PortalSignupPage() {
  const router = useRouter()
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [form, setForm] = useState<FormState>({
    planMode: 'point',
    plan: 'free' as PlanType,
    billing: 'monthly',
    companyName: '',
    businessNumber: '',
    ownerName: '',
    ownerBirthDate: '',
    phone: '',
    email: '',
    address: '',
    addressDetail: '',
    businessType: '',
    businessCategory: '',
    bankName: '',
    bankAccount: '',
    bankHolder: '',
    password: '',
    passwordConfirm: '',
    agreeTerms: false,
    agreePrivacy: false,
    identityVerified: false,
    identityName: '',
    identityPhone: '',
    paymentMethod: 'CARD',
    easyPayProvider: 'KAKAOPAY',
    virtualAccountBank: 'KOOKMIN_BANK',
  })

  useEffect(() => {
    if (typeof window === 'undefined') return

    const params = new URLSearchParams(window.location.search)
    const requestedPlan = params.get('plan')
    const requestedMode = params.get('mode')
    const requestedBilling = params.get('billing')

    setForm((previous) => ({
      ...previous,
      planMode: requestedMode === 'subscription' || requestedPlan ? 'subscription' : previous.planMode,
      plan:
        requestedPlan && PLANS.some((plan) => plan.id === requestedPlan)
          ? (requestedPlan as PlanType)
          : previous.plan,
      billing:
        requestedBilling === 'monthly' || requestedBilling === '1year' || requestedBilling === '2year'
          ? requestedBilling
          : previous.billing,
      paymentMethod:
        requestedMode === 'subscription' || requestedPlan ? 'CARD' : previous.paymentMethod,
    }))
  }, [])

  const amount = useMemo(() => {
    if (form.planMode !== 'subscription' || form.plan === 'point' || form.plan === 'free') {
      return 0
    }
    return getSubscriptionPrice(form.plan, form.billing)
  }, [form.billing, form.plan, form.planMode])

  const availablePointPaymentMethods = PAYMENT_METHOD_OPTIONS.filter((option) => option.value !== 'CARD' || true)

  function updateForm(patch: Partial<FormState>) {
    setForm((previous) => ({
      ...previous,
      ...patch,
      ...(patch.planMode === 'subscription' ? { paymentMethod: 'CARD' as AgencyPaymentMethod } : {}),
    }))
  }

  async function handleVerifyIdentity() {
    setError(null)

    const storeId = process.env.NEXT_PUBLIC_PORTONE_STORE_ID
    const channelKey = process.env.NEXT_PUBLIC_PORTONE_CHANNEL_KEY

    if (!storeId || !channelKey) {
      setError('PortOne 본인인증 설정이 누락되었습니다. 관리자에게 문의해 주세요.')
      return
    }

    try {
      const PortOne = await import('@portone/browser-sdk/v2')
      const identityVerificationId = `identity_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`

      const result = await PortOne.requestIdentityVerification({
        storeId,
        channelKey,
        identityVerificationId,
      })

      if (!result || result.code) {
        throw new Error(result?.message ?? '본인인증이 취소되었습니다.')
      }

      const response = await fetch('/api/payment', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'verify-identity', identityVerificationId }),
      })
      const data = await response.json()

      if (!response.ok || !data.verified) {
        throw new Error(data.error ?? '본인인증 결과를 확인하지 못했습니다.')
      }

      updateForm({
        identityVerified: true,
        identityName: data.name ?? '',
        identityPhone: data.phone ?? '',
        ownerName: data.name || form.ownerName,
        phone: data.phone || form.phone,
      })
    } catch (verificationError) {
      setError(
        verificationError instanceof Error
          ? verificationError.message
          : '본인인증 처리 중 오류가 발생했습니다.',
      )
    }
  }

  async function handleSubmit() {
    if (!form.companyName.trim()) return setError('운송사명을 입력해 주세요.')
    if (!form.ownerName.trim()) return setError('대표자명을 입력해 주세요.')
    if (!form.email.trim()) return setError('로그인 이메일을 입력해 주세요.')
    if (!form.identityVerified) return setError('본인인증을 완료해 주세요.')
    if (!form.agreeTerms || !form.agreePrivacy) return setError('필수 약관 동의가 필요합니다.')
    if (!form.password || form.password !== form.passwordConfirm) {
      return setError('비밀번호와 비밀번호 확인이 일치해야 합니다.')
    }

    setSubmitting(true)
    setError(null)

    let accountCreated = false

    try {
      const signupResponse = await fetch('/api/auth/signup', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          email: form.email,
          password: form.password,
          companyName: form.companyName,
          ownerName: form.ownerName,
          businessNumber: form.businessNumber,
          ownerBirthDate: form.ownerBirthDate,
          phone: form.phone,
          address: form.address,
          addressDetail: form.addressDetail,
          businessType: form.businessType,
          businessCategory: form.businessCategory,
          bankName: form.bankName,
          bankAccount: form.bankAccount,
          bankHolder: form.bankHolder,
          planMode: form.planMode,
          plan: form.plan,
          billing: form.billing,
        }),
      })

      const signupData = await signupResponse.json()
      if (!signupResponse.ok) {
        throw new Error(signupData.error ?? '회원가입을 완료하지 못했습니다.')
      }

      accountCreated = true

      const supabase = createBrowserSupabaseClient()
      const signInResult = await supabase.auth.signInWithPassword({
        email: form.email,
        password: form.password,
      })

      if (signInResult.error) {
        throw new Error(`가입은 완료되었지만 자동 로그인에 실패했습니다. (${signInResult.error.message})`)
      }

      if (form.planMode === 'subscription' && form.plan !== 'point' && form.plan !== 'free') {
        const paymentResult = await requestAgencyPayment({
          paymentId: `signup_${signupData.agencyId}_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`,
          orderName: `logiSSign ${form.plan.toUpperCase()} 플랜`,
          amount,
          method: 'CARD',
          redirectUrl: `${window.location.origin}/portal/settings?tab=billing`,
          customer: {
            customerId: signupData.agencyId,
            fullName: form.companyName,
            email: form.email,
            phoneNumber: form.phone,
          },
        })

        const paymentResponse = await fetch('/api/payment', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            action: 'record-plan-payment',
            paymentId: paymentResult.paymentId,
            plan: form.plan,
            billing: form.billing,
            amount,
            paymentMethod: 'CARD',
          }),
        })

        const paymentData = await paymentResponse.json()
        if (!paymentResponse.ok) {
          throw new Error(paymentData.error ?? '결제 결과 저장에 실패했습니다.')
        }

        if (paymentData.status === 'pending') {
          alert(
            [
              '가입이 완료되었습니다.',
              '결제가 입금 대기 상태로 등록되었습니다.',
              paymentData.virtualAccountBank ? `은행: ${paymentData.virtualAccountBank}` : null,
              paymentData.virtualAccountNumber ? `가상계좌: ${paymentData.virtualAccountNumber}` : null,
            ]
              .filter(Boolean)
              .join('\n'),
          )
        }
      }

      router.replace('/portal/dashboard')
    } catch (submitError) {
      const message =
        submitError instanceof Error ? submitError.message : '가입 처리 중 오류가 발생했습니다.'
      setError(
        accountCreated
          ? `${message}\n계정은 생성되었으니 로그인 후 설정 > 결제 관리에서 이어서 진행해 주세요.`
          : message,
      )
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <div className="min-h-screen bg-surface px-6 py-12">
      <div className="mx-auto max-w-[980px]">
        <div className="mb-8 text-center">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src="/logo-light.png" alt="logiSSign" className="mx-auto mb-5 w-[260px] object-contain" />
          <h1 className="font-headline text-[30px] font-bold text-on-surface">운영사 회원가입</h1>
          <p className="mt-2 text-sm text-on-surface-variant">
            사업자 정보, 본인인증, 결제를 한 번에 마치고 바로 운영을 시작할 수 있습니다.
          </p>
          <p className="mt-3 text-sm text-on-surface-variant">
            이미 계정이 있다면{' '}
            <Link href="/portal/login" className="text-primary underline">
              로그인
            </Link>
            을 이용해 주세요.
          </p>
        </div>

        <div className="grid gap-6 xl:grid-cols-[1.15fr_0.85fr]">
          <div className="space-y-6 rounded-3xl bg-surface-container-lowest p-7 shadow-ambient">
            <div className="grid gap-3 md:grid-cols-2">
              <button
                type="button"
                onClick={() => updateForm({ planMode: 'point', plan: 'point' })}
                className={`rounded-2xl border-2 p-4 text-left ${
                  form.planMode === 'point' ? 'border-primary bg-primary/5' : 'border-outline-variant/20'
                }`}
              >
                <p className="text-sm font-bold text-on-surface">무료가입</p>
                <p className="mt-1 text-xs text-on-surface-variant">
                  가입 즉시 5,000P 무료 지급! 포인트 소진 후 충전 또는 구독 전환 가능합니다.
                </p>
              </button>
              <button
                type="button"
                onClick={() => updateForm({ planMode: 'subscription', plan: 'basic' })}
                className={`rounded-2xl border-2 p-4 text-left ${
                  form.planMode === 'subscription'
                    ? 'border-primary bg-primary/5'
                    : 'border-outline-variant/20'
                }`}
              >
                <p className="text-sm font-bold text-on-surface">구독형 플랜</p>
                <p className="mt-1 text-xs text-on-surface-variant">
                  구독형 플랜은 카드 결제만 사용할 수 있으며, 카드 등록/변경도 구독형에서만 가능합니다.
                </p>
              </button>
            </div>

            {form.planMode === 'subscription' ? (
              <>
                <div className="grid gap-3 md:grid-cols-3">
                  {PLANS.map((plan) => (
                    <button
                      key={plan.id}
                      type="button"
                      onClick={() => updateForm({ plan: plan.id })}
                      className={`rounded-2xl border p-4 text-left ${
                        form.plan === plan.id ? 'border-primary bg-primary/5' : 'border-outline-variant/20'
                      }`}
                    >
                      <p className="text-sm font-bold text-on-surface">{plan.name}</p>
                      <p className="mt-1 text-xs text-on-surface-variant">{plan.description}</p>
                      <p className="mt-3 text-lg font-bold text-primary">
                        {formatKRW(getSubscriptionPrice(plan.id, 'monthly'))}
                        <span className="ml-1 text-xs font-normal text-on-surface-variant">/월</span>
                      </p>
                    </button>
                  ))}
                </div>

                <div className="grid gap-3 md:grid-cols-3">
                  {BILLING_OPTIONS.map((cycle) => (
                    <button
                      key={cycle.value}
                      type="button"
                      onClick={() => updateForm({ billing: cycle.value })}
                      className={`rounded-2xl border p-4 text-left ${
                        form.billing === cycle.value ? 'border-primary bg-primary/5' : 'border-outline-variant/20'
                      }`}
                    >
                      <p className="text-sm font-semibold text-on-surface">{cycle.label}</p>
                      <p className="mt-1 text-xs text-on-surface-variant">{cycle.description}</p>
                    </button>
                  ))}
                </div>
              </>
            ) : null}

            <div className="grid gap-4 md:grid-cols-2">
              <input
                className={INPUT_CLASS}
                value={form.companyName}
                onChange={(event) => updateForm({ companyName: event.target.value })}
                placeholder="운송사명"
              />
              <input
                className={INPUT_CLASS}
                value={form.businessNumber}
                onChange={(event) => updateForm({ businessNumber: formatBusinessNumber(event.target.value) })}
                placeholder="사업자등록번호"
              />
              <input
                className={INPUT_CLASS}
                value={form.ownerName}
                onChange={(event) => updateForm({ ownerName: event.target.value })}
                placeholder="대표자명"
              />
              <input
                className={INPUT_CLASS}
                value={form.ownerBirthDate}
                onChange={(event) => updateForm({ ownerBirthDate: formatBirthDate(event.target.value) })}
                placeholder="대표자 생년월일"
              />
              <input
                className={INPUT_CLASS}
                value={form.phone}
                onChange={(event) => updateForm({ phone: formatPhoneNumber(event.target.value) })}
                placeholder="대표 연락처"
              />
              <input
                type="email"
                className={INPUT_CLASS}
                value={form.email}
                onChange={(event) => updateForm({ email: event.target.value })}
                placeholder="로그인 이메일"
              />
            </div>

            <AddressSearch
              value={form.address}
              detailValue={form.addressDetail}
              onChange={(value: AddressValue) =>
                updateForm({ address: value.address, addressDetail: value.addressDetail })
              }
              label="사업장 주소"
              required
            />

            <div className="grid gap-4 md:grid-cols-2">
              <input
                className={INPUT_CLASS}
                value={form.businessType}
                onChange={(event) => updateForm({ businessType: event.target.value })}
                placeholder="업태"
              />
              <input
                className={INPUT_CLASS}
                value={form.businessCategory}
                onChange={(event) => updateForm({ businessCategory: event.target.value })}
                placeholder="업종"
              />
            </div>

            <div className="grid gap-4 md:grid-cols-2">
              <input
                type="password"
                className={INPUT_CLASS}
                value={form.password}
                onChange={(event) => updateForm({ password: event.target.value })}
                placeholder="비밀번호"
              />
              <input
                type="password"
                className={INPUT_CLASS}
                value={form.passwordConfirm}
                onChange={(event) => updateForm({ passwordConfirm: event.target.value })}
                placeholder="비밀번호 확인"
              />
            </div>

            <div className="rounded-2xl border border-outline-variant/20 p-4">
              <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
                <div>
                  <p className="text-sm font-semibold text-on-surface">대표자 본인인증</p>
                  <p className="mt-1 text-xs text-on-surface-variant">
                    {form.identityVerified
                      ? `${form.identityName} / ${form.identityPhone}`
                      : '가입 전에 본인인증을 먼저 완료해 주세요.'}
                  </p>
                </div>
                <button
                  type="button"
                  onClick={handleVerifyIdentity}
                  className={`h-10 rounded-xl px-5 text-sm font-semibold ${
                    form.identityVerified ? 'bg-tertiary/10 text-tertiary' : 'bg-power-gradient text-white'
                  }`}
                >
                  {form.identityVerified ? '인증 완료' : '본인인증 진행'}
                </button>
              </div>
            </div>

            <label className="flex items-center gap-2 text-sm text-on-surface-variant">
              <input
                type="checkbox"
                checked={form.agreeTerms}
                onChange={(event) => updateForm({ agreeTerms: event.target.checked })}
                className="h-4 w-4 accent-primary"
              />
              <span>
                <Link href="/terms" target="_blank" className="text-primary underline">
                  이용약관
                </Link>
                에 동의합니다. (필수)
              </span>
            </label>
            <label className="flex items-center gap-2 text-sm text-on-surface-variant">
              <input
                type="checkbox"
                checked={form.agreePrivacy}
                onChange={(event) => updateForm({ agreePrivacy: event.target.checked })}
                className="h-4 w-4 accent-primary"
              />
              <span>
                <Link href="/privacy" target="_blank" className="text-primary underline">
                  개인정보처리방침
                </Link>
                에 동의합니다. (필수)
              </span>
            </label>
          </div>

          <aside className="space-y-6">
            <section className="rounded-3xl bg-surface-container-lowest p-7 shadow-ambient">
              <h2 className="font-headline text-lg font-bold text-on-surface">가입 요약</h2>
              <div className="mt-5 space-y-3">
                <SummaryRow label="가입 방식" value={form.planMode === 'point' ? '무료가입' : '구독형'} />
                <SummaryRow
                  label="선택 플랜"
                  value={form.planMode === 'point' ? '무료가입 (5,000P 지급)' : form.plan.toUpperCase()}
                />
                {form.planMode === 'subscription' ? (
                  <>
                    <SummaryRow
                      label="결제 주기"
                      value={
                        form.billing === 'monthly'
                          ? '월 결제'
                          : form.billing === '1year'
                            ? '1년 선결제'
                            : '2년 선결제'
                      }
                    />
                    <SummaryRow label="결제 금액" value={formatKRW(amount)} />
                  </>
                ) : (
                  <div className="rounded-2xl bg-primary/5 p-4 text-xs leading-5 text-on-surface-variant">
                    가입 즉시 <strong>5,000P</strong>가 무료 지급됩니다. 포인트 소진 후 포인트 충전 또는 구독 플랜으로 전환하여 계속 이용할 수 있습니다.
                  </div>
                )}
              </div>
            </section>

            {form.planMode === 'subscription' ? (
              <section className="space-y-4 rounded-3xl bg-surface-container-lowest p-7 shadow-ambient">
                <h2 className="font-headline text-lg font-bold text-on-surface">결제 수단</h2>
                <div className="rounded-2xl border border-primary/20 bg-primary/5 p-4">
                  <p className="text-sm font-semibold text-on-surface">구독형은 카드 결제만 가능합니다.</p>
                  <p className="mt-1 text-xs text-on-surface-variant">
                    카드 등록/변경도 구독형 플랜 이용 시에만 가능하며, 다른 결제수단은 가입 시 노출되지 않습니다.
                  </p>
                </div>
                <label className="block rounded-2xl border border-primary bg-primary/5 p-4">
                  <div className="flex items-start gap-3">
                    <input type="radio" name="paymentMethod" className="mt-1 accent-primary" checked readOnly />
                    <div>
                      <p className="text-sm font-semibold text-on-surface">카드 일시불</p>
                      <p className="mt-1 text-xs text-on-surface-variant">
                        최초 가입 결제는 카드 승인으로 진행되며, 이후 카드 등록 상태에 따라 만료 전 갱신을 안내합니다.
                      </p>
                    </div>
                  </div>
                </label>
              </section>
            ) : (
              <section className="space-y-4 rounded-3xl bg-surface-container-lowest p-7 shadow-ambient">
                <h2 className="font-headline text-lg font-bold text-on-surface">결제 수단</h2>
                {availablePointPaymentMethods.map((option) => (
                  <label
                    key={option.value}
                    className={`block rounded-2xl border p-4 ${
                      form.paymentMethod === option.value
                        ? 'border-primary bg-primary/5'
                        : 'border-outline-variant/20'
                    }`}
                  >
                    <div className="flex items-start gap-3">
                      <input
                        type="radio"
                        name="paymentMethod"
                        className="mt-1 accent-primary"
                        checked={form.paymentMethod === option.value}
                        onChange={() => updateForm({ paymentMethod: option.value })}
                      />
                      <div>
                        <p className="text-sm font-semibold text-on-surface">{option.label}</p>
                        <p className="mt-1 text-xs text-on-surface-variant">{option.description}</p>
                      </div>
                    </div>
                  </label>
                ))}

                {form.paymentMethod === 'EASY_PAY' ? (
                  <div className="grid grid-cols-2 gap-3">
                    {EASY_PAY_PROVIDER_OPTIONS.map((option) => (
                      <button
                        key={option.value}
                        type="button"
                        onClick={() => updateForm({ easyPayProvider: option.value })}
                        className={`h-10 rounded-xl text-sm font-medium ${
                          form.easyPayProvider === option.value
                            ? 'bg-primary text-white'
                            : 'bg-surface-container-low text-on-surface-variant'
                        }`}
                      >
                        {option.label}
                      </button>
                    ))}
                  </div>
                ) : null}

                {form.paymentMethod === 'VIRTUAL_ACCOUNT' ? (
                  <select
                    value={form.virtualAccountBank}
                    onChange={(event) => updateForm({ virtualAccountBank: event.target.value })}
                    className={INPUT_CLASS}
                  >
                    {VIRTUAL_ACCOUNT_BANK_OPTIONS.map((option) => (
                      <option key={option.value} value={option.value}>
                        {option.label}
                      </option>
                    ))}
                  </select>
                ) : null}
              </section>
            )}

            {error ? (
              <section className="whitespace-pre-line rounded-3xl border border-error/20 bg-error/5 p-5 text-sm leading-6 text-error">
                {error}
              </section>
            ) : null}

            <button
              type="button"
              onClick={handleSubmit}
              disabled={submitting}
              className="h-12 w-full rounded-2xl bg-power-gradient text-sm font-semibold text-white shadow-ambient disabled:opacity-60"
            >
              {submitting
                ? '처리 중입니다...'
                : form.planMode === 'subscription'
                  ? '가입 및 결제 진행'
                  : '무료 가입 완료'}
            </button>
          </aside>
        </div>
      </div>
    </div>
  )
}
