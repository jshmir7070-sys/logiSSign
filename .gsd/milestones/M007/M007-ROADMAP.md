# M007: 

## Vision
모든 테이블에 RLS 정책을 적용하고, API 입력 검증을 Zod 스키마로 통일하며, 민감 데이터 접근 감사 로그를 완성하여 프로덕션 수준의 보안 기반을 확보한다.

## Slice Overview
| ID | Slice | Risk | Depends | Done | After this |
|----|-------|------|---------|------|------------|
| S01 | RLS 누락 테이블 정책 완전 적용 | high | — | ✅ | migration SQL 실행 후 모든 33+ 테이블에 RLS + 정책 존재 확인 |
| S02 | API 라우트 Zod 입력 검증 통일 | medium | S01 | ✅ | 잘못된 입력으로 API 호출 시 400 + 구체적 에러 메시지 반환 |
| S03 | 민감 데이터 접근 감사 로그 강화 | medium | S01 | ✅ | 은행 계좌 조회/수정 시 security_logs에 감사 기록 생성, 관리자 페이지에서 조회 |
| S04 | service_role 사용 감사 + 최소화 | medium | — | ✅ | service_role 사용처 목록 + 각각의 필요성 판단 + 불필요한 사용 제거 |
| S05 | 보안 테스트 추가 | low | S01, S02, S03, S04 | ✅ | npm test 실행 시 보안 관련 테스트 10건+ 통과 |
