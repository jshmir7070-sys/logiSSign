'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';

/**
 * 메인 페이지 (/) → 준비중 페이지로 리디렉트
 * 서비스 오픈 후 /portal/login 또는 /about으로 변경
 */
export default function HomePage() {
  const router = useRouter();
  useEffect(() => {
    router.replace('/coming-soon');
  }, [router]);
  return null;
}
