---
id: S01
parent: M008
milestone: M008
provides:
  - Sentry 에러 모니터링 인프라
requires:
  []
affects:
  - S04
key_files:
  - web/src/instrumentation-client.ts
  - web/sentry.server.config.ts
  - web/src/instrumentation.ts
  - web/next.config.mjs
key_decisions:
  - DSN 없으면 Sentry 완전 비활성화
  - dev에서 beforeSend로 전송 차단
  - PII 헤더 자동 제거
patterns_established:
  - DSN 없으면 graceful 비활성화 패턴
  - withSentryConfig 래핑으로 next.config 확장
observability_surfaces:
  - Sentry 대시보드에서 클라이언트/서버 에러 자동 수집
  - error.tsx/global-error.tsx에서 captureException 호출
drill_down_paths:
  - .gsd/milestones/M008/slices/S01/tasks/T01-SUMMARY.md
duration: ""
verification_result: passed
completed_at: 2026-04-03T13:28:06.830Z
blocker_discovered: false
---

# S01: Sentry \uc5d0\ub7ec \ubaa8\ub2c8\ud130\ub9c1 \uc5f0\ub3d9

**Sentry \uc804\uccb4 \uc5f0\ub3d9 \uc644\ub8cc: 3\uac1c runtime config + instrumentation + error boundary**

## What Happened

@sentry/nextjs\ub97c Next.js 14 App Router\uc5d0 \uc644\uc804 \ud1b5\ud569. client(instrumentation-client.ts), server, edge 3\uac1c runtime \ubaa8\ub450 \ucee4\ubc84. error boundary\uc5d0\uc11c \uc790\ub3d9 \ucea1\ucc98, onRequestError\ub85c API route \uc5d0\ub7ec\ub3c4 \uc218\uc9d1. DSN \uc5c6\uc73c\uba74 \uc644\uc804 \ube44\ud65c\uc131\ud654\ub418\ub294 graceful \ucc98\ub9ac\ub85c \uac1c\ubc1c \ud658\uacbd\uc5d0\uc11c\ub3c4 \ubb38\uc81c \uc5c6\uc74c.

## Verification

build \uc131\uacf5 (62 pages) + 188 tests passed

## Requirements Advanced

None.

## Requirements Validated

None.

## New Requirements Surfaced

None.

## Requirements Invalidated or Re-scoped

None.

## Deviations

sentry.client.config.ts \u2192 instrumentation-client.ts \ub9c8\uc774\uadf8\ub808\uc774\uc158 (Sentry \ub7f0\ud0c0\uc784 \uad8c\uc7a5\uc0ac\ud56d)

## Known Limitations

SENTRY_AUTH_TOKEN \uc5c6\uc73c\uba74 \uc18c\uc2a4\ub9f5 \uc5c5\ub85c\ub4dc \ube44\ud65c\uc131\ud654 (\uacc4\ud68d\ub300\ub85c)

## Follow-ups

NEXT_PUBLIC_SENTRY_DSN \ud658\uacbd\ubcc0\uc218 \uc124\uc815 \ud6c4 \uc2e4\uc81c \uc5d0\ub7ec \uc218\uc9d1 \ud14c\uc2a4\ud2b8 \ud544\uc694

## Files Created/Modified

- `web/package.json` — @sentry/nextjs 설치
- `web/src/instrumentation-client.ts` — 클라이언트 Sentry 설정 (에러 필터, replay, tracing)
- `web/sentry.server.config.ts` — 서버 Sentry 설정 (PII 헤더 제거)
- `web/sentry.edge.config.ts` — 엣지 Sentry 설정
- `web/src/instrumentation.ts` — Next.js instrumentation (server/edge 초기화 + onRequestError)
- `web/next.config.mjs` — withSentryConfig 래핑 + CSP sentry.io 추가
- `web/src/app/error.tsx` — Sentry.captureException 추가
- `web/src/app/global-error.tsx` — Sentry.captureException 추가
