'use client'

import { useState, type FormEvent } from 'react'
import Link from 'next/link'

type Step = 'input' | 'verify' | 'newpw' | 'done'

export default function ResetPasswordPage() {
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
        if (prev <= 1) { clearInterval(timer); return 0 }
        return prev - 1
      })
    }, 1000)
  }

  const formatTime = (sec: number) => `${Math.floor(sec / 60)}:${String(sec % 60).padStart(2, '0')}`

  const handlePhoneChange = (val: string) => {
    const digits = val.replace(/[^0-9]/g, '').slice(0, 11)
    if (digits.length <= 3) setPhone(digits)
    else if (digits.length <= 7) setPhone(`${digits.slice(0, 3)}-${digits.slice(3)}`)
    else setPhone(`${digits.slice(0, 3)}-${digits.slice(3, 7)}-${digits.slice(7)}`)
  }

  // 비밀번호 유효성 체크
  const pwChecks = {
    length: newPassword.length >= 8,
    lower: /[a-z]/.test(newPassword),
    upper: /[A-Z]/.test(newPassword),
    number: /[0-9]/.test(newPassword),
    special: /[^a-zA-Z0-9]/.test(newPassword),
    match: newPassword === confirmPassword && confirmPassword.length > 0,
  }
  const pwValid = Object.values(pwChecks).every(Boolean)

  // Step 1: 인증번호 발송
  const handleSendCode = async (e: FormEvent) => {
    e.preventDefault()
    if (!email.trim() || !name.trim() || !phone.trim()) { setError('모든 항목을 입력해주세요.'); return }
    setLoading(true); setError(null)

    try {
      const res = await fetch('/api/auth/reset-password', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'send', email: email.trim(), name: name.trim(), phone: phone.trim() }),
      })
      const data = await res.json()
      if (!res.ok) { setError(data.error || '요청에 실패했습니다.'); setLoading(false); return }
      setStep('verify')
      startCountdown()
    } catch { setError('네트워크 오류가 발생했습니다.') }
    setLoading(false)
  }

  // Step 2: 인증번호 확인
  const handleVerify = async (e: FormEvent) => {
    e.preventDefault()
    if (!code.trim()) { setError('인증번호를 입력해주세요.'); return }
    // 인증 확인만 — 실제 검증은 비밀번호 변경 시 서버에서 수행
    setStep('newpw')
    setError(null)
  }

  // Step 3: 비밀번호 변경
  const handleReset = async (e: FormEvent) => {
    e.preventDefault()
    if (!pwValid) { setError('비밀번호 조건을 모두 충족해야 합니다.'); return }
    setLoading(true); setError(null)

    try {
      const res = await fetch('/api/auth/reset-password', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'reset',
          email: email.trim(),
          name: name.trim(),
          phone: phone.trim(),
          code: code.trim(),
          newPassword,
        }),
      })
      const data = await res.json()
      if (!res.ok) { setError(data.error || '비밀번호 변경에 실패했습니다.'); setLoading(false); return }
      setStep('done')
    } catch { setError('네트워크 오류가 발생했습니다.') }
    setLoading(false)
  }

  const inputCls = 'w-full h-11 px-4 rounded-xl bg-surface-container-low text-on-surface placeholder:text-on-surface-variant/40 focus:outline-none focus:ring-2 focus:ring-primary/30 text-sm font-korean'

  return (
    <div className="min-h-screen bg-surface flex items-center justify-center px-6 py-12">
      <div className="w-full max-w-[420px]">
        {/* 브랜드 */}
        <div className="flex flex-col items-center mb-10">
          <img src="/logo.png" alt="logiSSign" className="w-72 max-w-full object-contain mb-6" />
          <h1 className="font-headline text-xl font-bold text-on-surface">비밀번호 초기화</h1>
          <p className="font-korean text-sm text-on-surface-variant mt-1">본인 확인 후 새 비밀번호를 설정합니다</p>
        </div>

        <div className="bg-surface-container-lowest rounded-2xl shadow-ambient p-8">
          {/* Step 1: 정보 입력 */}
          {step === 'input' && (
            <form onSubmit={handleSendCode} className="space-y-4">
              <div>
                <label className="block text-xs font-medium text-on-surface-variant mb-1.5 font-korean">이메일</label>
                <input type="email" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="example@company.com" className={inputCls} required />
              </div>
              <div>
                <label className="block text-xs font-medium text-on-surface-variant mb-1.5 font-korean">대표자 이름</label>
                <input type="text" value={name} onChange={(e) => setName(e.target.value)} placeholder="홍길동" className={inputCls} required />
              </div>
              <div>
                <label className="block text-xs font-medium text-on-surface-variant mb-1.5 font-korean">휴대폰 번호</label>
                <input type="tel" value={phone} onChange={(e) => handlePhoneChange(e.target.value)} placeholder="010-0000-0000" className={inputCls} required />
              </div>
              {error && <p className="text-error text-xs font-korean">{error}</p>}
              <button type="submit" disabled={loading} className="w-full h-11 rounded-xl bg-power-gradient text-white font-medium text-sm shadow-ambient hover:shadow-float transition-all disabled:opacity-60 mt-2">
                {loading ? '발송 중...' : '인증번호 받기'}
              </button>
            </form>
          )}

          {/* Step 2: 인증번호 입력 */}
          {step === 'verify' && (
            <form onSubmit={handleVerify} className="space-y-4">
              <p className="text-sm text-on-surface-variant font-korean">
                <strong>{phone}</strong>으로 인증번호를 발송했습니다.
              </p>
              <div>
                <label className="block text-xs font-medium text-on-surface-variant mb-1.5 font-korean">
                  인증번호 {countdown > 0 && <span className="text-primary ml-1">{formatTime(countdown)}</span>}
                </label>
                <input type="text" value={code} onChange={(e) => setCode(e.target.value.replace(/[^0-9]/g, '').slice(0, 6))} placeholder="6자리 입력" maxLength={6} className={inputCls} autoFocus required />
              </div>
              {error && <p className="text-error text-xs font-korean">{error}</p>}
              <button type="submit" disabled={loading || countdown === 0 || code.length < 6} className="w-full h-11 rounded-xl bg-power-gradient text-white font-medium text-sm shadow-ambient hover:shadow-float transition-all disabled:opacity-60">
                다음
              </button>
              <button type="button" onClick={() => { setStep('input'); setCode(''); setError(null) }} className="w-full text-xs text-on-surface-variant hover:text-primary transition-colors font-korean">
                다시 입력하기
              </button>
            </form>
          )}

          {/* Step 3: 새 비밀번호 입력 */}
          {step === 'newpw' && (
            <form onSubmit={handleReset} className="space-y-4">
              <h3 className="text-sm font-bold text-on-surface font-korean">새 비밀번호 설정</h3>
              <div>
                <label className="block text-xs font-medium text-on-surface-variant mb-1.5 font-korean">새 비밀번호</label>
                <div className="relative">
                  <input
                    type={showPassword ? 'text' : 'password'}
                    value={newPassword}
                    onChange={(e) => setNewPassword(e.target.value)}
                    placeholder="8자 이상, 대소문자+숫자+특수문자"
                    className={inputCls}
                    required
                  />
                  <button type="button" onClick={() => setShowPassword(!showPassword)} className="absolute right-3 top-1/2 -translate-y-1/2 text-on-surface-variant/50 text-xs font-korean">
                    {showPassword ? '숨기기' : '보기'}
                  </button>
                </div>
              </div>
              <div>
                <label className="block text-xs font-medium text-on-surface-variant mb-1.5 font-korean">비밀번호 확인</label>
                <input type={showPassword ? 'text' : 'password'} value={confirmPassword} onChange={(e) => setConfirmPassword(e.target.value)} placeholder="비밀번호 다시 입력" className={inputCls} required />
              </div>
              {/* 비밀번호 조건 체크 */}
              <div className="grid grid-cols-2 gap-1.5 text-[11px] font-korean">
                {([
                  ['length', '8자 이상'],
                  ['lower', '소문자 포함'],
                  ['upper', '대문자 포함'],
                  ['number', '숫자 포함'],
                  ['special', '특수문자 포함'],
                  ['match', '비밀번호 일치'],
                ] as const).map(([key, label]) => (
                  <div key={key} className={`flex items-center gap-1 ${pwChecks[key] ? 'text-green-600' : 'text-on-surface-variant/40'}`}>
                    {pwChecks[key] ? '✓' : '○'} {label}
                  </div>
                ))}
              </div>
              {error && <p className="text-error text-xs font-korean">{error}</p>}
              <button type="submit" disabled={loading || !pwValid} className="w-full h-11 rounded-xl bg-power-gradient text-white font-medium text-sm shadow-ambient hover:shadow-float transition-all disabled:opacity-60">
                {loading ? '변경 중...' : '비밀번호 변경'}
              </button>
            </form>
          )}

          {/* Step 4: 완료 */}
          {step === 'done' && (
            <div className="text-center space-y-5">
              <div className="w-16 h-16 mx-auto rounded-full bg-green-100 flex items-center justify-center">
                <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="#16a34a" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                  <polyline points="20 6 9 17 4 12" />
                </svg>
              </div>
              <div>
                <p className="text-base font-bold text-on-surface font-korean">비밀번호가 변경되었습니다</p>
                <p className="text-sm text-on-surface-variant font-korean mt-1">새 비밀번호로 로그인해주세요.</p>
              </div>
              <Link href="/portal/login" className="block w-full h-11 rounded-xl bg-power-gradient text-white font-medium text-sm leading-[44px] text-center shadow-ambient hover:shadow-float transition-all">
                로그인하러 가기
              </Link>
            </div>
          )}
        </div>

        {/* 하단 링크 */}
        <div className="flex items-center justify-center gap-4 mt-6">
          <Link href="/portal/login" className="text-xs text-on-surface-variant hover:text-primary transition-colors font-korean">로그인</Link>
          <span className="text-on-surface-variant/30">|</span>
          <Link href="/portal/find-id" className="text-xs text-on-surface-variant hover:text-primary transition-colors font-korean">아이디 찾기</Link>
          <span className="text-on-surface-variant/30">|</span>
          <Link href="/portal/signup" className="text-xs text-primary font-medium hover:underline font-korean">회원가입</Link>
        </div>
      </div>
    </div>
  )
}
