'use client';

import { useEffect, useState } from 'react';
import { createBrowserSupabaseClient } from '@/lib/supabase';
import {
  type PlanType,
  PLAN_LABELS,
  PLAN_LIMITS,
  PLAN_PRICES,
  PLAN_HIGHLIGHTS,
  isPlanAtLeast,
  POINT_COSTS,
  POINT_PACKAGES,
  WELCOME_BONUS_POINTS,
  EXTRA_DRIVER_MONTHLY_POINTS,
  FREE_PLAN_FREE_DRIVERS,
  type PointAction,
} from '@/lib/plan-limits';
import { usePlan } from '@/contexts/PlanContext';

/* ── Types ── */
interface PointBalanceData {
  balance: number;
  totalCharged: number;
  totalUsed: number;
}

interface PointTx {
  id: string;
  type: string;
  amount: number;
  balanceAfter: number;
  description: string;
  createdAt: string;
}

interface PointPackage {
  id: string;
  name: string;
  points: number;
  price: number;
  bonus_points: number;
}

/* ── Constants ── */
const SUB_PLAN_ORDER: PlanType[] = ['free', 'basic', 'standard', 'pro', 'enterprise'];

const PAID_ACTIONS = (Object.entries(POINT_COSTS) as [PointAction, typeof POINT_COSTS[PointAction]][])
  .filter(([, info]) => info.cost > 0);

function fmt(n: number): string { return n.toLocaleString('ko-KR'); }
function fmtKRW(n: number): string { return `₩${fmt(n)}`; }
function fmtP(n: number): string { return `${fmt(n)}P`; }

/* ── Estimate 30 drivers monthly ── */
// 30명 기준: 기사비(25명×₩1,500) + 계약서 6건 + 정산서 6세트(30÷5) + 엑셀 1회
const EST_EXTRA = 25; // 30 - 5(무료)
const EST_DRIVER_FEE = EST_EXTRA * EXTRA_DRIVER_MONTHLY_POINTS;
const EST_POINT_TOTAL = 6 * POINT_COSTS.contract_send.cost
  + 6 * POINT_COSTS.settlement_generate.cost
  + 1 * POINT_COSTS.excel_upload.cost;
const EST_TOTAL = EST_DRIVER_FEE + EST_POINT_TOTAL;

/* ═══════════════════════════════════════════════════════════════ */

export default function BillingTab() {
  const { plan: currentPlan, refreshPlan } = usePlan();
  const [tab, setTab] = useState<'overview' | 'subscription' | 'point'>('overview');
  const [cardInfo, setCardInfo] = useState<{ cardName: string; cardNumber: string } | null>(null);
  const [loading, setLoading] = useState(true);
  const [processing, setProcessing] = useState(false);
  const [upgrading, setUpgrading] = useState<string | null>(null);

  // Point state
  const [pointBalance, setPointBalance] = useState<PointBalanceData | null>(null);
  const [pointTxs, setPointTxs] = useState<PointTx[]>([]);
  const [packages, setPackages] = useState<PointPackage[]>([]);
  const [chargingPkg, setChargingPkg] = useState<string | null>(null);

  // Agency plan_type
  const [planType, setPlanType] = useState<'subscription' | 'point'>('subscription');

  useEffect(() => {
    async function load() {
      const supabase = createBrowserSupabaseClient();
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) { setLoading(false); return; }
      const aid = user.app_metadata?.agency_id as string;

      // 구독 정보
      const { data: sub } = await supabase
        .from('subscriptions')
        .select('card_name, card_number_masked, status')
        .eq('agency_id', aid)
        .single();

      if (sub && (sub as Record<string, unknown>).status === 'active') {
        setCardInfo({
          cardName: (sub as Record<string, string>).card_name ?? '',
          cardNumber: (sub as Record<string, string>).card_number_masked ?? '',
        });
      }

      // 대리점 plan_type
      const { data: agency } = await supabase
        .from('agencies')
        .select('plan_type')
        .eq('id', aid)
        .single();
      if (agency?.plan_type === 'point') {
        setPlanType('point');
      }

      // 포인트 잔액
      try {
        const balRes = await fetch('/api/points?action=balance');
        if (balRes.ok) setPointBalance(await balRes.json());

        const txRes = await fetch('/api/points?action=transactions&limit=10');
        if (txRes.ok) {
          const txData = await txRes.json();
          setPointTxs(txData.transactions ?? []);
        }

        const pkgRes = await fetch('/api/points?action=packages');
        if (pkgRes.ok) {
          const pkgData = await pkgRes.json();
          setPackages(pkgData.packages ?? []);
        }
      } catch { /* 포인트 API 실패 무시 */ }

      setLoading(false);
    }
    load();
  }, []);

  /* ── Card Registration ── */
  const handleRegisterCard = async () => {
    const storeId = process.env.NEXT_PUBLIC_PORTONE_STORE_ID;
    const channelKey = process.env.NEXT_PUBLIC_PORTONE_CHANNEL_KEY;
    if (!storeId || !channelKey) { alert('결제 시스템이 설정되지 않았습니다.'); return; }

    setProcessing(true);
    try {
      const PortOne = await import('@portone/browser-sdk/v2');
      const result = await PortOne.requestIssueBillingKey({
        storeId, channelKey,
        billingKeyMethod: 'CARD',
        issueId: `billing_${Date.now()}`,
        issueName: 'logiSSign 정기결제 카드 등록',
        customer: { customerId: 'agency' },
      });

      if (!result || result.code) {
        alert('카드 등록 실패: ' + (result?.message ?? result?.code ?? '알 수 없는 오류'));
        setProcessing(false);
        return;
      }

      const res = await fetch('/api/payment', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'save-billing-key',
          billingKey: result.billingKey ?? '',
          cardName: '', cardNumber: '',
        }),
      });

      if (res.ok) {
        setCardInfo({ cardName: '신용카드', cardNumber: '등록 완료' });
        alert('카드가 등록되었습니다.');
      } else { alert('카드 정보 저장 실패'); }
    } catch (err) {
      alert('카드 등록 중 오류: ' + (err instanceof Error ? err.message : ''));
    }
    setProcessing(false);
  };

  /* ── Plan Upgrade ── */
  const handleUpgrade = async (targetPlan: PlanType) => {
    if (!cardInfo) { alert('먼저 카드를 등록해주세요.'); return; }
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
      } else {
        const err = await res.json();
        alert('업그레이드 실패: ' + (err.error || ''));
      }
    } catch { alert('오류가 발생했습니다'); }
    setUpgrading(null);
  };

  /* ── Switch to Point Plan ── */
  const handleSwitchToPoint = async () => {
    if (!confirm('포인트 충전형으로 전환하시겠습니까? 기존 구독은 현 결제 기간 종료 후 해지됩니다.')) return;
    try {
      const res = await fetch('/api/payment', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'switch-to-point' }),
      });
      if (res.ok) {
        setPlanType('point');
        alert('포인트 충전형으로 전환되었습니다.');
        await refreshPlan();
      } else {
        alert('전환 실패');
      }
    } catch { alert('오류가 발생했습니다'); }
  };

  /* ── Point Charge ── */
  const handleChargePoints = async (pkgId: string) => {
    if (!cardInfo) { alert('먼저 카드를 등록해주세요.'); return; }
    const pkg = packages.find(p => p.id === pkgId);
    if (!pkg) return;
    if (!confirm(`${pkg.name} (${fmtKRW(pkg.price)})을 충전하시겠습니까?${pkg.bonus_points > 0 ? ` 보너스 +${fmtP(pkg.bonus_points)}` : ''}`)) return;

    setChargingPkg(pkgId);
    try {
      const res = await fetch('/api/points', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'charge', packageId: pkgId }),
      });
      if (res.ok) {
        const data = await res.json();
        setPointBalance(prev => prev ? { ...prev, balance: data.balanceAfter } : null);
        alert(`${fmtP(data.charged)}${data.bonus > 0 ? ` + 보너스 ${fmtP(data.bonus)}` : ''} 충전 완료!`);
        // 거래 내역 새로고침
        const txRes = await fetch('/api/points?action=transactions&limit=10');
        if (txRes.ok) { const txData = await txRes.json(); setPointTxs(txData.transactions ?? []); }
      } else {
        const err = await res.json();
        alert('충전 실패: ' + (err.error || ''));
      }
    } catch { alert('오류가 발생했습니다'); }
    setChargingPkg(null);
  };

  if (loading) return <p className="text-center text-on-surface-variant py-12 font-korean">불러오는 중...</p>;

  const tabCls = (active: boolean) =>
    `h-10 px-5 rounded-xl text-sm font-semibold font-korean transition-all ${
      active ? 'bg-primary text-white shadow-md' : 'bg-surface-container-low text-on-surface-variant hover:bg-surface-container-high'
    }`;

  return (
    <div className="space-y-6">

      {/* ── 탭 선택 ── */}
      <div className="flex gap-2 flex-wrap">
        <button onClick={() => setTab('overview')} className={tabCls(tab === 'overview')}>
          현재 요금제
        </button>
        <button onClick={() => setTab('subscription')} className={tabCls(tab === 'subscription')}>
          구독형 (월정액)
        </button>
        <button onClick={() => setTab('point')} className={tabCls(tab === 'point')}>
          포인트 충전형
        </button>
      </div>

      {/* ══════════════════ 현재 요금제 탭 ══════════════════ */}
      {tab === 'overview' && (
        <>
          {/* 현재 플랜 카드 */}
          <div className="bg-surface-container-lowest rounded-2xl shadow-ambient p-8">
            <h2 className="text-lg font-headline font-bold text-on-surface font-korean mb-6">현재 요금제</h2>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {/* 플랜 정보 */}
              <div className="p-5 rounded-xl bg-primary/5 border border-primary/15">
                <p className="text-xs text-on-surface-variant font-label font-korean">현재 플랜</p>
                <p className="text-2xl font-data font-bold text-primary mt-1">{PLAN_LABELS[currentPlan] ?? currentPlan}</p>
                <p className="text-sm text-on-surface-variant font-data mt-1">
                  {currentPlan === 'point' ? '포인트 충전형 (월정액 없음)'
                    : currentPlan === 'free' ? '무료 (기사 5명)'
                    : `${fmtKRW(PLAN_PRICES[currentPlan] ?? 0)} / 월`}
                </p>
                <div className="mt-3 space-y-1">
                  {currentPlan !== 'point' && (
                    <>
                      <p className="text-xs text-on-surface-variant font-korean">
                        기사: {PLAN_LIMITS[currentPlan]?.maxDrivers === null ? '무제한' : `${PLAN_LIMITS[currentPlan]?.maxDrivers}명`}
                        {currentPlan === 'free' && ` (초과 시 기사당 ${fmtP(EXTRA_DRIVER_MONTHLY_POINTS)}/월)`}
                      </p>
                      <p className="text-xs text-on-surface-variant font-korean">관리자: {(PLAN_LIMITS[currentPlan]?.maxAdminAccounts ?? 0) + 1}명</p>
                    </>
                  )}
                  {currentPlan === 'point' && (
                    <p className="text-xs text-on-surface-variant font-korean">기사: 무제한 · 관리자: 3명</p>
                  )}
                </div>
              </div>

              {/* 포인트 잔액 */}
              <div className="p-5 rounded-xl bg-tertiary/5 border border-tertiary/15">
                <p className="text-xs text-on-surface-variant font-label font-korean">포인트 잔액</p>
                <p className="text-2xl font-data font-bold text-tertiary mt-1">{fmtP(pointBalance?.balance ?? 0)}</p>
                <div className="mt-2 flex items-center gap-4 text-xs text-on-surface-variant font-data">
                  <span>충전 {fmtP(pointBalance?.totalCharged ?? 0)}</span>
                  <span>사용 {fmtP(pointBalance?.totalUsed ?? 0)}</span>
                </div>
                <button onClick={() => setTab('point')}
                  className="mt-3 h-8 px-4 rounded-lg bg-tertiary text-white text-xs font-semibold font-korean hover:bg-tertiary/90 transition-colors">
                  포인트 충전하기
                </button>
              </div>
            </div>

            {/* 카드 정보 */}
            <div className="mt-4 p-4 rounded-xl bg-surface-container-low/50 flex items-center justify-between">
              <div>
                <p className="text-xs text-on-surface-variant font-korean">결제 카드</p>
                {cardInfo ? (
                  <p className="text-sm text-on-surface font-korean mt-0.5">{cardInfo.cardName} {cardInfo.cardNumber}</p>
                ) : (
                  <p className="text-sm text-on-surface-variant/50 font-korean mt-0.5">등록된 카드 없음</p>
                )}
              </div>
              <button onClick={handleRegisterCard} disabled={processing}
                className="h-9 px-4 rounded-lg bg-primary text-white text-xs font-semibold font-korean disabled:opacity-50">
                {processing ? '처리중...' : cardInfo ? '카드 변경' : '카드 등록'}
              </button>
            </div>
          </div>

          {/* 요금제 전환 안내 */}
          <div className="bg-surface-container-lowest rounded-2xl shadow-ambient p-8">
            <h2 className="text-lg font-headline font-bold text-on-surface font-korean mb-4">요금제 변경</h2>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <button onClick={() => setTab('subscription')}
                className="p-5 rounded-xl border-2 border-primary/20 hover:border-primary/40 text-left transition-all group">
                <div className="flex items-center justify-between">
                  <span className="px-2 py-0.5 rounded-full bg-primary/10 text-primary text-xs font-bold">구독형</span>
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor" className="text-on-surface-variant group-hover:text-primary transition-colors">
                    <path d="M8.59 16.59L13.17 12 8.59 7.41 10 6l6 6-6 6z"/>
                  </svg>
                </div>
                <p className="text-sm font-bold text-on-surface font-korean mt-2">월정액으로 무제한 사용</p>
                <p className="text-xs text-on-surface-variant font-korean mt-1">
                  Basic {fmtKRW(49900)}~ · 기사 50명 이상이면 유리
                </p>
              </button>

              <button onClick={() => setTab('point')}
                className="p-5 rounded-xl border-2 border-tertiary/20 hover:border-tertiary/40 text-left transition-all group">
                <div className="flex items-center justify-between">
                  <span className="px-2 py-0.5 rounded-full bg-tertiary/10 text-tertiary text-xs font-bold">포인트형</span>
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor" className="text-on-surface-variant group-hover:text-tertiary transition-colors">
                    <path d="M8.59 16.59L13.17 12 8.59 7.41 10 6l6 6-6 6z"/>
                  </svg>
                </div>
                <p className="text-sm font-bold text-on-surface font-korean mt-2">사용한 만큼만 결제</p>
                <p className="text-xs text-on-surface-variant font-korean mt-1">
                  기사 50명 이하 · 30명 기준 월 ~{fmtP(EST_TOTAL)}
                </p>
              </button>
            </div>
          </div>

          {/* 포인트 단가 안내 */}
          <div className="bg-surface-container-lowest rounded-2xl shadow-ambient p-8">
            <h2 className="text-lg font-headline font-bold text-on-surface font-korean mb-4">포인트 단가표</h2>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
              {(Object.entries(POINT_COSTS) as [PointAction, typeof POINT_COSTS[PointAction]][]).map(([, info]) => (
                <div key={info.label} className="flex items-center justify-between p-3 rounded-xl bg-surface-container-low/50">
                  <div>
                    <p className="text-sm font-semibold text-on-surface font-korean">{info.label}</p>
                    <p className="text-[11px] text-on-surface-variant font-korean">{info.desc}</p>
                  </div>
                  <span className={`text-sm font-data font-bold shrink-0 ${info.cost === 0 ? 'text-tertiary' : 'text-primary'}`}>
                    {info.cost === 0 ? '무료' : fmtP(info.cost)}
                  </span>
                </div>
              ))}
            </div>
          </div>
        </>
      )}

      {/* ══════════════════ 구독형 탭 ══════════════════ */}
      {tab === 'subscription' && (
        <>
          <div className="bg-surface-container-lowest rounded-2xl shadow-ambient p-8">
            <div className="flex items-center justify-between mb-6">
              <h2 className="text-lg font-headline font-bold text-on-surface font-korean">구독형 플랜 비교</h2>
              {planType === 'subscription' && (
                <span className="px-3 py-1 rounded-full bg-primary/10 text-primary text-xs font-bold font-korean">현재: 구독형</span>
              )}
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 lg:grid-cols-5 gap-4">
              {SUB_PLAN_ORDER.map((opt) => {
                const isCurrent = currentPlan === opt;
                const isUpgrade = !isCurrent && isPlanAtLeast(opt, currentPlan) && opt !== currentPlan;

                return (
                  <div key={opt} className={`rounded-2xl border-2 p-5 transition-all ${
                    isCurrent ? 'border-primary bg-primary/5 shadow-lg' : opt === 'standard' ? 'border-primary/30' : 'border-outline-variant/15'
                  }`}>
                    {opt === 'standard' && !isCurrent && (
                      <span className="inline-block px-2 py-0.5 rounded-full bg-primary text-white text-[10px] font-bold mb-2">추천</span>
                    )}
                    <h3 className="text-sm font-bold text-on-surface font-korean">{PLAN_LABELS[opt]}</h3>
                    <p className="text-xl font-data font-bold text-primary mt-2">
                      {PLAN_PRICES[opt] === 0 ? '무료' : opt === 'enterprise' ? '별도 문의' : fmtKRW(PLAN_PRICES[opt])}
                      {PLAN_PRICES[opt] > 0 && opt !== 'enterprise' && <span className="text-xs text-on-surface-variant font-normal">/월</span>}
                    </p>
                    <ul className="mt-3 space-y-1">
                      {PLAN_HIGHLIGHTS[opt].map((h) => (
                        <li key={h} className="flex items-start gap-1.5 text-xs text-on-surface-variant font-korean">
                          <svg width="12" height="12" viewBox="0 0 24 24" fill="currentColor" className="text-tertiary shrink-0 mt-0.5">
                            <path d="M9 16.17L4.83 12l-1.42 1.41L9 19 21 7l-1.41-1.41z"/>
                          </svg>
                          {h}
                        </li>
                      ))}
                    </ul>
                    <div className="mt-4">
                      {isCurrent ? (
                        <div className="h-9 flex items-center justify-center rounded-xl bg-primary/10 text-primary text-xs font-semibold font-korean">현재 플랜</div>
                      ) : isUpgrade && opt !== 'enterprise' ? (
                        <button onClick={() => handleUpgrade(opt)} disabled={!!upgrading}
                          className="w-full h-9 rounded-xl bg-primary text-white text-xs font-semibold font-korean hover:bg-primary/90 disabled:opacity-50">
                          {upgrading === opt ? '처리중...' : '업그레이드'}
                        </button>
                      ) : opt === 'enterprise' ? (
                        <div className="h-9 flex items-center justify-center rounded-xl bg-surface-container-low text-on-surface-variant text-xs font-korean">문의하기</div>
                      ) : (
                        <div className="h-9 flex items-center justify-center rounded-xl bg-surface-container-low text-on-surface-variant/40 text-xs font-korean">다운그레이드</div>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>

            {/* 카드 미등록 시 */}
            {!cardInfo && (
              <div className="mt-4 p-4 rounded-xl bg-amber-50 border border-amber-200 flex items-center justify-between">
                <p className="text-sm text-amber-800 font-korean">구독을 위해 카드를 먼저 등록해주세요.</p>
                <button onClick={handleRegisterCard} disabled={processing}
                  className="h-8 px-4 rounded-lg bg-primary text-white text-xs font-semibold font-korean disabled:opacity-50 shrink-0">
                  {processing ? '처리중...' : '카드 등록'}
                </button>
              </div>
            )}

            <p className="text-xs text-on-surface-variant/50 mt-4 font-korean">
              연간 결제 시 20~40% 할인. Enterprise는 별도 문의. 다운그레이드는 고객센터.
            </p>
          </div>

          {/* 포인트형 전환 안내 */}
          {planType === 'subscription' && currentPlan !== 'free' && (
            <div className="bg-surface-container-lowest rounded-2xl shadow-ambient p-6 flex items-center justify-between">
              <div>
                <p className="text-sm font-bold text-on-surface font-korean">포인트 충전형으로 전환</p>
                <p className="text-xs text-on-surface-variant font-korean mt-1">월정액 대신 사용한 만큼만 결제하고 싶다면</p>
              </div>
              <button onClick={handleSwitchToPoint}
                className="h-9 px-5 rounded-xl bg-tertiary/10 text-tertiary text-xs font-semibold font-korean hover:bg-tertiary/20 transition-colors">
                포인트형 전환
              </button>
            </div>
          )}
        </>
      )}

      {/* ══════════════════ 포인트 충전형 탭 ══════════════════ */}
      {tab === 'point' && (
        <>
          {/* 포인트 잔액 */}
          <div className="bg-surface-container-lowest rounded-2xl shadow-ambient p-8">
            <h2 className="text-lg font-headline font-bold text-on-surface font-korean mb-6">포인트 잔액</h2>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
              <div className="p-5 rounded-xl bg-primary/5 border border-primary/20 text-center">
                <p className="text-xs text-on-surface-variant font-korean">잔여 포인트</p>
                <p className={`text-3xl font-data font-bold mt-2 ${
                  (pointBalance?.balance ?? 0) <= 1000 ? 'text-error' : 'text-primary'
                }`}>
                  {fmtP(pointBalance?.balance ?? 0)}
                </p>
              </div>
              <div className="p-5 rounded-xl bg-surface-container-low text-center">
                <p className="text-xs text-on-surface-variant font-korean">누적 충전</p>
                <p className="text-xl font-data font-bold text-tertiary mt-2">{fmtP(pointBalance?.totalCharged ?? 0)}</p>
              </div>
              <div className="p-5 rounded-xl bg-surface-container-low text-center">
                <p className="text-xs text-on-surface-variant font-korean">누적 사용</p>
                <p className="text-xl font-data font-bold text-error mt-2">{fmtP(pointBalance?.totalUsed ?? 0)}</p>
              </div>
            </div>

            {/* 포인트 부족 경고 */}
            {(pointBalance?.balance ?? 0) <= 1000 && (
              <div className="mt-4 p-4 rounded-xl bg-error/5 border border-error/20">
                <p className="text-sm text-error font-korean font-semibold">
                  포인트가 부족합니다! 아래에서 충전해주세요.
                </p>
              </div>
            )}

            {/* 카드 미등록 시 */}
            {!cardInfo && (
              <div className="mt-4 p-4 rounded-xl bg-amber-50 border border-amber-200 flex items-center justify-between">
                <p className="text-sm text-amber-800 font-korean">포인트 충전을 위해 카드를 먼저 등록해주세요.</p>
                <button onClick={handleRegisterCard} disabled={processing}
                  className="h-8 px-4 rounded-lg bg-primary text-white text-xs font-semibold font-korean disabled:opacity-50 shrink-0">
                  {processing ? '처리중...' : '카드 등록'}
                </button>
              </div>
            )}
          </div>

          {/* 충전 패키지 */}
          <div className="bg-surface-container-lowest rounded-2xl shadow-ambient p-8">
            <h2 className="text-lg font-headline font-bold text-on-surface font-korean mb-6">포인트 충전</h2>
            <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3">
              {(packages.length > 0
                ? packages
                : POINT_PACKAGES.map((p, i) => ({
                    id: `local_${i}`,
                    name: fmtP(p.points),
                    points: p.points,
                    price: p.price,
                    bonus_points: p.bonus,
                  }))
              ).map((pkg) => (
                <button key={pkg.id} onClick={() => handleChargePoints(pkg.id)}
                  disabled={!cardInfo || !!chargingPkg}
                  className={`relative p-4 rounded-2xl border-2 transition-all text-center hover:border-primary/40 hover:shadow-md disabled:opacity-50 ${
                    pkg.bonus_points > 0 ? 'border-tertiary/30 bg-tertiary/[0.03]' : 'border-outline-variant/15'
                  }`}>
                  {pkg.bonus_points > 0 && (
                    <span className="absolute -top-2 right-2 px-2 py-0.5 rounded-full bg-tertiary text-white text-[10px] font-bold">
                      +{fmtP(pkg.bonus_points)}
                    </span>
                  )}
                  <p className="text-lg font-data font-bold text-on-surface">{pkg.name}</p>
                  <p className="text-sm font-data text-primary mt-1">{fmtKRW(pkg.price)}</p>
                  {pkg.bonus_points > 0 && (
                    <p className="text-[10px] text-tertiary font-korean mt-1">실수령 {fmtP(pkg.points + pkg.bonus_points)}</p>
                  )}
                  {chargingPkg === pkg.id && (
                    <p className="text-xs text-on-surface-variant mt-1 font-korean">결제 중...</p>
                  )}
                </button>
              ))}
            </div>
            <p className="text-xs text-on-surface-variant/50 mt-4 font-korean">
              1P = ₩1. 첫 가입 시 {fmt(WELCOME_BONUS_POINTS)}P 무료 지급.
            </p>
          </div>

          {/* 포인트 단가 */}
          <div className="bg-surface-container-lowest rounded-2xl shadow-ambient p-8">
            <h2 className="text-lg font-headline font-bold text-on-surface font-korean mb-4">포인트 단가표</h2>

            {/* 유료 항목 */}
            <h3 className="text-sm font-bold text-primary font-korean mb-2">유료 항목</h3>
            <div className="space-y-2 mb-6">
              {PAID_ACTIONS.map(([, info]) => (
                <div key={info.label} className="flex items-center justify-between p-3 rounded-xl bg-surface-container-low/50">
                  <div>
                    <p className="text-sm font-semibold text-on-surface font-korean">{info.label}</p>
                    <p className="text-[11px] text-on-surface-variant font-korean">{info.desc}</p>
                  </div>
                  <span className="text-sm font-data font-bold text-primary shrink-0">{fmtP(info.cost)}</span>
                </div>
              ))}
            </div>

            {/* 무료 항목 */}
            <h3 className="text-sm font-bold text-tertiary font-korean mb-2">무료 항목</h3>
            <div className="flex flex-wrap gap-2">
              {(Object.entries(POINT_COSTS) as [PointAction, typeof POINT_COSTS[PointAction]][])
                .filter(([, info]) => info.cost === 0)
                .map(([, info]) => (
                  <span key={info.label} className="px-3 py-1.5 rounded-full bg-tertiary/5 border border-tertiary/15 text-xs text-on-surface font-korean">
                    {info.label}
                    <span className="text-tertiary ml-1 font-data">FREE</span>
                  </span>
                ))}
            </div>

            {/* 월 예상 비용 */}
            <div className="mt-6 p-4 rounded-xl bg-surface-container-low/50">
              <p className="text-sm font-bold text-on-surface font-korean mb-2">기사 30명 월 예상 비용</p>
              <div className="space-y-1 text-xs text-on-surface-variant font-korean">
                <div className="flex justify-between text-error/80 font-semibold"><span>초과 기사 {EST_EXTRA}명 x {fmtP(EXTRA_DRIVER_MONTHLY_POINTS)}</span><span className="font-data">{fmtP(EST_DRIVER_FEE)}/월</span></div>
                <div className="flex justify-between"><span>계약서 전송 6건</span><span className="font-data">{fmt(6 * POINT_COSTS.contract_send.cost)}P</span></div>
                <div className="flex justify-between"><span>정산서 생성 6세트 (30명÷5명)</span><span className="font-data">{fmt(6 * POINT_COSTS.settlement_generate.cost)}P</span></div>
                <div className="flex justify-between"><span>엑셀 업로드 1회</span><span className="font-data">{fmt(1 * POINT_COSTS.excel_upload.cost)}P</span></div>
                <div className="flex justify-between text-tertiary"><span>정산전송·PDF·알림톡·기사등록</span><span className="font-data">무료</span></div>
                <div className="flex justify-between border-t border-outline-variant/20 pt-1 mt-1 font-semibold text-on-surface">
                  <span>월 총비용</span>
                  <span className="font-data text-primary">{fmtP(EST_TOTAL)}</span>
                </div>
                <div className="text-[10px] text-on-surface-variant/60">
                  (기사비 {fmtP(EST_DRIVER_FEE)} + 포인트 {fmtP(EST_POINT_TOTAL)})
                </div>
              </div>
              <p className="text-[10px] text-on-surface-variant/60 mt-2 font-korean">
                기사 5명 무료, 초과 시 기사당 {fmtP(EXTRA_DRIVER_MONTHLY_POINTS)}/월. 구독형은 플랜 내 기사 수까지 추가 비용 없음.
              </p>
            </div>
          </div>

          {/* 거래 내역 */}
          <div className="bg-surface-container-lowest rounded-2xl shadow-ambient p-8">
            <h2 className="text-lg font-headline font-bold text-on-surface font-korean mb-6">최근 거래 내역</h2>
            {pointTxs.length === 0 ? (
              <p className="text-sm text-on-surface-variant text-center py-6 font-korean">거래 내역이 없습니다.</p>
            ) : (
              <div className="divide-y divide-outline-variant/15">
                {pointTxs.map((tx) => (
                  <div key={tx.id} className="flex items-center justify-between py-3">
                    <div>
                      <p className="text-sm text-on-surface font-korean">{tx.description}</p>
                      <p className="text-[11px] text-on-surface-variant font-data">
                        {new Date(tx.createdAt).toLocaleString('ko-KR')}
                      </p>
                    </div>
                    <div className="text-right">
                      <p className={`text-sm font-data font-bold ${tx.amount >= 0 ? 'text-tertiary' : 'text-error'}`}>
                        {tx.amount >= 0 ? '+' : ''}{fmtP(tx.amount)}
                      </p>
                      <p className="text-[11px] text-on-surface-variant font-data">잔액 {fmtP(tx.balanceAfter)}</p>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* 구독형 전환 안내 */}
          <div className="bg-surface-container-lowest rounded-2xl shadow-ambient p-6 flex items-center justify-between">
            <div>
              <p className="text-sm font-bold text-on-surface font-korean">구독형으로 전환하면?</p>
              <p className="text-xs text-on-surface-variant font-korean mt-1">
                Basic {fmtKRW(49900)}/월로 계약서·정산서·엑셀 업로드 무제한.
                기사 50명 이상이면 구독이 더 유리합니다.
              </p>
            </div>
            <button onClick={() => setTab('subscription')}
              className="h-9 px-5 rounded-xl bg-primary/10 text-primary text-xs font-semibold font-korean hover:bg-primary/20 transition-colors shrink-0">
              구독형 보기
            </button>
          </div>
        </>
      )}
    </div>
  );
}
