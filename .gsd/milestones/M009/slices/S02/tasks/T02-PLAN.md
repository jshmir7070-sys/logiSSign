---
estimated_steps: 1
estimated_files: 1
skills_used: []
---

# T02: 테스트 데이터로 정산 생성 검증

기사 주상하 + 원청사 쿠팡퀵플렉스에 테스트 정산 데이터 생성. 배송 100건 × 단가 계산 → settlements 테이블에 저장 → 금액 검증

## Inputs

- `web/src/services/settlement.service.ts`

## Expected Output

- `정산 레코드 1건`

## Verification

settlements 테이블에 정산 1건 생성, 금액 정상
