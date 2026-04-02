# S04: 컬럼 매핑 UI 강화

**Goal:** S01 수식 파싱/자동 분류를 기존 업로드 플로우에 통합 + 매핑 프리셋 관리 강화
**Demo:** After this: 자동 매핑 → 드래그 수정 → 프리셋 저장

## Tasks
- [ ] **T01: 자동 분류 통합 + 매핑 UI 강화** — 1. upload/page.tsx 매핑 단계에 자동 분류 결과 표시 (confidence badge)\n2. 수식 감지 표시 (FormulaType badge)\n3. 수익/차감 자동 분류 결과를 템플릿 빌더로 전달하는 링크 버튼\n4. 매핑 프리셋을 settlement_templates.column_mapping에 저장
  - Estimate: 1.5h
  - Files: web/src/app/portal/(dashboard)/settlements/upload/page.tsx
  - Verify: cd web && npx next build && npm test
