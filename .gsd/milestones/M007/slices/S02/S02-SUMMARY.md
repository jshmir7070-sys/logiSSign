---
id: S02
parent: M007
milestone: M007
provides:
  - Zod 입력 검증 패턴 + 스키마 중앙 관리
requires:
  - slice: S01
    provides: RLS 완전 적용된 DB 스키마
affects:
  - S05
key_files:
  - web/src/lib/api-schemas.ts
key_decisions:
  - payment API에 Zod discriminatedUnion 적용 (타입 안전한 action 분기)
  - SMS 전화번호 01X 형식 regex 검증 추가
patterns_established:
  - api-schemas.ts에 중앙 집중 스키마 + validateInput() 헬퍼 패턴
  - discriminatedUnion으로 action 기반 API 분기 검증
observability_surfaces:
  - Zod 검증 실패 시 구체적 에러 메시지와 400 응답 반환
drill_down_paths:
  - .gsd/milestones/M007/slices/S02/tasks/T01-SUMMARY.md
duration: ""
verification_result: passed
completed_at: 2026-04-02T20:38:26.209Z
blocker_discovered: false
---

# S02: API 라우트 Zod 입력 검증 통일

**7개 Zod 스키마 + 7개 API 라우트 입력 검증 통일 완료**

## What Happened

8개 미검증 API 라우트를 분석하여 body가 있는 6개 POST + 1개 GET에 Zod 스키마를 적용했다. api-schemas.ts에 7개 스키마를 중앙 집중 정의하고, 각 라우트에서 validateInput() 헬퍼를 사용하도록 변경. discriminatedUnion을 사용한 payment 라우트가 가장 복잡한 변환이었다.

## Verification

빌드 성공 + 142 테스트 통과 + 모든 POST API에 validation import 확인

## Requirements Advanced

None.

## Requirements Validated

None.

## New Requirements Surfaced

None.

## Requirements Invalidated or Re-scoped

None.

## Deviations

Cron GET 라우트 2개는 body 없음으로 Zod 적용 불필요. 기존 inline 검증 충분한 3개 라우트는 강제 변환하지 않음.

## Known Limitations

3개 라우트(driver-signup, extract-document, generate-bulk)는 기존 inline 검증 유지

## Follow-ups

driver-signup, extract-document, generate-bulk 라우트도 향후 Zod 전환 가능하지만, 현재 inline 검증으로 충분.

## Files Created/Modified

- `web/src/lib/api-schemas.ts` — 7개 Zod 스키마 추가 (payment, SMS, signedPdf, aiTemplate, contractList)
- `web/src/app/api/payment/route.ts` — Zod discriminatedUnion 검증 적용
- `web/src/app/api/sms/send/route.ts` — smsSendSchema 적용
- `web/src/app/api/sms/invite/route.ts` — smsInviteSchema 적용
- `web/src/app/api/contracts/signed-pdf/route.ts` — signedPdfSchema 적용
- `web/src/app/api/contracts/list/route.ts` — contractListQuerySchema 적용
- `web/src/app/api/ai/generate-template/route.ts` — aiGenerateTemplateSchema 적용 + category 타입 수정
