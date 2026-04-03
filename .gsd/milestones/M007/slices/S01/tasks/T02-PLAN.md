---
estimated_steps: 4
estimated_files: 2
skills_used: []
---

# T02: 기존 RLS 정책 간극 점검 + 보완

1. 기존 33개 테이블의 모든 정책 리뷰
2. INSERT/UPDATE/DELETE 중 누락된 작업 유형 식별
3. 지나치게 허용적인 정책(authenticated 전체 허용 등) 강화
4. 보완 SQL을 006 migration에 추가

## Inputs

- `supabase/schema.sql`
- `supabase/migrations/003_security_hardening.sql`

## Expected Output

- `supabase/migrations/006_rls_complete.sql`

## Verification

모든 테이블에 SELECT/INSERT/UPDATE/DELETE 4종 정책이 존재하거나 의도적 제외 주석
