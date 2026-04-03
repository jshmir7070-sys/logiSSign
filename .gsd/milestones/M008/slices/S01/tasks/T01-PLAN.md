---
estimated_steps: 9
estimated_files: 8
skills_used: []
---

# T01: Sentry SDK 설치 + 전체 설정

1. @sentry/nextjs 설치
2. sentry.client.config.ts 작성
3. sentry.server.config.ts 작성
4. sentry.edge.config.ts 작성 (middleware용)
5. instrumentation.ts 작성
6. next.config.mjs에 withSentryConfig 래핑
7. error.tsx + global-error.tsx에 Sentry.captureException 추가
8. .env.example에 Sentry 변수 추가
9. build + test 검증

## Inputs

- `web/next.config.mjs`
- `web/src/app/error.tsx`
- `web/src/app/global-error.tsx`

## Expected Output

- `web/sentry.client.config.ts`
- `web/sentry.server.config.ts`
- `web/sentry.edge.config.ts`
- `web/src/instrumentation.ts`
- `web/next.config.mjs (수정)`
- `web/src/app/error.tsx (수정)`
- `web/src/app/global-error.tsx (수정)`

## Verification

npx next build 성공 + npm test 188 통과
