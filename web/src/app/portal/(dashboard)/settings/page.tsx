'use client'

import { useEffect, useState } from 'react'
import { useSearchParams } from 'next/navigation'
import { createBrowserSupabaseClient } from '@/lib/supabase'
import AdminsTab from '@/components/portal/settings/AdminsTab'
import BillingTab from '@/components/portal/settings/BillingTab'
import NotificationTab from '@/components/portal/settings/NotificationTab'
import ProfileTab from '@/components/portal/settings/ProfileTab'
import SealTab from '@/components/portal/settings/SealTab'

type SettingsTab = 'profile' | 'seal' | 'billing' | 'notification' | 'admins'

const VALID_TABS: SettingsTab[] = ['profile', 'seal', 'billing', 'notification', 'admins']

export default function PortalSettingsPage() {
  const searchParams = useSearchParams()
  const tabParam = searchParams.get('tab')
  const isWelcome = searchParams.get('welcome') === '1'
  const [activeTab, setActiveTab] = useState<SettingsTab>(
    VALID_TABS.includes(tabParam as SettingsTab) ? (tabParam as SettingsTab) : 'profile',
  )
  const [agencyId, setAgencyId] = useState<string | null>(null)
  const [userPlan, setUserPlan] = useState<string>('free')

  useEffect(() => {
    async function init() {
      const supabase = createBrowserSupabaseClient()
      const {
        data: { user },
      } = await supabase.auth.getUser()

      if (user) {
        setAgencyId((user.app_metadata?.agency_id as string) ?? null)
        setUserPlan((user.app_metadata?.plan as string) ?? 'free')
      }
    }

    void init()
  }, [])

  const tabs: Array<{ id: SettingsTab; label: string }> = [
    { id: 'profile', label: '기본 정보' },
    { id: 'admins', label: '관리자 계정' },
    { id: 'seal', label: '도장 / 서명' },
    { id: 'billing', label: '결제 관리' },
    { id: 'notification', label: '알림 설정' },
  ]

  return (
    <div className="space-y-8">
      {isWelcome ? (
        <div className="flex items-start gap-3 rounded-2xl border border-primary/20 bg-primary/[0.06] p-5">
          <div className="mt-0.5 flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-primary/15 text-primary">
            <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M22 11.08V12a10 10 0 1 1-5.93-9.14" />
              <polyline points="22 4 12 14.01 9 11.01" />
            </svg>
          </div>
          <div>
            <h2 className="font-korean text-sm font-bold text-on-surface">가입이 완료되었습니다.</h2>
            <p className="mt-1 font-korean text-xs text-on-surface-variant">
              계약서에 사용할 도장과 서명을 먼저 준비해 두면, 일반 도장과 법인 도장, 직접 그린 서명까지
              빠르게 등록할 수 있습니다.
            </p>
            <button
              onClick={() => setActiveTab('seal')}
              className="mt-2 font-korean text-xs font-semibold text-primary hover:underline"
            >
              도장 만들기
            </button>
          </div>
        </div>
      ) : null}

      <div>
        <h1 className="font-headline font-korean text-2xl font-bold text-on-surface">설정</h1>
        <p className="mt-1 font-korean text-sm text-on-surface-variant">
          대리점 정보와 운영에 필요한 기본 설정을 관리합니다.
        </p>
      </div>

      <div className="flex flex-wrap gap-2">
        {tabs.map((tab) => (
          <button
            key={tab.id}
            onClick={() => setActiveTab(tab.id)}
            className={`rounded-xl px-4 py-2 font-korean text-sm font-medium transition-colors ${
              activeTab === tab.id
                ? 'bg-primary text-white'
                : 'bg-surface-container-low text-on-surface-variant hover:bg-surface-container-high'
            }`}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {activeTab === 'profile' ? <ProfileTab /> : null}
      {activeTab === 'admins' && agencyId ? <AdminsTab agencyId={agencyId} plan={userPlan} /> : null}
      {activeTab === 'seal' && agencyId ? <SealTab agencyId={agencyId} /> : null}
      {activeTab === 'billing' ? <BillingTab /> : null}
      {activeTab === 'notification' ? <NotificationTab /> : null}
    </div>
  )
}
