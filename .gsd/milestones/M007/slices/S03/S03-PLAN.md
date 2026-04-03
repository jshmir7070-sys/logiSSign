# S03: 민감 데이터 접근 감사 로그 강화

**Goal:** PII 접근(은행계좌, 주민번호, 연락처) 시 자동 감사 기록 + audit-log 페이지 데이터 연결
**Demo:** After this: 은행 계좌 조회/수정 시 security_logs에 감사 기록 생성, 관리자 페이지에서 조회

## Tasks
- [x] **T01: PII 접근 감사 함수 + pii_access 이벤트 타입 + audit-log 필터 추가** — 1. security-logger.ts에 PII 접근 로깅 함수 추가
2. driver.service.ts, settlement.service.ts 등에서 은행계좌 조회/수정 시 로그 호출
3. audit-log 페이지에 security_logs 조회 연결
4. build + test 확인
  - Estimate: 25min
  - Files: web/src/lib/security-logger.ts, web/src/app/admin/(dashboard)/audit-log/page.tsx
  - Verify: build 성공 + logPiiAccess 함수 존재 + audit-log 페이지에서 security_logs 조회
