---
id: S02
parent: M008
milestone: M008
provides:
  - robots.txt + sitemap.xml + OG 메타
requires:
  []
affects:
  - S04
key_files:
  - web/src/app/robots.ts
  - web/src/app/sitemap.ts
  - web/src/app/layout.tsx
key_decisions:
  - admin/portal/api 크롤링 차단
  - logo.png를 OG image로 사용
patterns_established:
  - Next.js metadata API로 SEO 관리
observability_surfaces:
  - none
drill_down_paths:
  - .gsd/milestones/M008/slices/S02/tasks/T01-SUMMARY.md
duration: ""
verification_result: passed
completed_at: 2026-04-03T13:29:49.220Z
blocker_discovered: false
---

# S02: SEO \uae30\ubcf8 \uc124\uc815 (robots, sitemap, OG)

**SEO \uae30\ubcf8 \uc124\uc815 \uc644\ub8cc: robots + sitemap + OG \uba54\ud0c0**

## What Happened

Next.js metadata API\ub85c SEO \uae30\ubcf8 3\uac1c \ud30c\uc77c \uc801\uc6a9. Google \ud06c\ub864\ub9c1 \uc2dc /portal, /admin\uc740 \ucc28\ub2e8\ub418\uace0 \uacf5\uac1c \ud398\uc774\uc9c0\ub9cc \uc778\ub371\uc2f1. SNS \uacf5\uc720 \uc2dc OG \uce74\ub4dc \ud45c\uc2dc.

## Verification

build 64 pages + 188 tests

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

- `web/src/app/robots.ts` — robots.txt 생성 (크롤링 차단 규칙)
- `web/src/app/sitemap.ts` — sitemap.xml 생성 (6개 공개 URL)
- `web/src/app/layout.tsx` — OG/Twitter 메타 + title template 추가
