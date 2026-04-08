'use client'

import Link from 'next/link'
import { useEffect, useMemo, useState } from 'react'

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
type ScopeKey = 'team' | 'mine'
type TeamScopeKey = 'ops' | 'cs' | 'legal' | 'finance' | 'dev' | 'drivers'

const TEAM_OPTIONS: Array<{ key: TeamScopeKey; label: string }> = [
  { key: 'ops', label: '운영팀' },
  { key: 'cs', label: '고객센터' },
  { key: 'legal', label: '법무' },
  { key: 'finance', label: '재무' },
  { key: 'dev', label: '개발' },
  { key: 'drivers', label: '기사관리' },
]

const guideSections: GuideSection[] = [
  {
    id: 'daily',
    title: '매일 확인하는 운영 순서',
    summary: '결제, 고객사, 서버 상태를 먼저 확인하면 장애를 가장 빨리 잡을 수 있습니다.',
    steps: [
      {
        id: 'daily-billing',
        title: '결제 상태 확인',
        description: '입금 대기, 결제 실패, 카드 만료 예정 고객사가 있는지 먼저 확인합니다.',
        href: '/admin/billing',
        cta: '결제 관리 열기',
      },
      {
        id: 'daily-agencies',
        title: '고객사 운영 현황 확인',
        description: '가입, 기사 연결, 플랜 상태, 최근 활동을 고객사 관리 화면에서 확인합니다.',
        href: '/admin/agencies',
        cta: '고객사 관리 열기',
      },
      {
        id: 'daily-server',
        title: '서버와 알림 상태 확인',
        description: 'DB, 인증, 스토리지, Sentry 상태를 먼저 확인해 전체 장애인지 개별 장애인지 나눕니다.',
        href: '/admin/server',
        cta: '서버 상태 열기',
      },
    ],
  },
  {
    id: 'onboarding',
    title: '신규 고객사 온보딩',
    summary: '가입, 플랜 결제, 기사 연결, 템플릿 구성까지 단계별로 안내하면 문의를 크게 줄일 수 있습니다.',
    steps: [
      {
        id: 'onboarding-plan',
        title: '가입과 플랜 선택 확인',
        description: '고객사가 가입 후 플랜 선택과 결제까지 무리 없이 진행했는지 확인합니다.',
        href: '/admin/agencies',
        cta: '신규 고객사 보기',
      },
      {
        id: 'onboarding-payment',
        title: '결제 반영 확인',
        description: '플랜 주문 상태, 결제 수단, 가상계좌 입금 여부가 정상 반영됐는지 확인합니다.',
        href: '/admin/billing',
        cta: '주문 내역 보기',
      },
      {
        id: 'onboarding-guide',
        title: '초기 사용 순서 안내',
        description: '기사 등록, 템플릿 만들기, 문서 발송, 정산 업로드 순서로 안내합니다.',
        href: '/admin/templates',
        cta: '템플릿 관리 보기',
      },
    ],
  },
  {
    id: 'drivers',
    title: '소속 기사 연결 점검',
    summary: '계약과 정산을 보내기 전에 기사 계정 연결과 앱 수신 가능 상태를 먼저 점검합니다.',
    steps: [
      {
        id: 'drivers-link',
        title: '기사 계정 연결 확인',
        description: '기사 현황 화면에서 고객사별 기사 연결 여부와 최근 앱 수신 상태를 확인합니다.',
        href: '/admin/drivers',
        cta: '기사 현황 보기',
      },
      {
        id: 'drivers-coverage',
        title: '고객사별 연결률 점검',
        description: '등록 기사 수와 앱 연결 기사 수 차이가 큰 고객사를 우선 확인합니다.',
        href: '/admin/agencies',
        cta: '고객사 연결률 보기',
      },
    ],
  },
  {
    id: 'workflow',
    title: '계약, 정산, 세금계산서 운영 기준',
    summary: '고객사가 직접 처리할 항목과 운영팀이 확인할 항목을 분리해서 안내합니다.',
    steps: [
      {
        id: 'workflow-contracts',
        title: '계약 흐름 안내',
        description: '계약서 발송과 전자서명은 고객사 포털 계약서 메뉴에서 직접 처리하도록 안내합니다.',
        href: '/admin/templates',
        cta: '계약 템플릿 보기',
      },
      {
        id: 'workflow-settlements',
        title: '정산 기준 안내',
        description: '보험, 공제, 단가, 기사 수당은 거래처·정산 기준 관리 화면에서 설정하도록 안내합니다.',
        href: '/admin/agencies',
        cta: '고객사 설정 흐름 보기',
      },
      {
        id: 'workflow-tax',
        title: '세금계산서 운영 안내',
        description: '세금계산서는 수기 역발행 보조 도구이며 출력, 다운로드, 공급자 전송 중심으로 운영합니다.',
        href: '/admin/notices',
        cta: '운영 공지 보기',
      },
    ],
  },
  {
    id: 'incident',
    title: '장애 대응 기준',
    summary: '서버 상태, 감사 로그, 영향 고객사를 순서대로 확인하면 대응 속도가 빨라집니다.',
    steps: [
      {
        id: 'incident-server',
        title: '서버 상태와 Sentry 확인',
        description: 'DB, Auth, Storage, Sentry 상태를 먼저 보고 공통 장애인지 개별 장애인지 판단합니다.',
        href: '/admin/server',
        cta: '서버 상태 열기',
      },
      {
        id: 'incident-audit',
        title: '감사 로그 확인',
        description: '권한 오류, 인증 실패, 주요 보안 이벤트는 감사 로그에서 먼저 확인합니다.',
        href: '/admin/audit-log',
        cta: '감사 로그 보기',
      },
      {
        id: 'incident-scope',
        title: '영향 고객사 범위 정리',
        description: '특정 고객사 문제인지 전체 장애인지 고객사 관리 화면에서 영향 범위를 정리합니다.',
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
  const [teamStates, setTeamStates] = useState<Record<TeamScopeKey, ChecklistState>>({
    ops: {},
    cs: {},
    legal: {},
    finance: {},
    dev: {},
    drivers: {},
  })
  const [mineState, setMineState] = useState<ChecklistState>({})
  const [selectedScope, setSelectedScope] = useState<ScopeKey>('team')
  const [selectedTeam, setSelectedTeam] = useState<TeamScopeKey>('ops')
  const [scopeLabels, setScopeLabels] = useState({
    teams: Object.fromEntries(TEAM_OPTIONS.map((team) => [team.key, `${team.label} 체크리스트`])) as Record<TeamScopeKey, string>,
    mineLabel: '내 담당 체크리스트',
  })
  const [canEditTeam, setCanEditTeam] = useState(true)
  const [loading, setLoading] = useState(true)
  const [savingScope, setSavingScope] = useState<ScopeKey | null>(null)
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

        setTeamStates((previous) => ({
          ...previous,
          ...(payload?.data?.teams ?? {}),
        }))
        setMineState((payload?.data?.mine ?? {}) as ChecklistState)
        setScopeLabels({
          teams: {
            ...Object.fromEntries(TEAM_OPTIONS.map((team) => [team.key, `${team.label} 체크리스트`])),
            ...(payload?.scopes?.teams ?? {}),
          },
          mineLabel: payload?.scopes?.mineLabel ?? '내 담당 체크리스트',
        })
        setCanEditTeam(Boolean(payload?.permissions?.canEditTeam))
        setError(null)
      } catch (loadError) {
        if (!mounted) return
        setError(loadError instanceof Error ? loadError.message : '운영 체크리스트를 불러오지 못했습니다.')
      } finally {
        if (mounted) setLoading(false)
      }
    }

    void loadChecklist()
    return () => {
      mounted = false
    }
  }, [])

  const totalSteps = useMemo(() => guideSections.reduce((count, section) => count + section.steps.length, 0), [])

  const completion = useMemo(() => {
    const countCompleted = (state: ChecklistState) => Object.values(state).filter(Boolean).length
    const perTeam = Object.fromEntries(
      TEAM_OPTIONS.map((team) => [
        team.key,
        {
          completed: countCompleted(teamStates[team.key] ?? {}),
          rate:
            totalSteps === 0
              ? 0
              : Math.round((countCompleted(teamStates[team.key] ?? {}) / totalSteps) * 100),
        },
      ]),
    ) as Record<TeamScopeKey, { completed: number; rate: number }>
    const myCompleted = countCompleted(mineState)
    return {
      myCompleted,
      myRate: totalSteps === 0 ? 0 : Math.round((myCompleted / totalSteps) * 100),
      perTeam,
    }
  }, [mineState, teamStates, totalSteps])

  const currentState = selectedScope === 'team' ? teamStates[selectedTeam] ?? {} : mineState
  const currentCompleted =
    selectedScope === 'team' ? completion.perTeam[selectedTeam]?.completed ?? 0 : completion.myCompleted
  const currentRate = selectedScope === 'team' ? completion.perTeam[selectedTeam]?.rate ?? 0 : completion.myRate
  const currentLabel =
    selectedScope === 'team' ? scopeLabels.teams[selectedTeam] ?? `${selectedTeam} 체크리스트` : scopeLabels.mineLabel
  const isScopeReadOnly = selectedScope === 'team' && !canEditTeam

  async function persistChecklist(scope: ScopeKey, nextState: ChecklistState, scopeKey?: TeamScopeKey) {
    if (scope === 'team') {
      const targetTeam = scopeKey ?? selectedTeam
      setTeamStates((previous) => ({ ...previous, [targetTeam]: nextState }))
    } else {
      setMineState(nextState)
    }
    setSavingScope(scope)

    try {
      const response = await fetch('/api/admin/guide-checklist', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ scope, scopeKey: scope === 'team' ? scopeKey ?? selectedTeam : undefined, value: nextState }),
      })
      const payload = await response.json().catch(() => ({}))
      if (!response.ok) {
        throw new Error(payload?.error || '운영 체크리스트를 저장하지 못했습니다.')
      }
      setError(null)
    } catch (saveError) {
      setError(saveError instanceof Error ? saveError.message : '운영 체크리스트를 저장하지 못했습니다.')
    } finally {
      setSavingScope(null)
    }
  }

  function toggleStep(stepId: string) {
    const nextState = {
      ...currentState,
      [stepId]: !currentState[stepId],
    }
    void persistChecklist(selectedScope, nextState, selectedTeam)
  }

  if (loading) {
    return <div className="rounded-3xl bg-surface-container-lowest p-8 text-sm text-on-surface-variant shadow-ambient">운영 체크리스트를 불러오는 중입니다...</div>
  }

  return (
    <div className="space-y-6">
      <div className="rounded-3xl bg-surface-container-lowest p-6 shadow-ambient">
        <div className="flex flex-col gap-4 xl:flex-row xl:items-end xl:justify-between">
          <div>
            <h2 className="font-headline text-[28px] font-bold text-on-surface">운영 가이드</h2>
            <p className="mt-2 text-sm leading-6 text-on-surface-variant">
              팀별 체크리스트와 개인 담당 항목을 분리해 관리합니다. 고객사 가입, 기사 연결, 계약·정산 안내,
              장애 대응 순서를 한 화면에서 확인할 수 있습니다.
            </p>
          </div>

          <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
            <div className="rounded-2xl bg-surface-container-low p-4">
              <p className="text-xs text-on-surface-variant">{scopeLabels.teams[selectedTeam] ?? '팀별 체크리스트'}</p>
              <p className="mt-2 font-data text-2xl font-bold text-primary">{completion.perTeam[selectedTeam]?.rate ?? 0}%</p>
              <p className="mt-1 text-xs text-on-surface-variant">
                {completion.perTeam[selectedTeam]?.completed ?? 0} / {totalSteps} 완료
              </p>
            </div>
            <div className="rounded-2xl bg-surface-container-low p-4">
              <p className="text-xs text-on-surface-variant">{scopeLabels.mineLabel}</p>
              <p className="mt-2 font-data text-2xl font-bold text-tertiary">{completion.myRate}%</p>
              <p className="mt-1 text-xs text-on-surface-variant">
                {completion.myCompleted} / {totalSteps} 완료
              </p>
            </div>
            <div className="rounded-2xl bg-surface-container-low p-4">
              <p className="text-xs text-on-surface-variant">현재 보고 있는 체크리스트</p>
              <p className="mt-2 text-base font-semibold text-on-surface">
                {currentLabel}
              </p>
              <p className="mt-1 text-xs text-on-surface-variant">
                {currentCompleted} / {totalSteps} 완료
              </p>
            </div>
          </div>
        </div>

        <div className="mt-5 flex flex-wrap gap-2">
          {([
            { key: 'team', label: '팀별 체크리스트' },
            { key: 'mine', label: scopeLabels.mineLabel },
          ] as Array<{ key: ScopeKey; label: string }>).map((scope) => (
            <button
              key={scope.key}
              type="button"
              onClick={() => setSelectedScope(scope.key)}
              className={`rounded-xl px-4 py-2 text-sm font-medium transition-colors ${
                selectedScope === scope.key
                  ? 'bg-primary text-white'
                  : 'bg-surface-container-low text-on-surface-variant hover:bg-surface-container-high'
              }`}
            >
              {scope.label}
            </button>
          ))}

          <div className="ml-auto rounded-xl bg-surface px-4 py-2 text-xs text-on-surface-variant">
            {savingScope === selectedScope ? '저장 중...' : `${currentRate}% 진행 중`}
          </div>
        </div>

        {selectedScope === 'team' ? (
          <div className="mt-4 flex flex-wrap gap-2">
            {TEAM_OPTIONS.map((team) => (
              <button
                key={team.key}
                type="button"
                onClick={() => setSelectedTeam(team.key)}
                className={`rounded-xl px-4 py-2 text-sm font-medium transition-colors ${
                  selectedTeam === team.key
                    ? 'bg-tertiary text-white'
                    : 'bg-surface-container-low text-on-surface-variant hover:bg-surface-container-high'
                }`}
              >
                {team.label}
                <span className="ml-2 text-xs opacity-80">
                  {completion.perTeam[team.key]?.completed ?? 0}/{totalSteps}
                </span>
              </button>
            ))}
          </div>
        ) : null}

        {isScopeReadOnly ? (
          <div className="mt-4 rounded-2xl border border-outline-variant/20 bg-surface-container-low px-4 py-3 text-sm text-on-surface-variant">
            팀별 체크리스트는 플랫폼 관리자만 수정할 수 있습니다. 현재 계정은 개인 담당 체크리스트만 변경할 수 있습니다.
          </div>
        ) : null}

        {error ? (
          <div className="mt-4 rounded-2xl border border-error/20 bg-error/5 px-4 py-3 text-sm text-error">
            {error}
          </div>
        ) : null}
      </div>

      <div className="grid grid-cols-1 gap-6 xl:grid-cols-[minmax(0,1fr)_280px]">
        <div className="space-y-5">
          {guideSections.map((section) => (
            <section key={section.id} className="rounded-3xl bg-surface-container-lowest p-6 shadow-ambient">
              <div className="border-b border-outline-variant/15 pb-4">
                <h3 className="font-headline text-[20px] font-bold text-on-surface">{section.title}</h3>
                <p className="mt-2 text-sm leading-6 text-on-surface-variant">{section.summary}</p>
              </div>

              <div className="mt-5 space-y-4">
                {section.steps.map((step, index) => {
                  const checked = Boolean(currentState[step.id])

                  return (
                    <div key={step.id} className="rounded-2xl border border-outline-variant/15 bg-surface-container-low p-4">
                      <div className="flex flex-col gap-4 md:flex-row md:items-start md:justify-between">
                        <div className="min-w-0">
                          <div className="flex items-center gap-3">
                            <span className="flex h-8 w-8 items-center justify-center rounded-full bg-primary/10 text-sm font-semibold text-primary">
                              {index + 1}
                            </span>
                            <div>
                              <p className="text-base font-semibold text-on-surface">{step.title}</p>
                              <p className="mt-1 text-sm leading-6 text-on-surface-variant">{step.description}</p>
                            </div>
                          </div>
                        </div>

                        <div className="flex flex-wrap items-center gap-3">
                          <button
                            type="button"
                            onClick={() => toggleStep(step.id)}
                            disabled={isScopeReadOnly}
                            className={`rounded-xl px-4 py-2 text-sm font-medium transition-colors ${
                              checked
                                ? 'bg-tertiary text-white'
                                : 'bg-white text-on-surface hover:bg-surface'
                            } disabled:cursor-not-allowed disabled:opacity-60`}
                          >
                            {checked ? '확인 완료' : '확인하기'}
                          </button>
                          <Link
                            href={step.href}
                            className="rounded-xl border border-outline-variant/20 bg-white px-4 py-2 text-sm font-medium text-on-surface hover:bg-surface"
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
          ))}
        </div>

        <aside className="space-y-5">
          <div className="rounded-3xl bg-surface-container-lowest p-5 shadow-ambient">
            <h3 className="font-headline text-lg font-bold text-on-surface">빠른 이동</h3>
            <div className="mt-4 space-y-2">
              {quickLinks.map((link) => (
                <Link
                  key={link.href}
                  href={link.href}
                  className="flex items-center justify-between rounded-2xl bg-surface-container-low px-4 py-3 text-sm text-on-surface hover:bg-surface-container-high"
                >
                  <span>{link.label}</span>
                  <span className="material-symbols-outlined text-[18px] text-on-surface-variant">chevron_right</span>
                </Link>
              ))}
            </div>
          </div>

          <div className="rounded-3xl bg-surface-container-lowest p-5 shadow-ambient">
            <h3 className="font-headline text-lg font-bold text-on-surface">운영 팁</h3>
            <ul className="mt-4 space-y-3 text-sm leading-6 text-on-surface-variant">
              <li>결제와 서버 상태를 먼저 확인하면 전체 장애를 가장 빨리 구분할 수 있습니다.</li>
              <li>고객사 문의는 기사 연결, 문서 전송, 정산 초안 여부를 함께 보면 대부분 빠르게 해결됩니다.</li>
              <li>세금계산서 전송 실패는 재무와 기사 앱 수신 상태를 함께 보는 것이 가장 효율적입니다.</li>
            </ul>
          </div>
        </aside>
      </div>
    </div>
  )
}
