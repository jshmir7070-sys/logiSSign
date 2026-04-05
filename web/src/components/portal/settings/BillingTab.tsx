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

function formatKRW(n: number): string {
  return `₩${n.toLocaleString('ko-KR')}`;
}
function formatP(n: number): string {
  return `${n.toLocaleString('ko-KR')}P`;
}

export default function BillingTab() {
  const { plan: currentPlan, refreshPlan } = usePlan();
  const [tab, setTab] = useState<'subscription' | 'point'>(currentPlan === 'point' ? 'point' : 'subscription');
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
        setTab('point');
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
    if (!storeId || !channelKey) { alert('결제 시스템이 설정되지 않���습니다.'); return; }

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
    if (!cardInfo) { alert('먼저 카드를 등록해주세���.'); return; }
    if (!confirm(`${PLAN_LABELS[targetPlan]} 플랜으로 업그레이드하시겠습��까?`)) return;

    setUpgrading(targetPlan);
    try {
      const res = await fetch('/api/payment', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'charge', plan: targetPlan, billing: 'monthly' }),
      });
      if (res.ok) {
        alert(`${PLAN_LABELS[targetPlan]} 플��으로 업그레이드되었습니다!`);
        await refreshPlan();
      } else {
        const err = await res.json();
        alert('업그레이드 실패: ' + (err.error || ''));
      }
    } catch { alert('오류가 발생했습니다'); }
    setUpgrading(null);
  };

  /* ── Point Charge ── */
  const handleChargePoints = async (pkgId: string) => {
    if (!cardInfo) { alert('먼저 카드�� 등록해주세요.'); return; }
    const pkg = packages.find(p => p.id === pkgId);
    if (!pkg) return;
    if (!confirm(`${pkg.name} (${formatKRW(pkg.price)})을 충전하시겠습니까?${pkg.bonus_points > 0 ? ` 보너스 +${formatP(pkg.bonus_points)}` : ''}`)) return;

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
        alert(`${formatP(data.charged)}${data.bonus > 0 ? ` + 보너스 ${formatP(data.bonus)}` : ''} 충전 완료!`);
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
    `h-10 px-6 rounded-xl text-sm font-semibold font-korean transition-all ${
      active ? 'bg-primary text-white shadow-md' : 'bg-surface-container-low text-on-surface-variant hover:bg-surface-container-high'
    }`;

  return (
    <div className="space-y-6">
      {/* ── 탭 선택 ��─ */}
      <div className="flex gap-2">
        <button onClick={() => setTab('subscription')} className={tabCls(tab === 'subscription')}>
          구독형 (월정액)
        </button>
        <button onClick={() => setTab('point')} className={tabCls(tab === 'point')}>
          포인트 충전형
        </button>
      </div>

      {/* ══════════════════ 구독형 탭 ══════════════════ */}
      {tab === 'subscription' && (
        <>
          {/* 현재 구독 */}
          <div className="bg-surface-container-lowest rounded-2xl shadow-ambient p-8">
            <h2 className="text-lg font-headline font-bold text-on-surface font-korean mb-6">현재 구독</h2>
            <div className="flex items-center justify-between p-5 rounded-xl bg-surface-container-low">
              <div>
                <p className="text-sm text-on-surface-variant font-label font-korean">현재 플랜</p>
                <p className="text-2xl font-data font-bold text-primary mt-1">{PLAN_LABELS[currentPlan] ?? currentPlan}</p>
                <p className="text-sm text-on-surface-variant font-data mt-1">
                  {currentPlan === 'point' ? '포인트 충전형' : `${formatKRW(PLAN_PRICES[currentPlan] ?? 0)} / 월`}
                </p>
              </div>
              <div className="text-right space-y-1">
                {currentPlan !== 'point' && (
                  <>
                    <p className="text-xs text-on-surface-variant font-korean">기사: {PLAN_LIMITS[currentPlan]?.maxDrivers === null ? '무제한' : `${PLAN_LIMITS[currentPlan]?.maxDrivers}명`}</p>
                    <p className="text-xs text-on-surface-variant font-korean">관리자: {PLAN_LIMITS[currentPlan]?.maxAdminAccounts}명</p>
                    <p className="text-xs text-on-surface-variant font-korean">템플릿: {PLAN_LIMITS[currentPlan]?.maxDefaultTemplates}개</p>
                  </>
                )}
                {/* 카드 정보 */}
                {cardInfo ? (
                  <p className="text-xs text-tertiary font-korean mt-2">{cardInfo.cardName} {cardInfo.cardNumber}</p>
                ) : (
                  <button onClick={handleRegisterCard} disabled={processing}
                    className="mt-2 h-8 px-4 rounded-lg bg-primary text-white text-xs font-semibold font-korean disabled:opacity-50">
                    {processing ? '처리중...' : '카드 등록'}
                  </button>
                )}
              </div>
            </div>
          </div>

          {/* 플랜 비교 */}
          <div className="bg-surface-container-lowest rounded-2xl shadow-ambient p-8">
            <h2 className="text-lg font-headline font-bold text-on-surface font-korean mb-6">플랜 비교</h2>
            <div className="grid grid-cols-1 md:grid-cols-3 lg:grid-cols-5 gap-4">
              {SUB_PLAN_ORDER.map((opt) => {
                const isCurrent = currentPlan === opt;
                const isUpgrade = !isCurrent && isPlanAtLeast(opt, currentPlan) && opt !== currentPlan;
                const isDowngrade = !isCurrent && !isUpgrade;

                return (
                  <div key={opt} className={`rounded-2xl border-2 p-5 transition-all ${
                    isCurrent ? 'border-primary bg-primary/5' : 'border-outline-variant/15 hover:border-outline-variant/30'
                  }`}>
                    <h3 className="text-sm font-bold text-on-surface font-korean">{PLAN_LABELS[opt]}</h3>
                    <p className="text-xl font-data font-bold text-primary mt-2">
                      {PLAN_PRICES[opt] === 0 ? '무료' : formatKRW(PLAN_PRICES[opt])}
                      {PLAN_PRICES[opt] > 0 && <span className="text-xs text-on-surface-variant font-normal">/월</span>}
                    </p>
                    <ul className="mt-4 space-y-1.5">
                      {PLAN_HIGHLIGHTS[opt].map((h) => (
                        <li key={h} className="flex items-start gap-1.5 text-xs text-on-surface-variant font-korean">
                          <svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor" className="text-tertiary shrink-0 mt-0.5">
                            <path d="M9 16.17L4.83 12l-1.42 1.41L9 19 21 7l-1.41-1.41z"/>
                          </svg>
                          {h}
                        </li>
                      ))}
                    </ul>
                    <div className="mt-5">
                      {isCurrent ? (
                        <div className="h-9 flex items-center justify-center rounded-xl bg-primary/10 text-primary text-xs font-semibold font-korean">현재 플랜</div>
                      ) : isUpgrade ? (
                        <button onClick={() => handleUpgrade(opt)} disabled={!!upgrading}
                          className="w-full h-9 rounded-xl bg-primary text-white text-xs font-semibold font-korean hover:bg-primary/90 disabled:opacity-50">
                          {upgrading === opt ? '처리중...' : '업그레이드'}
                        </button>
                      ) : isDowngrade ? (
                        <div className="h-9 flex items-center justify-center rounded-xl bg-surface-container-low text-on-surface-variant/40 text-xs font-korean">다운��레이드</div>
                      ) : null}
                    </div>
                  </div>
                );
              })}
            </div>
            <p className="text-xs text-on-surface-variant/50 mt-4 font-korean">
              Enterprise 플랜은 별도 문의가 필요합니다. 다운그레이드는 고객센터로 연락해주세��.
            </p>
          </div>
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
                <p className="text-3xl font-data font-bold text-primary mt-2">
                  {formatP(pointBalance?.balance ?? 0)}
                </p>
              </div>
              <div className="p-5 rounded-xl bg-surface-container-low text-center">
                <p className="text-xs text-on-surface-variant font-korean">누적 충전</p>
                <p className="text-xl font-data font-bold text-tertiary mt-2">
                  {formatP(pointBalance?.totalCharged ?? 0)}
                </p>
              </div>
              <div className="p-5 rounded-xl bg-surface-container-low text-center">
                <p className="text-xs text-on-surface-variant font-korean">누적 사용</p>
                <p className="text-xl font-data font-bold text-error mt-2">
                  {formatP(pointBalance?.totalUsed ?? 0)}
                </p>
              </div>
            </div>

            {/* 카드 미등록 시 */}
            {!cardInfo && (
              <div className="mt-4 p-4 rounded-xl bg-amber-50 border border-amber-200 flex items-center justify-between">
                <p className="text-sm text-amber-800 font-korean">포인트 충전을 위해 카드를 먼저 등록해주세요.</p>
                <button onClick={handleRegisterCard} disabled={processing}
                  className="h-8 px-4 rounded-lg bg-primary text-white text-xs font-semibold font-korean disabled:opacity-50 shrink-0">
                  {processing ? '처리중...' : '카드 ��록'}
                </button>
              </div>
            )}
          </div>

          {/* 충전 패키지 */}
          <div className="bg-surface-container-lowest rounded-2xl shadow-ambient p-8">
            <h2 className="text-lg font-headline font-bold text-on-surface font-korean mb-6">포인트 충전</h2>
            <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3">
              {(packages.length > 0 ? packages : POINT_PACKAGES.map((p, i) => ({ id: `local_${i}`, name: formatP(p.points), points: p.points, price: p.price, bonus_points: p.bonus }))).map((pkg) => (
                <button key={pkg.id} onClick={() => handleChargePoints(pkg.id)}
                  disabled={!cardInfo || !!chargingPkg}
                  className={`relative p-4 rounded-2xl border-2 transition-all text-center hover:border-primary/40 hover:shadow-md disabled:opacity-50 ${
                    pkg.bonus_points > 0 ? 'border-tertiary/30 bg-tertiary/[0.03]' : 'border-outline-variant/15'
                  }`}>
                  {pkg.bonus_points > 0 && (
                    <span className="absolute -top-2 right-2 px-2 py-0.5 rounded-full bg-tertiary text-white text-[10px] font-bold">
                      +{formatP(pkg.bonus_points)}
                    </span>
                  )}
                  <p className="text-lg font-data font-bold text-on-surface">{pkg.name}</p>
                  <p className="text-sm font-data text-primary mt-1">{formatKRW(pkg.price)}</p>
                  {chargingPkg === pkg.id && (
                    <p className="text-xs text-on-surface-variant mt-1 font-korean">결제 중...</p>
                  )}
                </button>
              ))}
            </div>
          </div>

          {/* 항목별 포인트 단가 */}
          <div className="bg-surface-container-lowest rounded-2xl shadow-ambient p-8">
            <h2 className="text-lg font-headline font-bold text-on-surface font-korean mb-6">항목별 포인트 단가</h2>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
              {(Object.entries(POINT_COSTS) as [PointAction, typeof POINT_COSTS[PointAction]][]).map(([key, info]) => (
                <div key={key} className="flex items-center justify-between p-3 rounded-xl bg-surface-container-low/50">
                  <div>
                    <p className="text-sm font-semibold text-on-surface font-korean">{info.label}</p>
                    <p className="text-[11px] text-on-surface-variant font-korean">{info.desc}</p>
                  </div>
                  <span className={`text-sm font-data font-bold shrink-0 ${info.cost === 0 ? 'text-tertiary' : 'text-primary'}`}>
                    {info.cost === 0 ? '무료' : `${info.cost}P`}
                  </span>
                </div>
              ))}
            </div>
          </div>

          {/* 거래 내역 */}
          <div className="bg-surface-container-lowest rounded-2xl shadow-ambient p-8">
            <h2 className="text-lg font-headline font-bold text-on-surface font-korean mb-6">최근 거래 내역</h2>
            {pointTxs.length === 0 ? (
              <p className="text-sm text-on-surface-variant text-center py-6 font-korean">거��� 내역이 없습니다.</p>
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
                        {tx.amount >= 0 ? '+' : ''}{formatP(tx.amount)}
                      </p>
                      <p className="text-[11px] text-on-surface-variant font-data">잔액 {formatP(tx.balanceAfter)}</p>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </>
      )}

      {/* ══════════════════ 구독형 vs 포인트형 비교 (항상 표시) ���═════════════════ */}
      <div className="bg-surface-container-lowest rounded-2xl shadow-ambient p-8">
        <h2 className="text-lg font-headline font-bold text-on-surface font-korean mb-2">구독형 vs 포인트형 비��</h2>
        <p className="text-xs text-on-surface-variant font-korean mb-6">기사 30명, 월 계약서 6건, 정산서 30건 기준 예상 비용</p>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {/* 구독형 */}
          <div className="p-5 rounded-2xl border-2 border-primary/30 bg-primary/[0.03]">
            <div className="flex items-center gap-2 mb-3">
              <span className="px-2.5 py-1 rounded-lg bg-primary/10 text-primary text-xs font-bold">추천</span>
              <h3 className="text-sm font-bold text-on-surface font-korean">구독형 (Basic)</h3>
            </div>
            <p className="text-2xl font-data font-bold text-primary">{formatKRW(49900)}<span className="text-xs font-normal text-on-surface-variant">/월</span></p>
            <ul className="mt-3 space-y-1 text-xs text-on-surface-variant font-korean">
              <li className="flex items-center gap-1.5">
                <svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor" className="text-tertiary"><path d="M9 16.17L4.83 12l-1.42 1.41L9 19 21 7l-1.41-1.41z"/></svg>
                기사 30명 포함
              </li>
              <li className="flex items-center gap-1.5">
                <svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor" className="text-tertiary"><path d="M9 16.17L4.83 12l-1.42 1.41L9 19 21 7l-1.41-1.41z"/></svg>
                계약서·정산서·SMS 무제한
              </li>
              <li className="flex items-center gap-1.5">
                <svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor" className="text-tertiary"><path d="M9 16.17L4.83 12l-1.42 1.41L9 19 21 7l-1.41-1.41z"/></svg>
                정산서 빌더·엑셀 업로드 포함
              </li>
              <li className="flex items-center gap-1.5">
                <svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor" className="text-tertiary"><path d="M9 16.17L4.83 12l-1.42 1.41L9 19 21 7l-1.41-1.41z"/></svg>
                추가 비용 없음
              </li>
            </ul>
          </div>

          {/* 포인트형 */}
          <div className="p-5 rounded-2xl border-2 border-outline-variant/20">
            <h3 className="text-sm font-bold text-on-surface font-korean mb-3">포인트 충전형</h3>
            <p className="text-2xl font-data font-bold text-on-surface">
              ~{formatKRW(
                6 * POINT_COSTS.contract_send.cost +
                30 * POINT_COSTS.settlement_generate.cost +
                30 * POINT_COSTS.settlement_pdf.cost +
                36 * POINT_COSTS.sms_send.cost +
                1 * POINT_COSTS.excel_upload.cost
              )}
              <span className="text-xs font-normal text-on-surface-variant">/월 예상</span>
            </p>
            <div className="mt-3 space-y-1 text-xs text-on-surface-variant font-korean">
              <div className="flex justify-between"><span>계약서 전송 6건</span><span className="font-data">{6 * POINT_COSTS.contract_send.cost}P</span></div>
              <div className="flex justify-between"><span>정산서 생성 30건</span><span className="font-data">{30 * POINT_COSTS.settlement_generate.cost}P</span></div>
              <div className="flex justify-between"><span>정산서 PDF 30건</span><span className="font-data">{30 * POINT_COSTS.settlement_pdf.cost}P</span></div>
              <div className="flex justify-between"><span>SMS 발송 36건</span><span className="font-data">{36 * POINT_COSTS.sms_send.cost}P</span></div>
              <div className="flex justify-between"><span>엑셀 업로드 1회</span><span className="font-data">{1 * POINT_COSTS.excel_upload.cost}P</span></div>
              <div className="flex justify-between border-t border-outline-variant/20 pt-1 mt-1 font-semibold text-on-surface">
                <span>합계</span>
                <span className="font-data">{formatP(
                  6 * POINT_COSTS.contract_send.cost +
                  30 * POINT_COSTS.settlement_generate.cost +
                  30 * POINT_COSTS.settlement_pdf.cost +
                  36 * POINT_COSTS.sms_send.cost +
                  1 * POINT_COSTS.excel_upload.cost
                )}</span>
              </div>
            </div>
            <p className="text-[10px] text-on-surface-variant/50 mt-2 font-korean">소량 사용(기사 20명 이하) 시 포인트형이 유리할 수 ��습니다.</p>
          </div>
        </div>
      </div>
    </div>
  );
}
