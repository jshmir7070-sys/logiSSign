'use client';

import { useEffect, useState } from 'react';
import { useSearchParams } from 'next/navigation';
import { createBrowserSupabaseClient } from '@/lib/supabase';
import ProfileTab from '@/components/portal/settings/ProfileTab';
import CategoryTab from '@/components/portal/settings/CategoryTab';
import SealTab from '@/components/portal/settings/SealTab';
import BillingTab from '@/components/portal/settings/BillingTab';
import NotificationTab from '@/components/portal/settings/NotificationTab';
import AdminsTab from '@/components/portal/settings/AdminsTab';

type SettingsTab = 'profile' | 'category' | 'seal' | 'billing' | 'notification' | 'admins';
const VALID_TABS: SettingsTab[] = ['profile', 'category', 'seal', 'billing', 'notification', 'admins'];

export default function PortalSettingsPage() {
  const searchParams = useSearchParams();
  const tabParam = searchParams.get('tab');
  const isWelcome = searchParams.get('welcome') === '1';
  const [activeTab, setActiveTab] = useState<SettingsTab>(
    VALID_TABS.includes(tabParam as SettingsTab) ? (tabParam as SettingsTab) : 'profile'
  );
  const [agencyId, setAgencyId] = useState<string | null>(null);
  const [userPlan, setUserPlan] = useState<string>('free');

  useEffect(() => {
    async function init() {
      const supabase = createBrowserSupabaseClient();
      const { data: { user } } = await supabase.auth.getUser();
      if (user) {
        setAgencyId(user.app_metadata?.agency_id as string ?? null);
        setUserPlan(user.app_metadata?.plan as string ?? 'free');
      }
    }
    init();
  }, []);

  const tabs = [
    { id: 'profile' as const, label: '프로필' },
    { id: 'admins' as const, label: '관리자 계정' },
    { id: 'category' as const, label: '카테고리 관리' },
    { id: 'seal' as const, label: '도장/서명' },
    { id: 'billing' as const, label: '구독/결제' },
    { id: 'notification' as const, label: '알림 설정' },
  ];

  return (
    <div className="space-y-8">
      {isWelcome && (
        <div className="bg-primary/[0.06] border border-primary/20 rounded-2xl p-5 flex items-start gap-3">
          <div className="w-10 h-10 rounded-full bg-primary/15 text-primary flex items-center justify-center shrink-0 mt-0.5">
            <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"/><polyline points="22 4 12 14.01 9 11.01"/></svg>
          </div>
          <div>
            <h2 className="text-sm font-bold text-on-surface font-korean">가입이 완료되었습니다!</h2>
            <p className="text-xs text-on-surface-variant font-korean mt-1">
              계약서에 사용할 도장을 지금 만들어보세요. 일반 도장, 법인 도장, 또는 실물 도장을 업로드할 수 있습니다.
            </p>
            <button
              onClick={() => setActiveTab('seal')}
              className="mt-2 text-xs text-primary font-semibold font-korean hover:underline"
            >
              도장 만들기 →
            </button>
          </div>
        </div>
      )}
      <div>
        <h1 className="text-2xl font-headline font-bold text-on-surface font-korean">설정</h1>
        <p className="mt-1 text-sm text-on-surface-variant font-korean">대리점 정보 및 서비스 설정을 관리합니다</p>
      </div>

      {/* Tabs */}
      <div className="flex gap-2">
        {tabs.map((tab) => (
          <button
            key={tab.id}
            onClick={() => setActiveTab(tab.id)}
            className={`px-4 py-2 rounded-xl text-sm font-label font-medium transition-colors font-korean ${
              activeTab === tab.id
                ? 'bg-primary text-white'
                : 'bg-surface-container-low text-on-surface-variant hover:bg-surface-container-high'
            }`}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {activeTab === 'profile' && <ProfileTab />}
      {activeTab === 'admins' && agencyId && <AdminsTab agencyId={agencyId} plan={userPlan} />}
      {activeTab === 'category' && agencyId && <CategoryTab agencyId={agencyId} />}
      {activeTab === 'seal' && agencyId && <SealTab agencyId={agencyId} />}
      {activeTab === 'billing' && <BillingTab />}
      {activeTab === 'notification' && <NotificationTab />}
    </div>
  );
}
