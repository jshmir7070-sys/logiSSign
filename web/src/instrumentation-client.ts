import * as Sentry from '@sentry/nextjs'

const SENTRY_DSN = process.env.NEXT_PUBLIC_SENTRY_DSN

if (SENTRY_DSN) {
  Sentry.init({
    dsn: SENTRY_DSN,

    // 프로덕션에서만 performance tracing (10% 샘플)
    tracesSampleRate: process.env.NODE_ENV === 'production' ? 0.1 : 1.0,

    // Session Replay (에러 발생 시에만)
    replaysSessionSampleRate: 0,
    replaysOnErrorSampleRate: process.env.NODE_ENV === 'production' ? 1.0 : 0,

    // 환경 구분
    environment: process.env.NODE_ENV ?? 'development',

    // 불필요한 에러 필터링
    ignoreErrors: [
      // 브라우저 확장 프로그램 에러
      'ResizeObserver loop',
      'Non-Error promise rejection',
      // 네트워크 에러 (사용자 환경)
      'Failed to fetch',
      'Load failed',
      'NetworkError',
      // Next.js 내부
      'NEXT_NOT_FOUND',
      'NEXT_REDIRECT',
    ],

    beforeSend(event) {
      // 로컬 개발 환경에서는 콘솔만 출력
      if (process.env.NODE_ENV === 'development') {
        console.warn('[Sentry] Would send event:', event.exception?.values?.[0]?.value)
        return null
      }
      return event
    },
  })
}
