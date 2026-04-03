---
id: T01
parent: S04
milestone: M007
provides: []
requires: []
affects: []
key_files: ["web/src/app/api/sms/invite/route.ts", "web/src/app/api/contracts/list/route.ts"]
key_decisions: ["sms/invite의 anon key fallback 제거 (보안 문제)", "10개 API 라우트 모두 service_role 필요성 확인 — 대부분 auth.admin 또는 cross-agency 작업으로 필수"]
patterns_established: []
drill_down_paths: []
observability_surfaces: []
duration: ""
verification_result: "build 성공 + NEXT_PUBLIC_에 service_role 미노출 확인 (grep 0건)"
completed_at: 2026-04-02T20:43:07.197Z
blocker_discovered: false
---

# T01: service_role 16개 사용처 감사 + sms/invite anon key fallback 제거

> service_role 16개 사용처 감사 + sms/invite anon key fallback 제거

## What Happened
---
id: T01
parent: S04
milestone: M007
key_files:
  - web/src/app/api/sms/invite/route.ts
  - web/src/app/api/contracts/list/route.ts
key_decisions:
  - sms/invite의 anon key fallback 제거 (보안 문제)
  - 10개 API 라우트 모두 service_role 필요성 확인 — 대부분 auth.admin 또는 cross-agency 작업으로 필수
duration: ""
verification_result: passed
completed_at: 2026-04-02T20:43:07.198Z
blocker_discovered: false
---

# T01: service_role 16개 사용처 감사 + sms/invite anon key fallback 제거

**service_role 16개 사용처 감사 + sms/invite anon key fallback 제거**

## What Happened

service_role 사용 10개 API 라우트 + 5개 서비스 + 1개 유틸을 감사했다. 모든 사용이 서버사이드 전용이고 NEXT_PUBLIC_에 노출되지 않음을 확인. sms/invite의 위험한 anon key fallback을 제거했다. 대부분의 service_role 사용은 auth.admin.createUser, cross-agency 쿼리, RLS 우회 INSERT 등으로 필수적.

## Verification

build 성공 + NEXT_PUBLIC_에 service_role 미노출 확인 (grep 0건)

## Verification Evidence

| # | Command | Exit Code | Verdict | Duration |
|---|---------|-----------|---------|----------|
| 1 | `cd web && npx next build` | 0 | ✅ pass | 32600ms |
| 2 | `grep NEXT_PUBLIC.*SERVICE_ROLE (0 results)` | 1 | ✅ pass: not exposed | 50ms |


## Deviations

None.

## Known Issues

None.

## Files Created/Modified

- `web/src/app/api/sms/invite/route.ts`
- `web/src/app/api/contracts/list/route.ts`


## Deviations
None.

## Known Issues
None.
