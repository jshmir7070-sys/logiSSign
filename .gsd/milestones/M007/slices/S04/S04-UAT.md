# S04: service_role 사용 감사 + 최소화 — UAT

**Milestone:** M007
**Written:** 2026-04-02T20:43:26.921Z

## UAT: service_role 감사\n\n1. grep NEXT_PUBLIC.*SERVICE_ROLE → 0건\n2. sms/invite에서 SUPABASE_SERVICE_ROLE_KEY 미설정 시 → 에러 (anon fallback 없음)\n3. 모든 service_role 사용이 API route/service 파일에만 존재
