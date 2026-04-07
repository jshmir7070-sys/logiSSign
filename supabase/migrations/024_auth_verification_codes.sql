CREATE TABLE IF NOT EXISTS auth_verification_codes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  verification_key TEXT NOT NULL,
  purpose TEXT NOT NULL,
  phone TEXT NOT NULL,
  code_hash TEXT NOT NULL,
  payload JSONB NOT NULL DEFAULT '{}'::jsonb,
  attempts INTEGER NOT NULL DEFAULT 0,
  max_attempts INTEGER NOT NULL DEFAULT 5,
  expires_at TIMESTAMPTZ NOT NULL,
  resend_available_at TIMESTAMPTZ NOT NULL,
  verified_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (verification_key, purpose)
);

CREATE INDEX IF NOT EXISTS idx_auth_verification_codes_expiry
  ON auth_verification_codes (expires_at);

CREATE OR REPLACE FUNCTION update_auth_verification_codes_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_auth_verification_codes_updated_at ON auth_verification_codes;
CREATE TRIGGER trg_auth_verification_codes_updated_at
BEFORE UPDATE ON auth_verification_codes
FOR EACH ROW
EXECUTE FUNCTION update_auth_verification_codes_updated_at();
