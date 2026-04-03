# S03: 민감 데이터 접근 감사 로그 강화 — UAT

**Milestone:** M007
**Written:** 2026-04-02T20:40:44.412Z

## UAT: 감사 로그\n\n### 테스트 시나리오\n1. logPiiAccess() 호출 → security_logs에 pii_access 이벤트 생성\n2. admin audit-log 페이지 → PII 접근 필터 클릭 → pii_access 이벤트만 표시\n3. logDataModification() 호출 → security_logs에 data_modification 이벤트 + changes 상세
