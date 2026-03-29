---
estimated_steps: 5
estimated_files: 3
skills_used: []
---

# T02: 정산 핵심 페이지 완성 (업로드→생성→규칙)

1. 정산 업로드 페이지 (settlements/upload) 검토 및 수정
2. 정산 생성 페이지 (settlements/generate) 검토 및 수정
3. 정산 규칙 페이지 (settlements/rules) 검토 및 수정
4. 각 페이지가 서비스 함수와 올바르게 연결되어 있는지 확인
5. 정산 발송/확정 플로우 연결

## Inputs

- `web/src/services/settlement.service.ts`
- `web/src/services/excel-settlement.service.ts`

## Expected Output

- `web/src/app/portal/(dashboard)/settlements/upload/page.tsx`
- `web/src/app/portal/(dashboard)/settlements/generate/page.tsx`
- `web/src/app/portal/(dashboard)/settlements/rules/page.tsx`

## Verification

cd web && npm run build
