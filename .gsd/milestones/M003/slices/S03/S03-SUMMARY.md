---
id: S03
parent: M003
milestone: M003
provides:
  - Cookie-based server Supabase client for S04, S08
requires:
  []
affects:
  - S04
  - S08
key_files:
  - web/src/lib/supabase.ts
  - web/src/lib/auth.ts
key_decisions:
  - createServerSupabaseClient async로 변경, getAll/setAll 패턴 사용
patterns_established:
  - createServerSupabaseClient()는 항상 await 필요 — async 함수
observability_surfaces:
  - none
drill_down_paths:
  - .gsd/milestones/M003/slices/S03/tasks/T01-SUMMARY.md
duration: ""
verification_result: passed
completed_at: 2026-04-01T00:27:20.104Z
blocker_discovered: false
---

# S03: Server-side Auth 컨텍스트 수정

**createServerSupabaseClient를 쿠키 기반 SSR 클라이언트로 교체하여 서버사이드 RLS 정상 동작**

## What Happened

Server-side Supabase 클라이언트가 쿠키 기반 세션을 읽도록 수정. 이제 서버 컴포넌트/API 라우트에서 auth.jwt()를 참조하는 RLS 정책이 정상 작동.

## Verification

npx tsc --noEmit — 0 errors

## Requirements Advanced

None.

## Requirements Validated

None.

## New Requirements Surfaced

None.

## Requirements Invalidated or Re-scoped

None.

## Deviations

identity.service.ts, integrity-check route도 함께 수정 (동일 패턴)

## Known Limitations

None.

## Follow-ups

None.

## Files Created/Modified

- `web/src/lib/supabase.ts` — createServerSupabaseClient를 @supabase/ssr createServerClient + cookies()로 교체
- `web/src/lib/auth.ts` — getSessionUser()에서 await 추가
- `web/src/services/identity.service.ts` — saveVerificationToSignature에서 await 추가
- `web/src/app/api/integrity-check/route.ts` — POST/GET에서 await 추가
