# S02: API 라우트 Zod 입력 검증 통일 — UAT

**Milestone:** M007
**Written:** 2026-04-02T20:38:26.210Z

## UAT: API 입력 검증\n\n### 테스트 시나리오\n1. POST /api/payment { action: 'save-billing-key' } body 없이 → 400 에러\n2. POST /api/sms/send { to: 'invalid' } → 400 + 전화번호 형식 에러\n3. POST /api/contracts/signed-pdf {} → 400 + contractId 필수 에러\n4. POST /api/ai/generate-template {} → 400 + 제목 필수 에러\n5. GET /api/contracts/list?status=invalid → 400 에러
