# S02: settings/page.tsx 분해 (1,268줄 → ~200줄)

**Goal:** settings/page.tsx의 7개 탭 컴포넌트를 개별 파일로 분리
**Demo:** After this: settings/page.tsx 300줄 이하

## Tasks
- [ ] **T01: settings 탭 컴포넌트 분리** — ProfileTab, CategoryTab, SealTab, DocumentsTab, BillingTab, NotificationTab, AdminsTab을 components/portal/settings/ 폴더로 추출
  - Estimate: 30min
  - Files: web/src/app/portal/(dashboard)/settings/page.tsx, web/src/components/portal/settings/ProfileTab.tsx, web/src/components/portal/settings/CategoryTab.tsx, web/src/components/portal/settings/SealTab.tsx, web/src/components/portal/settings/DocumentsTab.tsx, web/src/components/portal/settings/BillingTab.tsx, web/src/components/portal/settings/NotificationTab.tsx, web/src/components/portal/settings/AdminsTab.tsx
  - Verify: cd web && npx next build && wc -l src/app/portal/(dashboard)/settings/page.tsx
