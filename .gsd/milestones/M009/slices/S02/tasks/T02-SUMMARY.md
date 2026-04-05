---
id: T02
parent: S02
milestone: M009
provides: []
requires: []
affects: []
key_files: ["web/src/services/settlement.service.ts"]
key_decisions: ["settlements upsert로 중복 방지"]
patterns_established: []
drill_down_paths: []
observability_surfaces: []
duration: ""
verification_result: "배송/반품/총액/공제/실수령 7개 필드 expected vs actual 일치"
completed_at: 2026-04-05T12:30:48.523Z
blocker_discovered: false
---

# T02: 정산 생성 + 7개 필드 금액 검증 전체 통과

> 정산 생성 + 7개 필드 금액 검증 전체 통과

## What Happened
---
id: T02
parent: S02
milestone: M009
key_files:
  - web/src/services/settlement.service.ts
key_decisions:
  - settlements upsert로 중복 방지
duration: ""
verification_result: passed
completed_at: 2026-04-05T12:30:48.569Z
blocker_discovered: false
---

# T02: 정산 생성 + 7개 필드 금액 검증 전체 통과

**정산 생성 + 7개 필드 금액 검증 전체 통과**

## What Happened

배송 100건 × 1500원 + 반품 10건 × 1500원 = 165,000원 - 공제 50,000원 = 실수령 115,000원. DB 저장 후 7개 필드 전체 검증 통과.

## Verification

배송/반품/총액/공제/실수령 7개 필드 expected vs actual 일치

## Verification Evidence

| # | Command | Exit Code | Verdict | Duration |
|---|---------|-----------|---------|----------|
| 1 | `node test-settlement.js` | 0 | ✅ pass | 3000ms |


## Deviations

기사 단가 미입력 → 기본 1500원으로 테스트

## Known Issues

기사 단가 0건 — 기사 등록 시 RLS 버그로 저장 안 됐던 데이터. 재등록 필요.

## Files Created/Modified

- `web/src/services/settlement.service.ts`


## Deviations
기사 단가 미입력 → 기본 1500원으로 테스트

## Known Issues
기사 단가 0건 — 기사 등록 시 RLS 버그로 저장 안 됐던 데이터. 재등록 필요.
