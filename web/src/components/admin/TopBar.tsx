'use client';

import { usePathname } from 'next/navigation';
import UserMenu from '@/components/shared/UserMenu';

const pageTitles: Record<string, string> = {
  '/admin/dashboard': '대시보드',
  '/admin/agencies': '구독사 관리',
  '/admin/billing': '구독/결제',
  '/admin/revenue': '매출 분석',
  '/admin/notices': '공지 관리',
  '/admin/server': '서버 상태',
  '/admin/settings': '설정',
};

export default function TopBar() {
  const pathname = usePathname();
  const title = pageTitles[pathname ?? ''] ?? '관리자';

  return (
    <header className="fixed top-0 left-[240px] right-0 h-16 bg-white/80 backdrop-blur-[20px] z-40 flex items-center justify-between px-8">
      {/* Page Title */}
      <h1 className="font-headline text-on-surface text-[18px] font-bold tracking-tight">
        {title}
      </h1>

      {/* Right Side Actions */}
      <div className="flex items-center gap-4">
        {/* Search */}
        <div className="relative">
          <span
            className="material-symbols-outlined absolute left-3 top-1/2 -translate-y-1/2 text-on-surface-variant/60 text-[18px]"
            style={{ fontVariationSettings: "'FILL' 0, 'wght' 300, 'GRAD' 0, 'opsz' 18" }}
          >
            search
          </span>
          <input
            type="text"
            placeholder="검색..."
            className="w-[220px] h-9 pl-9 pr-4 rounded-xl bg-surface-container-low text-on-surface font-body text-[13px] placeholder:text-on-surface-variant/40 focus:outline-none focus:ring-2 focus:ring-primary/20 transition-all"
          />
        </div>

        {/* Notification Bell */}
        <button className="relative w-9 h-9 rounded-xl flex items-center justify-center hover:bg-surface-container-low transition-colors">
          <span
            className="material-symbols-outlined text-on-surface-variant text-[20px]"
            style={{ fontVariationSettings: "'FILL' 0, 'wght' 300, 'GRAD' 0, 'opsz' 20" }}
          >
            notifications
          </span>
          <span className="absolute top-1.5 right-1.5 w-2 h-2 rounded-full bg-error" />
        </button>

        {/* User Menu */}
        <UserMenu
          initials="A"
          name="Super Admin"
          email="admin@precision.io"
          redirectTo="/admin/login"
        />
      </div>
    </header>
  );
}
