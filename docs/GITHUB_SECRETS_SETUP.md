# GitHub Secrets Setup

## 1. Purpose

This document lists the repository secrets required for automated security checks, backups, and build-time integrations.

## 2. Where to add them

GitHub repository ->
`Settings` ->
`Secrets and variables` ->
`Actions`

## 3. Required secrets

### For backup workflow

Used by [supabase-backup.yml](/C:/Users/jshmi/Downloads/logiSSign/.github/workflows/supabase-backup.yml)

- `SUPABASE_DB_URL`
  - PostgreSQL connection string
  - Example: `postgresql://USER:PASSWORD@HOST:5432/postgres`

- `BACKUP_ARCHIVE_PASSWORD`
  - Password used to encrypt backup artifacts
  - Recommend 32+ characters

### For Sentry source map upload

- `SENTRY_AUTH_TOKEN`
- `SENTRY_ORG`
- `SENTRY_PROJECT`

## 4. Recommended secrets

- `CRON_SECRET`
- `MFA_HMAC_SECRET`
- `PORTONE_API_SECRET`
- `PORTONE_V2_SECRET`
- `SOLAPI_API_SECRET`
- `RESEND_API_KEY`
- `OPENAI_API_KEY`

## 5. Verification steps

1. Add the secrets.
2. Run `security-audit.yml` manually once.
3. Run `supabase-backup.yml` manually once.
4. Confirm a backup artifact is generated.
5. Confirm Vercel env vars and GitHub secrets do not drift apart.

## 6. Notes

- Never commit `.env.local`, `.env`, or production env files.
- Do not put real secrets into `NEXT_PUBLIC_*` variables.
- Restrict database credentials to the backup workflow only.
