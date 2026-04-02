---
estimated_steps: 1
estimated_files: 1
skills_used: []
---

# T01: _DocumentsTab → DocumentsTab 리네이밍 (빌드 수정)

settings/page.tsx의 _DocumentsTab을 DocumentsTab으로 변경. React hooks 규칙 위반 해소.

## Inputs

- `web/src/app/portal/(dashboard)/settings/page.tsx`

## Expected Output

- `빌드 에러 0건`

## Verification

cd web && npx next build 2>&1 | grep -c 'Error' | grep 0
