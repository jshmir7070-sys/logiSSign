# S01: 빌드 에러 수정 + as any 7건 제거

**Goal:** 빌드 통과시키고 모든 as any를 안전한 타입으로 교체
**Demo:** After this: npx next build 성공 + rg 'as any' 0건

## Tasks
- [x] **T01: _DocumentsTab → DocumentsTab 리네이밍으로 React hooks 규칙 위반 빌드 에러 해소** — settings/page.tsx의 _DocumentsTab을 DocumentsTab으로 변경. React hooks 규칙 위반 해소.
  - Estimate: 10min
  - Files: web/src/app/portal/(dashboard)/settings/page.tsx
  - Verify: cd web && npx next build 2>&1 | grep -c 'Error' | grep 0
- [x] **T02: as any 9건(Recharts 5, Supabase RPC 1, 타입 미비 3) + csrf.test any 1건 → 전량 안전 타입으로 교체** — 1) Recharts formatter 4건: ContentType 또는 실제 타입 사용\n2) verification.service.ts rpc 1건: Supabase 타입 확장\n3) settings 3건: (doc as any).recipients → 타입 확장
  - Estimate: 1h
  - Files: web/src/components/admin/charts/PlanDistribution.tsx, web/src/components/admin/charts/MrrChart.tsx, web/src/components/portal/charts/RevenueChart.tsx, web/src/components/portal/charts/ExpenseDonut.tsx, web/src/services/verification.service.ts, web/src/app/portal/(dashboard)/settings/page.tsx
  - Verify: cd web && rg 'as any' src/ --count-matches && npx next build && npm test
