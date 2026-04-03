# S04: E2E 핵심 플로우 테스트

**Goal:** 핵심 비즈니스 로직 테스트 추가 — plan-limits, contract 변수 바인딩, rate-limit, api-error
**Demo:** After this: npm test 실행 시 핵심 플로우 테스트 통과

## Tasks
- [x] **T01: 핵심 비즈니스 로직 테스트 30건 추가 (plan-limits 12 + contract-binding 10 + rate-limit 8)** — 1. plan-limits 테스트 (isPaidPlan, getPlanLimits, 플랜별 제한값)
2. contract bindContractVariables 테스트 (변수 치환, XSS 이스케이프, 누락 변수)
3. rate-limit 테스트 (허용/차단 동작)
4. build + test
  - Estimate: 15min
  - Files: web/src/__tests__/plan-limits.test.ts, web/src/__tests__/contract-binding.test.ts, web/src/__tests__/rate-limit.test.ts
  - Verify: npm test 200+ 통과
