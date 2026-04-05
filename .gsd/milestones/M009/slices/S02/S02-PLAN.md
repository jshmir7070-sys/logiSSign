# S02: 정산 E2E 검증

**Goal:** 정산 전체 플로우 오류 없이 동작 확인 — 엑셀 업로드 → 자동 정산 → PDF → 앱 확인
**Demo:** After this: 엑셀 업로드 → 자동 정산 → PDF 생성 → 기사 앱에서 정산서 확인

## Tasks
- [x] **T01: 정산 서비스/API 타입 에러 0건 — 15개 함수 정상** — 정산 서비스(excel-settlement, settlement, settlement-pdf 등) + API(generate-bulk, excel-upload, send) tsc 에러 확인 및 수정
  - Estimate: 20min
  - Files: web/src/services/excel-settlement.service.ts, web/src/services/settlement.service.ts, web/src/services/settlement-pdf.service.ts, web/src/app/api/settlement/generate-bulk/route.ts
  - Verify: npx tsc --noEmit 에러 0건
- [x] **T02: 정산 생성 + 7개 필드 금액 검증 전체 통과** — 기사 주상하 + 원청사 쿠팡퀵플렉스에 테스트 정산 데이터 생성. 배송 100건 × 단가 계산 → settlements 테이블에 저장 → 금액 검증
  - Estimate: 30min
  - Files: web/src/services/settlement.service.ts
  - Verify: settlements 테이블에 정산 1건 생성, 금액 정상
- [x] **T03: 모바일 정산 조회 쿼리 정상 — 1건 반환 확인** — 생성된 정산 데이터가 모바일 앱 정산 탭에서 표시되는지 확인. RLS 정책으로 기사 본인 데이터만 조회되는지 검증
  - Estimate: 15min
  - Files: mobile/app/(tabs)/settlement.tsx, mobile/services/settlement.service.ts
  - Verify: 모바일 정산 서비스로 조회 시 데이터 반환
