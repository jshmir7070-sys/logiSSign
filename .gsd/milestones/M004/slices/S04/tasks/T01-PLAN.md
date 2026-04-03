---
estimated_steps: 4
estimated_files: 3
skills_used: []
---

# T01: 핵심 비즈니스 로직 테스트 추가

1. plan-limits 테스트 (isPaidPlan, getPlanLimits, 플랜별 제한값)
2. contract bindContractVariables 테스트 (변수 치환, XSS 이스케이프, 누락 변수)
3. rate-limit 테스트 (허용/차단 동작)
4. build + test

## Inputs

- `web/src/lib/plan-limits.ts`
- `web/src/services/contract.service.ts`
- `web/src/lib/rate-limit.ts`

## Expected Output

- `web/src/__tests__/plan-limits.test.ts`
- `web/src/__tests__/contract-binding.test.ts`
- `web/src/__tests__/rate-limit.test.ts`

## Verification

npm test 200+ 통과
