-- RLS 보안 수정: FOR ALL USING(true) 정책을 service_role 전용으로 변경
-- point_transactions_service와 point_balances_service는 
-- service_role에서만 사용되므로 제거하고, service_role은 RLS를 우회하므로 별도 정책 불필요

-- point_transactions: service 정책 제거 (service_role은 RLS 자동 우회)
DROP POLICY IF EXISTS point_transactions_service ON point_transactions;

-- point_balances: service 정책 제거
DROP POLICY IF EXISTS point_balances_service ON point_balances;

-- agencies: provider_admin 정책이 이미 있으므로 추가 불필요
-- 확인: agencies_own과 agencies_provider_admin만 존재해야 함

-- subscriptions: 이미 agency 정책 있음 — 추가 확인
-- principals: agency 정책 있음

SELECT 'RLS 보안 정책 수정 완료' AS result;
