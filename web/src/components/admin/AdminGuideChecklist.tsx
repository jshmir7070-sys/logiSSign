'use client'

import { useEffect, useMemo, useState } from 'react'
import Link from 'next/link'

type GuideStep = {
  id: string
  title: string
  description: string
  href: string
  cta: string
}

type GuideSection = {
  id: string
  title: string
  summary: string
  steps: GuideStep[]
}

type ChecklistState = Record<string, boolean>

const guideSections: GuideSection[] = [
  {
    id: 'daily',
    title: '매일 확인하면 좋은 운영 순서',
    summary:
      '관리자 프로그램은 고객사의 업무를 대신 처리하기보다 서비스가 안정적으로 사용되고 있는지 확인하고 빠르게 지원하는 역할에 맞춰 구성되어 있습니다.',
    steps: [
      {
        id: 'daily-billing',
        title: '결제 상태 먼저 확인',
        description:
          '결제 관리에서 최근 주문, 입금 대기, 실패 내역을 확인해 즉시 안내가 필요한 고객사가 있는지 먼저 점검합니다.',
        href: '/admin/billing',
        cta: '결제 관리 열기',
      },
      {
        id: 'daily-agencies',
        title: '고객사와 소속 기사 현황 점검',
        description:
          '고객사 관리와 기사 현황 화면에서 연결 상태, 최근 활동, 누락 여부를 함께 확인해 초기 설정 문제를 빠르게 찾습니다.',
        href: '/admin/agencies',
        cta: '고객사 관리 보기',
      },
      {
        id: 'daily-server',
        title: '서버 상태와 오류 이슈 점검',
        description:
          '서버 상태 화면에서 DB, Storage, Auth, Sentry 상태를 확인해 전체 서비스 이슈인지 특정 고객사 이슈인지 먼저 구분합니다.',
        href: '/admin/server',
        cta: '서버 상태 보기',
      },
    ],
  },
  {
    id: 'onboarding',
    title: '신규 고객사 지원 순서',
    summary:
      '신규 고객사는 가입, 플랜 선택, 기사 등록, 계약 발송, 정산 시작 순서로 안내하면 가장 빠르게 안착합니다.',
    steps: [
      {
        id: 'onboarding-plan',
        title: '가입과 플랜 선택 완료 여부 확인',
        description:
          '고객사 계정 생성 후 무료 시작인지, 유료 플랜 결제인지, 로그인까지 정상적으로 이어졌는지 먼저 확인합니다.',
        href: '/admin/agencies',
        cta: '신규 고객사 확인',
      },
      {
        id: 'onboarding-payment',
        title: '결제 반영 여부 확인',
        description:
          '유료 플랜을 선택한 고객사는 결제 관리 화면에서 주문 상태와 결제 수단이 정상 반영됐는지 확인합니다.',
        href: '/admin/billing',
        cta: '결제 반영 확인',
      },
      {
        id: 'onboarding-workflow',
        title: '초기 사용 순서 안내',
        description:
          '기사 등록, 템플릿 만들기, 내 문서함, 문서/서류 전송, 정산 업로드 순서로 안내하면 고객사가 스스로 업무 흐름을 잡기 쉽습니다.',
        href: '/admin/templates',
        cta: '템플릿 화면 보기',
      },
    ],
  },
  {
    id: 'drivers',
    title: '소속 기사 연결 점검',
    summary:
      '계약서나 정산서를 보내기 전에 기사 계정 연결과 알림 가능 상태를 먼저 확인하면 오발송과 문의를 크게 줄일 수 있습니다.',
    steps: [
      {
        id: 'drivers-connection',
        title: '기사 계정 연결 여부 확인',
        description:
          '기사 현황에서 계정 연결, 푸시 가능 여부, 최근 활동 상태를 먼저 확인해 발송 전 점검 기준으로 사용합니다.',
        href: '/admin/drivers',
        cta: '기사 현황 보기',
      },
      {
        id: 'drivers-count',
        title: '고객사별 기사 수 비교',
        description:
          '고객사 관리 화면에서 등록 기사 수와 실제 기사 현황 숫자가 크게 다르지 않은지 비교해 누락 여부를 확인합니다.',
        href: '/admin/agencies',
        cta: '고객사별 기사 보기',
      },
    ],
  },
  {
    id: 'workflow',
    title: '계약, 정산, 세금계산서 안내 기준',
    summary:
      '관리자는 고객사가 각 메뉴에서 직접 작업할 수 있도록 정확한 메뉴와 순서를 안내하는 역할에 집중하는 편이 가장 효율적입니다.',
    steps: [
      {
        id: 'workflow-contracts',
        title: '계약서는 계약서 관리 메뉴로 안내',
        description:
          '템플릿 만들기, 내 문서함, 문서/서류 전송은 계약서 관리 그룹에서 직접 처리하도록 안내합니다.',
        href: '/admin/templates',
        cta: '템플릿 현황 보기',
      },
      {
        id: 'workflow-settlement',
        title: '정산 기준은 거래처/정산 기준 관리로 안내',
        description:
          '보험, 차감 항목, 수익 구조는 거래처/정산 기준 관리 메뉴에서 설정하도록 안내하면 가장 자연스럽습니다.',
        href: '/admin/agencies',
        cta: '고객사 설정 보기',
      },
      {
        id: 'workflow-tax',
        title: '세금계산서는 수기 역발행 보조 도구로 설명',
        description:
          '세금계산서 메뉴는 출력, 다운로드, 공급자 전송을 돕는 수기 역발행 보조 도구라는 점을 분명하게 안내합니다.',
        href: '/admin/notices',
        cta: '운영 공지 보기',
      },
    ],
  },
  {
    id: 'incident',
    title: '장애와 문의 대응 순서',
    summary:
      '원인 추정보다 먼저 상태를 확인하고 영향 범위를 좁히는 방식으로 대응하면 운영 지원이 훨씬 안정적입니다.',
    steps: [
      {
        id: 'incident-server',
        title: '서버 상태와 Sentry 먼저 확인',
        description:
          'DB, Storage, Auth, Sentry 상태를 먼저 확인해 시스템 전체 문제인지 특정 고객사 문제인지 구분합니다.',
        href: '/admin/server',
        cta: '상태 화면 열기',
      },
      {
        id: 'incident-audit',
        title: '감사 로그 확인',
        description:
          '권한 오류, 인증 실패, 주요 보안 이벤트는 감사 로그에서 우선 확인해 원인 후보를 줄입니다.',
        href: '/admin/audit-log',
        cta: '감사 로그 보기',
      },
      {
        id: 'incident-scope',
        title: '영향 고객사 범위 확인',
        description:
          '특정 고객사만 겪는 문제인지 전체 이슈인지 고객사 관리와 기사 현황을 함께 보며 범위를 정리합니다.',
        href: '/admin/agencies',
        cta: '영향 범위 확인',
      },
    ],
  },
]

const quickLinks = [
  { label: '고객사 관리', href: '/admin/agencies' },
  { label: '결제 관리', href: '/admin/billing' },
  { label: '기사 현황', href: '/admin/drivers' },
  { label: '서버 상태', href: '/admin/server' },
  { label: '감사 로그', href: '/admin/audit-log' },
  { label: '공지 관리', href: '/admin/notices' },
]

export default function AdminGuideChecklist() {
  const [checkedMap, setCheckedMap] = useState<ChecklistState>({})
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    let mounted = true

    async function loadChecklist() {
      try {
        const response = await fetch('/api/admin/guide-checklist', { credentials: 'include' })
        const payload = await response.json().catch(() => ({}))
        if (!response.ok) {
          throw new Error(payload?.error || '운영 체크리스트를 불러오지 못했습니다.')
        }
        if (!mounted) return
        setCheckedMap((payload?.data ?? {}) as ChecklistState)
        setError(null)
      } catch (loadError) {
        if (!mounted) return
        setError(
          loadError instanceof Error
            ? loadError.message
            : '운영 체크리스트를 불러오지 못했습니다.',
        )
      } finally {
        if (mounted) setLoading(false)
      }
    }

    void loadChecklist()

    return () => {
      mounted = false
    }
  }, [])

  const totalSteps = useMemo(
    () => guideSections.reduce((count, section) => count + section.steps.length, 0),
    [],
  )
  const completedSteps = useMemo(
    () => Object.values(checkedMap).filter(Boolean).length,
    [checkedMap],
  )
  const completionRate = totalSteps === 0 ? 0 : Math.round((completedSteps / totalSteps) * 100)

  async function persistChecklist(nextState: ChecklistState) {
    setCheckedMap(nextState)
    setSaving(true)
    try {
      const response = await fetch('/api/admin/guide-checklist', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ value: nextState }),
      })
      const payload = await response.json().catch(() => ({}))
      if (!response.ok) {
        throw new Error(payload?.error || '운영 체크리스트를 저장하지 못했습니다.')
      }
      setError(null)
    } catch (saveError) {
      setError(
        saveError instanceof Error
          ? saveError.message
          : '운영 체크리스트를 저장하지 못했습니다.',
      )
    } finally {
      setSaving(false)
    }
  }

  function toggleStep(stepId: string) {
    const nextState = {
      ...checkedMap,
      [stepId]: !checkedMap[stepId],
    }
    void persistChecklist(nextState)
  }

  function resetChecklist() {
    void persistChecklist({})
  }

  return (
    <div className="space-y-8">
      <div className="rounded-3xl bg-surface-container-lowest p-8 shadow-ambient">
        <div className="flex flex-col gap-6 lg:flex-row lg:items-center lg:justify-between">
          <div className="max-w-3xl">
            <p className="text-xs font-semibold uppercase tracking-[0.18em] text-primary">
              Admin Guide
            </p>
            <h1 className="mt-2 font-headline text-3xl font-bold text-on-surface font-korean">
              관리자 운영 체크리스트
            </h1>
            <p className="mt-3 text-sm leading-6 text-on-surface-variant font-korean">
              운영 중 자주 확인하는 순서를 체크리스트로 정리했습니다. 체크 상태는 서버에 저장되어
              모든 관리자 계정에서 같은 진행 상태를 함께 확인할 수 있습니다.
            </p>
            {error ? <p className="mt-3 text-sm text-error font-korean">{error}</p> : null}
          </div>

          <div className="min-w-[220px] rounded-2xl bg-surface-container-low p-5">
            <p className="text-xs font-semibold uppercase tracking-[0.14em] text-primary">
              Progress
            </p>
            <p className="mt-2 text-3xl font-bold text-on-surface">{completionRate}%</p>
            <p className="mt-1 text-sm text-on-surface-variant font-korean">
              총 {totalSteps}단계 중 {completedSteps}단계를 확인했습니다.
            </p>
            <div className="mt-4 flex flex-wrap gap-3">
              <button
                type="button"
                onClick={resetChecklist}
                disabled={loading || saving}
                className="inline-flex h-10 items-center rounded-xl border border-outline-variant/20 px-4 text-sm text-on-surface font-korean transition-colors hover:bg-surface disabled:opacity-50"
              >
                체크리스트 초기화
              </button>
              {saving ? (
                <span className="inline-flex h-10 items-center text-xs text-on-surface-variant font-korean">
                  저장 중...
                </span>
              ) : null}
            </div>
          </div>
        </div>

        <div className="mt-6 flex flex-wrap gap-3">
          {quickLinks.map((link) => (
            <Link
              key={link.href}
              href={link.href}
              className="inline-flex h-10 items-center rounded-full border border-outline-variant/20 px-4 text-sm text-on-surface font-korean transition-colors hover:bg-surface-container-low"
            >
              {link.label}
            </Link>
          ))}
        </div>
      </div>

      <div className="grid gap-6">
        {guideSections.map((section) => {
          const doneCount = section.steps.filter((step) => checkedMap[step.id]).length
          return (
            <section
              key={section.id}
              id={section.id}
              className="rounded-3xl bg-surface-container-lowest p-6 shadow-ambient"
            >
              <div className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
                <div>
                  <p className="text-xs font-semibold uppercase tracking-[0.14em] text-primary">
                    Section
                  </p>
                  <h2 className="mt-1 font-headline text-xl font-bold text-on-surface font-korean">
                    {section.title}
                  </h2>
                  <p className="mt-2 text-sm leading-6 text-on-surface-variant font-korean">
                    {section.summary}
                  </p>
                </div>
                <div className="rounded-full bg-surface-container-low px-4 py-2 text-sm text-on-surface-variant font-korean">
                  {doneCount}/{section.steps.length} 완료
                </div>
              </div>

              <div className="mt-6 grid gap-4">
                {section.steps.map((step, index) => {
                  const checked = Boolean(checkedMap[step.id])
                  return (
                    <div
                      key={step.id}
                      className={`rounded-2xl border p-5 transition-colors ${
                        checked
                          ? 'border-primary/30 bg-primary/5'
                          : 'border-outline-variant/20 bg-surface-container-low'
                      }`}
                    >
                      <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
                        <div className="flex gap-4">
                          <button
                            type="button"
                            onClick={() => toggleStep(step.id)}
                            disabled={loading || saving}
                            className={`mt-0.5 flex h-9 w-9 shrink-0 items-center justify-center rounded-full border text-sm font-bold transition-colors disabled:opacity-50 ${
                              checked
                                ? 'border-primary bg-primary text-white'
                                : 'border-outline-variant/20 bg-white text-on-surface'
                            }`}
                            aria-pressed={checked}
                            aria-label={`${step.title} 체크`}
                          >
                            {checked ? '✓' : index + 1}
                          </button>
                          <div>
                            <h3 className="text-base font-semibold text-on-surface font-korean">
                              {step.title}
                            </h3>
                            <p className="mt-1 text-sm leading-6 text-on-surface-variant font-korean">
                              {step.description}
                            </p>
                          </div>
                        </div>

                        <div className="flex shrink-0 flex-wrap gap-3">
                          <button
                            type="button"
                            onClick={() => toggleStep(step.id)}
                            disabled={loading || saving}
                            className={`inline-flex h-10 items-center rounded-xl px-4 text-sm font-semibold font-korean transition-colors disabled:opacity-50 ${
                              checked
                                ? 'border border-outline-variant/20 bg-white text-on-surface'
                                : 'bg-surface-container-high text-on-surface'
                            }`}
                          >
                            {checked ? '체크 해제' : '확인 완료'}
                          </button>
                          <Link
                            href={step.href}
                            className="inline-flex h-10 items-center justify-center rounded-xl bg-power-gradient px-4 text-sm font-semibold text-white font-korean"
                          >
                            {step.cta}
                          </Link>
                        </div>
                      </div>
                    </div>
                  )
                })}
              </div>
            </section>
          )
        })}
      </div>
    </div>
  )
}
