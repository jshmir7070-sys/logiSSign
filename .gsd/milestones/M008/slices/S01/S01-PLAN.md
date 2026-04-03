# S01: Sentry 에러 모니터링 연동

**Goal:** @sentry/nextjs 설치 + 클라이언트/서버 설정 + instrumentation.ts + error boundary 통합
**Demo:** After this: 의도적 에러 발생 → Sentry 대시보드에 수집 확인

## Tasks
- [x] **T01: Sentry \uc804\uccb4 \uc5f0\ub3d9: client/server/edge config + instrumentation + error boundary \ud1b5\ud569** — 1. @sentry/nextjs 설치
2. sentry.client.config.ts 작성
3. sentry.server.config.ts 작성
4. sentry.edge.config.ts 작성 (middleware용)
5. instrumentation.ts 작성
6. next.config.mjs에 withSentryConfig 래핑
7. error.tsx + global-error.tsx에 Sentry.captureException 추가
8. .env.example에 Sentry 변수 추가
9. build + test 검증
  - Estimate: 25min
  - Files: web/package.json, web/next.config.mjs, web/sentry.client.config.ts, web/sentry.server.config.ts, web/sentry.edge.config.ts, web/src/instrumentation.ts, web/src/app/error.tsx, web/src/app/global-error.tsx
  - Verify: npx next build 성공 + npm test 188 통과
