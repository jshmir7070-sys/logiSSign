import { withSentryConfig } from '@sentry/nextjs'

/** @type {import('next').NextConfig} */
const nextConfig = {
  async headers() {
    return [
      {
        // API 라우트에 CORS 헤더 적용
        source: '/api/:path*',
        headers: [
          { key: 'Access-Control-Allow-Origin', value: process.env.NEXT_PUBLIC_APP_URL || (process.env.NODE_ENV === 'production' ? '' : 'http://localhost:3000') },
          { key: 'Access-Control-Allow-Methods', value: 'GET, POST, PATCH, DELETE, OPTIONS' },
          { key: 'Access-Control-Allow-Headers', value: 'Content-Type, Authorization' },
          { key: 'Access-Control-Max-Age', value: '86400' },
        ],
      },
      {
        // 보안 헤더 (전체)
        source: '/(.*)',
        headers: [
          { key: 'X-Frame-Options', value: 'DENY' },
          { key: 'X-Content-Type-Options', value: 'nosniff' },
          { key: 'Referrer-Policy', value: 'strict-origin-when-cross-origin' },
          { key: 'X-DNS-Prefetch-Control', value: 'on' },
          { key: 'X-XSS-Protection', value: '1; mode=block' },
          {
            key: 'Strict-Transport-Security',
            value: 'max-age=63072000; includeSubDomains; preload',
          },
          // CSP: Kakao Postcode, Supabase, Google Fonts, Vercel Analytics 허용
          {
            key: 'Content-Security-Policy',
            value: [
              "default-src 'self'",
              "script-src 'self' 'unsafe-inline' 'unsafe-eval' https://t1.daumcdn.net https://postcode.map.daum.net https://ssl.daumcdn.net https://va.vercel-scripts.com",
              "style-src 'self' 'unsafe-inline' https://fonts.googleapis.com https://t1.daumcdn.net",
              "font-src 'self' https://fonts.gstatic.com data:",
              "img-src 'self' data: blob: https://*.supabase.co https://t1.daumcdn.net",
              "connect-src 'self' https://*.supabase.co wss://*.supabase.co https://postcode.map.daum.net https://va.vercel-scripts.com https://*.sentry.io https://*.ingest.sentry.io",
              "frame-src 'self' blob: https://*.supabase.co https://t1.daumcdn.net https://postcode.map.daum.net",
              "object-src 'self' blob:",
              "worker-src 'self' blob:",
              "base-uri 'self'",
              "form-action 'self'",
              "frame-ancestors 'none'",
            ].join('; '),
          },
          {
            key: 'Permissions-Policy',
            value: 'camera=(), microphone=(), geolocation=(), payment=()',
          },
        ],
      },
    ]
  },
}

export default withSentryConfig(nextConfig, {
  // Sentry 소스맵 업로드 (SENTRY_AUTH_TOKEN 필요, 없으면 건너뜀)
  silent: true,
  // 클라이언트 번들에서 Sentry 디버그 정보 제거
  disableLogger: true,
  // 빌드 시 소스맵 자동 업로드 비활성화 (CI에서만 활성화 권장)
  sourcemaps: {
    disable: !process.env.SENTRY_AUTH_TOKEN,
  },
})
