---
estimated_steps: 5
estimated_files: 2
skills_used: []
---

# T01: RLS 누락 테이블 분석 + migration SQL 작성

1. schema.sql에서 5개 누락 테이블의 컬럼/관계 분석
2. 각 테이블별 접근 패턴 파악 (누가 읽고/쓰는가)
3. agency_id 기반 정책 설계
4. 006_rls_complete.sql migration 작성
5. 검증 쿼리 포함

## Inputs

- `supabase/schema.sql`
- `supabase/migrations/003_security_hardening.sql`
- `supabase/migrations/004_rpc_auth.sql`

## Expected Output

- `supabase/migrations/006_rls_complete.sql`

## Verification

migration SQL에 문법 에러 없고, 5개 테이블 모두 ENABLE ROW LEVEL SECURITY + CREATE POLICY 포함
