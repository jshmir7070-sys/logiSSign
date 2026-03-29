---
id: T01
parent: S03
milestone: M002
provides: []
requires: []
affects: []
key_files: ["mobile/app/(tabs)/_layout.tsx", "mobile/services/notice.service.ts"]
key_decisions: ["Added contracts as 3rd tab (between settlement and notice)", "Removed unnecessary TabIconName type cast — simplified icon props"]
patterns_established: []
drill_down_paths: []
observability_surfaces: []
duration: ""
verification_result: "cd mobile && npx tsc --noEmit — 0 errors"
completed_at: 2026-03-29T09:39:05.867Z
blocker_discovered: false
---

# T01: 계약 탭 추가 (5개 탭 완성) + notice service 생성, 0 TS errors

> 계약 탭 추가 (5개 탭 완성) + notice service 생성, 0 TS errors

## What Happened
---
id: T01
parent: S03
milestone: M002
key_files:
  - mobile/app/(tabs)/_layout.tsx
  - mobile/services/notice.service.ts
key_decisions:
  - Added contracts as 3rd tab (between settlement and notice)
  - Removed unnecessary TabIconName type cast — simplified icon props
duration: ""
verification_result: passed
completed_at: 2026-03-29T09:39:05.873Z
blocker_discovered: false
---

# T01: 계약 탭 추가 (5개 탭 완성) + notice service 생성, 0 TS errors

**계약 탭 추가 (5개 탭 완성) + notice service 생성, 0 TS errors**

## What Happened

Added contracts tab to bottom tab bar as 3rd tab (홈, 정산서, 계약, 공지, 프로필). Simplified tab icon typings. Created notice.service.ts with getDriverNotices querying published notices. All screens compile with 0 errors.

## Verification

cd mobile && npx tsc --noEmit — 0 errors

## Verification Evidence

| # | Command | Exit Code | Verdict | Duration |
|---|---------|-----------|---------|----------|
| 1 | `cd mobile && npx tsc --noEmit` | 0 | ✅ 0 errors | 5000ms |


## Deviations

None.

## Known Issues

None.

## Files Created/Modified

- `mobile/app/(tabs)/_layout.tsx`
- `mobile/services/notice.service.ts`


## Deviations
None.

## Known Issues
None.
