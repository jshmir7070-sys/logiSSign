---
estimated_steps: 1
estimated_files: 1
skills_used: []
---

# T02: RLS 정책 전수 검증

drivers, settlements, contracts 등 주요 테이블에 RLS 활성화 확인. anon key로 조회 시 0건 반환 확인.

## Inputs

- `supabase/schema.sql`

## Expected Output

- `RLS 검증 결과`

## Verification

주요 테이블 anon 조회 0건
