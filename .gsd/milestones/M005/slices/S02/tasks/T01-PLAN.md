---
estimated_steps: 1
estimated_files: 8
skills_used: []
---

# T01: settings 탭 컴포넌트 분리

ProfileTab, CategoryTab, SealTab, DocumentsTab, BillingTab, NotificationTab, AdminsTab을 components/portal/settings/ 폴더로 추출

## Inputs

- `web/src/app/portal/(dashboard)/settings/page.tsx`

## Expected Output

- `settings/page.tsx 300줄 이하`
- `7개 탭 컴포넌트 파일`

## Verification

cd web && npx next build && wc -l src/app/portal/(dashboard)/settings/page.tsx
