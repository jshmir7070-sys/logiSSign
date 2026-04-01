---
estimated_steps: 5
estimated_files: 5
skills_used: []
---

# T01: 한글 폰트 공통 로더 + PDF 서비스 수정

1. web/src/lib/pdf-fonts.ts 공통 모듈 생성 — 서버사이드 fs.readFile, 클라이언트 fetch 분기
2. signed-pdf.service.ts 수정: StandardFonts → NotoSansKR
3. audit-certificate.service.ts 수정
4. education-certificate.service.ts 수정
5. tsc --noEmit

## Inputs

- `web/public/fonts/NotoSansKR-Regular.otf`
- `web/public/fonts/NotoSansKR-Bold.otf`

## Expected Output

- `web/src/lib/pdf-fonts.ts`
- `web/src/services/signed-pdf.service.ts (수정)`
- `web/src/services/audit-certificate.service.ts (수정)`
- `web/src/services/education-certificate.service.ts (수정)`

## Verification

cd web && npx tsc --noEmit
