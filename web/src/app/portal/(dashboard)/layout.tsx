'use client';

import Sidebar from '@/components/portal/Sidebar';
import UserMenu from '@/components/shared/UserMenu';
import { ToastContainer } from '@/components/shared/Toast';
import { PlanProvider, usePlan } from '@/contexts/PlanContext';
import { useEffect, useState } from 'react';

function PortalDashboardInner({ children }: { children: React.ReactNode }) {
  const { plan, ownerName, companyName, email } = usePlan();
  const [pointBalance, setPointBalance] = useState<number | undefined>(undefined);

  // 포인트형 플랜이면 잔액 조회
  useEffect(() => {
    if (plan === 'point') {
      fetch('/api/points?action=balance')
        .then(r => r.ok ? r.json() : null)
        .then(data => { if (data) setPointBalance(data.balance); })
        .catch(() => {});
    }
  }, [plan]);

  // ✅ 보안: 브라우저 뒤로가기/이력으로 캐시된 페이지 접속 방지
  useEffect(() => {
    const handlePageShow = (e: PageTransitionEvent) => {
      if (e.persisted) {
        // bfcache에서 복원된 페이지 → 새로고침 강제
        window.location.reload();
      }
    };
    window.addEventListener('pageshow', handlePageShow);
    return () => window.removeEventListener('pageshow', handlePageShow);
  }, []);

  return (
    <div className="min-h-screen bg-surface">
      <Sidebar plan={plan} ownerName={ownerName} pointBalance={pointBalance} />

      {/* TopBar — Glass */}
      <header className="fixed top-0 left-[240px] right-0 h-16 bg-white/80 backdrop-blur-[20px] z-30 flex items-center justify-between px-8">
        <div />
        <div className="flex items-center gap-4">
          <button className="relative text-on-surface-variant hover:text-on-surface transition-colors">
            <svg width="22" height="22" viewBox="0 0 24 24" fill="currentColor">
              <path d="M12 22c1.1 0 2-.9 2-2h-4c0 1.1.89 2 2 2zm6-6v-5c0-3.07-1.64-5.64-4.5-6.32V4c0-.83-.67-1.5-1.5-1.5s-1.5.67-1.5 1.5v.68C7.63 5.36 6 7.92 6 11v5l-2 2v1h16v-1l-2-2z" />
            </svg>
            <span className="absolute -top-1 -right-1 w-4 h-4 bg-error rounded-full flex items-center justify-center">
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
      </header>

      <main className="pl-[240px] pt-16 min-h-screen">
        <div className="p-8">
          {children}
        </div>
      </main>

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
