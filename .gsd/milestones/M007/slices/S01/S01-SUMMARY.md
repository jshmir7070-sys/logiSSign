---
id: S01
parent: M007
milestone: M007
provides:
  - RLS 완전 적용된 DB 스키마
requires:
  []
affects:
  - S02
  - S03
  - S05
key_files:
  - supabase/migrations/006_rls_complete.sql
key_decisions:
  - drivers_own FOR ALL → SELECT+UPDATE 세분화
  - driver_documents_own FOR ALL → SELECT 전용
  - education_records/logs driver FOR ALL → SELECT(+INSERT for logs) 세분화
  - 기사에게 단가/공제/인센티브/계약기간/공지/세금계산서 조회 권한 추가
patterns_established:
  - agency_id 기반 RLS 정책 패턴: auth.jwt()->'app_metadata'->>'agency_id'
  - driver 조회 정책 패턴: driver_id IN (SELECT id FROM drivers WHERE user_id = auth.uid())
observability_surfaces:
  - none
drill_down_paths:
  - .gsd/milestones/M007/slices/S01/tasks/T01-SUMMARY.md
  - .gsd/milestones/M007/slices/S01/tasks/T02-SUMMARY.md
  - .gsd/milestones/M007/slices/S01/tasks/T03-SUMMARY.md
duration: ""
verification_result: passed
completed_at: 2026-04-02T20:34:04.142Z
blocker_discovered: false
---

# S01: RLS 누락 테이블 정책 완전 적용

**18개 RLS 정책 추가 + 4개 FOR ALL 세분화 migration 완성**

## What Happened

전체 33개 테이블의 RLS 정책을 감사했다. FOR ALL로 과도하게 열린 기사(driver) 레벨 정책 4개를 세분화하고, 기사에게 필요한 조회 접근(단가, 공제, 인센티브, 계약기간, 변경이력, 공지, 세금계산서 등) 14개 정책을 추가했다. 최종 migration: 18 CREATE + 4 DROP POLICY. 빌드 + 142 테스트 통과.

## Verification

SQL 문법 검증(괄호 59/59 균형), npx next build 성공, 142 tests passed

## Requirements Advanced

None.

## Requirements Validated

None.

## New Requirements Surfaced

None.

## Requirements Invalidated or Re-scoped

None.

## Deviations

초기 분석에서 5개 테이블 RLS 미적용이라고 판단했으나, 실제로는 모두 RLS 활성화 상태. 진짜 문제는 정책 누락과 과도한 FOR ALL 사용이었음.

## Known Limitations

None.

## Follow-ups

None.

## Files Created/Modified

- `supabase/migrations/006_rls_complete.sql` — 18 CREATE POLICY + 4 DROP POLICY: RLS 정책 완전 적용 migration
