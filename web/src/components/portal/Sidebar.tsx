'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useState } from 'react';

interface NavItem {
  label: string;
  icon: React.ReactNode;
  href: string;
  children?: { label: string; href: string }[];
}

const navItems: NavItem[] = [
  {
    label: '대시보드',
    icon: (
      <svg width="20" height="20" viewBox="0 0 24 24" fill="currentColor">
        <path d="M3 13h8V3H3v10zm0 8h8v-6H3v6zm10 0h8V11h-8v10zm0-18v6h8V3h-8z" />
      </svg>
    ),
    href: '/portal/dashboard',
  },
  {
    label: '기사 관리',
    icon: (
      <svg width="20" height="20" viewBox="0 0 24 24" fill="currentColor">
        <path d="M16 11c1.66 0 2.99-1.34 2.99-3S17.66 5 16 5c-1.66 0-3 1.34-3 3s1.34 3 3 3zm-8 0c1.66 0 2.99-1.34 2.99-3S9.66 5 8 5C6.34 5 5 6.34 5 8s1.34 3 3 3zm0 2c-2.33 0-7 1.17-7 3.5V19h14v-2.5c0-2.33-4.67-3.5-7-3.5zm8 0c-.29 0-.62.02-.97.05 1.16.84 1.97 1.97 1.97 3.45V19h6v-2.5c0-2.33-4.67-3.5-7-3.5z" />
      </svg>
    ),
    href: '/portal/drivers',
  },
  {
    label: '계약서 관리',
    icon: (
      <svg width="20" height="20" viewBox="0 0 24 24" fill="currentColor">
        <path d="M14 2H6c-1.1 0-1.99.9-1.99 2L4 20c0 1.1.89 2 1.99 2H18c1.1 0 2-.9 2-2V8l-6-6zm2 16H8v-2h8v2zm0-4H8v-2h8v2zm-3-5V3.5L18.5 9H13z" />
      </svg>
    ),
    href: '/portal/contracts',
    children: [
      { label: '계약서 목록', href: '/portal/contracts' },
      { label: '계약서 양식', href: '/portal/contracts/templates' },
      { label: '변경이력', href: '/portal/amendments' },
      { label: '외부문서 관리', href: '/portal/documents' },
    ],
  },
  {
    label: '정산 관리',
    icon: (
      <svg width="20" height="20" viewBox="0 0 24 24" fill="currentColor">
        <path d="M4 10v7h3v-7H4zm6 0v7h3v-7h-3zM2 22h19v-3H2v3zm14-12v7h3v-7h-3zm-4.5-9L2 6v2h19V6l-9.5-5z" />
      </svg>
    ),
    href: '/portal/settlements/generate',
    children: [
      { label: '원청사 관리', href: '/portal/principals' },
      { label: '엑셀 업로드 정산', href: '/portal/settlements/upload' },
      { label: '정산서 일괄생성', href: '/portal/settlements/generate' },
      { label: '정산서 양식 편집', href: '/portal/settlements/builder' },
      { label: '생성 이력', href: '/portal/settlements/history' },
      { label: '세금계산서', href: '/portal/tax-invoices' },
    ],
  },
  {
    label: '매출 리포트',
    icon: (
      <svg width="20" height="20" viewBox="0 0 24 24" fill="currentColor">
        <path d="M5 9.2h3V19H5zM10.6 5h2.8v14h-2.8zm5.6 8H19v6h-2.8z" />
      </svg>
    ),
    href: '/portal/reports',
  },
  {
    label: '공지 관리',
    icon: (
      <svg width="20" height="20" viewBox="0 0 24 24" fill="currentColor">
        <path d="M18 11v2h4v-2h-4zm-2 6.61c.96.71 2.21 1.65 3.2 2.39.4-.53.8-1.07 1.2-1.6-.99-.74-2.24-1.68-3.2-2.4-.4.54-.8 1.08-1.2 1.61zM20.4 5.6c-.4-.53-.8-1.07-1.2-1.6-.99.74-2.24 1.68-3.2 2.4.4.53.8 1.07 1.2 1.6.96-.72 2.21-1.65 3.2-2.4zM4 9c-1.1 0-2 .9-2 2v2c0 1.1.9 2 2 2h1l5 3V6L5 9H4zm11.5 3c0-1.33-.58-2.53-1.5-3.35v6.69c.92-.81 1.5-2.01 1.5-3.34z" />
      </svg>
    ),
    href: '/portal/notices',
  },
  {
    label: '설정',
    icon: (
      <svg width="20" height="20" viewBox="0 0 24 24" fill="currentColor">
        <path d="M19.14 12.94c.04-.3.06-.61.06-.94 0-.32-.02-.64-.07-.94l2.03-1.58a.49.49 0 00.12-.61l-1.92-3.32a.49.49 0 00-.59-.22l-2.39.96c-.5-.38-1.03-.7-1.62-.94l-.36-2.54a.484.484 0 00-.48-.41h-3.84c-.24 0-.43.17-.47.41l-.36 2.54c-.59.24-1.13.57-1.62.94l-2.39-.96c-.22-.08-.47 0-.59.22L2.74 8.87c-.12.21-.08.47.12.61l2.03 1.58c-.05.3-.07.62-.07.94s.02.64.07.94l-2.03 1.58a.49.49 0 00-.12.61l1.92 3.32c.12.22.37.29.59.22l2.39-.96c.5.38 1.03.7 1.62.94l.36 2.54c.05.24.24.41.48.41h3.84c.24 0 .44-.17.47-.41l.36-2.54c.59-.24 1.13-.56 1.62-.94l2.39.96c.22.08.47 0 .59-.22l1.92-3.32c.12-.22.07-.47-.12-.61l-2.01-1.58zM12 15.6c-1.98 0-3.6-1.62-3.6-3.6s1.62-3.6 3.6-3.6 3.6 1.62 3.6 3.6-1.62 3.6-3.6 3.6z" />
      </svg>
    ),
    href: '/portal/settings',
  },
];

const PLAN_LABELS: Record<string, string> = {
  free: 'Free',
  basic: 'Basic',
  standard: 'Standard',
  enterprise: 'Enterprise',
};

export default function Sidebar({ plan, ownerName }: { plan?: string; ownerName?: string }) {
  const pathname = usePathname();
  const [expandedItem, setExpandedItem] = useState<string | null>('정산 관리');

  const isActive = (href: string) => pathname === href || pathname.startsWith(href + '/');
  const isParentActive = (item: NavItem) =>
    item.children?.some((child) => isActive(child.href)) || isActive(item.href);

  return (
    <aside className="fixed left-0 top-0 bottom-0 w-[240px] bg-sidebar flex flex-col z-40">
      {/* Brand */}
      <div className="px-5 pt-7 pb-5">
        <img src="/logo.png" alt="logiSSign" className="h-12 object-contain" />
      </div>

      {/* Navigation */}
      <nav className="flex-1 px-3 overflow-y-auto">
        <ul className="flex flex-col gap-1">
          {navItems.map((item) => {
            const active = isParentActive(item);
            const expanded = expandedItem === item.label;

            return (
              <li key={item.label}>
                {item.children ? (
                  <>
                    <button
                      onClick={() =>
                        setExpandedItem(expanded ? null : item.label)
                      }
                      className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-label transition-colors ${
                        active
                          ? 'bg-primary-container text-white'
                          : 'text-white/60 hover:text-white/90 hover:bg-white/5'
                      }`}
                    >
                      <span className={active ? 'text-white' : 'text-white/50'}>
                        {item.icon}
                      </span>
                      <span className="flex-1 text-left font-korean">{item.label}</span>
                      <svg
                        width="16"
                        height="16"
                        viewBox="0 0 24 24"
                        fill="currentColor"
                        className={`transition-transform ${expanded ? 'rotate-180' : ''}`}
                      >
                        <path d="M7.41 8.59L12 13.17l4.59-4.58L18 10l-6 6-6-6 1.41-1.41z" />
                      </svg>
                    </button>
                    {expanded && (
                      <ul className="mt-1 ml-8 flex flex-col gap-0.5">
                        {item.children.map((child) => (
                          <li key={child.href}>
                            <Link
                              href={child.href}
                              className={`block px-3 py-2 rounded-lg text-xs font-label transition-colors ${
                                isActive(child.href)
                                  ? 'text-white bg-white/10'
                                  : 'text-white/50 hover:text-white/80'
                              }`}
                            >
                              <span className="font-korean">{child.label}</span>
                            </Link>
                          </li>
                        ))}
                      </ul>
                    )}
                  </>
                ) : (
                  <Link
                    href={item.href}
                    className={`flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-label transition-colors ${
                      active
                        ? 'bg-primary-container text-white'
                        : 'text-white/60 hover:text-white/90 hover:bg-white/5'
                    }`}
                  >
                    <span className={active ? 'text-white' : 'text-white/50'}>
                      {item.icon}
                    </span>
                    <span className="font-korean">{item.label}</span>
                  </Link>
                )}
              </li>
            );
          })}
        </ul>
      </nav>

      {/* Agency Profile */}
      <div className="px-4 py-5">
        <div className="flex items-center gap-3 px-2">
          <div className="w-9 h-9 rounded-full bg-primary-container flex items-center justify-center">
            <span className="text-white text-xs font-bold">{ownerName ? ownerName.charAt(0) : 'U'}</span>
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-white/40 text-[10px] font-label">{PLAN_LABELS[plan || 'free'] || 'Free'} 고객님</p>
            <p className="text-white text-sm font-korean truncate">{ownerName || '—'}</p>
          </div>
        </div>
      </div>
    </aside>
  );
}
