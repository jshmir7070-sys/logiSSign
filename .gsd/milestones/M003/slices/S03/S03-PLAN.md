# S03: Server-side Auth 컨텍스트 수정

**Goal:** Server-side Supabase 클라이언트가 쿠키 기반 세션을 읽도록 수정하여 RLS가 정상 작동하게 한다
**Demo:** After this: 로그인한 운영사만 자기 데이터 조회 가능, 타 운영사 데이터 차단

## Tasks
- [x] **T01: createServerSupabaseClient를 쿠키 기반 SSR 클라이언트로 교체하여 서버사이드 RLS 정상 동작** — 1. web/src/lib/supabase.ts의 createServerSupabaseClient()를 @supabase/ssr의 createServerClient + next/headers cookies()로 교체
2. auth.ts의 getSessionUser()가 정상 동작하도록 확인
3. npx tsc --noEmit으로 타입 체크
  - Estimate: 15min
  - Files: web/src/lib/supabase.ts, web/src/lib/auth.ts
  - Verify: cd web && npx tsc --noEmit
