'use client';

import dynamic from 'next/dynamic';
import { useEffect, useState } from 'react';
import Sidebar from '@/components/portal/Sidebar';
import TopStatusBar from '@/components/portal/TopStatusBar';
import { ToastContainer } from '@/components/shared/Toast';
import UserMenu from '@/components/shared/UserMenu';
import { PlanProvider, usePlan } from '@/contexts/PlanContext';
import { isPointBased } from '@/lib/plan-limits';

const CsChatbot = dynamic(() => import('@/components/portal/CsChatbot'), { ssr: false });

function PortalDashboardInner({ children }: { children: React.ReactNode }) {
  const { plan, ownerName, companyName, email } = usePlan();
  const [pointBalance, setPointBalance] = useState<number | undefined>(undefined);

  useEffect(() => {
    if (isPointBased(plan)) {
      fetch('/api/points?action=balance')
        .then((response) => (response.ok ? response.json() : null))
        .then((data) => {
          if (data) setPointBalance(data.balance);
        })
        .catch(() => {});
    }
  }, [plan]);

  return (
    <div className="min-h-screen bg-surface">
      <Sidebar plan={plan} ownerName={ownerName} pointBalance={pointBalance} />

      <header className="fixed top-0 left-[240px] right-0 z-30 px-6 py-3">
        <div className="flex h-[68px] items-center justify-between gap-4 rounded-[28px] border border-white/70 bg-white/88 px-5 shadow-[0_18px_42px_-24px_rgba(15,23,42,0.4)] backdrop-blur-[22px]">
          <div className="min-w-0 flex-1">
            <TopStatusBar pointBalance={pointBalance} onPointBalanceChange={setPointBalance} />
          </div>

          <div className="flex shrink-0 items-center gap-3">
            <button className="relative flex h-11 w-11 items-center justify-center rounded-2xl bg-surface-container-low text-on-surface-variant transition-colors hover:bg-surface-container hover:text-on-surface">
              <svg width="20" height="20" viewBox="0 0 24 24" fill="currentColor">
                <path d="M12 22c1.1 0 2-.9 2-2h-4c0 1.1.89 2 2 2zm6-6v-5c0-3.07-1.64-5.64-4.5-6.32V4c0-.83-.67-1.5-1.5-1.5s-1.5.67-1.5 1.5v.68C7.63 5.36 6 7.92 6 11v5l-2 2v1h16v-1l-2-2z" />
              </svg>
              <span className="absolute -top-1 -right-1 flex h-5 min-w-5 items-center justify-center rounded-full bg-error px-1">
                <span className="text-[10px] text-white font-bold">3</span>
              </span>
            </button>
            <UserMenu
              initials={companyName?.charAt(0) || 'AG'}
              name={companyName}
              email={email}
              redirectTo="/portal/login"
            />
          </div>
        </div>
      </header>

      <main className="min-h-screen pl-[240px] pt-[92px]">
        <div className="p-8">{children}</div>
      </main>

      <CsChatbot />
      <ToastContainer />
    </div>
  );
}

export default function PortalDashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <PlanProvider>
      <PortalDashboardInner>{children}</PortalDashboardInner>
    </PlanProvider>
  );
}
