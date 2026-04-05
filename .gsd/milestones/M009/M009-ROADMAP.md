# M009: 

## Vision
포인트/결제 시스템 실가동, 정산 전체 플로우 검증, iOS 앱 빌드, 보안 취약점 점검까지 완료하여 서비스 런칭 준비를 마친다.

## Slice Overview
| ID | Slice | Risk | Depends | Done | After this |
|----|-------|------|---------|------|------------|
| S01 | 요금제 DB 적용 + 포인트/결제 연동 | high | — | ⬜ | 포인트 충전 → 잔액 확인 → 계약서 발송 시 포인트 차감 → 카드 결제 |
| S02 | 정산 E2E 검증 | high | S01 | ⬜ | 엑셀 업로드 → 자동 정산 → PDF 생성 → 기사 앱에서 정산서 확인 |
| S03 | iOS EAS Build + TestFlight | medium | — | ⬜ | TestFlight에서 iOS 앱 설치 + 로그인 + 계약서 확인 |
| S04 | 보안 점검 + 성능 최적화 | medium | S01, S02 | ⬜ | 보안 점검 리포트 + API 응답시간 < 500ms |
