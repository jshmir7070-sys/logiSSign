---
id: T02
parent: S01
milestone: M009
provides: []
requires: []
affects: []
key_files: ["web/src/services/point.service.ts", "web/src/app/api/points/route.ts"]
key_decisions: ["service_role로 직접 DB 조작하여 충전/차감/거래내역 정상 동작 확인"]
patterns_established: []
drill_down_paths: []
observability_surfaces: []
duration: ""
verification_result: "잔액 조회 5000P, 차감 -1200P → 3800P, 복원 +1200P → 5000P, 거래 내역 2건"
completed_at: 2026-04-05T12:27:12.280Z
blocker_discovered: false
---

# T02: 포인트 API 충전/차감/잔액/거래내역 정상 동작 확인

> 포인트 API 충전/차감/잔액/거래내역 정상 동작 확인

## What Happened
---
id: T02
parent: S01
milestone: M009
key_files:
  - web/src/services/point.service.ts
  - web/src/app/api/points/route.ts
key_decisions:
  - service_role로 직접 DB 조작하여 충전/차감/거래내역 정상 동작 확인
duration: ""
verification_result: passed
completed_at: 2026-04-05T12:27:12.281Z
blocker_discovered: false
---

# T02: 포인트 API 충전/차감/잔액/거래내역 정상 동작 확인

**포인트 API 충전/차감/잔액/거래내역 정상 동작 확인**

## What Happened

잔액 조회 → 1200P 차감 → 거래 내역 기록 → 1200P 복원 → 최종 잔액 5000P 정상 확인. point_balances/point_transactions 모두 정상 동작.

## Verification

잔액 조회 5000P, 차감 -1200P → 3800P, 복원 +1200P → 5000P, 거래 내역 2건

## Verification Evidence

| # | Command | Exit Code | Verdict | Duration |
|---|---------|-----------|---------|----------|
| 1 | `node test-points.js` | 0 | ✅ pass | 3000ms |


## Deviations

None.

## Known Issues

None.

## Files Created/Modified

- `web/src/services/point.service.ts`
- `web/src/app/api/points/route.ts`


## Deviations
None.

## Known Issues
None.
