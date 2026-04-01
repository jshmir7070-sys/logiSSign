---
estimated_steps: 1
estimated_files: 2
skills_used: []
---

# T01: Storage 버킷 + 정쇅 SQL 작성

supabase/migrations/002_storage_buckets.sql 작성 + schema.sql 업데이트

## Inputs

- None specified.

## Expected Output

- `supabase/migrations/002_storage_buckets.sql`

## Verification

cat supabase/migrations/002_storage_buckets.sql | grep 'INSERT INTO storage.buckets'
