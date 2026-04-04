'use client';

import { useEffect, useState } from 'react';
import { createBrowserSupabaseClient } from '@/lib/supabase';
import { type PlanType, PLAN_LABELS, PLAN_LIMITS, isPlanAtLeast } from '@/lib/plan-limits';
import { usePlan } from '@/contexts/PlanContext';

interface PlanOption {
  id: PlanType;
  price: number;
  highlights: string[];
}

const PLAN_OPTIONS: PlanOption[] = [
  { id: 'free', price: 0, highlights: ['기사 10명', '기본 정산', '공지 관리'] },
  { id: 'basic', price: 49900, highlights: ['기사 30명', '전자계약서', '정산서 빌더', '세금계산서', '엑셀 업로드'] },
  { id: 'standard', price: 99000, highlights: ['기사 80명', 'Basic 전체', '매출 리포트', '푸시 알림'] },
  { id: 'pro', price: 149000, highlights: ['기사 150명', 'Standard 전체', 'API 연동', '대용량 처리'] },
  { id: 'enterprise', price: 199000, highlights: ['기사 무제한', '전담 매니저', 'SLA 99.9%', '맞춤형 정산'] },
];

function formatKRW(n: number): string {
  return `₩${n.toLocaleString('ko-KR')}`;
}

export default function BillingTab() {
  const { plan: currentPlan, refreshPlan } = usePlan();
  const [cardInfo, setCardInfo] = useState<{ cardName: string; cardNumber: string } | null>(null);
  const [loading, setLoading] = useState(true);
  const [processing, setProcessing] = useState(false);
  const [upgrading, setUpgrading] = useState<string | null>(null);

  useEffect(() => {
    async function load() {
      const supabase = createBrowserSupabaseClient();
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) { setLoading(false); return; }
      const aid = user.app_metadata?.agency_id as string;

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
      setLoading(false);
    }
    load();
  }, []);

  const handleRegisterCard = async () => {
    const storeId = process.env.NEXT_PUBLIC_PORTONE_STORE_ID;
    const channelKey = process.env.NEXT_PUBLIC_PORTONE_CHANNEL_KEY;
    if (!storeId || !channelKey) {
      alert('결제 시스템이 설정되지 않았습니다.');
      return;
    }

    setProcessing(true);
    try {
      const PortOne = await import('@portone/browser-sdk/v2');
      const result = await PortOne.requestIssueBillingKey({
        storeId,
        channelKey,
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
          cardName: '',
          cardNumber: '',
        }),
      });

      if (res.ok) {
        setCardInfo({ cardName: '신용카드', cardNumber: '등록 완료' });
        alert('카드가 등록되었습니다.');
      } else {
        alert('카드 정보 저장 실패');
      }
    } catch (err) {
      alert('카드 등록 중 오류: ' + (err instanceof Error ? err.message : ''));
    }
    setProcessing(false);
  };

  const handleUpgrade = async (targetPlan: PlanType) => {
    if (!cardInfo) {
      alert('먼저 카드를 등록해주세요.');
      return;
    }
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

  if (loading) return <p className="text-center text-on-surface-variant py-12 font-korean">불러오는 중...</p>;

  return (
    <div className="space-y-6">
      {/* 현재 구독 */}
      <div className="bg-surface-container-lowest rounded-2xl shadow-ambient p-8">
        <h2 className="text-lg font-headline font-bold text-on-surface font-korean mb-6">현재 구독</h2>
        <div className="flex items-center justify-between p-5 rounded-xl bg-surface-container-low">
          <div>
            <p className="text-sm text-on-surface-variant font-label font-korean">현재 플랜</p>
            <p className="text-2xl font-data font-bold text-primary mt-1">{PLAN_LABELS[currentPlan] ?? currentPlan}</p>
            <p className="text-sm text-on-surface-variant font-data mt-1">
              {formatKRW(PLAN_OPTIONS.find(p => p.id === currentPlan)?.price ?? 0)} / 월
            </p>
          </div>
          <div className="text-right text-xs text-on-surface-variant font-korean">
            <p>기사: {PLAN_LIMITS[currentPlan]?.maxDrivers === null ? '무제한' : `${PLAN_LIMITS[currentPlan]?.maxDrivers}명`}</p>
            <p>관리자: {PLAN_LIMITS[currentPlan]?.maxAdminAccounts}명</p>
            <p>템플릿: {PLAN_LIMITS[currentPlan]?.maxDefaultTemplates}개</p>
          </div>
        </div>
      </div>

      {/* 플랜 비교 */}
      <div className="bg-surface-container-lowest rounded-2xl shadow-ambient p-8">
        <h2 className="text-lg font-headline font-bold text-on-surface font-korean mb-6">플랜 비교</h2>
        <div className="grid grid-cols-1 md:grid-cols-3 lg:grid-cols-5 gap-4">
          {PLAN_OPTIONS.map((opt) => {
            const isCurrent = currentPlan === opt.id;
            const isDowngrade = !isPlanAtLeast(opt.id, currentPlan);
            const isUpgrade = !isCurrent && isPlanAtLeast(opt.id, currentPlan) && opt.id !== currentPlan;

            return (
              <div key={opt.id} className={`rounded-2xl border-2 p-5 transition-all ${
                isCurrent
                  ? 'border-primary bg-primary/5'
                  : 'border-outline-variant/15 hover:border-outline-variant/30'
              }`}>
                <h3 className="text-sm font-bold text-on-surface font-korean">{PLAN_LABELS[opt.id]}</h3>
                <p className="text-xl font-data font-bold text-primary mt-2">
                  {opt.price === 0 ? '무료' : formatKRW(opt.price)}
                  {opt.price > 0 && <span className="text-xs text-on-surface-variant font-normal">/월</span>}
                </p>

                <ul className="mt-4 space-y-1.5">
                  {opt.highlights.map((h) => (
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
                    <div className="h-9 flex items-center justify-center rounded-xl bg-primary/10 text-primary text-xs font-semibold font-korean">
                      현재 플랜
                    </div>
                  ) : isUpgrade ? (
                    <button onClick={() => handleUpgrade(opt.id)}
                      disabled={!!upgrading}
                      className="w-full h-9 rounded-xl bg-primary text-white text-xs font-semibold font-korean hover:bg-primary/90 disabled:opacity-50 transition-colors">
                      {upgrading === opt.id ? '처리중...' : '업그레이드'}
                    </button>
                  ) : isDowngrade ? (
                    <div className="h-9 flex items-center justify-center rounded-xl bg-surface-container-low text-on-surface-variant/40 text-xs font-korean">
                      다운그레이드
                    </div>
                  ) : null}
                </div>
              </div>
            );
          })}
        </div>
        <p className="text-xs text-on-surface-variant/50 mt-4 font-korean">
          Enterprise 플랜은 별도 문의가 필요합니다. 다운그레이드는 고객센터로 연락해주세요.
        </p>
      </div>
    </div>
  );
}
