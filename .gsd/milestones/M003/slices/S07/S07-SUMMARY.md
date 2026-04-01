---
id: S07
parent: M003
milestone: M003
provides:
  - Correct Solapi auth for SMS sending
requires:
  []
affects:
  []
key_files:
  - web/src/services/sms.service.ts
key_decisions:
  - Solapi HMAC-SHA256 인증 방식 적용
patterns_established:
  - Solapi API 호출 시 getSolapiAuthHeader() 사용
observability_surfaces:
  - none
drill_down_paths:
  - .gsd/milestones/M003/slices/S07/tasks/T01-SUMMARY.md
duration: ""
verification_result: passed
completed_at: 2026-04-01T00:34:29.703Z
blocker_discovered: false
---

# S07: SMS 연동 (Solapi)

**Solapi SMS 인증을 HMAC-SHA256으로 수정**

## What Happened

Solapi API v4 인증을 HMAC-SHA256으로 교체. date+salt+apiSecret 기반 signature 생성.

## Verification

npx tsc --noEmit — 0 errors

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

SOLAPI_API_KEY/SECRET 미설정 시 SMS 발송 건너뜀 (경고 로그)

## Follow-ups

Solapi API 키 설정 후 실제 SMS 발송 테스트

## Files Created/Modified

- `web/src/services/sms.service.ts` — Bearer 토큰 → HMAC-SHA256 인증으로 교체
