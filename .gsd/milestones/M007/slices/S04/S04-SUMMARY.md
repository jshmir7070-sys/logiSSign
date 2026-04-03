---
id: S04
parent: M007
milestone: M007
provides:
  - service_role 감사 결과
requires:
  []
affects:
  - S05
key_files:
  - web/src/app/api/sms/invite/route.ts
key_decisions:
  - service_role은 서버사이드 전용, NEXT_PUBLIC_ 미노출 확인 완료
patterns_established:
  - service_role 사용 시 주석으로 필요성 문서화
observability_surfaces:
  - none
drill_down_paths:
  - .gsd/milestones/M007/slices/S04/tasks/T01-SUMMARY.md
duration: ""
verification_result: passed
completed_at: 2026-04-02T20:43:26.921Z
blocker_discovered: false
---

# S04: service_role 사용 감사 + 최소화

**service_role 16개 사용처 감사 완료, anon key fallback 1건 제거**

## What Happened

10개 API 라우트 + 5개 서비스의 service_role 사용을 감사. 모두 서버사이드 전용, NEXT_PUBLIC_ 미노출 확인. sms/invite의 anon key fallback 제거가 가장 중요한 보안 수정.

## Verification

build 성공 + NEXT_PUBLIC_ 미노출 확인

## Requirements Advanced

None.

## Requirements Validated

None.

## New Requirements Surfaced

None.

## Requirements Invalidated or Re-scoped

None.

## Deviations

service_role 전환 건수가 적음 — 대부분의 사용이 정당했고 anon key fallback 1건 제거가 주요 수정.

## Known Limitations

None.

## Follow-ups

None.

## Files Created/Modified

- `web/src/app/api/sms/invite/route.ts` — anon key fallback 제거 + service_role 필수 주석
- `web/src/app/api/contracts/list/route.ts` — service_role 사용 이유 주석 추가
