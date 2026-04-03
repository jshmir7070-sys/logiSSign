---
estimated_steps: 3
estimated_files: 2
skills_used: []
---

# T01: 보안 테스트 작성

1. api-schemas 테스트 (Zod 스키마 검증 성공/실패)
2. security-logger 테스트 (함수 호출 + 타입 검증)
3. build + test 확인

## Inputs

- `web/src/lib/api-schemas.ts`
- `web/src/lib/security-logger.ts`

## Expected Output

- `web/src/__tests__/api-schemas.test.ts`
- `web/src/__tests__/security-logger.test.ts`

## Verification

npm test 통과 + 보안 테스트 10건+ 포함
