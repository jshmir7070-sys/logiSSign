# S01: RLS 누락 테이블 정책 완전 적용 — UAT

**Milestone:** M007
**Written:** 2026-04-02T20:34:04.143Z

## UAT: RLS 정책 완전 적용\n\n### 테스트 시나리오\n1. Migration SQL을 Supabase SQL Editor에서 실행\n2. `SELECT schemaname, tablename, rowsecurity FROM pg_tables WHERE schemaname = 'public'` → 모든 테이블 rowsecurity = true\n3. 기사 계정으로 로그인 → 자기 단가/공제/계약기간 조회 가능\n4. 기사 계정으로 → driver_documents DELETE 시도 → 차단 확인\n5. 기사 계정으로 → education_records INSERT 시도 → 차단 확인\n6. 타 운영사 계정으로 → 다른 운영사 데이터 조회 → 빈 결과
