import * as Sentry from '@sentry/nextjs'

const SENTRY_DSN = process.env.NEXT_PUBLIC_SENTRY_DSN

if (SENTRY_DSN) {
  Sentry.init({
    dsn: SENTRY_DSN,

    // 서버사이드 tracing
    tracesSampleRate: process.env.NODE_ENV === 'production' ? 0.1 : 1.0,

    environment: process.env.NODE_ENV ?? 'development',

    // 민감 데이터 제거
    beforeSend(event) {
      // PII 헤더 제거
      if (event.request?.headers) {
        delete event.request.headers['cookie']
        delete event.request.headers['authorization']
      }
      return event
    },
  })
}
