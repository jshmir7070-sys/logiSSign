---
estimated_steps: 1
estimated_files: 2
skills_used: []
---

# T01: API 인증/CSRF 전수 테스트

인증 없이 보호된 API 호출 시 401/403 반환 확인. CSRF 차단 확인. 공개 API는 200 확인.

## Inputs

- `web/src/middleware.ts`

## Expected Output

- `보안 테스트 결과`

## Verification

보호된 API 전체 401/403 반환
