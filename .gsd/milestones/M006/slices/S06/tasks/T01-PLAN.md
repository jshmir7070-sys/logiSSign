---
estimated_steps: 1
estimated_files: 2
skills_used: []
---

# T01: 정산 검증 서비스 + 테스트

1. verifySettlement() 함수\n2. 합계 교차검증 (income - deduction = net)\n3. 이상치 감지 (평균 ±50%)\n4. 음수 정산액 경고\n5. 테스트 작성

## Inputs

- None specified.

## Expected Output

- `web/src/services/settlement-verification.service.ts`
- `web/src/__tests__/settlement-verification.test.ts`

## Verification

cd web && npm test
