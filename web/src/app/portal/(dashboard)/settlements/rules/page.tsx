'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';

/**
 * 정산 규칙 페이지 → 카테고리 관리로 리다이렉트
 * 정산 규칙은 카테고리(원청사) 설정에서 통합 관리됩니다.
 */
export default function SettlementRulesRedirect() {
  const router = useRouter();

  useEffect(() => {
    router.replace('/portal/principals');
  }, [router]);

  return (
    <div className="flex items-center justify-center h-64">
      <p className="text-sm text-on-surface-variant font-korean">
        카테고리 관리 페이지로 이동 중...
      </p>
    </div>
  );
}
