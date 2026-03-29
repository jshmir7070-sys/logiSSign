# S02: Supabase Backend & Auth Foundation

**Goal:** Deploy all core tables to Supabase, configure RLS policies, and implement auth service with role-based access
**Demo:** After this: Supabase tables deployed, RLS policies active, auth signup/login/logout works with role-based JWT claims

## Tasks
- [x] **T01: Extended schema from 15→19 tables with full RLS coverage matching all web service requirements** — 1. Review existing supabase/schema.sql (279 lines, 15 tables)
2. Validate all FK references and constraints
3. Add any missing columns identified from stitch/ screen analysis (e.g., driver profile fields)
4. Verify RLS policies cover all tables with correct role checks
5. Add missing indexes for common query patterns
6. Output finalized migration-ready SQL
  - Estimate: 1h
  - Files: supabase/schema.sql
  - Verify: SQL syntax check passes; all FK references valid
- [x] **T02: Generated TypeScript types for all 19 tables with named enums and convenience aliases** — 1. Create web/src/types/database.ts with complete Supabase-generated types
2. Define Row, Insert, Update types for all 15 tables
3. Define enum types for all CHECK constraint values
4. Create mobile/types/database.ts (shared or copied)
5. Ensure types match schema.sql exactly
  - Estimate: 1h
  - Files: web/src/types/database.ts, mobile/types/database.ts
  - Verify: cd web && npx tsc --noEmit && cd ../mobile && npx tsc --noEmit
- [x] **T03: Auth service working for both mobile (SecureStore + Zustand) and web (SSR cookies + middleware guards) with typed Supabase client** — 1. Review existing mobile/lib/supabase.ts and web/src/lib/supabase.ts
2. Implement auth service: signUp, signIn, signOut, getSession, refreshToken, onAuthStateChange
3. Handle role-based JWT custom claims (role, agency_id)
4. Create mobile/hooks/useAuth.ts with session state
5. Create web/src/lib/auth.ts with SSR-compatible auth helpers
6. Integrate with existing Zustand stores
  - Estimate: 1.5h
  - Files: mobile/lib/supabase.ts, mobile/hooks/useAuth.ts, mobile/stores/authStore.ts, web/src/lib/auth.ts, web/src/lib/supabase.ts
  - Verify: TypeScript compiles without errors in both mobile/ and web/
