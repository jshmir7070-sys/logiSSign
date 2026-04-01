# S05: 정산 Excel 업로드 → 생성 → 조회

**Goal:** 정산 Excel 업로드→생성→조회 플로우가 실데이터로 작동하는지 확인
**Demo:** After this: Excel 업로드 → 정산서 자동 생성 → 기사별 정산 상세 조회

## Tasks
- [x] **T01: 정산 서비스 코드 확인 — 이미 RLS 호환, 변경 불필요** — Settlement 서비스들이 createBrowserSupabaseClient() 기반으로 이미 구현. 코드 변경 불필요.
  - Estimate: 5min
  - Verify: cd web && npx tsc --noEmit
