# S01: 웹 포털 나머지 페이지 완성

**Goal:** 웹 포털 나머지 페이지 완성 + 기사 정산서 노출항목 설정 및 미리보기 기능 추가
**Demo:** After this: 웹 포털 모든 페이지가 빌드/렌더링 됨 — 대시보드 KPI, 기사 상세, 세금계산서, 리포트, 설정

## Tasks
- [x] **T01: 정산서 노출항목 14개 체크박스 + 모바일 앱 실시간 미리보기 구현** — 1. principals/[id]/page.tsx에 정산서 노출항목 설정 섹션 추가
2. FieldConfig에 settlement_display 필드 추가 (기사에게 보여줄 항목 체크)
3. 체크박스: 배송건수, 배송금액, 반품건수, 반품금액, 인센티브, 프레쉬백, 차감상세, 부가세, 총수입, 총차감, 순지급액
4. 미리보기 패널: 체크된 항목만 보이는 모바일 앱 스타일 정산서 레이아웃
5. field_config 저장 시 settlement_display 포함
  - Estimate: 1.5h
  - Files: web/src/app/portal/(dashboard)/principals/[id]/page.tsx, web/src/services/principal.service.ts
  - Verify: cd web && npm run build
- [x] **T02: All 20 web portal pages verified — dashboard, driver detail, tax invoices, reports, settings all build** — 1. dashboard/page.tsx 검토 — KPI 쿠리 타입 확인
2. drivers/[id]/page.tsx 검토 — 기사 상세 페이지
3. tax-invoices/page.tsx 검토
4. tax-invoices/[id]/print/page.tsx 검토
5. reports/page.tsx 검토
6. settings/page.tsx 검토
7. 필요시 수정
  - Estimate: 1.5h
  - Files: web/src/app/portal/(dashboard)/dashboard/page.tsx, web/src/app/portal/(dashboard)/drivers/[id]/page.tsx, web/src/app/portal/(dashboard)/tax-invoices/page.tsx, web/src/app/portal/(dashboard)/tax-invoices/[id]/print/page.tsx, web/src/app/portal/(dashboard)/reports/page.tsx, web/src/app/portal/(dashboard)/settings/page.tsx
  - Verify: cd web && npm run build
