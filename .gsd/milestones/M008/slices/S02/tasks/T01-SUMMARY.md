---
id: T01
parent: S02
milestone: M008
provides: []
requires: []
affects: []
key_files: ["web/src/app/robots.ts", "web/src/app/sitemap.ts", "web/src/app/layout.tsx"]
key_decisions: ["/portal/, /admin/, /api/ 크롤링 차단 (robots.txt disallow)", "sitemap에 공개 페이지만 포함 (6개 URL)", "OG image로 기존 logo.png 사용"]
patterns_established: []
drill_down_paths: []
observability_surfaces: []
duration: ""
verification_result: "build 성공 (64 pages) + 188 tests passed"
completed_at: 2026-04-03T13:29:29.053Z
blocker_discovered: false
---

# T01: robots.txt + sitemap.xml + OG/Twitter 메타태그 완성

> robots.txt + sitemap.xml + OG/Twitter 메타태그 완성

## What Happened
---
id: T01
parent: S02
milestone: M008
key_files:
  - web/src/app/robots.ts
  - web/src/app/sitemap.ts
  - web/src/app/layout.tsx
key_decisions:
  - /portal/, /admin/, /api/ 크롤링 차단 (robots.txt disallow)
  - sitemap에 공개 페이지만 포함 (6개 URL)
  - OG image로 기존 logo.png 사용
duration: ""
verification_result: passed
completed_at: 2026-04-03T13:29:29.119Z
blocker_discovered: false
---

# T01: robots.txt + sitemap.xml + OG/Twitter 메타태그 완성

**robots.txt + sitemap.xml + OG/Twitter 메타태그 완성**

## What Happened

Next.js metadata API\ub85c robots.txt(portal/admin/api \ucc28\ub2e8), sitemap.xml(6\uac1c \uacf5\uac1c URL), OG \uba54\ud0c0\ud0dc\uadf8(title template, image, twitter card) \uc801\uc6a9. layout.tsx metadata\ub97c \ud655\uc7a5\ud558\uc5ec metadataBase, openGraph, twitter, robots, icons \uc124\uc815.

## Verification

build 성공 (64 pages) + 188 tests passed

## Verification Evidence

| # | Command | Exit Code | Verdict | Duration |
|---|---------|-----------|---------|----------|
| 1 | `cd web && npx next build` | 0 | ✅ pass (64 pages) | 25000ms |
| 2 | `cd web && npm test` | 0 | ✅ 188 passed | 8000ms |


## Deviations

None.

## Known Issues

None.

## Files Created/Modified

- `web/src/app/robots.ts`
- `web/src/app/sitemap.ts`
- `web/src/app/layout.tsx`


## Deviations
None.

## Known Issues
None.
