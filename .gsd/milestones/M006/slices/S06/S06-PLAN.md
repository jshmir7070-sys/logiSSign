# S06: 정산 검증 + 이력 관리

**Goal:** 정산 교차검증 시스템 + 이상치 감지 + 생성 이력 관리 페이지
**Demo:** After this: 검증 결과 + 생성 이력 조회

## Tasks
- [ ] **T01: 정산 검증 서비스 + 테스트** — 1. verifySettlement() 함수\n2. 합계 교차검증 (income - deduction = net)\n3. 이상치 감지 (평균 ±50%)\n4. 음수 정산액 경고\n5. 테스트 작성
  - Estimate: 1h
  - Files: web/src/services/settlement-verification.service.ts, web/src/__tests__/settlement-verification.test.ts
  - Verify: cd web && npm test
- [ ] **T02: 생성 이력 페이지** — 작업 목록 + 상세 + 다운로드 링크 + 검증 결과 표시
  - Estimate: 1h
  - Files: web/src/app/portal/(dashboard)/settlements/history/page.tsx, web/src/components/portal/Sidebar.tsx
  - Verify: cd web && npx next build
