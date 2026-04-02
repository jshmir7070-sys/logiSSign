---
estimated_steps: 1
estimated_files: 4
skills_used: []
---

# T01: 수식 파싱 + 자동 분류 서비스 구현

1. ParsedCell, DetectedFormula, FormulaType 타입 정의\n2. SheetJS cellFormula:true 파싱 → 수식 추출\n3. 수식 패턴 분석 (SUM, *0.0X, 차감)\n4. 키워드 기반 수익/차감/info 자동 분류\n5. ColumnMapping + confidence 반환\n6. 테스트 작성

## Inputs

- `web/src/services/excel-settlement.service.ts`

## Expected Output

- `web/src/services/formula-parser.service.ts`
- `web/src/services/column-classifier.service.ts`
- `web/src/__tests__/formula-parser.test.ts`
- `web/src/__tests__/column-classifier.test.ts`

## Verification

cd web && npm test
