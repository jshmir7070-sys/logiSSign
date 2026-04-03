# S01: RLS 누락 테이블 정책 완전 적용

**Goal:** contract_amendments, driver_contract_periods, contract_verification_logs, integrity_check_results, security_logs 5개 테이블에 RLS 정책 추가 + 기존 RLS 정책 누락 검증
**Demo:** After this: migration SQL 실행 후 모든 33+ 테이블에 RLS + 정책 존재 확인

## Tasks
- [x] **T01: 14개 RLS 정책 추가 + drivers FOR ALL 세분화 migration 작성** — 1. schema.sql에서 5개 누락 테이블의 컬럼/관계 분석
2. 각 테이블별 접근 패턴 파악 (누가 읽고/쓰는가)
3. agency_id 기반 정책 설계
4. 006_rls_complete.sql migration 작성
5. 검증 쿼리 포함
  - Estimate: 25min
  - Files: supabase/schema.sql, supabase/migrations/006_rls_complete.sql
  - Verify: migration SQL에 문법 에러 없고, 5개 테이블 모두 ENABLE ROW LEVEL SECURITY + CREATE POLICY 포함
- [x] **T02: driver_documents/education FOR ALL 정책 3건 세분화 추가** — 1. 기존 33개 테이블의 모든 정책 리뷰
2. INSERT/UPDATE/DELETE 중 누락된 작업 유형 식별
3. 지나치게 허용적인 정책(authenticated 전체 허용 등) 강화
4. 보완 SQL을 006 migration에 추가
  - Estimate: 15min
  - Files: supabase/schema.sql, supabase/migrations/006_rls_complete.sql
  - Verify: 모든 테이블에 SELECT/INSERT/UPDATE/DELETE 4종 정책이 존재하거나 의도적 제외 주석
- [x] **T03: 빌드 성공 + 142 테스트 통과 확인** — 1. npx next build 실행
2. npm test 실행
3. migration SQL 최종 리뷰
  - Estimate: 5min
  - Files: supabase/migrations/006_rls_complete.sql
  - Verify: npx next build 성공 + npm test 통과
