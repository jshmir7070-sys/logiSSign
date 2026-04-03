---
id: S04
parent: M008
milestone: M008
provides:
  - /api/health 헬스체크 엔드포인트
requires:
  - slice: S01
    provides: Sentry 에러 모니터링
  - slice: S02
    provides: SEO 기본 설정
  - slice: S03
    provides: 환경변수 문서
affects:
  []
key_files:
  - web/src/app/api/health/route.ts
key_decisions:
  - 헬스체크에 환경변수 누락 검사 포함
patterns_established:
  - /api/health 패턴으로 외부 모니터링
observability_surfaces:
  - /api/health로 외부 모니터링 연동 가능
drill_down_paths:
  - .gsd/milestones/M008/slices/S04/tasks/T01-SUMMARY.md
duration: ""
verification_result: passed
completed_at: 2026-04-03T13:34:25.538Z
blocker_discovered: false
---

# S04: \ud5ec\uc2a4\uccb4\ud06c API + \ubc30\ud3ec \uc124\uc815 \uac80\uc99d

**\ud5ec\uc2a4\uccb4\ud06c API \uc644\uc131 + M008 \uc804\uccb4 \ucd5c\uc885 \uac80\uc99d \ud1b5\uacfc**

## What Happened

/api/health API \uc644\uc131. DB, Storage, Auth \uac01\uac01\uc758 \uc751\ub2f5\uc2dc\uac04\uc744 \uce21\uc815\ud558\uace0, \ud544\uc218 \ud658\uacbd\ubcc0\uc218 \ub204\ub77d\ub3c4 \uac10\uc9c0. \uc678\ubd80 \ubaa8\ub2c8\ud130\ub9c1(UptimeRobot) \uc5f0\ub3d9 \uac00\ub2a5. M008 \uc804\uccb4 4\uac1c \uc2ac\ub77c\uc774\uc2a4 \uc644\ub8cc.

## Verification

build 64 pages + 188 tests passed

## Requirements Advanced

None.

## Requirements Validated

None.

## New Requirements Surfaced

None.

## Requirements Invalidated or Re-scoped

None.

## Deviations

None.

## Known Limitations

None.

## Follow-ups

None.

## Files Created/Modified

- `web/src/app/api/health/route.ts` — /api/health 헬스체크 (DB/Storage/Auth/Env 개별 체크)
- `web/src/middleware.ts` — /api/health PUBLIC_ROUTES 추가
