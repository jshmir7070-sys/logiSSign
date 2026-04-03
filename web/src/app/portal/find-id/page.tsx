'use client'

import { useState, type FormEvent } from 'react'
import Link from 'next/link'

type Step = 'input' | 'verify' | 'result'

export default function FindIdPage() {
  const [step, setStep] = useState<Step>('input')
  const [name, setName] = useState('')
  const [phone, setPhone] = useState('')
  const [code, setCode] = useState('')
  const [foundEmail, setFoundEmail] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)
  const [countdown, setCountdown] = useState(0)

  // 타이머
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

  // 전화번호 자동 포맷
  const handlePhoneChange = (val: string) => {
    const digits = val.replace(/[^0-9]/g, '').slice(0, 11)
    if (digits.length <= 3) setPhone(digits)
    else if (digits.length <= 7) setPhone(`${digits.slice(0, 3)}-${digits.slice(3)}`)
    else setPhone(`${digits.slice(0, 3)}-${digits.slice(3, 7)}-${digits.slice(7)}`)
  }

  // Step 1: 인증번호 발송
  const handleSendCode = async (e: FormEvent) => {
    e.preventDefault()
    if (!name.trim() || !phone.trim()) { setError('이름과 휴대폰 번호를 입력해주세요.'); return }
    setLoading(true); setError(null)

    try {
      const res = await fetch('/api/auth/find-id', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'send', name: name.trim(), phone: phone.trim() }),
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
    setLoading(true); setError(null)

    try {
      const res = await fetch('/api/auth/find-id', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'verify', name: name.trim(), phone: phone.trim(), code: code.trim() }),
      })
      const data = await res.json()
      if (!res.ok) { setError(data.error || '인증에 실패했습니다.'); setLoading(false); return }
      setFoundEmail(data.email)
      setStep('result')
    } catch { setError('네트워크 오류가 발생했습니다.') }
    setLoading(false)
  }

  const inputCls = 'w-full h-11 px-4 rounded-xl bg-surface-container-low text-on-surface placeholder:text-on-surface-variant/40 focus:outline-none focus:ring-2 focus:ring-primary/30 text-sm font-korean'

  return (
    <div className="min-h-screen bg-surface flex items-center justify-center px-6 py-12">
      <div className="w-full max-w-[420px]">
        {/* 브랜드 */}
        <div className="flex flex-col items-center mb-10">
          <img src="/logo.png" alt="logiSSign" className="w-48 object-contain mb-5" />
          <h1 className="font-headline text-xl font-bold text-on-surface">아이디(이메일) 찾기</h1>
          <p className="font-korean text-sm text-on-surface-variant mt-1">가입 시 등록한 정보로 찾습니다</p>
        </div>

        <div className="bg-surface-container-lowest rounded-2xl shadow-ambient p-8">
          {/* Step 1: 이름 + 전화번호 입력 */}
          {step === 'input' && (
            <form onSubmit={handleSendCode} className="space-y-4">
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
              <button type="submit" disabled={loading || countdown === 0} className="w-full h-11 rounded-xl bg-power-gradient text-white font-medium text-sm shadow-ambient hover:shadow-float transition-all disabled:opacity-60">
                {loading ? '확인 중...' : '인증번호 확인'}
              </button>
              <button type="button" onClick={() => { setStep('input'); setCode(''); setError(null) }} className="w-full text-xs text-on-surface-variant hover:text-primary transition-colors font-korean">
                다시 입력하기
              </button>
            </form>
          )}

          {/* Step 3: 결과 */}
          {step === 'result' && (
            <div className="text-center space-y-5">
              <div className="w-16 h-16 mx-auto rounded-full bg-green-100 flex items-center justify-center">
                <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="#16a34a" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                  <polyline points="20 6 9 17 4 12" />
                </svg>
              </div>
              <div>
                <p className="text-sm text-on-surface-variant font-korean">회원님의 이메일(아이디)은</p>
                <p className="text-lg font-bold text-on-surface font-data mt-1">{foundEmail}</p>
              </div>
              <Link href="/portal/login" className="block w-full h-11 rounded-xl bg-power-gradient text-white font-medium text-sm leading-[44px] text-center shadow-ambient hover:shadow-float transition-all">
                로그인하러 가기
              </Link>
              <Link href="/portal/reset-password" className="block text-xs text-primary hover:underline font-korean">
                비밀번호가 기억나지 않으세요?
              </Link>
            </div>
          )}
        </div>

        {/* 하단 링크 */}
        <div className="flex items-center justify-center gap-4 mt-6">
          <Link href="/portal/login" className="text-xs text-on-surface-variant hover:text-primary transition-colors font-korean">로그인</Link>
          <span className="text-on-surface-variant/30">|</span>
          <Link href="/portal/reset-password" className="text-xs text-on-surface-variant hover:text-primary transition-colors font-korean">비밀번호 초기화</Link>
          <span className="text-on-surface-variant/30">|</span>
          <Link href="/portal/signup" className="text-xs text-primary font-medium hover:underline font-korean">회원가입</Link>
        </div>
      </div>
    </div>
  )
}
