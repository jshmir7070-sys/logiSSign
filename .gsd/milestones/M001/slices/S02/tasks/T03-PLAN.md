---
estimated_steps: 6
estimated_files: 5
skills_used: []
---

# T03: Implement auth service for mobile and web

1. Review existing mobile/lib/supabase.ts and web/src/lib/supabase.ts
2. Implement auth service: signUp, signIn, signOut, getSession, refreshToken, onAuthStateChange
3. Handle role-based JWT custom claims (role, agency_id)
4. Create mobile/hooks/useAuth.ts with session state
5. Create web/src/lib/auth.ts with SSR-compatible auth helpers
6. Integrate with existing Zustand stores

## Inputs

- `supabase/schema.sql`

## Expected Output

- `mobile/lib/supabase.ts`
- `mobile/hooks/useAuth.ts`
- `mobile/stores/authStore.ts`
- `web/src/lib/auth.ts`
- `web/src/lib/supabase.ts`

## Verification

TypeScript compiles without errors in both mobile/ and web/
