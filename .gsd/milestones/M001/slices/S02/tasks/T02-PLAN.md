---
estimated_steps: 5
estimated_files: 2
skills_used: []
---

# T02: Generate TypeScript types from schema

1. Create web/src/types/database.ts with complete Supabase-generated types
2. Define Row, Insert, Update types for all 15 tables
3. Define enum types for all CHECK constraint values
4. Create mobile/types/database.ts (shared or copied)
5. Ensure types match schema.sql exactly

## Inputs

- `supabase/schema.sql`

## Expected Output

- `web/src/types/database.ts`
- `mobile/types/database.ts`

## Verification

cd web && npx tsc --noEmit && cd ../mobile && npx tsc --noEmit
