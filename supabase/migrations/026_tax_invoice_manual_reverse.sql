-- 026: tax_invoices invoice_type check 확장
-- 수기 역발행(manual_reverse)을 세금계산서 관리 화면에서 저장할 수 있도록 허용

ALTER TABLE tax_invoices DROP CONSTRAINT IF EXISTS tax_invoices_invoice_type_check;

ALTER TABLE tax_invoices
  ADD CONSTRAINT tax_invoices_invoice_type_check
  CHECK (invoice_type IN ('tax', 'cash_receipt', 'none', 'vat_invoice', 'withholding_3_3', 'manual_reverse'));
