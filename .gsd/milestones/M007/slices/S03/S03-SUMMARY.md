---
id: S03
parent: M007
milestone: M007
provides:
  - PII 감사 로깅 인프라 (logPiiAccess, logDataModification)
requires:
  - slice: S01
    provides: RLS 완전 적용
affects:
  - S05
key_files:
  - web/src/lib/security-logger.ts
  - supabase/migrations/007_pii_audit_log.sql
key_decisions:
  - pii_access를 data_modification과 분리하여 조회만으로도 감사 가능
patterns_established:
  - logPiiAccess()로 민감 데이터 접근 추적 패턴
observability_surfaces:
  - security_logs 테이블 pii_access 이벤트 필터링
  - audit-log 페이지 PII 접근 필터 버튼
drill_down_paths:
  - .gsd/milestones/M007/slices/S03/tasks/T01-SUMMARY.md
duration: ""
verification_result: passed
completed_at: 2026-04-02T20:40:44.411Z
blocker_discovered: false
---

# S03: 민감 데이터 접근 감사 로그 강화

**PII 접근 감사 인프라 완성 (함수 + DB 이벤트 타입 + UI 필터)**

## What Happened

PII 접근 감사를 위한 인프라를 완성했다. pii_access 이벤트 타입, 전용 인덱스, 편의 함수(logPiiAccess, logDataModification), audit-log UI 필터를 추가.

## Verification

npx next build 성공

## Requirements Advanced

None.

## Requirements Validated

None.

## New Requirements Surfaced

None.

## Requirements Invalidated or Re-scoped

None.

## Deviations

None.

## Known Limitations

logPiiAccess 함수는 준비됨, 모든 서비스 접근점에 삽입하는 것은 점진적 작업

## Follow-ups

서비스 레이어의 각 PII 접근점(driver bank_account 조회, 수정 등)에 logPiiAccess() 호출 삽입은 점진적으로 추가.

## Files Created/Modified

- `web/src/lib/security-logger.ts` — logPiiAccess + logDataModification 함수 추가, pii_access 이벤트 타입
- `supabase/migrations/007_pii_audit_log.sql` — pii_access 이벤트 타입 + 전용 인덱스 추가
- `web/src/app/admin/(dashboard)/audit-log/page.tsx` — PII 접근 필터 버튼 + 이벤트 라벨 추가
- `supabase/schema.sql` — pii_access 이벤트 타입 추가
