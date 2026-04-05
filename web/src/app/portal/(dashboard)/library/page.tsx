'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';

/**
 * /portal/library → /portal/documents 리다이렉트
 * 기존 "내 문서함"과 "문서함 관리"를 하나로 통합
 */
export default function LibraryRedirectPage() {
  const router = useRouter();

  useEffect(() => {
    router.replace('/portal/documents');
  }, [router]);

  return (
    <div className="flex items-center justify-center h-48 text-sm text-on-surface-variant font-korean">
      문서함으로 이동 중...
    </div>
  );
}
