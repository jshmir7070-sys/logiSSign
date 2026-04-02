# S03: 템플릿 빌더 UI + DB

**Goal:** 정산서 템플릿 에디터 페이지 + CRUD API + 실시간 미리보기
**Demo:** After this: 템플릿 빌더에서 항목 체크/색상/로고 설정 → 실시간 미리보기

## Tasks
- [ ] **T01: 템플릿 CRUD 서비스** — settlement_templates CRUD + settlement_jobs/records 서비스 함수
  - Estimate: 30min
  - Files: web/src/services/settlement-template.service.ts
  - Verify: cd web && npx next build
- [ ] **T02: 템플릿 빌더 페이지 UI** — 테플릿 목록/선택 + 항목 체크박스 + 색상/폰트 설정 + 실시간 미리보기 + PDF 다운로드
  - Estimate: 2h
  - Files: web/src/app/portal/(dashboard)/settlements/builder/page.tsx, web/src/components/portal/Sidebar.tsx
  - Verify: cd web && npx next build
