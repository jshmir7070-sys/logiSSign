---
id: T01
parent: S06
milestone: M003
provides: []
requires: []
affects: []
key_files: ["web/src/lib/pdf-fonts.ts", "web/src/services/signed-pdf.service.ts", "web/src/services/audit-certificate.service.ts", "web/src/services/education-certificate.service.ts", "web/src/services/government-form-pdf.service.ts"]
key_decisions: ["pdf-fonts.ts 공통 모듈: 서버사이드 fs.readFile / 클라이언트 fetch 자동 분기", "NotoSansKR subset:false로 CFF 인코딩 오류 방지"]
patterns_established: []
drill_down_paths: []
observability_surfaces: []
duration: ""
verification_result: "npx tsc --noEmit — 0 errors"
completed_at: 2026-04-01T00:32:07.709Z
blocker_discovered: false
---

# T01: PDF 서비스 4개를 NotoSansKR 한글 폰트로 전환, 공통 폰트 로더 모듈 생성

> PDF 서비스 4개를 NotoSansKR 한글 폰트로 전환, 공통 폰트 로더 모듈 생성

## What Happened
---
id: T01
parent: S06
milestone: M003
key_files:
  - web/src/lib/pdf-fonts.ts
  - web/src/services/signed-pdf.service.ts
  - web/src/services/audit-certificate.service.ts
  - web/src/services/education-certificate.service.ts
  - web/src/services/government-form-pdf.service.ts
key_decisions:
  - pdf-fonts.ts 공통 모듈: 서버사이드 fs.readFile / 클라이언트 fetch 자동 분기
  - NotoSansKR subset:false로 CFF 인코딩 오류 방지
duration: ""
verification_result: passed
completed_at: 2026-04-01T00:32:07.709Z
blocker_discovered: false
---

# T01: PDF 서비스 4개를 NotoSansKR 한글 폰트로 전환, 공통 폰트 로더 모듈 생성

**PDF 서비스 4개를 NotoSansKR 한글 폰트로 전환, 공통 폰트 로더 모듈 생성**

## What Happened

모든 PDF 서비스가 StandardFonts.Helvetica를 사용하고 있어 한글 렌더링 불가능이었다. web/src/lib/pdf-fonts.ts 공통 모듈을 만들어 서버사이드(fs.readFile)와 클라이언트(fetch) 자동 분기 처리. signed-pdf, audit-certificate, education-certificate 3개 서비스를 NotoSansKR 폰트로 전환. government-form-pdf.service.ts는 기존 인라인 로더를 제거하고 공통 모듈로 교체.

## Verification

npx tsc --noEmit — 0 errors

## Verification Evidence

| # | Command | Exit Code | Verdict | Duration |
|---|---------|-----------|---------|----------|
| 1 | `cd web && npx tsc --noEmit` | 0 | ✅ pass | 2500ms |


## Deviations

government-form-pdf.service.ts도 공통 모듈로 전환

## Known Issues

None.

## Files Created/Modified

- `web/src/lib/pdf-fonts.ts`
- `web/src/services/signed-pdf.service.ts`
- `web/src/services/audit-certificate.service.ts`
- `web/src/services/education-certificate.service.ts`
- `web/src/services/government-form-pdf.service.ts`


## Deviations
government-form-pdf.service.ts도 공통 모듈로 전환

## Known Issues
None.
