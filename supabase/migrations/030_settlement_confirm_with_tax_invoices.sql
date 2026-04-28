-- 030: 정산 확정과 세금계산서 생성을 단일 Postgres 트랜잭션에서 처리
--
-- 이전: 라우트(/api/settlements/confirm)가 두 번의 RPC 호출(UPDATE settlements
-- + UPSERT tax_invoices)을 수행하면서 두 번째 호출 실패 시 첫 번째를
-- 보상 트랜잭션으로 되돌렸다. Postgres 함수로 옮기면 둘이 한 트랜잭션 안에서
-- 실행되어 어느 한쪽이 실패하면 자연스럽게 모두 롤백된다(진짜 원자성).

-- (1) tax_invoices.settlement_id 부분 유니크 인덱스 — UPSERT의 ON CONFLICT 타깃
-- manual_reverse 처럼 정산이 없는 케이스가 있을 수 있어 NULL은 허용한다.
CREATE UNIQUE INDEX IF NOT EXISTS tax_invoices_settlement_id_unique
  ON public.tax_invoices (settlement_id)
  WHERE settlement_id IS NOT NULL;

-- (2) 단일 트랜잭션 RPC
CREATE OR REPLACE FUNCTION public.confirm_settlements_with_tax_invoices(
  p_agency_id uuid,
  p_settlement_ids uuid[]
)
RETURNS TABLE (
  confirmed_count integer,
  tax_invoices_count integer
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_confirmed_count integer;
  v_tax_invoices_count integer;
BEGIN
  -- 정산 행을 confirmed로 갱신하면서 RETURNING으로 받아 임시 CTE에 저장
  WITH confirmed AS (
    UPDATE public.settlements
    SET status = 'confirmed'
    WHERE id = ANY(p_settlement_ids)
      AND agency_id = p_agency_id
      AND status = 'sent'
    RETURNING id, driver_id, year_month, net_amount, is_business_owner, vat_included
  ),
  invoices AS (
    INSERT INTO public.tax_invoices (
      agency_id,
      settlement_id,
      driver_id,
      year_month,
      supply_amount,
      tax_amount,
      total_amount,
      invoice_type,
      status
    )
    SELECT
      p_agency_id,
      c.id,
      c.driver_id,
      c.year_month,
      -- supply_amount
      CASE
        WHEN c.is_business_owner AND c.vat_included
          THEN ROUND(c.net_amount::numeric / 1.1)::int
        ELSE c.net_amount
      END AS supply_amount,
      -- tax_amount
      CASE
        WHEN c.is_business_owner AND c.vat_included
          THEN c.net_amount - ROUND(c.net_amount::numeric / 1.1)::int
        WHEN c.is_business_owner
          THEN ROUND(c.net_amount::numeric * 0.1)::int
        ELSE
          ROUND(c.net_amount::numeric * 0.033)::int
      END AS tax_amount,
      -- total_amount
      CASE
        WHEN c.is_business_owner AND c.vat_included
          THEN c.net_amount
        WHEN c.is_business_owner
          THEN c.net_amount + ROUND(c.net_amount::numeric * 0.1)::int
        ELSE
          c.net_amount - ROUND(c.net_amount::numeric * 0.033)::int
      END AS total_amount,
      CASE WHEN c.is_business_owner THEN 'vat_invoice' ELSE 'withholding_3_3' END AS invoice_type,
      CASE WHEN c.is_business_owner THEN 'pending' ELSE 'issued' END AS status
    FROM confirmed c
    ON CONFLICT (settlement_id) WHERE settlement_id IS NOT NULL
    DO UPDATE SET
      driver_id = EXCLUDED.driver_id,
      year_month = EXCLUDED.year_month,
      supply_amount = EXCLUDED.supply_amount,
      tax_amount = EXCLUDED.tax_amount,
      total_amount = EXCLUDED.total_amount,
      invoice_type = EXCLUDED.invoice_type,
      status = EXCLUDED.status
    RETURNING id
  )
  SELECT
    (SELECT COUNT(*) FROM confirmed)::int,
    (SELECT COUNT(*) FROM invoices)::int
  INTO v_confirmed_count, v_tax_invoices_count;

  RETURN QUERY SELECT v_confirmed_count, v_tax_invoices_count;
END;
$$;

GRANT EXECUTE ON FUNCTION public.confirm_settlements_with_tax_invoices(uuid, uuid[]) TO service_role;

COMMENT ON FUNCTION public.confirm_settlements_with_tax_invoices IS
  '정산을 sent → confirmed로 일괄 갱신하면서 같은 트랜잭션에서 세금계산서를 생성/갱신한다. 어느 단계든 실패하면 전체 롤백.';
