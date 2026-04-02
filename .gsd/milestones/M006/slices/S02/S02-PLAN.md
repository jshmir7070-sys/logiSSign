# S02: 정산서 PDF 렌더러 (pdf-lib)

**Goal:** pdf-lib로 정산서 PDF 렌더러를 구현한다 — 타이틀, 기사정보, 수익 테이블, 차감 테이블, 합계, 푸터 섹션
**Demo:** After this: 샘플 1명 정산서 PDF 생성 + 다운로드

## Tasks
- [ ] **T01: 정산서 PDF 렌더러 구현** — 1. SettlementTemplate 타입 정의\n2. PDF 레이아웃 엔진 (drawTable, drawSection)\n3. 타이틀 + 로고 + 기사정보 + 수익테이블 + 차감테이블 + 합계 + 푸터\n4. generateSettlementPdf() 함수 export
  - Estimate: 2h
  - Files: web/src/services/settlement-pdf.service.ts, web/src/types/settlement-template.ts
  - Verify: cd web && npx next build && npm test
