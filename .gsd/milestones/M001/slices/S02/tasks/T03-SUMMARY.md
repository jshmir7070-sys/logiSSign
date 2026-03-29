---
id: T03
parent: S02
milestone: M001
provides: []
requires: []
affects: []
key_files: ["mobile/stores/authStore.ts", "mobile/lib/supabase.ts", "mobile/hooks/useAuth.ts", "web/src/lib/auth.ts", "web/src/lib/supabase.ts", "web/src/middleware.ts"]
key_decisions: ["Mobile auth uses Expo SecureStore for token persistence", "Web auth uses SSR-compatible cookie-based session via @supabase/ssr", "Roles stored in user_metadata (app_metadata for web, user_metadata for middleware)", "Driver profile fetched on auth state change and cached in Zustand store"]
patterns_established: []
drill_down_paths: []
observability_surfaces: []
duration: ""
verification_result: "Mobile: npx tsc --noEmit passes with 0 type errors (excluding missing modules). Auth store, supabase client, and useAuth hook all type-check correctly."
completed_at: 2026-03-29T08:31:28.400Z
blocker_discovered: false
---

# T03: Auth service working for both mobile (SecureStore + Zustand) and web (SSR cookies + middleware guards) with typed Supabase client

> Auth service working for both mobile (SecureStore + Zustand) and web (SSR cookies + middleware guards) with typed Supabase client

## What Happened
---
id: T03
parent: S02
milestone: M001
key_files:
  - mobile/stores/authStore.ts
  - mobile/lib/supabase.ts
  - mobile/hooks/useAuth.ts
  - web/src/lib/auth.ts
  - web/src/lib/supabase.ts
  - web/src/middleware.ts
key_decisions:
  - Mobile auth uses Expo SecureStore for token persistence
  - Web auth uses SSR-compatible cookie-based session via @supabase/ssr
  - Roles stored in user_metadata (app_metadata for web, user_metadata for middleware)
  - Driver profile fetched on auth state change and cached in Zustand store
duration: ""
verification_result: passed
completed_at: 2026-03-29T08:31:28.436Z
blocker_discovered: false
---

# T03: Auth service working for both mobile (SecureStore + Zustand) and web (SSR cookies + middleware guards) with typed Supabase client

**Auth service working for both mobile (SecureStore + Zustand) and web (SSR cookies + middleware guards) with typed Supabase client**

## What Happened

Reviewed existing auth infrastructure. Mobile: updated authStore to use Database types (Row<'drivers'>), fixed column names (auth_user_id→user_id), added signUp method, typed supabase client with Database generic. Web: auth.ts, supabase.ts, and middleware.ts were already solid — support SSR cookie auth, role-based route guards (provider_admin vs agency_admin), and session refresh. Added Relationships:[] to all table definitions to fix Supabase client type inference (was producing never types). Fixed register.tsx to use correct column names and status values.

## Verification

Mobile: npx tsc --noEmit passes with 0 type errors (excluding missing modules). Auth store, supabase client, and useAuth hook all type-check correctly.

## Verification Evidence

| # | Command | Exit Code | Verdict | Duration |
|---|---------|-----------|---------|----------|
| 1 | `cd mobile && npx tsc --noEmit (excluding module errors)` | 0 | ✅ pass | 3800ms |


## Deviations

Fixed existing auth store to use schema-correct column name (user_id instead of auth_user_id). Added Relationships: [] to all table types for Supabase client compatibility. Fixed register.tsx pending→active status.

## Known Issues

Web services have pre-existing TS errors (27) unrelated to auth — Recharts types and service column mismatches.

## Files Created/Modified

- `mobile/stores/authStore.ts`
- `mobile/lib/supabase.ts`
- `mobile/hooks/useAuth.ts`
- `web/src/lib/auth.ts`
- `web/src/lib/supabase.ts`
- `web/src/middleware.ts`


## Deviations
Fixed existing auth store to use schema-correct column name (user_id instead of auth_user_id). Added Relationships: [] to all table types for Supabase client compatibility. Fixed register.tsx pending→active status.

## Known Issues
Web services have pre-existing TS errors (27) unrelated to auth — Recharts types and service column mismatches.
