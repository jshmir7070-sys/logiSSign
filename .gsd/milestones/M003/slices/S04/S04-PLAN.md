# S04: Portal E2E: 원청사 → 기사 → 계약 CRUD

**Goal:** Portal CRUD가 실데이터로 작동하는지 확인 — 코드 수정 필요 시 수정
**Demo:** After this: 원청사 등록 → 기사 등록 → 계약 생성 → 계약 목록에 표시

## Tasks
- [x] **T01: Portal CRUD 코드 확인 — 기존 구현이 이미 RLS 호환, 변경 불필요** — Portal CRUD 페이지들이 이미 구현되어 있음. S03에서 서버사이드 auth 수정 완료로 코드 변경 불필요. 빌드 확인만.
  - Estimate: 5min
  - Verify: cd web && npx tsc --noEmit
