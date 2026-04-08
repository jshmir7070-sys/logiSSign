'use client';

import { type ReactNode, useCallback, useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { usePlan } from '@/contexts/PlanContext';
import { createBrowserSupabaseClient } from '@/lib/supabase';

interface TopStatusBarProps {
  pointBalance?: number;
  onPointBalanceChange?: (balance: number) => void;
}

function fmt(value: number): string {
  return value.toLocaleString('ko-KR');
}

function ProgressBar({
  current,
  limit,
}: {
  current: number;
  limit: number | null;
}) {
  if (limit === null) {
    return <span className="text-[10px] font-semibold text-emerald-600">무제한</span>;
  }

  const pct = Math.min(100, Math.round((current / Math.max(limit, 1)) * 100));
  const color = pct >= 90 ? 'bg-red-500' : pct >= 70 ? 'bg-amber-500' : 'bg-emerald-500';

  return (
    <div className="h-1.5 w-14 overflow-hidden rounded-full bg-outline-variant/20">
      <div className={`h-full rounded-full transition-all ${color}`} style={{ width: `${pct}%` }} />
    </div>
  );
}

function StatusTile({
  value,
  onClick,
  highlight = false,
  icon,
}: {
  value: string;
  onClick: () => void;
  highlight?: boolean;
  icon: ReactNode;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`group flex min-w-[112px] shrink-0 items-center gap-3 rounded-[22px] border px-3 py-2.5 transition-all active:scale-[0.98] ${
        highlight
          ? 'border-amber-200/70 bg-amber-50/90 shadow-[0_10px_24px_-18px_rgba(217,119,6,0.65)] hover:bg-amber-100/90'
          : 'border-white/70 bg-white/85 shadow-[0_14px_30px_-24px_rgba(15,23,42,0.45)] hover:-translate-y-0.5 hover:bg-white'
      }`}
    >
      <span
        className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-2xl ${
          highlight
            ? 'bg-amber-100 text-amber-700'
            : 'bg-surface-container-low text-on-surface-variant group-hover:bg-surface-container'
        }`}
      >
        {icon}
      </span>
      <span className="truncate text-[13px] font-bold text-on-surface font-data">{value}</span>
    </button>
  );
}

function BillingGuideModal({
  open,
  onClose,
  planLabel,
  monthlyUsed,
  monthlyFree,
  driverCount,
  maxDrivers,
  pointBalance,
}: {
  open: boolean;
  onClose: () => void;
  planLabel: string;
  monthlyUsed: number;
  monthlyFree: number | null;
  driverCount: number;
  maxDrivers: number | null;
  pointBalance: number;
}) {
  const router = useRouter();

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center">
      <div className="absolute inset-0 bg-black/40 backdrop-blur-sm" onClick={onClose} />
      <div className="relative mx-4 w-full max-w-xl overflow-hidden rounded-3xl bg-surface-container-lowest shadow-2xl">
        <div className="flex items-start justify-between border-b border-outline-variant/15 px-6 py-5">
          <div>
            <h2 className="font-korean text-lg font-bold text-on-surface">이용 현황 안내</h2>
            <p className="mt-1 font-korean text-sm text-on-surface-variant">
              현재 플랜, 이번 달 전자계약 사용량, 등록 기사 수, 포인트 잔액을 한눈에 확인할 수 있습니다.
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="h-9 w-9 rounded-xl text-on-surface-variant hover:bg-surface-container-high"
          >
            닫기
          </button>
        </div>

        <div className="space-y-5 p-6">
          <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
            <div className="rounded-2xl border border-outline-variant/15 bg-surface-container-low p-4">
              <p className="font-korean text-xs text-on-surface-variant">현재 플랜</p>
              <p className="mt-1 text-lg font-bold text-on-surface">{planLabel}</p>
              <p className="mt-2 font-korean text-xs text-on-surface-variant">
                결제 관리는 설정의 결제 관리에서 확인할 수 있습니다.
              </p>
            </div>
            <div className="rounded-2xl border border-outline-variant/15 bg-surface-container-low p-4">
              <p className="font-korean text-xs text-on-surface-variant">이번 달 전자계약 사용량</p>
              <p className="mt-1 font-data text-lg font-bold text-on-surface">
                {monthlyUsed}
                <span className="ml-1 text-sm font-normal text-on-surface-variant">
                  / {monthlyFree === null ? '무제한' : fmt(monthlyFree)}
                </span>
              </p>
              <div className="mt-3">
                <ProgressBar current={monthlyUsed} limit={monthlyFree} />
              </div>
            </div>
            <div className="rounded-2xl border border-outline-variant/15 bg-surface-container-low p-4">
              <p className="font-korean text-xs text-on-surface-variant">등록 기사 수</p>
              <p className="mt-1 font-data text-lg font-bold text-on-surface">
                {driverCount}
                <span className="ml-1 text-sm font-normal text-on-surface-variant">
                  / {maxDrivers === null ? '무제한' : fmt(maxDrivers)}
                </span>
              </p>
              <div className="mt-3">
                <ProgressBar current={driverCount} limit={maxDrivers} />
              </div>
            </div>
          </div>

          <div className="flex items-center justify-between gap-4 rounded-2xl border border-amber-200/60 bg-amber-50 p-4">
            <div>
              <p className="font-korean text-xs text-amber-700">포인트 잔액</p>
              <p className="mt-1 font-data text-2xl font-bold text-amber-800">{fmt(pointBalance)}P</p>
              <p className="mt-1 font-korean text-xs text-amber-700/80">
                포인트형 이용 중에는 계약, 정산, 추가 기능 사용 시 포인트가 차감됩니다.
              </p>
            </div>
            <button
              type="button"
              onClick={() => {
                onClose();
                router.push('/portal/settings?tab=billing');
              }}
              className="h-11 rounded-xl bg-primary px-5 font-korean text-sm font-bold text-white transition-colors hover:bg-primary/90"
            >
              결제 관리 열기
            </button>
          </div>

          <div className="grid grid-cols-1 gap-3 md:grid-cols-3">
            <button
              type="button"
              onClick={() => {
                onClose();
                router.push('/portal/contracts/new');
              }}
              className="h-11 rounded-xl bg-surface-container-high font-korean text-sm font-semibold text-on-surface transition-colors hover:bg-surface-container-highest"
            >
              계약서 발송
            </button>
            <button
              type="button"
              onClick={() => {
                onClose();
                router.push('/portal/drivers');
              }}
              className="h-11 rounded-xl bg-surface-container-high font-korean text-sm font-semibold text-on-surface transition-colors hover:bg-surface-container-highest"
            >
              기사 관리
            </button>
            <button
              type="button"
              onClick={() => {
                onClose();
                router.push('/portal/settings?tab=billing');
              }}
              className="h-11 rounded-xl bg-power-gradient font-korean text-sm font-bold text-white transition-shadow hover:shadow-md"
            >
              결제 설정 확인
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

export default function TopStatusBar({ pointBalance, onPointBalanceChange }: TopStatusBarProps) {
  const { planLabel, agencyId, limits } = usePlan();
  const router = useRouter();
  const [monthlyUsed, setMonthlyUsed] = useState(0);
  const [driverCount, setDriverCount] = useState(0);
  const [localPointBalance, setLocalPointBalance] = useState<number>(pointBalance ?? 0);
  const [loading, setLoading] = useState(true);
  const [showGuide, setShowGuide] = useState(false);

  useEffect(() => {
    if (pointBalance !== undefined) {
      setLocalPointBalance(pointBalance);
    }
  }, [pointBalance]);

  const loadStats = useCallback(async () => {
    if (!agencyId) {
      setLoading(false);
      return;
    }

    const supabase = createBrowserSupabaseClient();
    const now = new Date();
    const monthStart = new Date(now.getFullYear(), now.getMonth(), 1);

    const [{ count: contractCount }, { count: drivers }, pointResponse] = await Promise.all([
      supabase
        .from('contracts')
        .select('id', { count: 'exact', head: true })
        .eq('agency_id', agencyId)
        .gte('created_at', monthStart.toISOString()),
      supabase
        .from('drivers')
        .select('id', { count: 'exact', head: true })
        .eq('agency_id', agencyId)
        .neq('status', 'deleted'),
      pointBalance === undefined ? fetch('/api/points?action=balance') : Promise.resolve(null),
    ]);

    setMonthlyUsed(contractCount ?? 0);
    setDriverCount(drivers ?? 0);

    if (pointResponse?.ok) {
      const data = await pointResponse.json();
      const nextBalance = data.balance ?? 0;
      setLocalPointBalance(nextBalance);
      onPointBalanceChange?.(nextBalance);
    }

    setLoading(false);
  }, [agencyId, onPointBalanceChange, pointBalance]);

  useEffect(() => {
    void loadStats();
  }, [loadStats]);

  if (loading) return null;

  return (
    <>
      <div className="flex min-w-0 items-center gap-2 overflow-x-auto rounded-[28px] bg-surface-container-low/70 p-1.5 shadow-[inset_0_1px_0_rgba(255,255,255,0.65)] ring-1 ring-black/5 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
        <button
          type="button"
          onClick={() => setShowGuide(true)}
          className="shrink-0 rounded-[22px] bg-gradient-to-br from-primary to-[#2963ff] px-5 py-2.5 text-left text-white shadow-[0_16px_32px_-24px_rgba(0,74,198,0.85)] transition-transform hover:-translate-y-0.5 active:scale-[0.98]"
          title="현재 플랜과 이용 현황 보기"
        >
          <span className="block text-sm font-bold">{planLabel}</span>
        </button>

        <StatusTile
          value={`${monthlyUsed}/${limits.monthlyFreeContracts === null ? '∞' : fmt(limits.monthlyFreeContracts)}`}
          onClick={() => setShowGuide(true)}
          icon={
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
              <polyline points="14 2 14 8 20 8" />
            </svg>
          }
        />

        <StatusTile
          value={`${driverCount}/${limits.maxDrivers === null ? '∞' : fmt(limits.maxDrivers)}`}
          onClick={() => setShowGuide(true)}
          icon={
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2" />
              <circle cx="9" cy="7" r="4" />
              <path d="M23 21v-2a4 4 0 0 0-3-3.87" />
              <path d="M16 3.13a4 4 0 0 1 0 7.75" />
            </svg>
          }
        />

        <StatusTile
          value={`${fmt(localPointBalance)}P`}
          onClick={() => router.push('/portal/settings?tab=billing')}
          highlight
          icon={
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <circle cx="12" cy="12" r="10" />
              <path d="M12 6v12M6 12h12" strokeLinecap="round" />
            </svg>
          }
        />
      </div>

      <BillingGuideModal
        open={showGuide}
        onClose={() => setShowGuide(false)}
        planLabel={planLabel}
        monthlyUsed={monthlyUsed}
        monthlyFree={limits.monthlyFreeContracts}
        driverCount={driverCount}
        maxDrivers={limits.maxDrivers}
        pointBalance={localPointBalance}
      />
    </>
  );
}
