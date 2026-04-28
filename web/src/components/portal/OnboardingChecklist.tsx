'use client'

import Link from 'next/link'
import { useEffect, useState } from 'react'
import {
  type OnboardingProgress,
  type OnboardingStepKey,
  getOnboardingProgress,
} from '@/services/onboarding.service'

interface StepDef {
  key: OnboardingStepKey
  title: string
  description: string
  href: string
  cta: string
}

const STEP_DEFS: StepDef[] = [
  {
    key: 'business_profile',
    title: '사업자 정보 등록',
    description: '사업자등록번호, 대표자명, 사업장 주소를 입력하면 계약서/세금계산서에 자동 반영됩니다.',
    href: '/portal/settings',
    cta: '기본 정보 입력',
  },
  {
    key: 'seal_or_logo',
    title: '로고 또는 도장 등록',
    description: '계약서·정산서 PDF에 들어갈 로고 또는 전자 도장을 등록합니다.',
    href: '/portal/settings',
    cta: '로고/도장 등록',
  },
  {
    key: 'principal',
    title: '거래처 / 정산 기준 등록',
    description: '운송사별 단가와 정산 양식을 등록해야 정산서를 만들 수 있습니다.',
    href: '/portal/principals',
    cta: '거래처 추가',
  },
  {
    key: 'driver',
    title: '기사 1명 이상 등록',
    description: '계약서를 보낼 기사를 등록하거나 초대코드를 공유합니다.',
    href: '/portal/drivers',
    cta: '기사 추가',
  },
  {
    key: 'first_contract',
    title: '첫 계약서·문서 발송',
    description: '템플릿을 만들거나 이미 가진 문서를 기사에게 발송해 보세요.',
    href: '/portal/contracts/new',
    cta: '계약서 발송',
  },
]

const DISMISS_KEY = 'logissign:onboarding_dismissed_v1'

interface OnboardingChecklistProps {
  agencyId: string | null | undefined
}

export default function OnboardingChecklist({ agencyId }: OnboardingChecklistProps) {
  const [progress, setProgress] = useState<OnboardingProgress | null>(null)
  const [dismissed, setDismissed] = useState(false)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    if (typeof window !== 'undefined' && window.localStorage.getItem(DISMISS_KEY) === '1') {
      setDismissed(true)
    }
  }, [])

  useEffect(() => {
    if (!agencyId) {
      setLoading(false)
      return
    }

    let cancelled = false
    getOnboardingProgress(agencyId)
      .then((result) => {
        if (!cancelled) setProgress(result)
      })
      .catch(() => {
        // 조회 실패 시 그냥 숨김 — 대시보드 핵심 동작은 막지 않는다
        if (!cancelled) setProgress(null)
      })
      .finally(() => {
        if (!cancelled) setLoading(false)
      })

    return () => {
      cancelled = true
    }
  }, [agencyId])

  if (loading || !progress || dismissed) return null
  if (progress.allDone) return null

  const handleDismiss = () => {
    setDismissed(true)
    if (typeof window !== 'undefined') {
      window.localStorage.setItem(DISMISS_KEY, '1')
    }
  }

  const stepDoneMap = new Map(progress.steps.map((step) => [step.key, step.done]))
  const completionPct = Math.round((progress.completedCount / progress.totalCount) * 100)
  const nextStep = STEP_DEFS.find((step) => !stepDoneMap.get(step.key))

  return (
    <section className="rounded-2xl bg-surface-container-lowest p-6 shadow-ambient">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <p className="text-xs font-label font-semibold uppercase tracking-[0.18em] text-primary/70 font-korean">
            시작 가이드
          </p>
          <h2 className="mt-1 text-lg font-headline font-bold text-on-surface font-korean">
            로지사인 5단계 셋업
          </h2>
          <p className="mt-1 text-sm text-on-surface-variant font-korean">
            아래 단계를 끝내면 계약, 정산, 세금계산서까지 자동으로 이어집니다.
          </p>
        </div>
        <div className="flex items-center gap-4">
          <div className="text-right">
            <p className="font-data text-2xl font-bold text-primary">
              {progress.completedCount}
              <span className="ml-1 text-sm font-normal text-on-surface-variant">/ {progress.totalCount}</span>
            </p>
            <div className="mt-1 h-1.5 w-32 overflow-hidden rounded-full bg-surface-container">
              <div
                className="h-full rounded-full bg-power-gradient transition-all"
                style={{ width: `${completionPct}%` }}
              />
            </div>
          </div>
          <button
            type="button"
            onClick={handleDismiss}
            className="rounded-lg p-2 text-on-surface-variant transition-colors hover:bg-surface-container-low hover:text-on-surface"
            aria-label="가이드 닫기"
          >
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <line x1="18" y1="6" x2="6" y2="18" />
              <line x1="6" y1="6" x2="18" y2="18" />
            </svg>
          </button>
        </div>
      </div>

      <ol className="mt-5 space-y-2">
        {STEP_DEFS.map((step, index) => {
          const done = stepDoneMap.get(step.key) ?? false
          const isNext = !done && step.key === nextStep?.key

          return (
            <li
              key={step.key}
              className={`flex items-start gap-4 rounded-xl border p-4 transition-colors ${
                done
                  ? 'border-tertiary/20 bg-tertiary/5'
                  : isNext
                    ? 'border-primary/20 bg-primary/5'
                    : 'border-outline-variant/15 bg-surface-container-low/40'
              }`}
            >
              <span
                className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-full text-sm font-data font-bold ${
                  done
                    ? 'bg-tertiary text-white'
                    : isNext
                      ? 'bg-primary text-white'
                      : 'bg-surface-container text-on-surface-variant'
                }`}
              >
                {done ? (
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round">
                    <polyline points="20 6 9 17 4 12" />
                  </svg>
                ) : (
                  index + 1
                )}
              </span>
              <div className="min-w-0 flex-1">
                <p className={`text-sm font-headline font-semibold font-korean ${done ? 'text-tertiary' : 'text-on-surface'}`}>
                  {step.title}
                </p>
                <p className="mt-1 text-xs leading-5 text-on-surface-variant font-korean">{step.description}</p>
              </div>
              {!done && (
                <Link
                  href={step.href}
                  className={`flex h-9 shrink-0 items-center gap-1.5 rounded-lg px-3 text-xs font-label font-semibold transition-colors font-korean ${
                    isNext
                      ? 'bg-primary text-white hover:bg-primary/90'
                      : 'bg-surface-container-low text-on-surface-variant hover:bg-surface-container hover:text-on-surface'
                  }`}
                >
                  {step.cta}
                  <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                    <path d="m9 18 6-6-6-6" />
                  </svg>
                </Link>
              )}
            </li>
          )
        })}
      </ol>
    </section>
  )
}
