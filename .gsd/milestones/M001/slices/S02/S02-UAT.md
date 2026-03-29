# S02: Supabase Backend & Auth Foundation — UAT

**Milestone:** M001
**Written:** 2026-03-29T08:31:56.600Z

## UAT: Supabase Backend & Auth Foundation\n\n### Schema\n- [x] 19 tables defined with proper constraints and FKs\n- [x] All FK references resolve to existing tables\n- [x] 15 tables have RLS enabled with 20 policies\n- [x] 15 indexes cover common query patterns\n\n### Types\n- [x] TypeScript types match schema exactly (19 tables)\n- [x] Named enum types exported for all CHECK constraints\n- [x] Relationships:[] field present for Supabase client compat\n- [x] Identical types shared between mobile and web\n\n### Auth\n- [x] Mobile: signIn, signUp, signOut, session persistence\n- [x] Mobile: Driver profile fetched on auth change\n- [x] Web: SSR cookie auth with session refresh\n- [x] Web: Middleware route guards (admin vs portal)\n- [x] TypeScript compiles clean for auth code
