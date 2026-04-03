# S02: API 라우트 Zod 입력 검증 통일

**Goal:** 8개 미검증 API 라우트에 Zod 스키마 적용, api-schemas.ts 중앙 관리
**Demo:** After this: 잘못된 입력으로 API 호출 시 400 + 구체적 에러 메시지 반환

## Tasks
- [x] **T01: 7개 Zod 스키마 추가 + 7개 API 라우트에 입력 검증 적용** — 1. 8개 미검증 API 라우트의 요청 body 분석
2. api-schemas.ts에 Zod 스키마 정의
3. 각 route에 검증 적용
4. build + test 통과 확인
  - Estimate: 30min
  - Files: web/src/lib/api-schemas.ts, web/src/app/api/payment/route.ts, web/src/app/api/ai/generate-template/route.ts, web/src/app/api/contracts/list/route.ts, web/src/app/api/contracts/signed-pdf/route.ts, web/src/app/api/cron/integrity-check/route.ts, web/src/app/api/cron/renewal-check/route.ts, web/src/app/api/sms/invite/route.ts, web/src/app/api/sms/send/route.ts
  - Verify: npx next build 성공 + npm test 통과 + 각 route에 zod import 존재
