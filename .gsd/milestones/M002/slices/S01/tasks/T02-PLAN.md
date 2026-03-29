---
estimated_steps: 7
estimated_files: 6
skills_used: []
---

# T02: 웹 포털 나머지 페이지 검증

1. dashboard/page.tsx 검토 — KPI 쿠리 타입 확인
2. drivers/[id]/page.tsx 검토 — 기사 상세 페이지
3. tax-invoices/page.tsx 검토
4. tax-invoices/[id]/print/page.tsx 검토
5. reports/page.tsx 검토
6. settings/page.tsx 검토
7. 필요시 수정

## Inputs

- `web/src/services/dashboard.service.ts`

## Expected Output

- `web/src/app/portal/(dashboard)/dashboard/page.tsx`
- `web/src/app/portal/(dashboard)/drivers/[id]/page.tsx`
- `web/src/app/portal/(dashboard)/tax-invoices/page.tsx`
- `web/src/app/portal/(dashboard)/reports/page.tsx`
- `web/src/app/portal/(dashboard)/settings/page.tsx`

## Verification

cd web && npm run build
