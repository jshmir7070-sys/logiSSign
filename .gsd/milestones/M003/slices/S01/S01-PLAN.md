# S01: Supabase 스키마 배포

**Goal:** Supabase 스키마 확인 + service_role key 설정
**Demo:** After this: Supabase 대시보드에서 19개 테이블 확인 가능

## Tasks
- [x] **T01: Supabase 19개 테이블 + 새 컬럼 모두 확인됨, 모바일 .env 설정 완료** — 1. 19개 테이블 존재 확인 ✔
2. 새 컨럼 존재 확인 ✔
3. service_role key 설정 필요
4. 모바일 .env 설정 완료
  - Estimate: 15min
  - Files: web/.env.local, mobile/.env
  - Verify: node script to query all 19 tables
