---
estimated_steps: 1
estimated_files: 1
skills_used: []
---

# T01: DB 마이그레이션 적용 확인

RUN_THIS_NOW.sql 실행 후 point_balances, point_transactions, point_packages, agencies.plan_type 테이블/컬럼 존재 확인. 웰컴 보너스 5000P 지급 확인.

## Inputs

- `supabase/migrations/RUN_THIS_NOW.sql`

## Expected Output

- `DB 마이그레이션 적용 완료 확인 로그`

## Verification

node 스크립트로 5개 테이블/컬럼 존재 + 잔액 5000P 확인
