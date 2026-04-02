'use client';

import { useEffect, useState } from 'react';
import { createBrowserSupabaseClient } from '@/lib/supabase';

export default function BillingTab() {
  const [plan, setPlan] = useState('free');
  const [cardInfo, setCardInfo] = useState<{ cardName: string; cardNumber: string } | null>(null);
  const [loading, setLoading] = useState(true);
  const [processing, setProcessing] = useState(false);

  useEffect(() => {
    async function load() {
      const supabase = createBrowserSupabaseClient();
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) { setLoading(false); return; }
      const aid = user.app_metadata?.agency_id as string;
      setPlan(user.app_metadata?.plan as string ?? 'free');

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

  const planLabels: Record<string, string> = { free: 'Free', basic: 'Basic', standard: 'Standard', enterprise: 'Enterprise' };
  const planPrices: Record<string, string> = { free: '₩0', basic: '₩49,900', standard: '₩99,000', enterprise: '별도 상담' };

  if (loading) return <p className="text-center text-on-surface-variant py-12 font-korean">불러오는 중...</p>;

  return (
    <div className="space-y-6">
      <div className="bg-surface-container-lowest rounded-2xl shadow-ambient p-8">
        <h2 className="text-lg font-headline font-bold text-on-surface font-korean mb-6">현재 구독</h2>
        <div className="flex items-center justify-between p-5 rounded-xl bg-surface-container-low">
          <div>
            <p className="text-sm text-on-surface-variant font-label font-korean">현재 플랜</p>
            <p className="text-2xl font-data font-bold text-primary mt-1">{planLabels[plan] ?? plan}</p>
            <p className="text-sm text-on-surface-variant font-data mt-1">{planPrices[plan] ?? ''} / 월</p>
          </div>
        </div>
      </div>

      <div className="bg-surface-container-lowest rounded-2xl shadow-ambient p-8">
        <h2 className="text-lg font-headline font-bold text-on-surface font-korean mb-6">결제 수단</h2>
        {cardInfo ? (
          <div className="flex items-center gap-4 p-4 rounded-xl bg-surface-container-low">
            <div className="w-10 h-10 rounded-xl bg-tertiary/10 flex items-center justify-center">
              <svg width="20" height="20" viewBox="0 0 24 24" fill="currentColor" className="text-tertiary">
                <path d="M20 4H4c-1.11 0-1.99.89-1.99 2L2 18c0 1.11.89 2 2 2h16c1.11 0 2-.89 2-2V6c0-1.11-.89-2-2-2zm0 14H4v-6h16v6zm0-10H4V6h16v2z"/>
              </svg>
            </div>
            <div className="flex-1">
              <p className="text-sm font-semibold text-on-surface font-korean">{cardInfo.cardName}</p>
              <p className="text-xs text-on-surface-variant font-data">{cardInfo.cardNumber}</p>
            </div>
            <button
              onClick={handleRegisterCard}
              disabled={processing}
              className="h-9 px-4 rounded-lg bg-surface-container-high text-on-surface-variant text-sm font-korean hover:bg-surface-container-highest"
            >
              변경
            </button>
          </div>
        ) : (
          <div className="flex items-center gap-4 p-4 rounded-xl bg-surface-container-low">
            <div className="w-10 h-10 rounded-xl bg-surface-container-high flex items-center justify-center">
              <svg width="20" height="20" viewBox="0 0 24 24" fill="currentColor" className="text-on-surface-variant">
                <path d="M20 4H4c-1.11 0-1.99.89-1.99 2L2 18c0 1.11.89 2 2 2h16c1.11 0 2-.89 2-2V6c0-1.11-.89-2-2-2zm0 14H4v-6h16v6zm0-10H4V6h16v2z"/>
              </svg>
            </div>
            <div className="flex-1">
              <p className="text-sm font-semibold text-on-surface font-korean">카드 등록 필요</p>
              <p className="text-xs text-on-surface-variant font-korean">정기결제를 위해 카드를 등록하세요</p>
            </div>
            <button
              onClick={handleRegisterCard}
              disabled={processing}
              className="h-9 px-4 rounded-lg bg-primary text-white text-sm font-korean hover:bg-primary/90 disabled:opacity-50"
            >
              {processing ? '처리중...' : '카드 등록'}
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
