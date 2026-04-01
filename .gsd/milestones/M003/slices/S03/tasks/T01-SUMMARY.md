---
id: T01
parent: S03
milestone: M003
provides: []
requires: []
affects: []
key_files: ["web/src/lib/supabase.ts", "web/src/lib/auth.ts", "web/src/services/identity.service.ts", "web/src/app/api/integrity-check/route.ts"]
key_decisions: ["createServerSupabaseClient를 async로 변경 — next/headers cookies() 사용", "setAll에서 Server Component catch 패턴 적용"]
patterns_established: []
drill_down_paths: []
observability_surfaces: []
duration: ""
verification_result: "npx tsc --noEmit — 0 errors"
completed_at: 2026-04-01T00:26:56.652Z
blocker_discovered: false
---

# T01: createServerSupabaseClient를 쿠키 기반 SSR 클라이언트로 교체하여 서버사이드 RLS 정상 동작

> createServerSupabaseClient를 쿠키 기반 SSR 클라이언트로 교체하여 서버사이드 RLS 정상 동작

## What Happened
---
id: T01
parent: S03
milestone: M003
key_files:
  - web/src/lib/supabase.ts
  - web/src/lib/auth.ts
  - web/src/services/identity.service.ts
  - web/src/app/api/integrity-check/route.ts
key_decisions:
  - createServerSupabaseClient를 async로 변경 — next/headers cookies() 사용
  - setAll에서 Server Component catch 패턴 적용
duration: ""
verification_result: passed
completed_at: 2026-04-01T00:26:56.653Z
blocker_discovered: false
---

# T01: createServerSupabaseClient를 쿠키 기반 SSR 클라이언트로 교체하여 서버사이드 RLS 정상 동작

**createServerSupabaseClient를 쿠키 기반 SSR 클라이언트로 교체하여 서버사이드 RLS 정상 동작**

## What Happened

createServerSupabaseClient()가 @supabase/supabase-js의 createClient를 직접 사용하여 세션 없이 anon key만으로 쿼리를 보내고 있었다. 이를 @supabase/ssr의 createServerClient + next/headers cookies()로 교체하여, 서버 컴포넌트에서도 로그인한 사용자의 JWT가 Supabase에 전달되도록 수정. getAll/setAll 패턴 사용. 동기→비동기 변경으로 auth.ts, identity.service.ts, integrity-check route.ts의 호출부도 await 추가.

## Verification

npx tsc --noEmit — 0 errors

## Verification Evidence

| # | Command | Exit Code | Verdict | Duration |
|---|---------|-----------|---------|----------|
| 1 | `cd web && npx tsc --noEmit` | 0 | ✅ pass | 9000ms |


## Deviations

identity.service.ts와 integrity-check route.ts도 동기 호출을 사용하고 있어 함께 수정

## Known Issues

None.

## Files Created/Modified

- `web/src/lib/supabase.ts`
- `web/src/lib/auth.ts`
- `web/src/services/identity.service.ts`
- `web/src/app/api/integrity-check/route.ts`


## Deviations
identity.service.ts와 integrity-check route.ts도 동기 호출을 사용하고 있어 함께 수정

## Known Issues
None.
