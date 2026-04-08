CREATE TABLE IF NOT EXISTS tax_invoice_send_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tax_invoice_id UUID NOT NULL REFERENCES tax_invoices(id) ON DELETE CASCADE,
  agency_id UUID NOT NULL REFERENCES agencies(id) ON DELETE CASCADE,
  driver_id UUID REFERENCES drivers(id) ON DELETE SET NULL,
  channel TEXT NOT NULL CHECK (channel IN ('push', 'sms', 'none')) DEFAULT 'none',
  success BOOLEAN NOT NULL DEFAULT false,
  reason TEXT,
  sent_by_user_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE tax_invoice_send_logs ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS tax_invoice_send_logs_agency_read ON tax_invoice_send_logs;
CREATE POLICY tax_invoice_send_logs_agency_read
  ON tax_invoice_send_logs
  FOR SELECT
  USING (agency_id = (auth.jwt()->'app_metadata'->>'agency_id')::uuid);

DROP POLICY IF EXISTS tax_invoice_send_logs_driver_read ON tax_invoice_send_logs;
CREATE POLICY tax_invoice_send_logs_driver_read
  ON tax_invoice_send_logs
  FOR SELECT
  USING (driver_id IN (SELECT id FROM drivers WHERE user_id = auth.uid()));

CREATE INDEX IF NOT EXISTS idx_tax_invoice_send_logs_invoice_created
  ON tax_invoice_send_logs(tax_invoice_id, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_tax_invoice_send_logs_agency_created
  ON tax_invoice_send_logs(agency_id, created_at DESC);
