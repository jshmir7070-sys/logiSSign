'use client'

import { useCallback, useEffect, useMemo, useState } from 'react'
import {
  DEFAULT_ADMIN_EMAIL_TEMPLATES,
  DEFAULT_ADMIN_GENERAL_SETTINGS,
  DEFAULT_ADMIN_PAYMENT_SETTINGS,
  type AdminEmailTemplate,
  type AdminGeneralSettings,
  type AdminPaymentSettings,
} from '@/lib/admin-settings'
import {
  EASY_PAY_PROVIDER_OPTIONS,
  PAYMENT_METHOD_OPTIONS,
  VIRTUAL_ACCOUNT_BANK_OPTIONS,
} from '@/lib/payment-methods'
import { FEATURE_LABELS } from '@/lib/plan-limits'

interface PlanConfig {
  plan: string
  label: string
  price_monthly: number
  max_drivers: number | null
  max_admin_accounts: number
  max_default_templates: number
  max_upload_templates: number
  features: Record<string, boolean>
  description: string | null
  sort_order: number
}

type TabId = 'general' | 'plans' | 'payment' | 'email'

const INPUT_CLASS =
  'h-10 w-full rounded-xl border border-outline-variant/20 bg-surface px-3 text-sm text-on-surface'
const TEXTAREA_CLASS =
  'min-h-[120px] w-full rounded-xl border border-outline-variant/20 bg-surface px-3 py-3 text-sm text-on-surface'

function formatKRW(value: number): string {
  return `₩${value.toLocaleString('ko-KR')}`
}

function FeatureCheckbox({
  checked,
  label,
  onChange,
}: {
  checked: boolean
  label: string
  onChange: (next: boolean) => void
}) {
  return (
    <label className="flex items-center gap-2 rounded-lg bg-surface-container-low px-3 py-2 text-sm text-on-surface">
      <input type="checkbox" checked={checked} onChange={(event) => onChange(event.target.checked)} />
      <span>{label}</span>
    </label>
  )
}

export default function AdminSettingsPage() {
  const [activeTab, setActiveTab] = useState<TabId>('general')
  const [loading, setLoading] = useState(true)
  const [plansLoading, setPlansLoading] = useState(false)
  const [savingSection, setSavingSection] = useState<TabId | null>(null)

  const [general, setGeneral] = useState<AdminGeneralSettings>(DEFAULT_ADMIN_GENERAL_SETTINGS)
  const [payment, setPayment] = useState<AdminPaymentSettings>(DEFAULT_ADMIN_PAYMENT_SETTINGS)
  const [emailTemplates, setEmailTemplates] = useState<AdminEmailTemplate[]>(DEFAULT_ADMIN_EMAIL_TEMPLATES)

  const [plans, setPlans] = useState<PlanConfig[]>([])
  const [editingPlan, setEditingPlan] = useState<PlanConfig | null>(null)
  const [savingPlan, setSavingPlan] = useState(false)

  const tabs: Array<{ id: TabId; label: string }> = [
    { id: 'general', label: '일반' },
    { id: 'plans', label: '플랜 관리' },
    { id: 'payment', label: '결제 설정' },
    { id: 'email', label: '이메일 템플릿' },
  ]

  const loadSettings = useCallback(async () => {
    setLoading(true)
    try {
      const response = await fetch('/api/admin/settings')
      if (!response.ok) {
        throw new Error('설정을 불러오지 못했습니다.')
      }
      const payload = await response.json()
      setGeneral(payload.general ?? DEFAULT_ADMIN_GENERAL_SETTINGS)
      setPayment(payload.payment ?? DEFAULT_ADMIN_PAYMENT_SETTINGS)
      setEmailTemplates(payload.emailTemplates ?? DEFAULT_ADMIN_EMAIL_TEMPLATES)
    } catch (error) {
      alert(error instanceof Error ? error.message : '설정을 불러오지 못했습니다.')
    } finally {
      setLoading(false)
    }
  }, [])

  const loadPlans = useCallback(async () => {
    setPlansLoading(true)
    try {
      const response = await fetch('/api/admin/plan-configs')
      if (!response.ok) {
        throw new Error('플랜 설정을 불러오지 못했습니다.')
      }
      const payload = await response.json()
      setPlans(payload.data ?? [])
    } catch (error) {
      alert(error instanceof Error ? error.message : '플랜 설정을 불러오지 못했습니다.')
    } finally {
      setPlansLoading(false)
    }
  }, [])

  useEffect(() => {
    void loadSettings()
  }, [loadSettings])

  useEffect(() => {
    if (activeTab === 'plans' && plans.length === 0 && !plansLoading) {
      void loadPlans()
    }
  }, [activeTab, loadPlans, plans.length, plansLoading])

  const saveSection = useCallback(
    async (
      tab: Extract<TabId, 'general' | 'payment' | 'email'>,
      value: AdminGeneralSettings | AdminPaymentSettings | AdminEmailTemplate[],
    ) => {
      setSavingSection(tab)
      try {
        const section = tab === 'email' ? 'email_templates' : tab
        const response = await fetch('/api/admin/settings', {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ section, value }),
        })
        const payload = await response.json()
        if (!response.ok) {
          throw new Error(payload.error || '설정을 저장하지 못했습니다.')
        }
        alert('설정을 저장했습니다.')
      } catch (error) {
        alert(error instanceof Error ? error.message : '설정을 저장하지 못했습니다.')
      } finally {
        setSavingSection(null)
      }
    },
    [],
  )

  const handleSavePlan = useCallback(async () => {
    if (!editingPlan) return

    setSavingPlan(true)
    try {
      const response = await fetch('/api/admin/plan-configs', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(editingPlan),
      })
      const payload = await response.json()
      if (!response.ok) {
        throw new Error(payload.error || '플랜 저장에 실패했습니다.')
      }
      alert('플랜 설정을 저장했습니다.')
      setEditingPlan(null)
      await loadPlans()
    } catch (error) {
      alert(error instanceof Error ? error.message : '플랜 저장에 실패했습니다.')
    } finally {
      setSavingPlan(false)
    }
  }, [editingPlan, loadPlans])

  const featureKeys = useMemo(() => Object.keys(FEATURE_LABELS), [])

  if (loading) {
    return <p className="py-10 text-sm text-on-surface-variant">설정을 불러오는 중입니다...</p>
  }

  return (
    <div className="space-y-8">
      <div>
        <h2 className="font-headline text-[26px] font-bold tracking-tight text-on-surface">관리자 설정</h2>
        <p className="mt-1 text-[14px] text-on-surface-variant">
          플랫폼 기본 정보, 플랜 정책, 결제 수단, 안내 템플릿을 운영 기준으로 관리합니다.
        </p>
      </div>

      <div className="flex flex-wrap gap-2">
        {tabs.map((tab) => (
          <button
            key={tab.id}
            type="button"
            onClick={() => setActiveTab(tab.id)}
            className={`rounded-xl px-4 py-2 text-sm font-medium transition-colors ${
              activeTab === tab.id
                ? 'bg-primary text-white'
                : 'bg-surface-container-low text-on-surface-variant hover:bg-surface-container-high'
            }`}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {activeTab === 'general' ? (
        <div className="space-y-6 rounded-2xl bg-surface-container-lowest p-8 shadow-ambient">
          <h3 className="font-headline text-[16px] font-bold text-on-surface">플랫폼 기본 정보</h3>
          <div className="grid grid-cols-1 gap-6 md:grid-cols-2">
            <div>
              <label className="mb-1.5 block text-xs font-medium text-on-surface-variant">플랫폼명</label>
              <input
                type="text"
                value={general.platformName}
                onChange={(event) => setGeneral((previous) => ({ ...previous, platformName: event.target.value }))}
                className={INPUT_CLASS}
              />
            </div>
            <div>
              <label className="mb-1.5 block text-xs font-medium text-on-surface-variant">지원 문의 이메일</label>
              <input
                type="email"
                value={general.supportEmail}
                onChange={(event) => setGeneral((previous) => ({ ...previous, supportEmail: event.target.value }))}
                className={INPUT_CLASS}
              />
            </div>
            <div>
              <label className="mb-1.5 block text-xs font-medium text-on-surface-variant">고객센터 연락처</label>
              <input
                type="text"
                value={general.supportPhone}
                onChange={(event) => setGeneral((previous) => ({ ...previous, supportPhone: event.target.value }))}
                className={INPUT_CLASS}
              />
            </div>
            <div>
              <label className="mb-1.5 block text-xs font-medium text-on-surface-variant">정산 마감 안내</label>
              <input
                type="text"
                value={general.settlementCloseDay}
                onChange={(event) =>
                  setGeneral((previous) => ({ ...previous, settlementCloseDay: event.target.value }))
                }
                className={INPUT_CLASS}
              />
            </div>
            <div>
              <label className="mb-1.5 block text-xs font-medium text-on-surface-variant">
                개인정보 책임자 이메일
              </label>
              <input
                type="email"
                value={general.privacyOfficerEmail}
                onChange={(event) =>
                  setGeneral((previous) => ({ ...previous, privacyOfficerEmail: event.target.value }))
                }
                className={INPUT_CLASS}
              />
            </div>
            <div>
              <label className="mb-1.5 block text-xs font-medium text-on-surface-variant">
                개인정보 책임자 연락처
              </label>
              <input
                type="text"
                value={general.privacyOfficerPhone}
                onChange={(event) =>
                  setGeneral((previous) => ({ ...previous, privacyOfficerPhone: event.target.value }))
                }
                className={INPUT_CLASS}
              />
            </div>
          </div>

          <div className="flex justify-end">
            <button
              type="button"
              onClick={() => void saveSection('general', general)}
              disabled={savingSection === 'general'}
              className="rounded-xl bg-primary px-4 py-2 text-sm font-semibold text-white disabled:opacity-50"
            >
              {savingSection === 'general' ? '저장 중...' : '일반 설정 저장'}
            </button>
          </div>
        </div>
      ) : null}

      {activeTab === 'payment' ? (
        <div className="space-y-6 rounded-2xl bg-surface-container-lowest p-8 shadow-ambient">
          <div>
            <h3 className="font-headline text-[16px] font-bold text-on-surface">결제 정책</h3>
            <p className="mt-1 text-sm text-on-surface-variant">
              고객사 화면에 노출할 결제 수단과 구독 만료 알림 정책을 여기서 설정합니다.
            </p>
          </div>

          <div className="grid gap-6 xl:grid-cols-3">
            <div>
              <p className="mb-2 text-xs font-medium text-on-surface-variant">사용 가능한 결제 수단</p>
              <div className="space-y-2">
                {PAYMENT_METHOD_OPTIONS.map((method) => (
                  <label key={method.value} className="flex items-center gap-2 rounded-xl bg-surface-container-low p-3">
                    <input
                      type="checkbox"
                      checked={payment.enabledMethods.includes(method.value)}
                      onChange={(event) =>
                        setPayment((previous) => ({
                          ...previous,
                          enabledMethods: event.target.checked
                            ? [...previous.enabledMethods, method.value]
                            : previous.enabledMethods.filter((item) => item !== method.value),
                        }))
                      }
                    />
                    <div>
                      <p className="text-sm font-medium text-on-surface">{method.label}</p>
                      <p className="text-xs text-on-surface-variant">{method.description}</p>
                    </div>
                  </label>
                ))}
              </div>
            </div>

            <div>
              <p className="mb-2 text-xs font-medium text-on-surface-variant">간편결제 제공사</p>
              <div className="space-y-2">
                {EASY_PAY_PROVIDER_OPTIONS.map((provider) => (
                  <label key={provider.value} className="flex items-center gap-2 rounded-xl bg-surface-container-low p-3">
                    <input
                      type="checkbox"
                      checked={payment.enabledEasyPayProviders.includes(provider.value)}
                      onChange={(event) =>
                        setPayment((previous) => ({
                          ...previous,
                          enabledEasyPayProviders: event.target.checked
                            ? [...previous.enabledEasyPayProviders, provider.value]
                            : previous.enabledEasyPayProviders.filter((item) => item !== provider.value),
                        }))
                      }
                    />
                    <span className="text-sm text-on-surface">{provider.label}</span>
                  </label>
                ))}
              </div>
            </div>

            <div>
              <p className="mb-2 text-xs font-medium text-on-surface-variant">가상계좌 은행 목록</p>
              <div className="space-y-2">
                {VIRTUAL_ACCOUNT_BANK_OPTIONS.map((bank) => (
                  <label key={bank.value} className="flex items-center gap-2 rounded-xl bg-surface-container-low p-3">
                    <input
                      type="checkbox"
                      checked={payment.enabledVirtualAccountBanks.includes(bank.value)}
                      onChange={(event) =>
                        setPayment((previous) => ({
                          ...previous,
                          enabledVirtualAccountBanks: event.target.checked
                            ? [...previous.enabledVirtualAccountBanks, bank.value]
                            : previous.enabledVirtualAccountBanks.filter((item) => item !== bank.value),
                        }))
                      }
                    />
                    <span className="text-sm text-on-surface">{bank.label}</span>
                  </label>
                ))}
              </div>
            </div>
          </div>

          <div className="grid gap-6 md:grid-cols-2 xl:grid-cols-4">
            <div>
              <label className="mb-1.5 block text-xs font-medium text-on-surface-variant">기본 가상계좌 은행</label>
              <select
                value={payment.defaultVirtualAccountBank}
                onChange={(event) =>
                  setPayment((previous) => ({ ...previous, defaultVirtualAccountBank: event.target.value }))
                }
                className={INPUT_CLASS}
              >
                {VIRTUAL_ACCOUNT_BANK_OPTIONS.map((bank) => (
                  <option key={bank.value} value={bank.value}>
                    {bank.label}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className="mb-1.5 block text-xs font-medium text-on-surface-variant">
                가상계좌 입금 만료 시간
              </label>
              <input
                type="number"
                min={1}
                max={72}
                value={payment.virtualAccountExpireHours}
                onChange={(event) =>
                  setPayment((previous) => ({
                    ...previous,
                    virtualAccountExpireHours: Number(event.target.value || 24),
                  }))
                }
                className={INPUT_CLASS}
              />
            </div>
            <div>
              <label className="mb-1.5 block text-xs font-medium text-on-surface-variant">
                플랜 만료 알림 일수
              </label>
              <input
                type="text"
                value={payment.subscriptionExpiryNoticeDays.join(', ')}
                onChange={(event) =>
                  setPayment((previous) => ({
                    ...previous,
                    subscriptionExpiryNoticeDays: event.target.value
                      .split(',')
                      .map((value) => Number(value.trim()))
                      .filter((value) => Number.isFinite(value) && value > 0),
                  }))
                }
                className={INPUT_CLASS}
              />
            </div>
            <div className="space-y-3 rounded-xl bg-surface-container-low p-4">
              <label className="flex items-center gap-2 text-sm text-on-surface">
                <input
                  type="checkbox"
                  checked={payment.allowPlanPayments}
                  onChange={(event) =>
                    setPayment((previous) => ({ ...previous, allowPlanPayments: event.target.checked }))
                  }
                />
                <span>플랜 결제 허용</span>
              </label>
              <label className="flex items-center gap-2 text-sm text-on-surface">
                <input
                  type="checkbox"
                  checked={payment.allowPointPayments}
                  onChange={(event) =>
                    setPayment((previous) => ({ ...previous, allowPointPayments: event.target.checked }))
                  }
                />
                <span>포인트 결제 허용</span>
              </label>
              <label className="flex items-center gap-2 text-sm text-on-surface">
                <input
                  type="checkbox"
                  checked={payment.subscriptionCardOnly}
                  onChange={(event) =>
                    setPayment((previous) => ({ ...previous, subscriptionCardOnly: event.target.checked }))
                  }
                />
                <span>구독은 카드 전용</span>
              </label>
              <label className="flex items-center gap-2 text-sm text-on-surface">
                <input
                  type="checkbox"
                  checked={payment.allowBillingKeyManagement}
                  onChange={(event) =>
                    setPayment((previous) => ({
                      ...previous,
                      allowBillingKeyManagement: event.target.checked,
                    }))
                  }
                />
                <span>구독 카드 등록/변경 허용</span>
              </label>
            </div>
          </div>

          <div className="flex justify-end">
            <button
              type="button"
              onClick={() => void saveSection('payment', payment)}
              disabled={savingSection === 'payment'}
              className="rounded-xl bg-primary px-4 py-2 text-sm font-semibold text-white disabled:opacity-50"
            >
              {savingSection === 'payment' ? '저장 중...' : '결제 설정 저장'}
            </button>
          </div>
        </div>
      ) : null}

      {activeTab === 'email' ? (
        <div className="space-y-5 rounded-2xl bg-surface-container-lowest p-8 shadow-ambient">
          <div>
            <h3 className="font-headline text-[16px] font-bold text-on-surface">이메일 템플릿</h3>
            <p className="mt-1 text-sm text-on-surface-variant">
              가입 승인, 결제 실패, 만료 안내 같은 자동 메일의 제목과 본문을 관리합니다.
            </p>
          </div>

          {emailTemplates.map((template, index) => (
            <div key={template.key} className="rounded-2xl border border-outline-variant/15 p-5">
              <div className="mb-4 flex items-center justify-between">
                <div>
                  <p className="font-medium text-on-surface">{template.name}</p>
                  <p className="mt-1 text-xs text-on-surface-variant">{template.key}</p>
                </div>
                <label className="flex items-center gap-2 text-sm text-on-surface">
                  <input
                    type="checkbox"
                    checked={template.isActive}
                    onChange={(event) =>
                      setEmailTemplates((previous) =>
                        previous.map((item, itemIndex) =>
                          itemIndex === index ? { ...item, isActive: event.target.checked } : item,
                        ),
                      )
                    }
                  />
                  <span>사용</span>
                </label>
              </div>

              <div className="space-y-4">
                <div>
                  <label className="mb-1.5 block text-xs font-medium text-on-surface-variant">제목</label>
                  <input
                    type="text"
                    value={template.subject}
                    onChange={(event) =>
                      setEmailTemplates((previous) =>
                        previous.map((item, itemIndex) =>
                          itemIndex === index ? { ...item, subject: event.target.value } : item,
                        ),
                      )
                    }
                    className={INPUT_CLASS}
                  />
                </div>
                <div>
                  <label className="mb-1.5 block text-xs font-medium text-on-surface-variant">본문</label>
                  <textarea
                    value={template.body}
                    onChange={(event) =>
                      setEmailTemplates((previous) =>
                        previous.map((item, itemIndex) =>
                          itemIndex === index ? { ...item, body: event.target.value } : item,
                        ),
                      )
                    }
                    className={TEXTAREA_CLASS}
                  />
                </div>
              </div>
            </div>
          ))}

          <div className="flex justify-end">
            <button
              type="button"
              onClick={() => void saveSection('email', emailTemplates)}
              disabled={savingSection === 'email'}
              className="rounded-xl bg-primary px-4 py-2 text-sm font-semibold text-white disabled:opacity-50"
            >
              {savingSection === 'email' ? '저장 중...' : '이메일 템플릿 저장'}
            </button>
          </div>
        </div>
      ) : null}

      {activeTab === 'plans' ? (
        <div className="space-y-5 rounded-2xl bg-surface-container-lowest p-8 shadow-ambient">
          <div className="flex items-center justify-between">
            <div>
              <h3 className="font-headline text-[16px] font-bold text-on-surface">플랜 관리</h3>
              <p className="mt-1 text-sm text-on-surface-variant">
                플랜별 금액, 기사 수 제한, 관리자 계정 수, 기능 제공 범위를 조정합니다.
              </p>
            </div>
          </div>

          {plansLoading ? (
            <p className="text-sm text-on-surface-variant">플랜 설정을 불러오는 중입니다...</p>
          ) : (
            <div className="grid gap-4 xl:grid-cols-2">
              {plans.map((plan) => (
                <button
                  key={plan.plan}
                  type="button"
                  onClick={() => setEditingPlan({ ...plan, features: { ...plan.features } })}
                  className="rounded-2xl border border-outline-variant/15 p-5 text-left transition hover:border-primary/40 hover:bg-surface-container-low"
                >
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="font-headline text-lg font-bold text-on-surface">{plan.label}</p>
                      <p className="mt-1 text-xs text-on-surface-variant">{plan.plan.toUpperCase()}</p>
                    </div>
                    <div className="text-right">
                      <p className="font-semibold text-on-surface">{formatKRW(plan.price_monthly)}</p>
                      <p className="text-xs text-on-surface-variant">
                        기사 {plan.max_drivers === null ? '무제한' : `${plan.max_drivers}명`}
                      </p>
                    </div>
                  </div>
                  <p className="mt-3 text-sm text-on-surface-variant">{plan.description || '설명이 없습니다.'}</p>
                </button>
              ))}
            </div>
          )}
        </div>
      ) : null}

      {editingPlan ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
          <div className="max-h-[90vh] w-full max-w-4xl overflow-y-auto rounded-3xl bg-surface-container-lowest p-6 shadow-ambient">
            <div className="mb-6 flex items-start justify-between gap-4">
              <div>
                <h3 className="font-headline text-xl font-bold text-on-surface">{editingPlan.label}</h3>
                <p className="mt-1 text-sm text-on-surface-variant">{editingPlan.plan.toUpperCase()} 설정 편집</p>
              </div>
              <button
                type="button"
                onClick={() => setEditingPlan(null)}
                className="rounded-lg border border-outline-variant/20 px-3 py-2 text-sm text-on-surface-variant"
              >
                닫기
              </button>
            </div>

            <div className="grid gap-6 md:grid-cols-2">
              <div>
                <label className="mb-1.5 block text-xs font-medium text-on-surface-variant">플랜명</label>
                <input
                  type="text"
                  value={editingPlan.label}
                  onChange={(event) =>
                    setEditingPlan((previous) => previous && { ...previous, label: event.target.value })
                  }
                  className={INPUT_CLASS}
                />
              </div>
              <div>
                <label className="mb-1.5 block text-xs font-medium text-on-surface-variant">월 요금</label>
                <input
                  type="number"
                  value={editingPlan.price_monthly}
                  onChange={(event) =>
                    setEditingPlan(
                      (previous) => previous && { ...previous, price_monthly: Number(event.target.value || 0) },
                    )
                  }
                  className={INPUT_CLASS}
                />
              </div>
              <div>
                <label className="mb-1.5 block text-xs font-medium text-on-surface-variant">기사 수 제한</label>
                <input
                  type="number"
                  value={editingPlan.max_drivers ?? ''}
                  placeholder="비워 두면 무제한"
                  onChange={(event) =>
                    setEditingPlan((previous) =>
                      previous && {
                        ...previous,
                        max_drivers: event.target.value === '' ? null : Number(event.target.value),
                      },
                    )
                  }
                  className={INPUT_CLASS}
                />
              </div>
              <div>
                <label className="mb-1.5 block text-xs font-medium text-on-surface-variant">
                  관리자 계정 수
                </label>
                <input
                  type="number"
                  value={editingPlan.max_admin_accounts}
                  onChange={(event) =>
                    setEditingPlan(
                      (previous) => previous && { ...previous, max_admin_accounts: Number(event.target.value || 0) },
                    )
                  }
                  className={INPUT_CLASS}
                />
              </div>
              <div>
                <label className="mb-1.5 block text-xs font-medium text-on-surface-variant">
                  기본 템플릿 수
                </label>
                <input
                  type="number"
                  value={editingPlan.max_default_templates}
                  onChange={(event) =>
                    setEditingPlan(
                      (previous) =>
                        previous && { ...previous, max_default_templates: Number(event.target.value || 0) },
                    )
                  }
                  className={INPUT_CLASS}
                />
              </div>
              <div>
                <label className="mb-1.5 block text-xs font-medium text-on-surface-variant">
                  업로드 템플릿 수
                </label>
                <input
                  type="number"
                  value={editingPlan.max_upload_templates}
                  onChange={(event) =>
                    setEditingPlan(
                      (previous) =>
                        previous && { ...previous, max_upload_templates: Number(event.target.value || 0) },
                    )
                  }
                  className={INPUT_CLASS}
                />
              </div>
              <div className="md:col-span-2">
                <label className="mb-1.5 block text-xs font-medium text-on-surface-variant">설명</label>
                <textarea
                  value={editingPlan.description ?? ''}
                  onChange={(event) =>
                    setEditingPlan((previous) => previous && { ...previous, description: event.target.value })
                  }
                  className={TEXTAREA_CLASS}
                />
              </div>
            </div>

            <div className="mt-6">
              <p className="mb-3 text-xs font-medium text-on-surface-variant">제공 기능</p>
              <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
                {featureKeys.map((featureKey) => (
                  <FeatureCheckbox
                    key={featureKey}
                    checked={Boolean(editingPlan.features?.[featureKey])}
                    label={FEATURE_LABELS[featureKey as keyof typeof FEATURE_LABELS] ?? featureKey}
                    onChange={(next) =>
                      setEditingPlan((previous) =>
                        previous
                          ? {
                              ...previous,
                              features: {
                                ...previous.features,
                                [featureKey]: next,
                              },
                            }
                          : previous,
                      )
                    }
                  />
                ))}
              </div>
            </div>

            <div className="mt-6 flex justify-end gap-3">
              <button
                type="button"
                onClick={() => setEditingPlan(null)}
                className="rounded-xl border border-outline-variant/20 px-4 py-2 text-sm font-medium text-on-surface-variant"
              >
                취소
              </button>
              <button
                type="button"
                onClick={() => void handleSavePlan()}
                disabled={savingPlan}
                className="rounded-xl bg-primary px-4 py-2 text-sm font-semibold text-white disabled:opacity-50"
              >
                {savingPlan ? '저장 중...' : '플랜 저장'}
              </button>
            </div>
          </div>
        </div>
      ) : null}
    </div>
  )
}

