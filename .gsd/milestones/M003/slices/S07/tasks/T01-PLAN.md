---
estimated_steps: 1
estimated_files: 1
skills_used: []
---

# T01: Solapi HMAC-SHA256 인증 구현

Solapi API의 인증 방식을 Bearer 토큰에서 HMAC-SHA256로 교체. date+salt 기반 signature 생성.

## Inputs

- None specified.

## Expected Output

- `web/src/services/sms.service.ts (수정)`

## Verification

cd web && npx tsc --noEmit
