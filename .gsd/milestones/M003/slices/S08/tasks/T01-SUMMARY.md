---
id: T01
parent: S08
milestone: M003
provides: []
requires: []
affects: []
key_files: ["supabase/migrations/002_storage_buckets.sql", "supabase/schema.sql"]
key_decisions: ["public 버킷: contracts, documents, education, seals / private 버킷: settlements"]
patterns_established: []
drill_down_paths: []
observability_surfaces: []
duration: ""
verification_result: "파일 존재 확인 + 내용 검증"
completed_at: 2026-04-01T00:34:52.302Z
blocker_discovered: false
---

# T01: 5개 Storage 버킷 + policies 마이그레이션 SQL 작성

> 5개 Storage 버킷 + policies 마이그레이션 SQL 작성

## What Happened
---
id: T01
parent: S08
milestone: M003
key_files:
  - supabase/migrations/002_storage_buckets.sql
  - supabase/schema.sql
key_decisions:
  - public 버킷: contracts, documents, education, seals / private 버킷: settlements
duration: ""
verification_result: passed
completed_at: 2026-04-01T00:34:52.302Z
blocker_discovered: false
---

# T01: 5개 Storage 버킷 + policies 마이그레이션 SQL 작성

**5개 Storage 버킷 + policies 마이그레이션 SQL 작성**

## What Happened

5개 Storage 버킷(contracts, documents, education, seals, settlements)과 storage policies 생성 SQL을 작성. 별도 마이그레이션 파일로 분리하고 schema.sql에도 반영.

## Verification

파일 존재 확인 + 내용 검증

## Verification Evidence

| # | Command | Exit Code | Verdict | Duration |
|---|---------|-----------|---------|----------|
| 1 | `cat supabase/migrations/002_storage_buckets.sql | grep 'INSERT INTO storage.buckets' | wc -l` | 0 | ✅ pass (5 buckets) | 100ms |


## Deviations

None.

## Known Issues

Supabase 대시보드에서 SQL 실행 필요 — 자동 배포 아님

## Files Created/Modified

- `supabase/migrations/002_storage_buckets.sql`
- `supabase/schema.sql`


## Deviations
None.

## Known Issues
Supabase 대시보드에서 SQL 실행 필요 — 자동 배포 아님
