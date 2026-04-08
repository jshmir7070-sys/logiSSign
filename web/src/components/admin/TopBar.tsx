'use client'

import { usePathname } from 'next/navigation'
import UserMenu from '@/components/shared/UserMenu'

const pageTitles: Record<string, string> = {
  '/admin/dashboard': '대시보드',
  '/admin/agencies': '고객사 관리',
  '/admin/billing': '구독·결제',
  '/admin/revenue': '매출 분석',
  '/admin/notices': '공지 관리',
  '/admin/ops': '운영 대시보드',
  '/admin/server': '서버 상태',
  '/admin/settings': '설정',
  '/admin/guide': '운영 가이드',
}

export default function TopBar() {
  const pathname = usePathname()
  const title = pageTitles[pathname ?? ''] ?? '관리자'

  return (
    <header className="fixed left-[240px] right-0 top-0 z-40 flex h-16 items-center justify-between bg-white/80 px-8 backdrop-blur-[20px]">
      <h1 className="font-headline text-[18px] font-bold tracking-tight text-on-surface">{title}</h1>

      <div className="flex items-center gap-4">
        <div className="relative">
          <span
            className="material-symbols-outlined absolute left-3 top-1/2 -translate-y-1/2 text-[18px] text-on-surface-variant/60"
            style={{ fontVariationSettings: "'FILL' 0, 'wght' 300, 'GRAD' 0, 'opsz' 18" }}
          >
            search
          </span>
          <input
            type="text"
            placeholder="검색"
            className="h-9 w-[220px] rounded-xl bg-surface-container-low pl-9 pr-4 font-body text-[13px] text-on-surface placeholder:text-on-surface-variant/40 transition-all focus:outline-none focus:ring-2 focus:ring-primary/20"
          />
        </div>

        <button className="relative flex h-9 w-9 items-center justify-center rounded-xl transition-colors hover:bg-surface-container-low">
          <span
            className="material-symbols-outlined text-[20px] text-on-surface-variant"
            style={{ fontVariationSettings: "'FILL' 0, 'wght' 300, 'GRAD' 0, 'opsz' 20" }}
          >
            notifications
          </span>
          <span className="absolute right-1.5 top-1.5 h-2 w-2 rounded-full bg-error" />
        </button>

        <UserMenu initials="A" name="Super Admin" email="admin@precision.io" redirectTo="/admin/login" />
      </div>
    </header>
  )
}
