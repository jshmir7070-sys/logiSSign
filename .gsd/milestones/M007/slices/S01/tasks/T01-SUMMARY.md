---
id: T01
parent: S01
milestone: M007
provides: []
requires: []
affects: []
key_files: ["supabase/migrations/006_rls_complete.sql"]
key_decisions: ["drivers_own FOR ALL → SELECT+UPDATE로 세분화 (기사 DELETE/INSERT 차단)", "기사에게 자기 단가/공제/인센티브/계약기간 조회 허용", "security_logs INSERT 정책 미추가 (service_role 전용, 의도적)", "notices에 기사 전용 조회 정책 추가"]
patterns_established: []
drill_down_paths: []
observability_surfaces: []
duration: ""
verification_result: "SQL 문법 검증: 괄호 균형 확인(45/45), 14 CREATE POLICY + 1 DROP POLICY 확인"
completed_at: 2026-04-02T20:32:13.250Z
blocker_discovered: false
---

# T01: 14개 RLS 정책 추가 + drivers FOR ALL 세분화 migration 작성

> 14개 RLS 정책 추가 + drivers FOR ALL 세분화 migration 작성

## What Happened
---
id: T01
parent: S01
milestone: M007
key_files:
  - supabase/migrations/006_rls_complete.sql
key_decisions:
  - drivers_own FOR ALL → SELECT+UPDATE로 세분화 (기사 DELETE/INSERT 차단)
  - 기사에게 자기 단가/공제/인센티브/계약기간 조회 허용
  - security_logs INSERT 정책 미추가 (service_role 전용, 의도적)
  - notices에 기사 전용 조회 정책 추가
duration: ""
verification_result: passed
completed_at: 2026-04-02T20:32:13.251Z
blocker_discovered: false
---

# T01: 14개 RLS 정책 추가 + drivers FOR ALL 세분화 migration 작성

**14개 RLS 정책 추가 + drivers FOR ALL 세분화 migration 작성**

## What Happened

schema.sql과 기존 migration 전체를 분석하여, 33개 테이블의 RLS 상태와 정책을 매핑했다. 5개 테이블이 RLS 미적용이 아니라 정책이 불완전한 것이 실제 문제였다. drivers 테이블의 FOR ALL 정책을 SELECT+UPDATE로 세분화하여 기사가 자기 row를 DELETE하거나 agency_id를 변경하는 것을 차단했다. 기사에게 단가/공제/인센티브/계약기간/공지/세금계산서 조회 접근을 추가했다. 총 14개 CREATE POLICY + 1개 DROP POLICY.

## Verification

SQL 문법 검증: 괄호 균형 확인(45/45), 14 CREATE POLICY + 1 DROP POLICY 확인

## Verification Evidence

| # | Command | Exit Code | Verdict | Duration |
|---|---------|-----------|---------|----------|
| 1 | `grep -c 'CREATE POLICY' supabase/migrations/006_rls_complete.sql` | 0 | ✅ pass: 14 policies | 50ms |
| 2 | `node paren-check` | 0 | ✅ pass: 45 open, 45 close, balanced | 100ms |


## Deviations

초기 분석에서 5개 테이블이 RLS 없다고 판단했으나, 실제로는 모두 ENABLE ROW LEVEL SECURITY가 있었음. 진짜 문제는 정책 부족/과도한 FOR ALL 사용이었음.

## Known Issues

None.

## Files Created/Modified

- `supabase/migrations/006_rls_complete.sql`


## Deviations
초기 분석에서 5개 테이블이 RLS 없다고 판단했으나, 실제로는 모두 ENABLE ROW LEVEL SECURITY가 있었음. 진짜 문제는 정책 부족/과도한 FOR ALL 사용이었음.

## Known Issues
None.
