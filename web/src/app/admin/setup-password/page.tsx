'use client'

import { useEffect, useMemo, useState, type FormEvent } from 'react'
import { useRouter } from 'next/navigation'
import {
  DEFAULT_ADMIN_PASSWORD,
  requiresAdminPasswordSetup,
} from '@/lib/admin-password-policy'
import { createBrowserSupabaseClient } from '@/lib/supabase'

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

export default function AdminSetupPasswordPage() {
  const router = useRouter()
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [newPassword, setNewPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [showPassword, setShowPassword] = useState(false)

  const passwordChecks = useMemo(
    () => getPasswordChecks(newPassword, confirmPassword),
    [newPassword, confirmPassword]
  )
  const passwordValid = Object.values(passwordChecks).every(Boolean)

  useEffect(() => {
    const bootstrap = async () => {
      const supabase = createBrowserSupabaseClient()
      const {
        data: { user },
      } = await supabase.auth.getUser()

      if (!user) {
        router.replace('/admin/login')
        return
      }

      const role = (user.app_metadata?.role ?? user.user_metadata?.role) as string | undefined
      if (role !== 'provider_admin') {
        await supabase.auth.signOut()
        router.replace('/admin/login')
        return
      }

      const forcedFromLogin =
        typeof window !== 'undefined' &&
        new URLSearchParams(window.location.search).get('required') === '1'
      if (!forcedFromLogin && !requiresAdminPasswordSetup(user)) {
        router.replace('/admin/dashboard')
        return
      }

      setLoading(false)
    }

    void bootstrap()
  }, [router])

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()

    if (!passwordValid) {
      setError('새 비밀번호 조건을 모두 충족해 주세요.')
      return
    }

    if (newPassword.trim() === DEFAULT_ADMIN_PASSWORD) {
      setError('초기 비밀번호와 다른 새 비밀번호를 입력해 주세요.')
      return
    }

    setSaving(true)
    setError(null)

    const supabase = createBrowserSupabaseClient()
    const {
      data: { user },
    } = await supabase.auth.getUser()

    if (!user) {
      router.replace('/admin/login')
      return
    }

    const { error: updateError } = await supabase.auth.updateUser({
      password: newPassword,
      data: {
        ...(user.user_metadata ?? {}),
        must_change_password: false,
        password_changed_at: new Date().toISOString(),
      },
    })

    if (updateError) {
      setError(updateError.message || '비밀번호 변경 중 오류가 발생했습니다.')
      setSaving(false)
      return
    }

    router.replace('/admin/dashboard')
  }

  if (loading) {
    return (
      <div className="min-h-screen bg-surface-container-lowest flex items-center justify-center">
        <p className="text-sm text-on-surface-variant">관리자 보안 설정을 확인하고 있습니다.</p>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-surface-container-lowest flex items-center justify-center px-6 py-12">
      <div className="w-full max-w-[460px] rounded-[28px] bg-white shadow-float p-8 md:p-10">
        <div className="flex items-center justify-center mb-6">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src="/logo-light.png" alt="logiSSign" className="w-[180px] object-contain" />
        </div>

        <div className="text-center mb-8">
          <span className="inline-flex items-center rounded-full bg-primary/10 px-3 py-1 text-xs font-semibold text-primary">
            관리자 보안 설정
          </span>
          <h1 className="mt-4 font-headline text-2xl font-bold text-on-surface">
            처음 사용하는 비밀번호를 변경해 주세요
          </h1>
          <p className="mt-2 text-sm text-on-surface-variant">
            초기 비밀번호는 보안상 사용할 수 없습니다. 새 비밀번호를 설정하면 바로 관리자 대시보드로
            이동합니다.
          </p>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-2">
            <label className="block text-sm font-medium text-on-surface">새 비밀번호</label>
            <input
              type={showPassword ? 'text' : 'password'}
              value={newPassword}
              onChange={(event) => setNewPassword(event.target.value)}
              className="h-12 w-full rounded-2xl border border-outline-variant/30 bg-surface-container-low px-4 text-sm text-on-surface focus:outline-none focus:ring-2 focus:ring-primary/30"
              placeholder="새 비밀번호 입력"
              autoComplete="new-password"
              required
            />
          </div>

          <div className="space-y-2">
            <label className="block text-sm font-medium text-on-surface">새 비밀번호 확인</label>
            <input
              type={showPassword ? 'text' : 'password'}
              value={confirmPassword}
              onChange={(event) => setConfirmPassword(event.target.value)}
              className="h-12 w-full rounded-2xl border border-outline-variant/30 bg-surface-container-low px-4 text-sm text-on-surface focus:outline-none focus:ring-2 focus:ring-primary/30"
              placeholder="새 비밀번호 다시 입력"
              autoComplete="new-password"
              required
            />
          </div>

          <label className="flex items-center gap-2 text-sm text-on-surface-variant">
            <input
              type="checkbox"
              checked={showPassword}
              onChange={() => setShowPassword((prev) => !prev)}
              className="h-4 w-4 rounded border-outline-variant/50"
            />
            비밀번호 표시
          </label>

          <div className="rounded-2xl bg-surface-container-low px-4 py-3 text-xs text-on-surface-variant space-y-1">
            <p>{passwordChecks.length ? '완료' : '미완료'} · 8자 이상</p>
            <p>{passwordChecks.lower ? '완료' : '미완료'} · 영문 소문자 포함</p>
            <p>{passwordChecks.upper ? '완료' : '미완료'} · 영문 대문자 포함</p>
            <p>{passwordChecks.number ? '완료' : '미완료'} · 숫자 포함</p>
            <p>{passwordChecks.special ? '완료' : '미완료'} · 특수문자 포함</p>
            <p>{passwordChecks.match ? '완료' : '미완료'} · 확인 비밀번호 일치</p>
          </div>

          {error && <p className="text-sm text-error">{error}</p>}

          <button
            type="submit"
            disabled={saving}
            className="h-12 w-full rounded-full bg-sidebar text-sm font-semibold text-white transition-all hover:bg-sidebar/90 disabled:cursor-not-allowed disabled:opacity-60"
          >
            {saving ? '비밀번호 설정 중...' : '비밀번호 설정 완료'}
          </button>
        </form>
      </div>
    </div>
  )
}
