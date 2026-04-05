---
estimated_steps: 1
estimated_files: 4
skills_used: []
---

# T01: 정산 관련 서비스/API 타입 에러 점검

정산 서비스(excel-settlement, settlement, settlement-pdf 등) + API(generate-bulk, excel-upload, send) tsc 에러 확인 및 수정

## Inputs

- `web/src/services/`

## Expected Output

- `타입 에러 0건`

## Verification

npx tsc --noEmit 에러 0건
