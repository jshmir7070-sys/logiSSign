'use client'

import { useState, type ReactNode } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import AddressSearch, { type AddressValue } from '@/components/shared/AddressSearch'
import { formatBirthDate, formatBusinessNumber, formatPhoneNumber } from '@/lib/formatters'
import { createBrowserSupabaseClient } from '@/lib/supabase'

type FormState = {
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
}

const INPUT_CLASS =
  'w-full h-11 rounded-xl bg-surface-container-low px-4 text-sm text-on-surface placeholder:text-on-surface-variant/50 outline-none focus:ring-2 focus:ring-primary/30'

function SectionTitle({ children }: { children: ReactNode }) {
  return (
    <h2 className="flex items-center gap-2 border-b border-outline-variant/20 pb-3 text-[15px] font-bold text-on-surface">
      {children}
    </h2>
  )
}

function GuideItem({ index, title, description }: { index: string; title: string; description: string }) {
  return (
    <div className="flex gap-3 rounded-2xl border border-outline-variant/15 bg-surface-container-low p-4">
      <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-primary/10 text-xs font-bold text-primary">
        {index}
      </div>
      <div>
        <p className="text-sm font-semibold text-on-surface">{title}</p>
        <p className="mt-1 text-xs leading-5 text-on-surface-variant">{description}</p>
      </div>
    </div>
  )
}

export default function PortalSignupPage() {
  const router = useRouter()
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [emailCheckMsg, setEmailCheckMsg] = useState<string | null>(null)
  const [form, setForm] = useState<FormState>({
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
  })

  function updateForm(patch: Partial<FormState>) {
    setForm((previous) => ({
      ...previous,
      ...patch,
      ...(patch.email !== undefined ? { emailChecked: false } : {}),
    }))

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
          planMode: 'free',
          plan: 'free',
          billing: 'monthly',
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

      router.replace('/portal/plan-select')
    } catch (submitError) {
      const message =
        submitError instanceof Error ? submitError.message : '가입 처리 중 오류가 발생했습니다.'

      setError(
        accountCreated
          ? `${message}\n계정은 생성되었으니 로그인 후 플랜을 선택해 주세요.`
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
            계정을 만든 뒤 다음 단계에서 무료 시작 또는 유료 플랜을 선택할 수 있습니다.
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
                    emailCheckMsg.includes('사용 가능한') ? 'text-tertiary' : 'text-error'
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
              <h2 className="font-headline text-lg font-bold text-on-surface">가입 후 진행 순서</h2>
              <div className="mt-5 space-y-3">
                <GuideItem
                  index="1"
                  title="운영사 계정 생성"
                  description="개인 정보와 사업자 정보를 입력하고 본인인증을 완료해 계정을 만듭니다."
                />
                <GuideItem
                  index="2"
                  title="플랜 선택"
                  description="가입 직후 별도 페이지에서 무료 시작 또는 유료 플랜 결제를 선택합니다."
                />
                <GuideItem
                  index="3"
                  title="로그인 후 시작"
                  description="플랜 선택이 끝나면 로그인 페이지로 이동하며, 로그인 후 바로 운영을 시작할 수 있습니다."
                />
              </div>
            </section>

            <section className="rounded-3xl bg-surface-container-lowest p-7 shadow-ambient">
              <h2 className="font-headline text-lg font-bold text-on-surface">안내</h2>
              <div className="mt-5 rounded-2xl bg-primary/5 p-4 text-sm leading-6 text-on-surface-variant">
                회원가입만 먼저 완료하고, 다음 단계에서 무료 플랜 또는 유료 플랜을 선택하게 됩니다.
                결제는 가입 페이지가 아니라 별도 플랜 선택 페이지에서 진행됩니다.
              </div>
            </section>

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
              {submitting ? '처리 중입니다...' : '가입 완료 후 플랜 선택'}
            </button>
          </aside>
        </div>
      </div>
    </div>
  )
}
