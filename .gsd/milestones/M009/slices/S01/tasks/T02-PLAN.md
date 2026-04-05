---
estimated_steps: 1
estimated_files: 2
skills_used: []
---

# T02: 포인트 API 동작 검증 + 버그 수정

GET /api/points?action=balance, transactions, packages 정상 응답 확인. POST /api/points (charge) 테스트. 에러 시 수정.

## Inputs

- `web/src/app/api/points/route.ts`

## Expected Output

- `포인트 API 정상 동작`

## Verification

curl로 balance/transactions/packages API 정상 응답
