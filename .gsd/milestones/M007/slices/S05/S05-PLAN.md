# S05: 보안 테스트 추가

**Goal:** 보안 관련 테스트 10건+ 추가: API 입력 검증, CSRF, 감사 로그 함수
**Demo:** After this: npm test 실행 시 보안 관련 테스트 10건+ 통과

## Tasks
- [x] **T01: 보안 테스트 33건 추가 (24 api-schemas + 9 security-logger)** — 1. api-schemas 테스트 (Zod 스키마 검증 성공/실패)
2. security-logger 테스트 (함수 호출 + 타입 검증)
3. build + test 확인
  - Estimate: 15min
  - Files: web/src/__tests__/api-schemas.test.ts, web/src/__tests__/security-logger.test.ts
  - Verify: npm test 통과 + 보안 테스트 10건+ 포함
