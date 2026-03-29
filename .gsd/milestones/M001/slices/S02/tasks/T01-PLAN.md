---
estimated_steps: 6
estimated_files: 1
skills_used: []
---

# T01: Finalize and validate database schema

1. Review existing supabase/schema.sql (279 lines, 15 tables)
2. Validate all FK references and constraints
3. Add any missing columns identified from stitch/ screen analysis (e.g., driver profile fields)
4. Verify RLS policies cover all tables with correct role checks
5. Add missing indexes for common query patterns
6. Output finalized migration-ready SQL

## Inputs

- `supabase/schema.sql`
- `stitch/ screen designs`

## Expected Output

- `supabase/schema.sql (updated)`
- `supabase/migrations/001_initial.sql`

## Verification

SQL syntax check passes; all FK references valid
