'use client';

import { useEffect, useState, useCallback } from 'react';
import { usePlan } from '@/contexts/PlanContext';
import { createBrowserSupabaseClient } from '@/lib/supabase';
import {
  type PlanType,
  PLAN_LABELS,
  PLAN_LIMITS,
  PLAN_PRICES,
  PLAN_HIGHLIGHTS,
  POINT_PACKAGES,
  isPlanAtLeast,
} from '@/lib/plan-limits';

interface TopStatusBarProps {
  pointBalance?: number;
  onPointBalanceChange?: (balance: number) => void;
}

function fmt(n: number): string { return n.toLocaleString('ko-KR'); }

export default function TopStatusBar({ pointBalance, onPointBalanceChange }: TopStatusBarProps) {
  const { plan, planLabel, agencyId, limits } = usePlan();

  const [monthlyUsed, setMonthlyUsed] = useState(0);
  const [driverCount, setDriverCount] = useState(0);
  const [localPointBalance, setLocalPointBalance] = useState<number | undefined>(pointBalance);
  const [showModal, setShowModal] = useState(false);
  const [loading, setLoading] = useState(true);

  // 외부 pointBalance prop이 변경되면 반영
  useEffect(() => {
    if (pointBalance !== undefined) setLocalPointBalance(pointBalance);
  }, [pointBalance]);

  const loadStats = useCallback(async () => {
    if (!agencyId) return;
    const supabase = createBrowserSupabaseClient();

    // 이번 달 발송 건수 (KST 기준)
    const now = new Date();
    const kstOffset = 9 * 60 * 60 * 1000;
    const kstNow = new Date(now.getTime() + kstOffset);
    const kstMonthStart = new Date(Date.UTC(kstNow.getUTCFullYear(), kstNow.getUTCMonth(), 1) - kstOffset);
    const { count: contractCount } = await supabase
      .from('contracts')
      .select('id', { count: 'exact', head: true })
      .eq('agency_id', agencyId)
      .gte('created_at', kstMonthStart.toISOString());
    setMonthlyUsed(contractCount ?? 0);

    // 등록 기사 수 (활성 기사만)
    let driverQuery = supabase
      .from('drivers')
      .select('id', { count: 'exact', head: true })
      .eq('agency_id', agencyId);
    // status 컬럼이 있으면 활성만 카운트 (없으면 전체)
    driverQuery = driverQuery.neq('status', 'deleted');
    const { count: drivers } = await driverQuery;
    setDriverCount(drivers ?? 0);

    // 포인트 잔액 (prop이 없으면 직접 조회)
    if (pointBalance === undefined) {
      try {
        const res = await fetch('/api/points?action=balance');
        if (res.ok) {
          const data = await res.json();
          setLocalPointBalance(data.balance ?? 0);
        }
      } catch { /* ignore */ }
    }

    setLoading(false);
  }, [agencyId, pointBalance]);

  useEffect(() => { loadStats(); }, [loadStats]);

  const monthlyFree = limits.monthlyFreeContracts;
  const maxDrivers = limits.maxDrivers;

  // 발송 잔여
  const contractRemaining = monthlyFree === null
    ? null // 무제한
    : Math.max(0, monthlyFree - monthlyUsed);

  // 기사 잔여
  const driverRemaining = maxDrivers === null
    ? null // 무제한
    : Math.max(0, maxDrivers - driverCount);

  // 발송 퍼센트 (프로그레스 바용)
  const contractPct = monthlyFree === null ? 0 : Math.min(100, (monthlyUsed / monthlyFree) * 100);
  const driverPct = maxDrivers === null ? 0 : Math.min(100, (driverCount / maxDrivers) * 100);

  const barColor = (pct: number) =>
    pct >= 90 ? 'bg-red-500' : pct >= 70 ? 'bg-amber-500' : 'bg-emerald-500';

  if (loading) return null;

  return (
    <>
      <div className="flex items-center gap-3 select-none">
        {/* 플랜 배지 */}
        <button
          onClick={() => setShowModal(true)}
          className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold font-korean transition-colors ${
            plan === 'free' || plan === 'point'
              ? 'bg-surface-container-high text-on-surface-variant hover:bg-surface-container-highest'
              : 'bg-primary/10 text-primary hover:bg-primary/20'
          }`}
          title="플랜 관리"
        >
          <span>{planLabel}</span>
          {plan === 'free' && (
            <span className="text-[10px] font-normal text-on-surface-variant/60">(무료)</span>
          )}
          {plan === 'point' && (
            <span className="text-[10px] font-normal text-amber-600/60">(충전형)</span>
          )}
        </button>

        {/* 전자계약 발송량 */}
        <button
          onClick={() => setShowModal(true)}
          className="flex items-center gap-2 px-3 py-1.5 rounded-lg bg-surface-container-low hover:bg-surface-container-high transition-colors group"
          title="전자계약 발송 현황"
        >
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="text-on-surface-variant/60">
            <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
            <polyline points="14 2 14 8 20 8" />
          </svg>
          <div className="flex items-center gap-1.5">
            <span className="text-xs text-on-surface-variant font-korean">발송</span>
            <span className="text-xs font-bold text-on-surface font-data">
              {monthlyUsed}
              <span className="text-on-surface-variant font-normal">
                /{monthlyFree === null ? '∞' : fmt(monthlyFree)}
              </span>
            </span>
            {monthlyFree !== null && (
              <div className="w-12 h-1.5 rounded-full bg-outline-variant/20 overflow-hidden">
                <div className={`h-full rounded-full transition-all ${barColor(contractPct)}`} style={{ width: `${contractPct}%` }} />
              </div>
            )}
          </div>
        </button>

        {/* 등록 기사 */}
        <button
          onClick={() => setShowModal(true)}
          className="flex items-center gap-2 px-3 py-1.5 rounded-lg bg-surface-container-low hover:bg-surface-container-high transition-colors group"
          title="기사 등록 현황"
        >
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="text-on-surface-variant/60">
            <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2" />
            <circle cx="9" cy="7" r="4" />
            <path d="M23 21v-2a4 4 0 0 0-3-3.87" />
            <path d="M16 3.13a4 4 0 0 1 0 7.75" />
          </svg>
          <div className="flex items-center gap-1.5">
            <span className="text-xs text-on-surface-variant font-korean">기사</span>
            <span className="text-xs font-bold text-on-surface font-data">
              {driverCount}
              <span className="text-on-surface-variant font-normal">
                /{maxDrivers === null ? '∞' : fmt(maxDrivers)}
              </span>
            </span>
            {maxDrivers !== null && (
              <div className="w-12 h-1.5 rounded-full bg-outline-variant/20 overflow-hidden">
                <div className={`h-full rounded-full transition-all ${barColor(driverPct)}`} style={{ width: `${driverPct}%` }} />
              </div>
            )}
          </div>
        </button>

        {/* 포인트 */}
        <button
          onClick={() => setShowModal(true)}
          className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-amber-50 hover:bg-amber-100 transition-colors border border-amber-200/50"
          title="포인트 충전 / 플랜 관리"
        >
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#D97706" strokeWidth="2">
            <circle cx="12" cy="12" r="10" />
            <path d="M12 6v12M6 12h12" strokeLinecap="round" />
          </svg>
          <span className="text-xs font-bold text-amber-700 font-data">
            {localPointBalance !== undefined ? fmt(localPointBalance) + 'P' : '—'}
          </span>
        </button>
      </div>

      {/* 충전/업그레이드 모달 */}
      {showModal && (
        <PlanPointModal
          plan={plan}
          planLabel={planLabel}
          pointBalance={localPointBalance ?? 0}
          monthlyUsed={monthlyUsed}
          monthlyFree={monthlyFree}
          driverCount={driverCount}
          maxDrivers={maxDrivers}
          onClose={() => setShowModal(false)}
          onPointCharged={(newBalance) => {
            setLocalPointBalance(newBalance);
            onPointBalanceChange?.(newBalance);
          }}
        />
      )}
    </>
  );
}

/* ════════════════════════════════════════════════════════════ */
/*  포인트 충전 / 플랜 업그레이드 팝업 모달                     */
/* ════════════════════════════════════════════════════════════ */

interface PlanPointModalProps {
  plan: PlanType;
  planLabel: string;
  pointBalance: number;
  monthlyUsed: number;
  monthlyFree: number | null;
  driverCount: number;
  maxDrivers: number | null;
  onClose: () => void;
  onPointCharged: (newBalance: number) => void;
}

const SUB_PLANS: PlanType[] = ['free', 'basic', 'standard', 'pro', 'enterprise'];

function PlanPointModal({
  plan, planLabel, pointBalance, monthlyUsed, monthlyFree, driverCount, maxDrivers,
  onClose, onPointCharged,
}: PlanPointModalProps) {
  const { refreshPlan } = usePlan();
  const [tab, setTab] = useState<'status' | 'charge' | 'upgrade'>('status');
  const [charging, setCharging] = useState<number | null>(null);
  const [upgrading, setUpgrading] = useState<string | null>(null);

  // 포인트 충전
  const handleCharge = async (points: number, price: number) => {
    if (!confirm(`${fmt(points)}P를 충전하시겠습니까?`)) return;
    setCharging(points);
    try {
      const res = await fetch('/api/points', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'charge', points, amount: price }),
      });
      if (res.ok) {
        const data = await res.json();
        onPointCharged(data.balanceAfter ?? pointBalance + points);
        alert(`${fmt(points)}P 충전 완료!`);
      } else {
        const err = await res.json();
        alert('충전 실패: ' + (err.error || '카드를 먼저 등록해주세요.'));
      }
    } catch {
      alert('충전 중 오류가 발생했습니다.');
    }
    setCharging(null);
  };

  // 플랜 업그레이드
  const handleUpgrade = async (targetPlan: PlanType) => {
    if (!confirm(`${PLAN_LABELS[targetPlan]} 플랜으로 업그레이드하시겠습니까?`)) return;
    setUpgrading(targetPlan);
    try {
      const res = await fetch('/api/payment', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'charge', plan: targetPlan, billing: 'monthly' }),
      });
      if (res.ok) {
        alert(`${PLAN_LABELS[targetPlan]} 플랜으로 업그레이드되었습니다!`);
        await refreshPlan();
        onClose();
      } else {
        const err = await res.json();
        alert('업그레이드 실패: ' + (err.error || '카드를 먼저 등록해주세요.\n설정 → 구독/결제에서 카드를 등록하세요.'));
      }
    } catch { alert('오류가 발생했습니다.'); }
    setUpgrading(null);
  };

  const contractPct = monthlyFree === null ? 0 : Math.min(100, (monthlyUsed / monthlyFree) * 100);
  const driverPct = maxDrivers === null ? 0 : Math.min(100, (driverCount / maxDrivers) * 100);
  const barColor = (pct: number) =>
    pct >= 90 ? 'bg-red-500' : pct >= 70 ? 'bg-amber-500' : 'bg-emerald-500';

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center">
      {/* Backdrop */}
      <div className="absolute inset-0 bg-black/40 backdrop-blur-sm" onClick={onClose} />

      {/* Modal */}
      <div className="relative bg-white rounded-2xl shadow-2xl w-full max-w-lg mx-4 max-h-[85vh] overflow-hidden flex flex-col">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-outline-variant/20">
          <h2 className="text-lg font-headline font-bold text-on-surface font-korean">플랜 및 포인트 관리</h2>
          <button onClick={onClose} className="w-8 h-8 flex items-center justify-center rounded-lg hover:bg-surface-container-high transition-colors">
            <svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor" className="text-on-surface-variant">
              <path d="M19 6.41L17.59 5 12 10.59 6.41 5 5 6.41 10.59 12 5 17.59 6.41 19 12 13.41 17.59 19 19 17.59 13.41 12z" />
            </svg>
          </button>
        </div>

        {/* Tabs */}
        <div className="flex border-b border-outline-variant/20 px-6">
          {([
            { key: 'status', label: '현재 상태' },
            { key: 'charge', label: '포인트 충전' },
            { key: 'upgrade', label: '플랜 업그레이드' },
          ] as const).map(t => (
            <button
              key={t.key}
              onClick={() => setTab(t.key)}
              className={`px-4 py-3 text-sm font-korean font-medium border-b-2 transition-colors ${
                tab === t.key
                  ? 'border-primary text-primary'
                  : 'border-transparent text-on-surface-variant hover:text-on-surface'
              }`}
            >
              {t.label}
            </button>
          ))}
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto p-6">
          {tab === 'status' && (
            <div className="space-y-5">
              {/* 현재 플랜 */}
              <div className="flex items-center gap-3 p-4 rounded-xl bg-primary/5 border border-primary/10">
                <div className="w-10 h-10 rounded-full bg-primary/10 flex items-center justify-center">
                  <span className="text-primary font-bold text-sm">{planLabel.charAt(0)}</span>
                </div>
                <div>
                  <p className="text-sm font-bold text-on-surface font-korean">현재 플랜: {planLabel}</p>
                  <p className="text-xs text-on-surface-variant font-korean">
                    {plan === 'free' || plan === 'point' ? '무료' : '구독형'}
                  </p>
                </div>
              </div>

              {/* 전자계약 발송 현황 */}
              <div className="p-4 rounded-xl bg-surface-container-lowest border border-outline-variant/10">
                <div className="flex items-center justify-between mb-2">
                  <span className="text-sm font-medium text-on-surface font-korean">전자계약 발송</span>
                  <span className="text-sm font-bold text-on-surface font-data">
                    {monthlyUsed} / {monthlyFree === null ? '무제한' : fmt(monthlyFree)}건
                  </span>
                </div>
                {monthlyFree !== null && (
                  <>
                    <div className="w-full h-2 rounded-full bg-outline-variant/15 overflow-hidden">
                      <div className={`h-full rounded-full transition-all ${barColor(contractPct)}`} style={{ width: `${contractPct}%` }} />
                    </div>
                    <p className="text-xs text-on-surface-variant mt-1.5 font-korean">
                      이번 달 남은 무료 발송: <strong className="text-on-surface">{fmt(Math.max(0, monthlyFree - monthlyUsed))}건</strong>
                      {monthlyUsed >= monthlyFree && (
                        <span className="text-red-500 ml-1">(초과 시 포인트 차감)</span>
                      )}
                    </p>
                  </>
                )}
                {monthlyFree === null && (
                  <p className="text-xs text-emerald-600 font-korean mt-1">무제한 발송 가능</p>
                )}
              </div>

              {/* 기사 등록 현황 */}
              <div className="p-4 rounded-xl bg-surface-container-lowest border border-outline-variant/10">
                <div className="flex items-center justify-between mb-2">
                  <span className="text-sm font-medium text-on-surface font-korean">등록 기사</span>
                  <span className="text-sm font-bold text-on-surface font-data">
                    {driverCount} / {maxDrivers === null ? '무제한' : fmt(maxDrivers)}명
                  </span>
                </div>
                {maxDrivers !== null && (
                  <>
                    <div className="w-full h-2 rounded-full bg-outline-variant/15 overflow-hidden">
                      <div className={`h-full rounded-full transition-all ${barColor(driverPct)}`} style={{ width: `${driverPct}%` }} />
                    </div>
                    <p className="text-xs text-on-surface-variant mt-1.5 font-korean">
                      남은 등록 가능: <strong className="text-on-surface">{fmt(Math.max(0, maxDrivers - driverCount))}명</strong>
                    </p>
                  </>
                )}
                {maxDrivers === null && (
                  <p className="text-xs text-emerald-600 font-korean mt-1">무제한 등록 가능</p>
                )}
              </div>

              {/* 포인트 잔액 */}
              <div className="p-4 rounded-xl bg-amber-50/80 border border-amber-200/30">
                <div className="flex items-center justify-between">
                  <span className="text-sm font-medium text-on-surface font-korean">포인트 잔액</span>
                  <span className="text-lg font-bold text-amber-700 font-data">{fmt(pointBalance)}P</span>
                </div>
                <div className="flex gap-2 mt-3">
                  <button
                    onClick={() => setTab('charge')}
                    className="flex-1 h-9 rounded-lg bg-amber-500 text-white text-xs font-bold font-korean hover:bg-amber-600 transition-colors"
                  >
                    포인트 충전
                  </button>
                  <button
                    onClick={() => setTab('upgrade')}
                    className="flex-1 h-9 rounded-lg bg-primary text-white text-xs font-bold font-korean hover:bg-primary/90 transition-colors"
                  >
                    플랜 업그레이드
                  </button>
                </div>
              </div>
            </div>
          )}

          {tab === 'charge' && (
            <div className="space-y-4">
              {/* 현재 잔액 */}
              <div className="text-center py-3">
                <p className="text-xs text-on-surface-variant font-korean">현재 잔액</p>
                <p className="text-2xl font-bold text-amber-700 font-data mt-1">{fmt(pointBalance)}P</p>
              </div>

              {/* 충전 패키지 */}
              <div className="grid grid-cols-2 gap-3">
                {POINT_PACKAGES.map(pkg => (
                  <button
                    key={pkg.points}
                    onClick={() => handleCharge(pkg.points, pkg.price)}
                    disabled={charging !== null}
                    className={`p-4 rounded-xl border-2 text-left transition-all hover:border-amber-400 hover:shadow-md ${
                      charging === pkg.points
                        ? 'border-amber-400 bg-amber-50'
                        : 'border-outline-variant/20 bg-white'
                    } disabled:opacity-60`}
                  >
                    <p className="text-lg font-bold text-on-surface font-data">
                      {fmt(pkg.points)}P
                    </p>
                    <p className="text-xs text-on-surface-variant font-data mt-0.5">
                      ₩{fmt(pkg.price)}
                    </p>
                    {pkg.bonus > 0 && (
                      <p className="text-xs text-amber-600 font-bold mt-1 font-korean">
                        +{fmt(pkg.bonus)}P 보너스
                      </p>
                    )}
                    {charging === pkg.points && (
                      <p className="text-xs text-primary font-korean mt-1">충전 중...</p>
                    )}
                  </button>
                ))}
              </div>

              <p className="text-xs text-on-surface-variant/60 text-center font-korean">
                등록된 카드로 즉시 충전됩니다. 카드 미등록 시 설정 → 구독/결제에서 등록하세요.
              </p>
            </div>
          )}

          {tab === 'upgrade' && (
            <div className="space-y-3">
              {SUB_PLANS.map(p => {
                const l = PLAN_LIMITS[p];
                const isCurrent = p === plan;
                const isLower = !isPlanAtLeast(p, plan);

                return (
                  <div
                    key={p}
                    className={`p-4 rounded-xl border-2 transition-all ${
                      isCurrent
                        ? 'border-primary bg-primary/5'
                        : isLower
                          ? 'border-outline-variant/10 bg-surface-container-lowest opacity-50'
                          : 'border-outline-variant/20 bg-white hover:border-primary/30'
                    }`}
                  >
                    <div className="flex items-center justify-between">
                      <div>
                        <div className="flex items-center gap-2">
                          <span className="text-sm font-bold text-on-surface font-korean">{PLAN_LABELS[p]}</span>
                          {isCurrent && (
                            <span className="text-[10px] px-2 py-0.5 rounded-full bg-primary text-white font-bold">현재</span>
                          )}
                        </div>
                        <p className="text-xs text-on-surface-variant mt-0.5 font-korean">
                          기사 {l.maxDrivers === null ? '무제한' : `${l.maxDrivers}명`}
                          {' · '}발송 {l.monthlyFreeContracts === null ? '무제한' : `월 ${fmt(l.monthlyFreeContracts)}건`}
                        </p>
                      </div>
                      <div className="text-right">
                        <p className="text-sm font-bold text-on-surface font-data">
                          {PLAN_PRICES[p] === 0 ? '무료' : `₩${fmt(PLAN_PRICES[p])}`}
                        </p>
                        {PLAN_PRICES[p] > 0 && <p className="text-[10px] text-on-surface-variant">/월</p>}
                      </div>
                    </div>

                    {/* 주요 기능 */}
                    <div className="flex flex-wrap gap-1.5 mt-2.5">
                      {PLAN_HIGHLIGHTS[p].map((h, i) => (
                        <span key={i} className="text-[10px] px-2 py-0.5 rounded-full bg-surface-container-high text-on-surface-variant font-korean">
                          {h}
                        </span>
                      ))}
                    </div>

                    {/* 업그레이드 버튼 */}
                    {!isCurrent && !isLower && (
                      <button
                        onClick={() => handleUpgrade(p)}
                        disabled={upgrading !== null}
                        className="w-full mt-3 h-9 rounded-lg bg-primary text-white text-xs font-bold font-korean hover:bg-primary/90 transition-colors disabled:opacity-50"
                      >
                        {upgrading === p ? '처리 중...' : `${PLAN_LABELS[p]}으로 업그레이드`}
                      </button>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="px-6 py-3 border-t border-outline-variant/20 bg-surface-container-lowest">
          <p className="text-[10px] text-on-surface-variant/50 text-center font-korean">
            자세한 설정은 설정 → 구독/결제 메뉴에서 확인할 수 있습니다
          </p>
        </div>
      </div>
    </div>
  );
}
