CREATE TABLE IF NOT EXISTS admin_checklist_states (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  scope_type TEXT NOT NULL CHECK (scope_type IN ('team', 'user')),
  scope_key TEXT NOT NULL,
  value JSONB NOT NULL DEFAULT '{}'::jsonb,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  UNIQUE (scope_type, scope_key)
);

CREATE INDEX IF NOT EXISTS idx_admin_checklist_states_scope
  ON admin_checklist_states(scope_type, scope_key);

ALTER TABLE admin_checklist_states ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS admin_checklist_states_provider_admin_select ON admin_checklist_states;
CREATE POLICY admin_checklist_states_provider_admin_select ON admin_checklist_states
  FOR SELECT
  USING ((auth.jwt() -> 'app_metadata' ->> 'role') = 'provider_admin');

DROP POLICY IF EXISTS admin_checklist_states_provider_admin_update ON admin_checklist_states;
CREATE POLICY admin_checklist_states_provider_admin_update ON admin_checklist_states
  FOR ALL
  USING ((auth.jwt() -> 'app_metadata' ->> 'role') = 'provider_admin')
  WITH CHECK ((auth.jwt() -> 'app_metadata' ->> 'role') = 'provider_admin');
