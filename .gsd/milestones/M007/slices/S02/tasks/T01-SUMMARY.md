---
id: T01
parent: S02
milestone: M007
provides: []
requires: []
affects: []
key_files: ["web/src/lib/api-schemas.ts", "web/src/app/api/payment/route.ts", "web/src/app/api/sms/send/route.ts", "web/src/app/api/sms/invite/route.ts", "web/src/app/api/contracts/signed-pdf/route.ts", "web/src/app/api/contracts/list/route.ts", "web/src/app/api/ai/generate-template/route.ts"]
key_decisions: ["payment 라우트에 discriminatedUnion 적용 (action 기반 분기)", "SMS 전화번호 regex 검증 추가 (01X 형식)", "기존 inline 검증이 충분한 라우트는 강제 변환하지 않음"]
patterns_established: []
drill_down_paths: []
observability_surfaces: []
duration: ""
verification_result: "npx next build 성공 + 142 tests passed + 모든 POST API에 validation import 확인"
completed_at: 2026-04-02T20:37:56.881Z
blocker_discovered: false
---

# T01: 7개 Zod 스키마 추가 + 7개 API 라우트에 입력 검증 적용

> 7개 Zod 스키마 추가 + 7개 API 라우트에 입력 검증 적용

## What Happened
---
id: T01
parent: S02
milestone: M007
key_files:
  - web/src/lib/api-schemas.ts
  - web/src/app/api/payment/route.ts
  - web/src/app/api/sms/send/route.ts
  - web/src/app/api/sms/invite/route.ts
  - web/src/app/api/contracts/signed-pdf/route.ts
  - web/src/app/api/contracts/list/route.ts
  - web/src/app/api/ai/generate-template/route.ts
key_decisions:
  - payment 라우트에 discriminatedUnion 적용 (action 기반 분기)
  - SMS 전화번호 regex 검증 추가 (01X 형식)
  - 기존 inline 검증이 충분한 라우트는 강제 변환하지 않음
duration: ""
verification_result: passed
completed_at: 2026-04-02T20:37:56.881Z
blocker_discovered: false
---

# T01: 7개 Zod 스키마 추가 + 7개 API 라우트에 입력 검증 적용

**7개 Zod 스키마 추가 + 7개 API 라우트에 입력 검증 적용**

## What Happened

api-schemas.ts에 payment(discriminatedUnion), SMS(send/invite), signedPdf, aiGenerateTemplate, contractListQuery 7개 스키마를 추가했다. 6개 POST 라우트와 1개 GET 라우트에 validateInput() 헬퍼를 적용. AI generate-template에서 optional category 타입 에러를 수정. 빌드 성공 + 142 테스트 통과.

## Verification

npx next build 성공 + 142 tests passed + 모든 POST API에 validation import 확인

## Verification Evidence

| # | Command | Exit Code | Verdict | Duration |
|---|---------|-----------|---------|----------|
| 1 | `cd web && npx next build` | 0 | ✅ pass | 16400ms |
| 2 | `cd web && npm test` | 0 | ✅ 142 tests passed | 8000ms |


## Deviations

Cron routes (GET-only, secret auth)는 body가 없으므로 Zod 적용 대상에서 제외. extract-document, driver-signup, generate-bulk는 이미 inline 검증이 있어 별도 처리 불필요.

## Known Issues

None.

## Files Created/Modified

- `web/src/lib/api-schemas.ts`
- `web/src/app/api/payment/route.ts`
- `web/src/app/api/sms/send/route.ts`
- `web/src/app/api/sms/invite/route.ts`
- `web/src/app/api/contracts/signed-pdf/route.ts`
- `web/src/app/api/contracts/list/route.ts`
- `web/src/app/api/ai/generate-template/route.ts`


## Deviations
Cron routes (GET-only, secret auth)는 body가 없으므로 Zod 적용 대상에서 제외. extract-document, driver-signup, generate-bulk는 이미 inline 검증이 있어 별도 처리 불필요.

## Known Issues
None.
