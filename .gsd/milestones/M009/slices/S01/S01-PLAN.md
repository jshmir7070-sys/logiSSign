# S01: 요금제 DB 적용 + 포인트/결제 연동

**Goal:** 포인트 시스템 실가동 + PortOne 카드 결제 연동
**Demo:** After this: 포인트 충전 → 잔액 확인 → 계약서 발송 시 포인트 차감 → 카드 결제

## Tasks
- [x] **T01: DB 마이그레이션 적용 완료 — 포인트 테이블 + 패키지 + 웰컴 보너스** — RUN_THIS_NOW.sql 실행 후 point_balances, point_transactions, point_packages, agencies.plan_type 테이블/컬럼 존재 확인. 웰컴 보너스 5000P 지급 확인.
  - Estimate: 10min
  - Files: supabase/migrations/RUN_THIS_NOW.sql
  - Verify: node 스크립트로 5개 테이블/컬럼 존재 + 잔액 5000P 확인
- [x] **T02: 포인트 API 충전/차감/잔액/거래내역 정상 동작 확인** — GET /api/points?action=balance, transactions, packages 정상 응답 확인. POST /api/points (charge) 테스트. 에러 시 수정.
  - Estimate: 30min
  - Files: web/src/app/api/points/route.ts, web/src/services/point.service.ts
  - Verify: curl로 balance/transactions/packages API 정상 응답
- [x] **T03: BillingTab + 결제/포인트 API 타입 에러 0건 확인** — 설정 > 구독/결제 탭에서 포인트 잔액 표시, 충전 패키지 표시, 카드 등록(PortOne) 동작 확인. 에러 시 수정.
  - Estimate: 30min
  - Files: web/src/components/portal/settings/BillingTab.tsx, web/src/app/api/payment/route.ts
  - Verify: 브라우저에서 BillingTab 정상 렌더 + 포인트 잔액 표시
