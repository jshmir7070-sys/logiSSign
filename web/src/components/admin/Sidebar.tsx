'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'

interface NavItem {
  label: string
  icon: string
  href: string
}

const navItems: NavItem[] = [
  { label: '대시보드', icon: 'dashboard', href: '/admin/dashboard' },
  { label: '고객사 관리', icon: 'apartment', href: '/admin/agencies' },
  { label: '계약서 템플릿', icon: 'description', href: '/admin/templates' },
  { label: '결제 관리', icon: 'payments', href: '/admin/billing' },
  { label: '매출 분석', icon: 'bar_chart', href: '/admin/revenue' },
  { label: '공지 관리', icon: 'campaign', href: '/admin/notices' },
  { label: '운영 대시보드', icon: 'monitoring', href: '/admin/ops' },
  { label: '서버 상태', icon: 'dns', href: '/admin/server' },
  { label: '감사 로그', icon: 'security', href: '/admin/audit-log' },
  { label: '설정', icon: 'settings', href: '/admin/settings' },
  { label: '운영 가이드', icon: 'help', href: '/admin/guide' },
]

export default function Sidebar() {
  const pathname = usePathname()

  return (
    <aside className="fixed left-0 top-0 bottom-0 z-50 flex w-[240px] flex-col bg-sidebar">
      <div className="px-5 pt-6 pb-4">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src="/logo.png" alt="logiSSign" className="w-[200px] object-contain" />
      </div>

      <nav className="mt-2 flex-1 space-y-0.5 overflow-y-auto px-3">
        {navItems.map((item) => {
          const isActive = pathname === item.href || pathname?.startsWith(item.href + '/')

          return (
            <Link
              key={item.href}
              href={item.href}
              className={`flex items-center gap-3 rounded-xl px-3 py-2.5 transition-all duration-200 ${
                isActive
                  ? 'bg-primary-container text-white'
                  : 'text-white/70 hover:bg-white/[0.06] hover:text-white'
              }`}
            >
              <span
                className={`material-symbols-outlined text-[20px] ${isActive ? 'text-white' : 'text-white/50'}`}
                style={{ fontVariationSettings: "'FILL' 0, 'wght' 300, 'GRAD' 0, 'opsz' 20" }}
              >
                {item.icon}
              </span>
              <span className="font-body text-[13px] font-medium">{item.label}</span>
            </Link>
          )
        })}
      </nav>

      <div className="flex items-center gap-3 bg-white/[0.04] px-4 py-5">
        <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-primary-container/30">
          <span
            className="material-symbols-outlined text-[18px] text-white/80"
            style={{ fontVariationSettings: "'FILL' 1, 'wght' 300, 'GRAD' 0, 'opsz' 20" }}
          >
            person
          </span>
        </div>
        <div className="min-w-0">
          <p className="truncate font-body text-[13px] font-medium text-white/90">관리자 프로필</p>
          <p className="truncate font-body text-[11px] text-white/40">admin@precision.io</p>
        </div>
      </div>
    </aside>
  )
}
