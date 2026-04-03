# S04: service_role 사용 감사 + 최소화

**Goal:** 10개 API 라우트의 service_role 사용을 감사하고, 불필요한 사용을 anon key로 전환
**Demo:** After this: service_role 사용처 목록 + 각각의 필요성 판단 + 불필요한 사용 제거

## Tasks
- [x] **T01: service_role 16개 사용처 감사 + sms/invite anon key fallback 제거** — 1. service_role 사용 10개 라우트 리스트업
2. 각 사용의 필요성 판단 (RLS 우회 필요 vs 불필요)
3. 불필요한 곳 전환 + 필요한 곳 주석 문서화
4. NEXT_PUBLIC_ 환경변수에 service_role 미노출 확인
5. build 확인
  - Estimate: 20min
  - Files: web/src/lib/supabase.ts, web/src/app/api/*/route.ts
  - Verify: build 성공 + NEXT_PUBLIC_*에 service_role 미노출
