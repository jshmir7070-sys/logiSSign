# S07: SMS 연동 (Solapi)

**Goal:** Solapi SMS 인증 방식을 Bearer → HMAC-SHA256로 수정
**Demo:** After this: 기사 초대 SMS 발송 → 수신 확인

## Tasks
- [x] **T01: Solapi SMS 인증을 Bearer → HMAC-SHA256로 수정** — Solapi API의 인증 방식을 Bearer 토큰에서 HMAC-SHA256로 교체. date+salt 기반 signature 생성.
  - Estimate: 10min
  - Files: web/src/services/sms.service.ts
  - Verify: cd web && npx tsc --noEmit
