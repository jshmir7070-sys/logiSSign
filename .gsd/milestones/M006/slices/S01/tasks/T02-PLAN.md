---
estimated_steps: 1
estimated_files: 2
skills_used: []
---

# T02: DB 스키마 추가 (settlement_templates, settlement_jobs, settlement_records)

settlement_templates, settlement_jobs, settlement_records 테이블 생성 + RLS + 인덱스

## Inputs

- `supabase/schema.sql`

## Expected Output

- `supabase/migrations/005_settlement_builder.sql`
- `web/src/types/database.ts 확장`

## Verification

cd web && npx next build
