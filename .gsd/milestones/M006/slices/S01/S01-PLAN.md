# S01: 수식 파싱 엔진 + 수익/차감 자동 분류

**Goal:** SheetJS 수식 파싱 + FormulaType 감지 + 키워드 기반 수익/차감 자동 분류
**Demo:** After this: 엑셀 업로드 시 수식 감지 + 수익/차감 자동 분류

## Tasks
- [ ] **T01: 수식 파싱 + 자동 분류 서비스 구현** — 1. ParsedCell, DetectedFormula, FormulaType 타입 정의\n2. SheetJS cellFormula:true 파싱 → 수식 추출\n3. 수식 패턴 분석 (SUM, *0.0X, 차감)\n4. 키워드 기반 수익/차감/info 자동 분류\n5. ColumnMapping + confidence 반환\n6. 테스트 작성
  - Estimate: 2h
  - Files: web/src/services/formula-parser.service.ts, web/src/services/column-classifier.service.ts, web/src/__tests__/formula-parser.test.ts, web/src/__tests__/column-classifier.test.ts
  - Verify: cd web && npm test
- [ ] **T02: DB 스키마 추가 (settlement_templates, settlement_jobs, settlement_records)** — settlement_templates, settlement_jobs, settlement_records 테이블 생성 + RLS + 인덱스
  - Estimate: 30min
  - Files: supabase/migrations/005_settlement_builder.sql, web/src/types/database.ts
  - Verify: cd web && npx next build
