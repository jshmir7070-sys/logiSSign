# Backup And Recovery

## 1. Purpose

- Define the automated backup flow for the production database.
- Define a repeatable recovery procedure for incidents and restore drills.

## 2. Automated backup

- Workflow: [supabase-backup.yml](/C:/Users/jshmi/Downloads/logiSSign/.github/workflows/supabase-backup.yml)
- Schedule: daily at 03:05 KST
- Backup format: `pg_dump --format=custom`
- Retention: GitHub artifact for 30 days

## 3. Required GitHub secrets

- `SUPABASE_DB_URL`
  - PostgreSQL connection string
- `BACKUP_ARCHIVE_PASSWORD`
  - Encryption password for the backup artifact

## 4. Recovery procedure

1. Download the latest `backup.dump` or `backup.dump.enc` artifact from GitHub Actions.
2. If the file is encrypted, decrypt it:

```bash
openssl enc -d -aes-256-cbc -pbkdf2 -in backup.dump.enc -out backup.dump -pass env:BACKUP_ARCHIVE_PASSWORD
```

3. Restore the database:

```bash
pg_restore --clean --if-exists --no-owner --no-privileges --dbname "$SUPABASE_DB_URL" backup.dump
```

## 5. Recovery targets

- RPO: within 24 hours
- RTO: within 4 hours

## 6. Operations checklist

- Run a restore drill at least once per month
- Record at least one full restore rehearsal per quarter
- Re-run the backup workflow immediately after rotating backup secrets
