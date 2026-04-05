'use client';

import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { useState } from 'react';
import { type PlanFeature, hasFeature, PLAN_LABELS as PLAN_LABEL_MAP, getMinimumPlan } from '@/lib/plan-limits';
import { toastWarning } from '@/components/shared/Toast';

interface NavChild {
  label: string;
  href: string;
  featureKey?: PlanFeature;
}

interface NavItem {
  label: string;
  icon: React.ReactNode;
  href: string;
  featureKey?: PlanFeature;
  children?: NavChild[];
}

const LockIcon = () => (
  <svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor" className="text-white/30 shrink-0">
    <rect x="3" y="11" width="18" height="11" rx="2" ry="2" />
    <path d="M7 11V7a5 5 0 0110 0v4" />
  </svg>
);

const navItems: NavItem[] = [
  {
    label: '대시보드',
    icon: (
      <svg width="20" height="20" viewBox="0 0 24 24" fill="currentColor">
        <path d="M3 13h8V3H3v10zm0 8h8v-6H3v6zm10 0h8V11h-8v10zm0-18v6h8V3h-8z" />
      </svg>
    ),
    href: '/portal/dashboard',
    featureKey: 'dashboard',
  },
  {
    label: '기사 관리',
    icon: (
      <svg width="20" height="20" viewBox="0 0 24 24" fill="currentColor">
        <path d="M16 11c1.66 0 2.99-1.34 2.99-3S17.66 5 16 5c-1.66 0-3 1.34-3 3s1.34 3 3 3zm-8 0c1.66 0 2.99-1.34 2.99-3S9.66 5 8 5C6.34 5 5 6.34 5 8s1.34 3 3 3zm0 2c-2.33 0-7 1.17-7 3.5V19h14v-2.5c0-2.33-4.67-3.5-7-3.5zm8 0c-.29 0-.62.02-.97.05 1.16.84 1.97 1.97 1.97 3.45V19h6v-2.5c0-2.33-4.67-3.5-7-3.5z" />
      </svg>
    ),
    href: '/portal/drivers',
    featureKey: 'drivers',
  },
  {
    label: '계약서 관리',
    icon: (
      <svg width="20" height="20" viewBox="0 0 24 24" fill="currentColor">
        <path d="M14 2H6c-1.1 0-1.99.9-1.99 2L4 20c0 1.1.89 2 1.99 2H18c1.1 0 2-.9 2-2V8l-6-6zm2 16H8v-2h8v2zm0-4H8v-2h8v2zm-3-5V3.5L18.5 9H13z" />
      </svg>
    ),
    href: '/portal/contracts',
    featureKey: 'contracts',
    children: [
      { label: '새 계약서 발송', href: '/portal/contracts/new', featureKey: 'contracts' },
      { label: '계약서 목록', href: '/portal/contracts', featureKey: 'contracts' },
      { label: '계약서 양식', href: '/portal/contracts/templates', featureKey: 'contracts.templates' },
      { label: '문서함', href: '/portal/documents', featureKey: 'contracts' },
      { label: '변경이력', href: '/portal/amendments', featureKey: 'contracts' },
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
    featureKey: 'settlements.basic',
    children: [
      { label: '원청사 관리', href: '/portal/principals', featureKey: 'settlements.basic' },
      { label: '엑셀 업로드 정산', href: '/portal/settlements/upload', featureKey: 'settlements.upload' },
      { label: '정산서 일괄생성', href: '/portal/settlements/generate', featureKey: 'settlements.basic' },
      { label: '정산서 양식 편집', href: '/portal/settlements/builder', featureKey: 'settlements.builder' },
      { label: '생성 이력', href: '/portal/settlements/history', featureKey: 'settlements.basic' },
      { label: '세금계산서', href: '/portal/tax-invoices', featureKey: 'settlements.tax' },
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
    featureKey: 'reports',
  },
  {
    label: '공지 관리',
    icon: (
      <svg width="20" height="20" viewBox="0 0 24 24" fill="currentColor">
        <path d="M18 11v2h4v-2h-4zm-2 6.61c.96.71 2.21 1.65 3.2 2.39.4-.53.8-1.07 1.2-1.6-.99-.74-2.24-1.68-3.2-2.4-.4.54-.8 1.08-1.2 1.61zM20.4 5.6c-.4-.53-.8-1.07-1.2-1.6-.99.74-2.24 1.68-3.2 2.4.4.53.8 1.07 1.2 1.6.96-.72 2.21-1.65 3.2-2.4zM4 9c-1.1 0-2 .9-2 2v2c0 1.1.9 2 2 2h1l5 3V6L5 9H4zm11.5 3c0-1.33-.58-2.53-1.5-3.35v6.69c.92-.81 1.5-2.01 1.5-3.34z" />
      </svg>
    ),
    href: '/portal/notices',
    featureKey: 'notices',
  },
  {
    label: '설정',
    icon: (
      <svg width="20" height="20" viewBox="0 0 24 24" fill="currentColor">
        <path d="M19.14 12.94c.04-.3.06-.61.06-.94 0-.32-.02-.64-.07-.94l2.03-1.58a.49.49 0 00.12-.61l-1.92-3.32a.49.49 0 00-.59-.22l-2.39.96c-.5-.38-1.03-.7-1.62-.94l-.36-2.54a.484.484 0 00-.48-.41h-3.84c-.24 0-.43.17-.47.41l-.36 2.54c-.59.24-1.13.57-1.62.94l-2.39-.96c-.22-.08-.47 0-.59.22L2.74 8.87c-.12.21-.08.47.12.61l2.03 1.58c-.05.3-.07.62-.07.94s.02.64.07.94l-2.03 1.58a.49.49 0 00-.12.61l1.92 3.32c.12.22.37.29.59.22l2.39-.96c.5.38 1.03.7 1.62.94l.36 2.54c.05.24.24.41.48.41h3.84c.24 0 .44-.17.47-.41l.36-2.54c.59-.24 1.13-.56 1.62-.94l2.39.96c.22.08.47 0 .59-.22l1.92-3.32c.12-.22.07-.47-.12-.61l-2.01-1.58zM12 15.6c-1.98 0-3.6-1.62-3.6-3.6s1.62-3.6 3.6-3.6 3.6 1.62 3.6 3.6-1.62 3.6-3.6 3.6z" />
      </svg>
    ),
    href: '/portal/settings',
    featureKey: 'settings',
  },
  {
    label: '사용 가이드',
    icon: (
      <svg width="20" height="20" viewBox="0 0 24 24" fill="currentColor">
        <path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm1 17h-2v-2h2v2zm2.07-7.75l-.9.92C13.45 12.9 13 13.5 13 15h-2v-.5c0-1.1.45-2.1 1.17-2.83l1.24-1.26c.37-.36.59-.86.59-1.41 0-1.1-.9-2-2-2s-2 .9-2 2H8c0-2.21 1.79-4 4-4s4 1.79 4 4c0 .88-.36 1.68-.93 2.25z" />
      </svg>
    ),
    href: '/portal/guide',
  },
];

export default function Sidebar({ plan, ownerName, pointBalance }: { plan?: string; ownerName?: string; pointBalance?: number }) {
  const pathname = usePathname();
  const router = useRouter();
  const [expandedItem, setExpandedItem] = useState<string | null>('정산 관리');

  const isActive = (href: string) => pathname === href || pathname.startsWith(href + '/');
  const isParentActive = (item: NavItem) =>
    item.children?.some((child) => isActive(child.href)) || isActive(item.href);

  const handleLockedClick = (feature: PlanFeature) => {
    const minPlan = getMinimumPlan(feature);
    const label = PLAN_LABEL_MAP[minPlan] || minPlan;
    toastWarning(`${label} 플랜부터 이용 가능합니다`);
    router.push('/portal/settings?tab=billing');
  };

  return (
    <aside className="fixed left-0 top-0 bottom-0 w-[240px] bg-sidebar flex flex-col z-40">
      {/* Brand */}
      <div className="px-6 pt-6 pb-4">
        <img src="/logo.png" alt="logiSSign" className="w-[200px] object-contain" />
      </div>

      {/* Navigation */}
      <nav className="flex-1 px-3 overflow-y-auto">
        <ul className="flex flex-col gap-1">
          {navItems.map((item) => {
            const active = isParentActive(item);
            const expanded = expandedItem === item.label;
            const locked = item.featureKey ? !hasFeature(plan, item.featureKey) : false;

            return (
              <li key={item.label}>
                {item.children ? (
                  <>
                    <button
                      onClick={() => {
                        if (locked) { handleLockedClick(item.featureKey!); return; }
                        setExpandedItem(expanded ? null : item.label);
                      }}
                      className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-label transition-colors ${
                        locked
                          ? 'text-white/30 cursor-not-allowed'
                          : active
                            ? 'bg-primary-container text-white'
                            : 'text-white/60 hover:text-white/90 hover:bg-white/5'
                      }`}
                    >
                      <span className={locked ? 'text-white/20' : active ? 'text-white' : 'text-white/50'}>
                        {item.icon}
                      </span>
                      <span className="flex-1 text-left font-korean">{item.label}</span>
                      {locked ? (
                        <LockIcon />
                      ) : (
                        <svg
                          width="16"
                          height="16"
                          viewBox="0 0 24 24"
                          fill="currentColor"
                          className={`transition-transform ${expanded ? 'rotate-180' : ''}`}
                        >
                          <path d="M7.41 8.59L12 13.17l4.59-4.58L18 10l-6 6-6-6 1.41-1.41z" />
                        </svg>
                      )}
                    </button>
                    {expanded && !locked && (
                      <ul className="mt-1 ml-8 flex flex-col gap-0.5">
                        {item.children.map((child) => {
                          const childLocked = child.featureKey ? !hasFeature(plan, child.featureKey) : false;

                          if (childLocked) {
                            return (
                              <li key={child.href}>
                                <button
                                  onClick={() => handleLockedClick(child.featureKey!)}
                                  className="w-full flex items-center justify-between px-3 py-2 rounded-lg text-xs font-label text-white/25 cursor-not-allowed"
                                >
                                  <span className="font-korean">{child.label}</span>
                                  <LockIcon />
                                </button>
                              </li>
                            );
                          }

                          return (
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
                          );
                        })}
                      </ul>
                    )}
                  </>
                ) : locked ? (
                  <button
                    onClick={() => handleLockedClick(item.featureKey!)}
                    className="w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-label text-white/30 cursor-not-allowed"
                  >
                    <span className="text-white/20">{item.icon}</span>
                    <span className="flex-1 text-left font-korean">{item.label}</span>
                    <LockIcon />
                  </button>
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

      {/* Point Balance (포인트형 플랜일 때) */}
      {plan === 'point' && pointBalance !== undefined && (
        <div className="mx-4 mb-2">
          <Link href="/portal/settings?tab=billing"
            className="flex items-center justify-between px-3 py-2.5 rounded-xl bg-white/5 hover:bg-white/10 transition-colors">
            <div className="flex items-center gap-2">
              <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor" className="text-amber-400">
                <path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm1.41 16.09V20h-2.67v-1.93c-1.71-.36-3.16-1.46-3.27-3.4h1.96c.1 1.05.82 1.87 2.65 1.87 1.96 0 2.4-.98 2.4-1.59 0-.83-.44-1.61-2.67-2.14-2.48-.6-4.18-1.62-4.18-3.67 0-1.72 1.39-2.84 3.11-3.21V4h2.67v1.95c1.86.45 2.79 1.86 2.85 3.39H14.3c-.05-1.11-.64-1.87-2.22-1.87-1.5 0-2.4.68-2.4 1.64 0 .84.65 1.39 2.67 1.94s4.18 1.36 4.18 3.85c0 1.89-1.44 2.96-3.12 3.19z"/>
              </svg>
              <span className="text-white/60 text-xs font-korean">잔여 포인트</span>
            </div>
            <span className={`text-sm font-data font-bold ${pointBalance > 1000 ? 'text-amber-400' : 'text-error'}`}>
              {pointBalance.toLocaleString('ko-KR')}P
            </span>
          </Link>
        </div>
      )}

      {/* Agency Profile */}
      <div className="px-4 py-5">
        <div className="flex items-center gap-3 px-2">
          <div className="w-9 h-9 rounded-full bg-primary-container flex items-center justify-center">
            <span className="text-white text-xs font-bold">{ownerName ? ownerName.charAt(0) : 'U'}</span>
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-white/40 text-[10px] font-label">{PLAN_LABEL_MAP[(plan || 'free') as keyof typeof PLAN_LABEL_MAP] || 'Free'} 고객님</p>
            <p className="text-white text-sm font-korean truncate">{ownerName || '—'}</p>
          </div>
        </div>
      </div>
    </aside>
  );
}
