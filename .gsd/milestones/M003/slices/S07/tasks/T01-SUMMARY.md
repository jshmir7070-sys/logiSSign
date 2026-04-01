---
id: T01
parent: S07
milestone: M003
provides: []
requires: []
affects: []
key_files: ["web/src/services/sms.service.ts"]
key_decisions: ["Solapi HMAC-SHA256 인증 — date+salt로 signature 생성, crypto.createHmac 사용"]
patterns_established: []
drill_down_paths: []
observability_surfaces: []
duration: ""
verification_result: "npx tsc --noEmit — 0 errors"
completed_at: 2026-04-01T00:34:14.871Z
blocker_discovered: false
---

# T01: Solapi SMS 인증을 Bearer → HMAC-SHA256로 수정

> Solapi SMS 인증을 Bearer → HMAC-SHA256로 수정

## What Happened
---
id: T01
parent: S07
milestone: M003
key_files:
  - web/src/services/sms.service.ts
key_decisions:
  - Solapi HMAC-SHA256 인증 — date+salt로 signature 생성, crypto.createHmac 사용
duration: ""
verification_result: passed
completed_at: 2026-04-01T00:34:14.872Z
blocker_discovered: false
---

# T01: Solapi SMS 인증을 Bearer → HMAC-SHA256로 수정

**Solapi SMS 인증을 Bearer → HMAC-SHA256로 수정**

## What Happened

Solapi API v4는 Bearer 토큰이 아닌 HMAC-SHA256 인증을 요구한다. date + salt를 hmacData로 연결하고, API Secret으로 HMAC-SHA256 해시를 생성하여 Authorization 헤더에 포함하도록 수정.

## Verification

npx tsc --noEmit — 0 errors

## Verification Evidence

| # | Command | Exit Code | Verdict | Duration |
|---|---------|-----------|---------|----------|
| 1 | `cd web && npx tsc --noEmit` | 0 | ✅ pass | 2500ms |


## Deviations

None.

## Known Issues

Solapi API 키가 .env.local에 미설정 — 키 설정 후 실제 발송 테스트 필요

## Files Created/Modified

- `web/src/services/sms.service.ts`


## Deviations
None.

## Known Issues
Solapi API 키가 .env.local에 미설정 — 키 설정 후 실제 발송 테스트 필요
