'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';

interface NavItem {
  label: string;
  icon: string;
  href: string;
}

const navItems: NavItem[] = [
  { label: '대시보드', icon: 'dashboard', href: '/admin/dashboard' },
  { label: '구독사 관리', icon: 'apartment', href: '/admin/agencies' },
  { label: '계약서 템플릿', icon: 'description', href: '/admin/templates' },
  { label: '구독/결제', icon: 'payments', href: '/admin/billing' },
  { label: '매출 분석', icon: 'bar_chart', href: '/admin/revenue' },
  { label: '공지 관리', icon: 'campaign', href: '/admin/notices' },
  { label: '서버 상태', icon: 'dns', href: '/admin/server' },
  { label: '감사 로그', icon: 'security', href: '/admin/audit-log' },
  { label: '설정', icon: 'settings', href: '/admin/settings' },
];

export default function Sidebar() {
  const pathname = usePathname();

  return (
    <aside className="fixed left-0 top-0 bottom-0 w-[240px] bg-sidebar flex flex-col z-50">
      {/* Logo */}
      <div className="px-6 py-7 flex items-center gap-3">
        <div className="w-9 h-9 rounded-xl bg-power-gradient flex items-center justify-center">
          <span className="material-symbols-outlined text-white text-[20px]">
            bolt
          </span>
        </div>
        <div>
          <p className="text-white font-headline text-[15px] font-bold leading-tight tracking-tight">
            Precision
          </p>
          <p className="text-white/60 font-headline text-[11px] font-medium tracking-widest uppercase">
            Velocity
          </p>
        </div>
      </div>

      {/* Navigation */}
      <nav className="flex-1 px-3 mt-2 space-y-0.5 overflow-y-auto">
        {navItems.map((item) => {
          const isActive = pathname === item.href || pathname?.startsWith(item.href + '/');

          return (
            <Link
              key={item.href}
              href={item.href}
              className={`
                flex items-center gap-3 px-3 py-2.5 rounded-xl transition-all duration-200
                ${isActive
                  ? 'bg-primary-container text-white'
                  : 'text-white/70 hover:text-white hover:bg-white/[0.06]'
                }
              `}
            >
              <span
                className={`
                  material-symbols-outlined text-[20px]
                  ${isActive ? 'text-white' : 'text-white/50'}
                `}
                style={{ fontVariationSettings: "'FILL' 0, 'wght' 300, 'GRAD' 0, 'opsz' 20" }}
              >
                {item.icon}
              </span>
              <span className="font-body text-[13px] font-medium">
                {item.label}
              </span>
            </Link>
          );
        })}
      </nav>

      {/* Admin Profile */}
      <div className="px-4 py-5 flex items-center gap-3 bg-white/[0.04]">
        <div className="w-9 h-9 rounded-full bg-primary-container/30 flex items-center justify-center shrink-0">
          <span
            className="material-symbols-outlined text-white/80 text-[18px]"
            style={{ fontVariationSettings: "'FILL' 1, 'wght' 300, 'GRAD' 0, 'opsz' 20" }}
          >
            person
          </span>
        </div>
        <div className="min-w-0">
          <p className="text-white/90 font-body text-[13px] font-medium truncate">
            Admin Profile
          </p>
          <p className="text-white/40 font-body text-[11px] truncate">
            admin@precision.io
          </p>
        </div>
      </div>
    </aside>
  );
}
