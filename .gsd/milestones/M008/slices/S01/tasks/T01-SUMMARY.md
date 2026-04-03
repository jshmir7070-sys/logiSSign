---
id: T01
parent: S01
milestone: M008
provides: []
requires: []
affects: []
key_files: ["web/src/instrumentation-client.ts", "web/sentry.server.config.ts", "web/sentry.edge.config.ts", "web/src/instrumentation.ts", "web/next.config.mjs", "web/src/app/error.tsx", "web/src/app/global-error.tsx"]
key_decisions: ["DSN 없으면 Sentry 완전 비활성화 (graceful)", "dev 환경에서는 console.warn만 출력, 전송 안 함", "PII 헤더(cookie, authorization) 서버 이벤트에서 제거", "CSP connect-src에 sentry.io 도메인 추가"]
patterns_established: []
drill_down_paths: []
observability_surfaces: []
duration: ""
verification_result: "npx next build \uc131\uacf5 (62 pages) + npm test 188 passed"
completed_at: 2026-04-03T13:27:32.060Z
blocker_discovered: false
---

# T01: Sentry \uc804\uccb4 \uc5f0\ub3d9: client/server/edge config + instrumentation + error boundary \ud1b5\ud569

> Sentry \uc804\uccb4 \uc5f0\ub3d9: client/server/edge config + instrumentation + error boundary \ud1b5\ud569

## What Happened
---
id: T01
parent: S01
milestone: M008
key_files:
  - web/src/instrumentation-client.ts
  - web/sentry.server.config.ts
  - web/sentry.edge.config.ts
  - web/src/instrumentation.ts
  - web/next.config.mjs
  - web/src/app/error.tsx
  - web/src/app/global-error.tsx
key_decisions:
  - DSN 없으면 Sentry 완전 비활성화 (graceful)
  - dev 환경에서는 console.warn만 출력, 전송 안 함
  - PII 헤더(cookie, authorization) 서버 이벤트에서 제거
  - CSP connect-src에 sentry.io 도메인 추가
duration: ""
verification_result: passed
completed_at: 2026-04-03T13:27:32.060Z
blocker_discovered: false
---

# T01: Sentry \uc804\uccb4 \uc5f0\ub3d9: client/server/edge config + instrumentation + error boundary \ud1b5\ud569

**Sentry \uc804\uccb4 \uc5f0\ub3d9: client/server/edge config + instrumentation + error boundary \ud1b5\ud569**

## What Happened

@sentry/nextjs \uc124\uce58 \ud6c4 client(instrumentation-client.ts), server, edge 3\uac1c \uc124\uc815 \ud30c\uc77c \uc791\uc131. Next.js 14 instrumentation.ts\ub85c \uc11c\ubc84/\uc5e3\uc9c0 \ucd08\uae30\ud654 \ud1b5\ud569. error.tsx + global-error.tsx\uc5d0 Sentry.captureException \ucd94\uac00. next.config.mjs\uc5d0 withSentryConfig \ub798\ud551 + CSP connect-src\uc5d0 sentry.io \ub3c4\uba54\uc778 \ucd94\uac00. DSN \uc5c6\uc73c\uba74 \uc644\uc804 \ube44\ud65c\uc131\ud654\ub418\ub294 graceful \ucc98\ub9ac.

## Verification

npx next build \uc131\uacf5 (62 pages) + npm test 188 passed

## Verification Evidence

| # | Command | Exit Code | Verdict | Duration |
|---|---------|-----------|---------|----------|
| 1 | `cd web && npx next build` | 0 | ✅ pass | 22300ms |
| 2 | `cd web && npm test` | 0 | ✅ 188 tests passed | 8000ms |


## Deviations

sentry.client.config.ts \u2192 src/instrumentation-client.ts\ub85c \ub9c8\uc774\uadf8\ub808\uc774\uc158 (Sentry \uad8c\uc7a5\uc0ac\ud56d). onRequestError \uc2dc\uadf8\ub2c8\ucc98\ub97c \uad6c\uccb4 \ud0c0\uc785\uc73c\ub85c \ubcc0\uacbd (spread args \ud0c0\uc785 \uc774\uc288 \ud574\uacb0).

## Known Issues

None.

## Files Created/Modified

- `web/src/instrumentation-client.ts`
- `web/sentry.server.config.ts`
- `web/sentry.edge.config.ts`
- `web/src/instrumentation.ts`
- `web/next.config.mjs`
- `web/src/app/error.tsx`
- `web/src/app/global-error.tsx`


## Deviations
sentry.client.config.ts \u2192 src/instrumentation-client.ts\ub85c \ub9c8\uc774\uadf8\ub808\uc774\uc158 (Sentry \uad8c\uc7a5\uc0ac\ud56d). onRequestError \uc2dc\uadf8\ub2c8\ucc98\ub97c \uad6c\uccb4 \ud0c0\uc785\uc73c\ub85c \ubcc0\uacbd (spread args \ud0c0\uc785 \uc774\uc288 \ud574\uacb0).

## Known Issues
None.
