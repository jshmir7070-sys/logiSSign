-- 004: RPC 권한 검증 추가
-- approve_amendment_with_period() 함수에 auth.jwt() 기반 권한 검증

CREATE OR REPLACE FUNCTION approve_amendment_with_period(
  p_driver_id UUID,
  p_agency_id UUID,
  p_amendment_id UUID,
  p_effective_date DATE,
  p_period_end DATE,
  p_rate_config JSONB,
  p_memo TEXT DEFAULT ''
) RETURNS VOID AS $$
DECLARE
  v_caller_role TEXT;
  v_caller_agency_id UUID;
BEGIN
  v_caller_role := (auth.jwt()->'app_metadata'->>'role');
  v_caller_agency_id := (auth.jwt()->'app_metadata'->>'agency_id')::uuid;

  IF v_caller_role NOT IN ('agency_admin', 'provider_admin') THEN
    RAISE EXCEPTION '권한이 없습니다';
  END IF;

  IF v_caller_role = 'agency_admin' AND v_caller_agency_id != p_agency_id THEN
    RAISE EXCEPTION '다른 운영사의 데이터에 접근할 수 없습니다';
  END IF;

  UPDATE driver_contract_periods
  SET status = 'expired', period_end = p_effective_date - INTERVAL '1 day', updated_at = now()
  WHERE driver_id = p_driver_id AND status = 'active';

  INSERT INTO driver_contract_periods (agency_id, driver_id, period_start, period_end, rate_config, status, amendment_id, memo)
  VALUES (p_agency_id, p_driver_id, p_effective_date, p_period_end, p_rate_config, 'active', p_amendment_id, p_memo);

  UPDATE contract_amendments SET status = 'approved', approved_at = now(), updated_at = now() WHERE id = p_amendment_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
