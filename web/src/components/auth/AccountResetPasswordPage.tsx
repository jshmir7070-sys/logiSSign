'use client'

import { useState, type FormEvent } from 'react'
import Link from 'next/link'

type Step = 'input' | 'verify' | 'newpw' | 'done'
type AccountType = 'agency' | 'admin'

export type AccountResetPasswordPageProps = {
  accountType?: AccountType
  title?: string
  description?: string
  loginHref?: string
  findIdHref?: string
  signupHref?: string
}

function formatPhone(phone: string) {
  const digits = phone.replace(/[^0-9]/g, '').slice(0, 11)
  if (digits.length <= 3) return digits
  if (digits.length <= 7) return `${digits.slice(0, 3)}-${digits.slice(3)}`
  return `${digits.slice(0, 3)}-${digits.slice(3, 7)}-${digits.slice(7)}`
}

function getPasswordChecks(password: string, confirmPassword: string) {
  return {
    length: password.length >= 8,
    lower: /[a-z]/.test(password),
    upper: /[A-Z]/.test(password),
    number: /[0-9]/.test(password),
    special: /[^a-zA-Z0-9]/.test(password),
    match: password === confirmPassword && confirmPassword.length > 0,
  }
}

export function AccountResetPasswordPage({
  accountType = 'agency',
  title = '비밀번호 재설정',
  description = '휴대폰 인증 후 새 비밀번호를 설정합니다.',
  loginHref = '/portal/login',
  findIdHref = '/portal/find-id',
  signupHref = '/portal/signup',
}: AccountResetPasswordPageProps) {
  const [step, setStep] = useState<Step>('input')
  const [email, setEmail] = useState('')
  const [name, setName] = useState('')
  const [phone, setPhone] = useState('')
  const [code, setCode] = useState('')
  const [newPassword, setNewPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [showPassword, setShowPassword] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)
  const [countdown, setCountdown] = useState(0)

  const startCountdown = () => {
    setCountdown(300)
    const timer = setInterval(() => {
      setCountdown((prev) => {
        if (prev <= 1) {
          clearInterval(timer)
          return 0
        }
        return prev - 1
      })
    }, 1000)
  }

  const formatTime = (seconds: number) =>
    `${Math.floor(seconds / 60)}:${String(seconds % 60).padStart(2, '0')}`

  const passwordChecks = getPasswordChecks(newPassword, confirmPassword)
  const passwordValid = Object.values(passwordChecks).every(Boolean)

  const inputCls =
    'w-full h-11 px-4 rounded-xl bg-surface-container-low text-on-surface placeholder:text-on-surface-variant/40 focus:outline-none focus:ring-2 focus:ring-primary/30 text-sm font-korean'

  const handleSendCode = async (event: FormEvent) => {
    event.preventDefault()
    if (!email.trim() || !phone.trim()) {
      setError('이메일과 휴대폰 번호를 입력해주세요.')
      return
    }

    setLoading(true)
    setError(null)

    try {
      const response = await fetch('/api/auth/reset-password', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'send',
          accountType,
          email: email.trim(),
          name: name.trim(),
          phone: phone.trim(),
        }),
      })

      const data = await response.json()
      if (!response.ok) {
        setError(data.error || '인증번호 발송에 실패했습니다.')
        return
      }

      setStep('verify')
      startCountdown()
    } catch {
      setError('네트워크 오류가 발생했습니다. 잠시 후 다시 시도해주세요.')
    } finally {
      setLoading(false)
    }
  }

  const handleVerify = async (event: FormEvent) => {
    event.preventDefault()
    if (!code.trim()) {
      setError('인증번호를 입력해주세요.')
      return
    }

    setLoading(true)
    setError(null)

    try {
      const response = await fetch('/api/auth/reset-password', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'verify',
          accountType,
          email: email.trim(),
          name: name.trim(),
          phone: phone.trim(),
          code: code.trim(),
        }),
      })

      const data = await response.json()
      if (!response.ok) {
        setError(data.error || '인증번호 확인에 실패했습니다.')
        return
      }

      setStep('newpw')
    } catch {
      setError('네트워크 오류가 발생했습니다. 잠시 후 다시 시도해주세요.')
    } finally {
      setLoading(false)
    }
  }

  const handleReset = async (event: FormEvent) => {
    event.preventDefault()
    if (!passwordValid) {
      setError('비밀번호 조건을 모두 충족해주세요.')
      return
    }

    setLoading(true)
    setError(null)

    try {
      const response = await fetch('/api/auth/reset-password', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'reset',
          accountType,
          email: email.trim(),
          name: name.trim(),
          phone: phone.trim(),
          newPassword,
        }),
      })

      const data = await response.json()
      if (!response.ok) {
        setError(data.error || '비밀번호 변경에 실패했습니다.')
        return
      }

      setStep('done')
    } catch {
      setError('네트워크 오류가 발생했습니다. 잠시 후 다시 시도해주세요.')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="min-h-screen bg-surface flex items-center justify-center px-6 py-12">
      <div className="w-full max-w-[420px]">
        <div className="flex flex-col items-center mb-10">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src="/logo-light.png" alt="logiSSign" className="w-[240px] object-contain mb-5" />
          <h1 className="font-headline text-xl font-bold text-on-surface">{title}</h1>
          <p className="font-korean text-sm text-on-surface-variant mt-1">{description}</p>
        </div>

        <div className="bg-surface-container-lowest rounded-2xl shadow-ambient p-8">
          {step === 'input' && (
            <form onSubmit={handleSendCode} className="space-y-4">
              <div>
                <label className="block text-xs font-medium text-on-surface-variant mb-1.5 font-korean">
                  이메일
                </label>
                <input
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="example@company.com"
                  className={inputCls}
                  required
                />
              </div>
              <div>
                <label className="block text-xs font-medium text-on-surface-variant mb-1.5 font-korean">
                  이름
                </label>
                <input
                  type="text"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder="이름 입력"
                  className={inputCls}
                />
              </div>
              <div>
                <label className="block text-xs font-medium text-on-surface-variant mb-1.5 font-korean">
                  휴대폰 번호
                </label>
                <input
                  type="tel"
                  value={phone}
                  onChange={(e) => setPhone(formatPhone(e.target.value))}
                  placeholder="010-0000-0000"
                  className={inputCls}
                  required
                />
              </div>
              {error && <p className="text-error text-xs font-korean">{error}</p>}
              <button
                type="submit"
                disabled={loading}
                className="w-full h-11 rounded-xl bg-power-gradient text-white font-medium text-sm shadow-ambient hover:shadow-float transition-all disabled:opacity-60 mt-2"
              >
                {loading ? '발송 중...' : '인증번호 받기'}
              </button>
            </form>
          )}

          {step === 'verify' && (
            <form onSubmit={handleVerify} className="space-y-4">
              <p className="text-sm text-on-surface-variant font-korean">
                <strong>{phone}</strong>으로 인증번호를 발송했습니다.
              </p>
              <div>
                <label className="block text-xs font-medium text-on-surface-variant mb-1.5 font-korean">
                  인증번호
                  {countdown > 0 && <span className="text-primary ml-1">{formatTime(countdown)}</span>}
                </label>
                <input
                  type="text"
                  value={code}
                  onChange={(e) => setCode(e.target.value.replace(/[^0-9]/g, '').slice(0, 6))}
                  placeholder="6자리 인증번호"
                  maxLength={6}
                  className={inputCls}
                  autoFocus
                  required
                />
              </div>
              {error && <p className="text-error text-xs font-korean">{error}</p>}
              <button
                type="submit"
                disabled={loading || countdown === 0 || code.length < 6}
                className="w-full h-11 rounded-xl bg-power-gradient text-white font-medium text-sm shadow-ambient hover:shadow-float transition-all disabled:opacity-60"
              >
                {loading ? '확인 중...' : '휴대폰 인증 완료'}
              </button>
            </form>
          )}

          {step === 'newpw' && (
            <form onSubmit={handleReset} className="space-y-4">
              <h3 className="text-sm font-bold text-on-surface font-korean">새 비밀번호 설정</h3>
              <div>
                <label className="block text-xs font-medium text-on-surface-variant mb-1.5 font-korean">
                  새 비밀번호
                </label>
                <div className="relative">
                  <input
                    type={showPassword ? 'text' : 'password'}
                    value={newPassword}
                    onChange={(e) => setNewPassword(e.target.value)}
                    placeholder="영문 대소문자, 숫자, 특수문자 포함"
                    className={inputCls}
                    required
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword((prev) => !prev)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-on-surface-variant/60 text-xs font-korean"
                  >
                    {showPassword ? '숨기기' : '보기'}
                  </button>
                </div>
              </div>
              <div>
                <label className="block text-xs font-medium text-on-surface-variant mb-1.5 font-korean">
                  비밀번호 재입력
                </label>
                <input
                  type={showPassword ? 'text' : 'password'}
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                  placeholder="비밀번호를 다시 입력해주세요"
                  className={inputCls}
                  required
                />
              </div>
              <div className="grid grid-cols-2 gap-1.5 text-[11px] font-korean">
                {([
                  ['length', '8자 이상'],
                  ['lower', '영문 소문자 포함'],
                  ['upper', '영문 대문자 포함'],
                  ['number', '숫자 포함'],
                  ['special', '특수문자 포함'],
                  ['match', '비밀번호 일치'],
                ] as const).map(([key, label]) => (
                  <div
                    key={key}
                    className={`flex items-center gap-1 ${
                      passwordChecks[key] ? 'text-green-600' : 'text-on-surface-variant/40'
                    }`}
                  >
                    {passwordChecks[key] ? '✓' : '○'} {label}
                  </div>
                ))}
              </div>
              {error && <p className="text-error text-xs font-korean">{error}</p>}
              <button
                type="submit"
                disabled={loading || !passwordValid}
                className="w-full h-11 rounded-xl bg-power-gradient text-white font-medium text-sm shadow-ambient hover:shadow-float transition-all disabled:opacity-60"
              >
                {loading ? '변경 중...' : '비밀번호 변경'}
              </button>
            </form>
          )}

          {step === 'done' && (
            <div className="text-center space-y-5">
              <div className="w-16 h-16 mx-auto rounded-full bg-green-100 flex items-center justify-center">
                <svg
                  width="32"
                  height="32"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="#16a34a"
                  strokeWidth="2.5"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                >
                  <polyline points="20 6 9 17 4 12" />
                </svg>
              </div>
              <div>
                <p className="text-base font-bold text-on-surface font-korean">
                  비밀번호가 변경되었습니다
                </p>
                <p className="text-sm text-on-surface-variant font-korean mt-1">
                  새 비밀번호로 로그인해주세요.
                </p>
              </div>
              <Link
                href={loginHref}
                className="block w-full h-11 rounded-xl bg-power-gradient text-white font-medium text-sm leading-[44px] text-center shadow-ambient hover:shadow-float transition-all"
              >
                로그인하러 가기
              </Link>
            </div>
          )}
        </div>

        <div className="flex items-center justify-center gap-4 mt-6">
          <Link href={loginHref} className="text-xs text-on-surface-variant hover:text-primary transition-colors font-korean">
            로그인
          </Link>
          {findIdHref && (
            <>
              <span className="text-on-surface-variant/30">|</span>
              <Link href={findIdHref} className="text-xs text-on-surface-variant hover:text-primary transition-colors font-korean">
                아이디 찾기
              </Link>
            </>
          )}
          {signupHref && (
            <>
              <span className="text-on-surface-variant/30">|</span>
              <Link href={signupHref} className="text-xs text-primary font-medium hover:underline font-korean">
                회원가입
              </Link>
            </>
          )}
        </div>
      </div>
    </div>
  )
}
