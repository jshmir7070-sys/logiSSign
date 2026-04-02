# S05: 대량 처리 (1,000명) + ZIP 다운로드

**Goal:** 클라이언트(≤300명) + 서버(301~1000명) 분기 처리, 진행률 표시, ZIP 다운로드
**Demo:** After this: 1,000행 엑셀 → 일괄 PDF → ZIP

## Tasks
- [ ] **T01: 대량 생성 API + ZIP** — 1. /api/settlement/generate-bulk API route (POST)\n2. 청크 분할 처리 (50명씩)\n3. settlement_jobs 상태 업데이트\n4. ZIP 압축 (JSZip)\n5. Supabase Storage 업로드
  - Estimate: 1.5h
  - Files: web/src/app/api/settlement/generate-bulk/route.ts
  - Verify: cd web && npx next build
- [ ] **T02: 빌더 UI에 대량 생성 + 진행률 통합** — 1. 정산서 빌더 페이지에 대량 생성 버튼 추가\n2. 진행률 바 + 처리 건수 표시\n3. 완료 후 ZIP 다운로드 링크\n4. 클라이언트 처리 (≤300명) JSZip 직접 생성
  - Estimate: 1h
  - Files: web/src/app/portal/(dashboard)/settlements/builder/page.tsx
  - Verify: cd web && npx next build
