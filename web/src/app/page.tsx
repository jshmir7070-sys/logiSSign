'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';

/**
 * 메인 페이지 (/) → 로그인 페이지로 리디렉트
 * 커밍순: /coming-soon
 * 서비스 소개: /about
 */
export default function HomePage() {
  const router = useRouter();
  useEffect(() => {
    router.replace('/portal/login');
  }, [router]);
  return null;
}
