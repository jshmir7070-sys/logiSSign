---
estimated_steps: 1
estimated_files: 1
skills_used: []
---

# T01: 자동 분류 통합 + 매핑 UI 강화

1. upload/page.tsx 매핑 단계에 자동 분류 결과 표시 (confidence badge)\n2. 수식 감지 표시 (FormulaType badge)\n3. 수익/차감 자동 분류 결과를 템플릿 빌더로 전달하는 링크 버튼\n4. 매핑 프리셋을 settlement_templates.column_mapping에 저장

## Inputs

- `web/src/services/formula-parser.service.ts`
- `web/src/services/column-classifier.service.ts`

## Expected Output

- `수정된 upload/page.tsx`

## Verification

cd web && npx next build && npm test
