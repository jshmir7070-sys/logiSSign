---
id: S06
parent: M003
milestone: M003
provides:
  - Korean PDF rendering capability
requires:
  []
affects:
  []
key_files:
  - web/src/lib/pdf-fonts.ts
key_decisions:
  - pdf-fonts.ts 공통 모듈로 폰트 로딩 중앙화
patterns_established:
  - PDF 건 생성 시 loadKoreanFonts(pdfDoc) 사용
observability_surfaces:
  - none
drill_down_paths:
  - .gsd/milestones/M003/slices/S06/tasks/T01-SUMMARY.md
duration: ""
verification_result: passed
completed_at: 2026-04-01T00:33:27.651Z
blocker_discovered: false
---

# S06: 계약 PDF 생성 + 서명 + QR 진위확인

**모든 PDF 서비스를 NotoSansKR 한글 폰트로 전환, 공통 폰트 로더 모듈 생성**

## What Happened

4개 PDF 서비스(signed-pdf, audit-certificate, education-certificate, government-form-pdf)가 모두 StandardFonts.Helvetica를 사용하여 한글 렌더링이 불가능했다. 공통 pdf-fonts.ts 모듈을 만들어 서버/클라이언트 자동 분기 처리하고, NotoSansKR Regular/Bold 폰트로 전환.

## Verification

npx tsc --noEmit — 0 errors

## Requirements Advanced

None.

## Requirements Validated

None.

## New Requirements Surfaced

None.

## Requirements Invalidated or Re-scoped

None.

## Deviations

government-form-pdf.service.ts도 공통 모듈로 전환

## Known Limitations

None.

## Follow-ups

None.

## Files Created/Modified

- `web/src/lib/pdf-fonts.ts` — PDF 한글 폰트 공통 로더 생성 (fs/fetch 자동 분기)
- `web/src/services/signed-pdf.service.ts` — StandardFonts → NotoSansKR 한글 폰트로 교체
- `web/src/services/audit-certificate.service.ts` — StandardFonts → NotoSansKR 한글 폰트로 교체
- `web/src/services/education-certificate.service.ts` — StandardFonts → NotoSansKR 한글 폰트로 교체
- `web/src/services/government-form-pdf.service.ts` — 인라인 폰트 로더 제거, 공통 모듈로 교체
