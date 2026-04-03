---
estimated_steps: 4
estimated_files: 9
skills_used: []
---

# T01: Zod 스키마 정의 + 8개 API 라우트 적용

1. 8개 미검증 API 라우트의 요청 body 분석
2. api-schemas.ts에 Zod 스키마 정의
3. 각 route에 검증 적용
4. build + test 통과 확인

## Inputs

- `web/src/lib/api-schemas.ts`
- `web/src/app/api/*/route.ts`

## Expected Output

- `web/src/lib/api-schemas.ts (확장)`
- `8개 API route 수정`

## Verification

npx next build 성공 + npm test 통과 + 각 route에 zod import 존재
