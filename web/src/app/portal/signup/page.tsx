'use client'

import { useEffect, useMemo, useState, type ReactNode } from 'react'
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

type PlanMode = 'free' | 'subscription'
type BillingCycle = 'monthly' | '1year' | '2year'
type PaymentSchedule = 'one_time' | 'recurring'

type FormState = {
  planMode: PlanMode
  plan: PlanType
  billing: BillingCycle
  paymentSchedule: PaymentSchedule
  ownerName: string
  personalAddress: string
  personalAddressDetail: string
  ownerBirthDate: string
  phone: string
  email: string
  emailChecked: boolean
  password: string
  passwordConfirm: string
  identityVerified: boolean
  identityName: string
  identityPhone: string
  companyName: string
  representativeName: string
  businessNumber: string
  address: string
  addressDetail: string
  businessType: string
  businessCategory: string
  businessEmail: string
  agreeTerms: boolean
  agreePrivacy: boolean
  paymentMethod: AgencyPaymentMethod
  easyPayProvider: AgencyEasyPayProvider
  virtualAccountBank: string
}

const PLANS: Array<{ id: Extract<PlanType, 'basic' | 'standard' | 'pro'>; name: string; description: string }> = [
  { id: 'basic', name: 'Basic', description: '기사 30명 규모에 적합한 기본 운영 플랜입니다.' },
  { id: 'standard', name: 'Standard', description: '기사 80명 규모와 정산, 알림 기능이 필요한 운영에 적합합니다.' },
  { id: 'pro', name: 'Pro', description: '기사 150명 이상 조직과 대량 처리에 적합합니다.' },
]

const BILLING_OPTIONS: Array<{ value: BillingCycle; label: string; discount: number; description: string }> = [
  { value: 'monthly', label: '월 결제', discount: 0, description: '매월 1회 정기적으로 결제됩니다.' },
  { value: '1year', label: '1년 선결제', discount: 20, description: '20% 할인 혜택이 적용됩니다.' },
  { value: '2year', label: '2년 선결제', discount: 30, description: '30% 할인 혜택이 적용됩니다.' },
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

function SectionTitle({ children }: { children: ReactNode }) {
  return (
    <h2 className="flex items-center gap-2 border-b border-outline-variant/20 pb-3 text-[15px] font-bold text-on-surface">
      {children}
    </h2>
  )
}

export default function PortalSignupPage() {
  const router = useRouter()
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [emailCheckMsg, setEmailCheckMsg] = useState<string | null>(null)
  const [form, setForm] = useState<FormState>({
    planMode: 'free',
    plan: 'free',
    billing: 'monthly',
    paymentSchedule: 'one_time',
    ownerName: '',
    personalAddress: '',
    personalAddressDetail: '',
    ownerBirthDate: '',
    phone: '',
    email: '',
    emailChecked: false,
    password: '',
    passwordConfirm: '',
    identityVerified: false,
    identityName: '',
    identityPhone: '',
    companyName: '',
    representativeName: '',
    businessNumber: '',
    address: '',
    addressDetail: '',
    businessType: '',
    businessCategory: '',
    businessEmail: '',
    agreeTerms: false,
    agreePrivacy: false,
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
      planMode: requestedMode === 'subscription' || requestedPlan ? 'subscription' : 'free',
      plan:
        requestedPlan && PLANS.some((plan) => plan.id === requestedPlan)
          ? (requestedPlan as PlanType)
          : previous.plan,
      billing:
        requestedBilling === 'monthly' || requestedBilling === '1year' || requestedBilling === '2year'
          ? requestedBilling
          : previous.billing,
      paymentSchedule:
        requestedMode === 'subscription' || requestedPlan ? previous.paymentSchedule : 'one_time',
    }))
  }, [])

  const amount = useMemo(() => {
    if (form.planMode !== 'subscription' || form.plan === 'free') {
      return 0
    }

    return getSubscriptionPrice(form.plan, form.billing)
  }, [form.billing, form.plan, form.planMode])

  const isRecurringSubscription =
    form.planMode === 'subscription' && form.billing === 'monthly' && form.paymentSchedule === 'recurring'

  function updateForm(patch: Partial<FormState>) {
    setForm((previous) => {
      const next = {
        ...previous,
        ...patch,
        ...(patch.email !== undefined ? { emailChecked: false } : {}),
      }

      const nextPlanMode = patch.planMode ?? previous.planMode
      const nextBilling = patch.billing ?? previous.billing
      const nextPaymentSchedule = patch.paymentSchedule ?? previous.paymentSchedule

      if (nextPlanMode === 'subscription' && nextBilling === 'monthly' && nextPaymentSchedule === 'recurring') {
        next.paymentMethod = 'CARD'
      }

      if (patch.planMode === 'free') {
        next.paymentSchedule = 'one_time'
      }

      return next
    })

    if (patch.email !== undefined) {
      setEmailCheckMsg(null)
    }
  }

  async function handleCheckEmail() {
    const email = form.email.trim()
    if (!email) {
      setEmailCheckMsg('이메일을 입력해 주세요.')
      return
    }
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      setEmailCheckMsg('올바른 이메일 형식이 아닙니다.')
      return
    }

    try {
      const response = await fetch('/api/auth/signup', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'check-email', email }),
      })
      const data = await response.json()

      if (data.available) {
        setForm((previous) => ({ ...previous, emailChecked: true }))
        setEmailCheckMsg('사용 가능한 이메일입니다.')
      } else {
        setEmailCheckMsg('이미 가입된 이메일입니다.')
      }
    } catch {
      setEmailCheckMsg('중복 확인 중 오류가 발생했습니다.')
    }
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
    if (!form.ownerName.trim()) return setError('이름을 입력해 주세요.')
    if (!form.phone.trim()) return setError('휴대폰 번호를 입력해 주세요.')
    if (!form.identityVerified) return setError('본인인증을 완료해 주세요.')
    if (!form.email.trim()) return setError('아이디로 사용할 이메일을 입력해 주세요.')
    if (!form.emailChecked) return setError('이메일 중복 확인을 진행해 주세요.')
    if (!form.password || form.password !== form.passwordConfirm) {
      return setError('비밀번호와 비밀번호 확인이 일치해야 합니다.')
    }
    if (!form.companyName.trim()) return setError('상호를 입력해 주세요.')
    if (!form.agreeTerms || !form.agreePrivacy) return setError('필수 약관 동의가 필요합니다.')

    setSubmitting(true)
    setError(null)

    let accountCreated = false
    let loginNotice = 'signup-complete'

    try {
      const signupResponse = await fetch('/api/auth/signup', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          email: form.email,
          password: form.password,
          companyName: form.companyName,
          ownerName: form.representativeName || form.ownerName,
          businessNumber: form.businessNumber,
          ownerBirthDate: form.ownerBirthDate,
          phone: form.phone,
          personalAddress: form.personalAddress,
          personalAddressDetail: form.personalAddressDetail,
          address: form.address,
          addressDetail: form.addressDetail,
          businessType: form.businessType,
          businessCategory: form.businessCategory,
          businessEmail: form.businessEmail,
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

      if (form.planMode === 'subscription' && form.plan !== 'free') {
        const supabase = createBrowserSupabaseClient()
        const signInResult = await supabase.auth.signInWithPassword({
          email: form.email,
          password: form.password,
        })

        if (signInResult.error) {
          throw new Error(`가입은 완료되었지만 결제 준비 중 자동 로그인에 실패했습니다. (${signInResult.error.message})`)
        }

        const paymentResult = await requestAgencyPayment({
          paymentId: `signup_${signupData.agencyId}_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`,
          orderName: `logiSSign ${form.plan.toUpperCase()} 플랜`,
          amount,
          method: isRecurringSubscription ? 'CARD' : form.paymentMethod,
          easyPayProvider:
            !isRecurringSubscription && form.paymentMethod === 'EASY_PAY' ? form.easyPayProvider : undefined,
          virtualAccountBankCode:
            !isRecurringSubscription && form.paymentMethod === 'VIRTUAL_ACCOUNT' ? form.virtualAccountBank : undefined,
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
            paymentMethod: isRecurringSubscription ? 'CARD' : form.paymentMethod,
            easyPayProvider:
              !isRecurringSubscription && form.paymentMethod === 'EASY_PAY' ? form.easyPayProvider : undefined,
            paymentSchedule: isRecurringSubscription ? 'recurring' : 'one_time',
          }),
        })

        const paymentData = await paymentResponse.json()
        if (!paymentResponse.ok) {
          throw new Error(paymentData.error ?? '결제 결과 저장에 실패했습니다.')
        }

        if (paymentData.status === 'pending') {
          loginNotice = 'signup-payment-pending'
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
        } else {
          loginNotice = 'signup-payment-complete'
        }

        await supabase.auth.signOut()
      }

      router.replace(`/portal/login?notice=${loginNotice}`)
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
            개인 정보와 사업자 정보를 입력하고 바로 운영을 시작할 수 있습니다.
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
                onClick={() => updateForm({ planMode: 'free', plan: 'free' })}
                className={`rounded-2xl border-2 p-4 text-left ${
                  form.planMode === 'free' ? 'border-primary bg-primary/5' : 'border-outline-variant/20'
                }`}
              >
                <p className="text-sm font-bold text-on-surface">무료 가입</p>
                <p className="mt-1 text-xs text-on-surface-variant">
                  가입 즉시 5,000P가 무료로 지급됩니다. 이후 필요에 따라 포인트를 충전하거나 구독 플랜으로
                  전환할 수 있습니다.
                </p>
              </button>
              <button
                type="button"
                onClick={() => updateForm({ planMode: 'subscription', plan: 'basic' })}
                className={`rounded-2xl border-2 p-4 text-left ${
                  form.planMode === 'subscription' ? 'border-primary bg-primary/5' : 'border-outline-variant/20'
                }`}
              >
                <p className="text-sm font-bold text-on-surface">구독형 플랜</p>
                <p className="mt-1 text-xs text-on-surface-variant">
                  월 결제는 한 달 이용과 월 정기구독 중에서 선택할 수 있습니다. 월 정기구독만 카드 등록과 자동 갱신을 사용합니다.
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
                      onClick={() =>
                        updateForm({
                          billing: cycle.value,
                          paymentSchedule: cycle.value === 'monthly' ? form.paymentSchedule : 'one_time',
                        })
                      }
                      className={`relative rounded-2xl border p-4 text-left ${
                        form.billing === cycle.value ? 'border-primary bg-primary/5' : 'border-outline-variant/20'
                      }`}
                    >
                      {cycle.discount > 0 ? (
                        <span className="absolute -top-2.5 right-3 rounded-full bg-error px-2.5 py-0.5 text-[11px] font-bold text-white">
                          {cycle.discount}% 할인
                        </span>
                      ) : null}
                      <p className="text-sm font-semibold text-on-surface">{cycle.label}</p>
                      <p className="mt-1 text-xs text-on-surface-variant">{cycle.description}</p>
                    </button>
                  ))}
                </div>
                {form.billing === 'monthly' ? (
                  <div className="grid gap-3 md:grid-cols-2">
                    <button
                      type="button"
                      onClick={() => updateForm({ paymentSchedule: 'one_time' })}
                      className={`rounded-2xl border p-4 text-left ${
                        form.paymentSchedule === 'one_time'
                          ? 'border-primary bg-primary/5'
                          : 'border-outline-variant/20'
                      }`}
                    >
                      <p className="text-sm font-semibold text-on-surface">한 달 이용</p>
                      <p className="mt-1 text-xs text-on-surface-variant">
                        이번 달만 결제하고 이용합니다. 카드, 간편결제, 계좌이체, 가상계좌를 선택할 수 있습니다.
                      </p>
                    </button>
                    <button
                      type="button"
                      onClick={() => updateForm({ paymentSchedule: 'recurring' })}
                      className={`rounded-2xl border p-4 text-left ${
                        form.paymentSchedule === 'recurring'
                          ? 'border-primary bg-primary/5'
                          : 'border-outline-variant/20'
                      }`}
                    >
                      <p className="text-sm font-semibold text-on-surface">월 정기구독</p>
                      <p className="mt-1 text-xs text-on-surface-variant">
                        매달 자동 갱신되는 구독입니다. 월 정기구독은 카드 결제와 카드 등록만 지원합니다.
                      </p>
                    </button>
                  </div>
                ) : null}
              </>
            ) : null}

            <SectionTitle>1. 개인 정보</SectionTitle>

            <input
              className={INPUT_CLASS}
              value={form.ownerName}
              onChange={(event) => updateForm({ ownerName: event.target.value })}
              placeholder="이름 *"
            />

            <AddressSearch
              value={form.personalAddress}
              detailValue={form.personalAddressDetail}
              onChange={(value: AddressValue) =>
                updateForm({ personalAddress: value.address, personalAddressDetail: value.addressDetail })
              }
              label="주소"
            />

            <div className="grid gap-4 md:grid-cols-2">
              <input
                className={INPUT_CLASS}
                value={form.ownerBirthDate}
                onChange={(event) => updateForm({ ownerBirthDate: formatBirthDate(event.target.value) })}
                placeholder="생년월일 (YYMMDD)"
              />
              <input
                className={INPUT_CLASS}
                value={form.phone}
                onChange={(event) => updateForm({ phone: formatPhoneNumber(event.target.value) })}
                placeholder="휴대폰 번호 *"
              />
            </div>

            <div className="rounded-2xl border border-outline-variant/20 p-4">
              <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
                <div>
                  <p className="text-sm font-semibold text-on-surface">본인인증</p>
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

            <div>
              <div className="flex gap-2">
                <input
                  type="email"
                  className={`${INPUT_CLASS} flex-1`}
                  value={form.email}
                  onChange={(event) => updateForm({ email: event.target.value })}
                  placeholder="아이디 이메일 *"
                />
                <button
                  type="button"
                  onClick={handleCheckEmail}
                  className={`h-11 shrink-0 rounded-xl px-4 text-sm font-semibold ${
                    form.emailChecked ? 'bg-tertiary/10 text-tertiary' : 'bg-primary text-white'
                  }`}
                >
                  {form.emailChecked ? '확인됨' : '중복확인'}
                </button>
              </div>
              {emailCheckMsg ? (
                <p
                  className={`mt-1.5 text-xs ${
                    emailCheckMsg.includes('사용 가능한') || emailCheckMsg.includes('확인됨')
                      ? 'text-tertiary'
                      : 'text-error'
                  }`}
                >
                  {emailCheckMsg}
                </p>
              ) : null}
            </div>

            <div className="grid gap-4 md:grid-cols-2">
              <input
                type="password"
                className={INPUT_CLASS}
                value={form.password}
                onChange={(event) => updateForm({ password: event.target.value })}
                placeholder="비밀번호 *"
              />
              <input
                type="password"
                className={INPUT_CLASS}
                value={form.passwordConfirm}
                onChange={(event) => updateForm({ passwordConfirm: event.target.value })}
                placeholder="비밀번호 확인 *"
              />
            </div>

            <SectionTitle>2. 사업자 정보</SectionTitle>

            <div className="grid gap-4 md:grid-cols-2">
              <input
                className={INPUT_CLASS}
                value={form.companyName}
                onChange={(event) => updateForm({ companyName: event.target.value })}
                placeholder="상호 *"
              />
              <input
                className={INPUT_CLASS}
                value={form.representativeName}
                onChange={(event) => updateForm({ representativeName: event.target.value })}
                placeholder="대표자명"
              />
            </div>

            <input
              className={INPUT_CLASS}
              value={form.businessNumber}
              onChange={(event) => updateForm({ businessNumber: formatBusinessNumber(event.target.value) })}
              placeholder="사업자등록번호"
            />

            <AddressSearch
              value={form.address}
              detailValue={form.addressDetail}
              onChange={(value: AddressValue) => updateForm({ address: value.address, addressDetail: value.addressDetail })}
              label="사업장 주소"
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

            <input
              type="email"
              className={INPUT_CLASS}
              value={form.businessEmail}
              onChange={(event) => updateForm({ businessEmail: event.target.value })}
              placeholder="사업자 이메일"
            />

            <SectionTitle>3. 약관 동의</SectionTitle>

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
                <SummaryRow label="가입 방식" value={form.planMode === 'free' ? '무료 가입' : '구독형'} />
                <SummaryRow
                  label="선택 플랜"
                  value={form.planMode === 'free' ? '무료 가입 (5,000P 지급)' : form.plan.toUpperCase()}
                />
                {form.planMode === 'subscription' ? (
                  <>
                    <SummaryRow
                      label="결제 주기"
                      value={
                        form.billing === 'monthly'
                          ? '월 결제'
                          : form.billing === '1year'
                            ? '1년 선결제 (20% 할인)'
                            : '2년 선결제 (30% 할인)'
                      }
                    />
                    <SummaryRow
                      label="이용 방식"
                      value={
                        form.billing === 'monthly'
                          ? isRecurringSubscription
                            ? '월 정기구독'
                            : '한 달 이용'
                          : '기간권 이용'
                      }
                    />
                    {form.billing !== 'monthly' ? (
                      <div className="flex items-center justify-between gap-4 text-sm">
                        <span className="text-on-surface-variant">정가</span>
                        <span className="text-on-surface-variant line-through">
                          {formatKRW(
                            getSubscriptionPrice(form.plan, 'monthly') * (form.billing === '1year' ? 12 : 24),
                          )}
                        </span>
                      </div>
                    ) : null}
                    <SummaryRow label="결제 금액" value={formatKRW(amount)} />
                    {form.billing !== 'monthly' ? (
                      <div className="rounded-xl bg-error/10 px-3 py-2 text-center text-xs font-semibold text-error">
                        {formatKRW(
                          getSubscriptionPrice(form.plan, 'monthly') * (form.billing === '1year' ? 12 : 24) - amount,
                        )}{' '}
                        절약
                      </div>
                    ) : null}
                  </>
                ) : (
                  <div className="rounded-2xl bg-primary/5 p-4 text-xs leading-5 text-on-surface-variant">
                    가입 즉시 <strong>5,000P</strong>가 무료 지급됩니다. 이후 사용량에 따라 포인트를 충전하거나
                    구독 플랜으로 전환해 계속 이용할 수 있습니다.
                  </div>
                )}
              </div>
            </section>

            {form.planMode === 'subscription' ? (
              <section className="space-y-4 rounded-3xl bg-surface-container-lowest p-7 shadow-ambient">
                <h2 className="font-headline text-lg font-bold text-on-surface">결제 수단</h2>
                <div className="rounded-2xl border border-primary/20 bg-primary/5 p-4">
                  <p className="text-sm font-semibold text-on-surface">
                    {isRecurringSubscription ? '월 정기구독은 카드 결제만 가능합니다.' : '결제를 누르면 바로 PortOne 결제 화면으로 이동합니다.'}
                  </p>
                  <p className="mt-1 text-xs text-on-surface-variant">
                    {isRecurringSubscription
                      ? '카드 등록과 변경은 월 정기구독 이용 중에만 가능하며, 자동 갱신은 등록된 카드로 처리됩니다.'
                      : '한 달 이용 또는 기간권은 카드, 간편결제, 계좌이체, 가상계좌 중 원하는 수단으로 결제할 수 있습니다.'}
                  </p>
                </div>
                {isRecurringSubscription ? (
                  <label className="block rounded-2xl border border-primary bg-primary/5 p-4">
                  <div className="flex items-start gap-3">
                    <input type="radio" name="paymentMethod" className="mt-1 accent-primary" checked readOnly />
                    <div>
                      <p className="text-sm font-semibold text-on-surface">결제</p>
                      <p className="mt-1 text-xs text-on-surface-variant">
                        월 정기구독은 카드 등록 후 자동 갱신되는 방식으로 진행됩니다.
                      </p>
                    </div>
                  </div>
                  </label>
                ) : (
                  <>
                    {PAYMENT_METHOD_OPTIONS.map((option) => (
                      <label
                        key={option.value}
                        className={`block rounded-2xl border p-4 ${
                          form.paymentMethod === option.value ? 'border-primary bg-primary/5' : 'border-outline-variant/20'
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
                  </>
                )}
              </section>
            ) : (
              <section className="space-y-4 rounded-3xl bg-surface-container-lowest p-7 shadow-ambient">
                <h2 className="font-headline text-lg font-bold text-on-surface">결제 수단</h2>
                {PAYMENT_METHOD_OPTIONS.map((option) => (
                  <label
                    key={option.value}
                    className={`block rounded-2xl border p-4 ${
                      form.paymentMethod === option.value ? 'border-primary bg-primary/5' : 'border-outline-variant/20'
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
                  ? '결제'
                  : '무료 가입 완료'}
            </button>
          </aside>
        </div>
      </div>
    </div>
  )
}
