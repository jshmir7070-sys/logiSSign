---
estimated_steps: 3
estimated_files: 2
skills_used: []
---

# T01: createServerSupabaseClient 쿠키 연동 수정

1. web/src/lib/supabase.ts의 createServerSupabaseClient()를 @supabase/ssr의 createServerClient + next/headers cookies()로 교체
2. auth.ts의 getSessionUser()가 정상 동작하도록 확인
3. npx tsc --noEmit으로 타입 체크

## Inputs

- `web/src/lib/supabase.ts`
- `web/src/lib/auth.ts`

## Expected Output

- `web/src/lib/supabase.ts (수정됨)`

## Verification

cd web && npx tsc --noEmit
