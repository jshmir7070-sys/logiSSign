# S04: 보안 점검 + 성능 최적화

**Goal:** OWASP Top 10 기준 보안 점검 + RLS 전수 검증 + API 성능 체크
**Demo:** After this: 보안 점검 리포트 + API 응답시간 < 500ms

## Tasks
- [x] **T01: API 인증 17개 전수 테스트 통과 — 비인증 시 401** — 인증 없이 보호된 API 호출 시 401/403 반환 확인. CSRF 차단 확인. 공개 API는 200 확인.
  - Estimate: 15min
  - Files: web/src/middleware.ts, web/src/lib/csrf.ts
  - Verify: 보호된 API 전체 401/403 반환
- [x] **T02: RLS 검증 — 9/13 통과, 4개 위반 발견 → 수정 SQL 작성** — drivers, settlements, contracts 등 주요 테이블에 RLS 활성화 확인. anon key로 조회 시 0건 반환 확인.
  - Estimate: 10min
  - Files: supabase/schema.sql
  - Verify: 주요 테이블 anon 조회 0건
- [x] **T03: API 응답시간 전체 < 300ms 확인** — 주요 API 응답시간 측정. < 500ms 확인.
  - Estimate: 10min
  - Verify: 주요 API 응답시간 < 500ms
