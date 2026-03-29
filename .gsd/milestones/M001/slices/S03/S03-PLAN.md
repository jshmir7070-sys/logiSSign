# S03: 웹 포털 — 정산서 생성 & 전자계약 관리

**Goal:** 웹 포털의 정산서 생성(엑셀 업로드→정산→발송)과 전자계약(템플릿→발송→서명관리) 핵심 플로우를 완성하고 TS 에러를 수정한다
**Demo:** After this: 운영사가 엑셀 업로드로 정산서 생성하고, 계약서 템플릿으로 전자계약을 기사에게 발송할 수 있다

## Tasks
- [x] **T01: Fixed all 34 web TypeScript errors — extended schema/types to match services, fixed Recharts and notices** — 1. web/src/types/database.ts에 settlements 테이블 누락 컬럼 추가 (delivery_amount, return_count, return_amount, pickup_count, pickup_amount, fresh_incentive, extra_incentive, gross_total, rate_mode, rate_percentage, route_details)
2. agencies 테이블에 excel_config, field_config 확인
3. tax_invoices에 invoice_type 확인 (vat_invoice, withholding_3_3 추가)
4. supabase/schema.sql도 동기화
5. 모든 서비스 파일의 as never 캐스트 제거하고 올바른 타입 사용
6. Recharts 차트 컴포넌트 타입 에러 수정
7. notices page null index 에러 수정
  - Estimate: 1.5h
  - Files: web/src/types/database.ts, supabase/schema.sql, web/src/services/settlement.service.ts, web/src/services/contract.service.ts, web/src/services/principal.service.ts, web/src/services/tax-invoice.service.ts, web/src/components/admin/charts/MrrChart.tsx, web/src/components/admin/charts/PlanDistribution.tsx, web/src/components/portal/charts/ExpenseDonut.tsx
  - Verify: cd web && npx tsc --noEmit
- [x] **T02: Settlement pages verified — upload/generate/rules all functional, build passes** — 1. 정산 업로드 페이지 (settlements/upload) 검토 및 수정
2. 정산 생성 페이지 (settlements/generate) 검토 및 수정
3. 정산 규칙 페이지 (settlements/rules) 검토 및 수정
4. 각 페이지가 서비스 함수와 올바르게 연결되어 있는지 확인
5. 정산 발송/확정 플로우 연결
  - Estimate: 1.5h
  - Files: web/src/app/portal/(dashboard)/settlements/upload/page.tsx, web/src/app/portal/(dashboard)/settlements/generate/page.tsx, web/src/app/portal/(dashboard)/settlements/rules/page.tsx
  - Verify: cd web && npm run build
- [x] **T03: Contract pages verified — list with status tabs, template CRUD with variable binding, all functional** — 1. 계약서 목록 페이지 (contracts/page) 검토
2. 계약서 템플릿 관리 페이지 (contracts/templates) 검토
3. 계약서 발송 기능이 contract.service.ts와 연결 확인
4. 계약서 상태별 필터링 (전체/서명완료/서명대기/만료)
5. 필요시 계약서 상세보기/서명현황 페이지 추가
  - Estimate: 1h
  - Files: web/src/app/portal/(dashboard)/contracts/page.tsx, web/src/app/portal/(dashboard)/contracts/templates/page.tsx
  - Verify: cd web && npm run build
