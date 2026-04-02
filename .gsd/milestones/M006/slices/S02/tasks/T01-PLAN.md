---
estimated_steps: 1
estimated_files: 2
skills_used: []
---

# T01: 정산서 PDF 렌더러 구현

1. SettlementTemplate 타입 정의\n2. PDF 레이아웃 엔진 (drawTable, drawSection)\n3. 타이틀 + 로고 + 기사정보 + 수익테이블 + 차감테이블 + 합계 + 푸터\n4. generateSettlementPdf() 함수 export

## Inputs

- `web/src/lib/pdf-fonts.ts`
- `web/src/services/signed-pdf.service.ts`

## Expected Output

- `web/src/services/settlement-pdf.service.ts`
- `web/src/types/settlement-template.ts`

## Verification

cd web && npx next build && npm test
