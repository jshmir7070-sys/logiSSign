# logiSSign Deployment Guide

## 1. Pre-deploy checklist

- `web` build passes
- `mobile` type check passes
- Supabase migrations are applied
- Vercel environment variables are configured
- GitHub Actions secrets are configured

## 2. Supabase migration order

### Recommended approach

1. Initialize the base schema from [schema.sql](/C:/Users/jshmi/Downloads/logiSSign/supabase/schema.sql).
2. Apply files in [supabase/migrations](/C:/Users/jshmi/Downloads/logiSSign/supabase/migrations) in filename order.
3. Do not use ad-hoc SQL files as a substitute for the ordered migrations in production.

### Apply in this order

1. [schema.sql](/C:/Users/jshmi/Downloads/logiSSign/supabase/schema.sql)
2. [002_storage_buckets.sql](/C:/Users/jshmi/Downloads/logiSSign/supabase/migrations/002_storage_buckets.sql)
3. [003_security_hardening.sql](/C:/Users/jshmi/Downloads/logiSSign/supabase/migrations/003_security_hardening.sql)
4. [004_rpc_auth.sql](/C:/Users/jshmi/Downloads/logiSSign/supabase/migrations/004_rpc_auth.sql)
5. [005_settlement_builder.sql](/C:/Users/jshmi/Downloads/logiSSign/supabase/migrations/005_settlement_builder.sql)
6. [006_rls_complete.sql](/C:/Users/jshmi/Downloads/logiSSign/supabase/migrations/006_rls_complete.sql)
7. [007_pii_audit_log.sql](/C:/Users/jshmi/Downloads/logiSSign/supabase/migrations/007_pii_audit_log.sql)
8. [008_agency_logo.sql](/C:/Users/jshmi/Downloads/logiSSign/supabase/migrations/008_agency_logo.sql)
9. [009_plan_configs.sql](/C:/Users/jshmi/Downloads/logiSSign/supabase/migrations/009_plan_configs.sql)
10. [010_pii_encryption_policy.sql](/C:/Users/jshmi/Downloads/logiSSign/supabase/migrations/010_pii_encryption_policy.sql)
11. [011_agency_logo_url.sql](/C:/Users/jshmi/Downloads/logiSSign/supabase/migrations/011_agency_logo_url.sql)
12. [011_fix_rls_user_metadata_to_app_metadata.sql](/C:/Users/jshmi/Downloads/logiSSign/supabase/migrations/011_fix_rls_user_metadata_to_app_metadata.sql)
13. [012_fix_missing_rls_policies.sql](/C:/Users/jshmi/Downloads/logiSSign/supabase/migrations/012_fix_missing_rls_policies.sql)
14. [013_contract_template_fields.sql](/C:/Users/jshmi/Downloads/logiSSign/supabase/migrations/013_contract_template_fields.sql)
15. [014_point_system.sql](/C:/Users/jshmi/Downloads/logiSSign/supabase/migrations/014_point_system.sql)
16. [015_security_and_schema_fixes.sql](/C:/Users/jshmi/Downloads/logiSSign/supabase/migrations/015_security_and_schema_fixes.sql)
17. [016_contract_sign_field_responses.sql](/C:/Users/jshmi/Downloads/logiSSign/supabase/migrations/016_contract_sign_field_responses.sql)
18. [017_fix_rls_security.sql](/C:/Users/jshmi/Downloads/logiSSign/supabase/migrations/017_fix_rls_security.sql)
19. [018_fix_audit_log_rls.sql](/C:/Users/jshmi/Downloads/logiSSign/supabase/migrations/018_fix_audit_log_rls.sql)
20. [019_privacy_security_hardening.sql](/C:/Users/jshmi/Downloads/logiSSign/supabase/migrations/019_privacy_security_hardening.sql)
21. [020_driver_code_matching.sql](/C:/Users/jshmi/Downloads/logiSSign/supabase/migrations/020_driver_code_matching.sql)
22. [021_agency_payment_orders.sql](/C:/Users/jshmi/Downloads/logiSSign/supabase/migrations/021_agency_payment_orders.sql)
23. [022_admin_console_settings.sql](/C:/Users/jshmi/Downloads/logiSSign/supabase/migrations/022_admin_console_settings.sql)
24. [023_runtime_security_controls.sql](/C:/Users/jshmi/Downloads/logiSSign/supabase/migrations/023_runtime_security_controls.sql)

### Security-critical migration

[023_runtime_security_controls.sql](/C:/Users/jshmi/Downloads/logiSSign/supabase/migrations/023_runtime_security_controls.sql) is required to enable:

- DB-backed rate limiting
- `rate_limit_counters`
- `check_rate_limit(...)` RPC

If this migration is not applied, the app falls back to in-memory rate limiting only.

## 3. Required Vercel environment variables

Set these in `Project Settings -> Environment Variables`.

### Core app

- `NEXT_PUBLIC_SUPABASE_URL`
- `NEXT_PUBLIC_SUPABASE_ANON_KEY`
- `SUPABASE_SERVICE_ROLE_KEY`
- `NEXT_PUBLIC_APP_URL`
- `CRON_SECRET`
- `MFA_HMAC_SECRET`
- `SESSION_IDLE_TIMEOUT_MS`
- `RATE_LIMIT_BACKEND`

### PortOne

- `NEXT_PUBLIC_PORTONE_STORE_ID`
- `NEXT_PUBLIC_PORTONE_CHANNEL_KEY`
- `PORTONE_API_SECRET`
- `PORTONE_V2_SECRET`

### Messaging

- `SOLAPI_API_KEY`
- `SOLAPI_API_SECRET`
- `SOLAPI_SENDER_PHONE`
- `RESEND_API_KEY`
- `ADMIN_PHONE`

### AI and monitoring

- `OPENAI_API_KEY`
- `NEXT_PUBLIC_SENTRY_DSN`
- `SENTRY_ORG`
- `SENTRY_PROJECT`
- `SENTRY_AUTH_TOKEN`

## 4. GitHub Actions secrets

See [GITHUB_SECRETS_SETUP.md](/C:/Users/jshmi/Downloads/logiSSign/docs/GITHUB_SECRETS_SETUP.md) for the full list.

### `security-audit.yml`

No extra secret is required beyond normal repository access.

### `supabase-backup.yml`

- `SUPABASE_DB_URL`
- `BACKUP_ARCHIVE_PASSWORD`

## 5. Recommended defaults

- `SESSION_IDLE_TIMEOUT_MS=1800000`
- `RATE_LIMIT_BACKEND=supabase`

## 6. Post-deploy checks

```bash
curl https://logissign.com/api/health
curl -I https://logissign.com
```

Verify:

- `x-request-id` header is present
- security headers are present
- API routes respond normally
- protected cron routes stay protected

## 7. Operational follow-up

- review the weekly `security-audit` workflow result
- test backup restore at least once per month
- confirm the latest migration was applied after each deploy
