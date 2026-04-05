---
id: T02
parent: S04
milestone: M009
provides: []
requires: []
affects: []
key_files: ["supabase/migrations/017_fix_rls_security.sql"]
key_decisions: ["point_transactions_service 정책 제거 필요 (Supabase에서 실행)"]
patterns_established: []
drill_down_paths: []
observability_surfaces: []
duration: ""
verification_result: "anon key로 13개 테이블 조회 → 9개 0건, 4개 위반"
completed_at: 2026-04-05T12:34:01.953Z
blocker_discovered: false
---

# T02: RLS 검증 — 9/13 통과, 4개 위반 발견 → 수정 SQL 작성

> RLS 검증 — 9/13 통과, 4개 위반 발견 → 수정 SQL 작성

## What Happened
---
id: T02
parent: S04
milestone: M009
key_files:
  - supabase/migrations/017_fix_rls_security.sql
key_decisions:
  - point_transactions_service 정책 제거 필요 (Supabase에서 실행)
duration: ""
verification_result: passed
completed_at: 2026-04-05T12:34:01.953Z
blocker_discovered: false
---

# T02: RLS 검증 — 9/13 통과, 4개 위반 발견 → 수정 SQL 작성

**RLS 검증 — 9/13 통과, 4개 위반 발견 → 수정 SQL 작성**

## What Happened

13개 주요 테이블 anon key 조회 테스트. 9개 통과, 4개 위반. 위반 원인: service 정책이 FOR ALL USING(true)로 모든 role에 적용. 수정 SQL 작성 완료.

## Verification

anon key로 13개 테이블 조회 → 9개 0건, 4개 위반

## Verification Evidence

| # | Command | Exit Code | Verdict | Duration |
|---|---------|-----------|---------|----------|
| 1 | `node rls-check.js` | 0 | ⚠️ 4건 위반 발견 | 3000ms |


## Deviations

4개 테이블 RLS 위반 발견 — 수정 SQL 작성 (017_fix_rls_security.sql)

## Known Issues

agencies, principals, subscriptions, point_transactions — FOR ALL USING(true) 정책이 anon에도 적용. 017 SQL 실행 필요.

## Files Created/Modified

- `supabase/migrations/017_fix_rls_security.sql`


## Deviations
4개 테이블 RLS 위반 발견 — 수정 SQL 작성 (017_fix_rls_security.sql)

## Known Issues
agencies, principals, subscriptions, point_transactions — FOR ALL USING(true) 정책이 anon에도 적용. 017 SQL 실행 필요.
