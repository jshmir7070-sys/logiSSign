# S09: 모바일 연동 테스트

**Goal:** 모바일 앱의 Supabase 연동 코드를 확인하고 필요 시 수정
**Demo:** After this: 모바일 앱에서 기사 로그인 → 계약 조회 → 정산 조회 → 서명

## Tasks
- [x] **T01: 모바일 Supabase 연동 확인 — 이미 적절히 설정됨, 변경 불필요** — 모바일 Supabase 클라이언트가 SecureStore + autoRefreshToken으로 적절히 설정됨. 코드 변경 불필요.
  - Estimate: 5min
  - Verify: cd mobile && npx tsc --noEmit
