# S06: 계약 PDF 생성 + 서명 + QR 진위확인

**Goal:** signed-pdf.service.ts에 한글 폰트 지원 추가 + PDF 서비스가 서버사이드에서도 폰트 로드 가능하도록 수정
**Demo:** After this: 계약서 PDF 생성 → 기사 서명 → QR코드 스캔으로 진위 확인

## Tasks
- [x] **T01: PDF 서비스 4개를 NotoSansKR 한글 폰트로 전환, 공통 폰트 로더 모듈 생성** — 1. web/src/lib/pdf-fonts.ts 공통 모듈 생성 — 서버사이드 fs.readFile, 클라이언트 fetch 분기
2. signed-pdf.service.ts 수정: StandardFonts → NotoSansKR
3. audit-certificate.service.ts 수정
4. education-certificate.service.ts 수정
5. tsc --noEmit
  - Estimate: 25min
  - Files: web/src/lib/pdf-fonts.ts, web/src/services/signed-pdf.service.ts, web/src/services/audit-certificate.service.ts, web/src/services/education-certificate.service.ts, web/src/services/government-form-pdf.service.ts
  - Verify: cd web && npx tsc --noEmit
