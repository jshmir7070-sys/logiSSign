---
estimated_steps: 4
estimated_files: 2
skills_used: []
---

# T01: 감사 로그 강화 + audit-log 페이지 데이터 연결

1. security-logger.ts에 PII 접근 로깅 함수 추가
2. driver.service.ts, settlement.service.ts 등에서 은행계좌 조회/수정 시 로그 호출
3. audit-log 페이지에 security_logs 조회 연결
4. build + test 확인

## Inputs

- `web/src/lib/security-logger.ts`
- `supabase/schema.sql`

## Expected Output

- `web/src/lib/security-logger.ts (확장)`
- `web/src/app/admin/(dashboard)/audit-log/page.tsx (수정)`

## Verification

build 성공 + logPiiAccess 함수 존재 + audit-log 페이지에서 security_logs 조회
