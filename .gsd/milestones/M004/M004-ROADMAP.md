# M004: 

## Vision
P1/P2 잔여 이슈를 해결하고, 코드 품질을 높여 안정적인 프로덕션 운영 기반을 마련한다.

## Slice Overview
| ID | Slice | Risk | Depends | Done | After this |
|----|-------|------|---------|------|------------|
| S01 | ESLint 미사용 import 정리 + console 정리 | low | — | ✅ | npx next build 시 ESLint 경고 0건 |
| S02 | SignaturePad 실제 이미지 캡처 | medium | S01 | ✅ | 모바일에서 서명 → 실제 PNG 이미지 → PDF에 삽입 확인 |
| S03 | CSRF 기본 방어 + RPC 함수 권한 검증 | medium | S01 | ⬜ | 외부 사이트에서 API 호출 시 차단 확인 |
| S04 | E2E 핵심 플로우 테스트 | low | S02, S03 | ✅ | npm test 실행 시 핵심 플로우 테스트 통과 |
