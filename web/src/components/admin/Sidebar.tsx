'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { useState } from 'react'

interface NavChild {
  label: string
  icon: string
  href: string
}

interface NavItem {
  label: string
  icon: string
  href: string
  children?: NavChild[]
}

const navItems: NavItem[] = [
  { label: '대시보드', icon: 'dashboard', href: '/admin/dashboard' },
  {
    label: '고객/계정 운영',
    icon: 'apartment',
    href: '/admin/agencies',
    children: [
      { label: '고객사 관리', icon: 'apartment', href: '/admin/agencies' },
      { label: '기사 현황', icon: 'badge', href: '/admin/drivers' },
    ],
  },
  {
    label: '문서/콘텐츠',
    icon: 'description',
    href: '/admin/templates',
    children: [
      { label: '계약서 템플릿', icon: 'description', href: '/admin/templates' },
      { label: '공지 관리', icon: 'campaign', href: '/admin/notices' },
      { label: '운영 가이드', icon: 'help', href: '/admin/guide' },
    ],
  },
  {
    label: '결제/매출',
    icon: 'payments',
    href: '/admin/billing',
    children: [
      { label: '결제 관리', icon: 'payments', href: '/admin/billing' },
      { label: '매출 분석', icon: 'bar_chart', href: '/admin/revenue' },
    ],
  },
  {
    label: '시스템 운영',
    icon: 'monitoring',
    href: '/admin/ops',
    children: [
      { label: '운영 대시보드', icon: 'monitoring', href: '/admin/ops' },
      { label: '서버 상태', icon: 'dns', href: '/admin/server' },
      { label: '감사 로그', icon: 'security', href: '/admin/audit-log' },
      { label: '설정', icon: 'settings', href: '/admin/settings' },
    ],
  },
]

export default function Sidebar() {
  const pathname = usePathname()
  const [expandedItem, setExpandedItem] = useState<string | null>('시스템 운영')
  const isActive = (href: string) => pathname === href || pathname?.startsWith(href + '/')

  return (
    <aside className="fixed left-0 top-0 bottom-0 z-50 flex w-[240px] flex-col bg-sidebar">
      <div className="px-5 pt-6 pb-4">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src="/logo.png" alt="logiSSign" className="w-[200px] object-contain" />
      </div>

      <nav className="mt-2 flex-1 space-y-0.5 overflow-y-auto px-3">
        {navItems.map((item) => {
          const active = item.children?.some((child) => isActive(child.href)) || isActive(item.href)
          const expanded = expandedItem === item.label

          return item.children ? (
            <div key={item.href}>
              <button
                type="button"
                onClick={() => setExpandedItem(expanded ? null : item.label)}
                className={`flex w-full items-center gap-3 rounded-xl px-3 py-2.5 transition-all duration-200 ${
                  active
                    ? 'bg-primary-container text-white'
                    : 'text-white/70 hover:bg-white/[0.06] hover:text-white'
                }`}
              >
                <span
                  className={`material-symbols-outlined text-[20px] ${active ? 'text-white' : 'text-white/50'}`}
                  style={{ fontVariationSettings: "'FILL' 0, 'wght' 300, 'GRAD' 0, 'opsz' 20" }}
                >
                  {item.icon}
                </span>
                <span className="flex-1 text-left font-body text-[13px] font-medium">{item.label}</span>
                <span
                  className={`material-symbols-outlined text-[18px] transition-transform ${expanded ? 'rotate-180' : ''}`}
                  style={{ fontVariationSettings: "'FILL' 0, 'wght' 300, 'GRAD' 0, 'opsz' 20" }}
                >
                  expand_more
                </span>
              </button>
              {expanded && (
                <div className="ml-8 mt-1 space-y-0.5">
                  {item.children.map((child) => {
                    const childActive = isActive(child.href)
                    return (
                      <Link
                        key={child.href}
                        href={child.href}
                        className={`flex items-center gap-2 rounded-lg px-3 py-2 text-xs transition-colors ${
                          childActive ? 'bg-white/10 text-white' : 'text-white/50 hover:text-white/80'
                        }`}
                      >
                        <span
                          className="material-symbols-outlined text-[16px]"
                          style={{ fontVariationSettings: "'FILL' 0, 'wght' 300, 'GRAD' 0, 'opsz' 18" }}
                        >
                          {child.icon}
                        </span>
                        <span className="font-body font-medium">{child.label}</span>
                      </Link>
                    )
                  })}
                </div>
              )}
            </div>
          ) : (
            <Link
              key={item.href}
              href={item.href}
              className={`flex items-center gap-3 rounded-xl px-3 py-2.5 transition-all duration-200 ${
                active
                  ? 'bg-primary-container text-white'
                  : 'text-white/70 hover:bg-white/[0.06] hover:text-white'
              }`}
            >
              <span
                className={`material-symbols-outlined text-[20px] ${active ? 'text-white' : 'text-white/50'}`}
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
          <p className="truncate font-body text-[13px] font-medium text-white/90">플랫폼 관리자</p>
          <p className="truncate font-body text-[11px] text-white/40">운영 계정</p>
        </div>
      </div>
    </aside>
  )
}
