---
estimated_steps: 1
estimated_files: 1
skills_used: []
---

# T01: 대량 생성 API + ZIP

1. /api/settlement/generate-bulk API route (POST)\n2. 청크 분할 처리 (50명씩)\n3. settlement_jobs 상태 업데이트\n4. ZIP 압축 (JSZip)\n5. Supabase Storage 업로드

## Inputs

- `web/src/services/settlement-pdf.service.ts`

## Expected Output

- `web/src/app/api/settlement/generate-bulk/route.ts`

## Verification

cd web && npx next build
