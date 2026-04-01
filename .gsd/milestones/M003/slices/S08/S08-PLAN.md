# S08: Supabase Storage + 파일 업로드

**Goal:** Supabase Storage 버킷 생성 SQL 작성 + 스키마 업데이트
**Demo:** After this: 사업자등록증 업로드 → 저장 → 다운로드 확인

## Tasks
- [x] **T01: 5개 Storage 버킷 + policies 마이그레이션 SQL 작성** — supabase/migrations/002_storage_buckets.sql 작성 + schema.sql 업데이트
  - Estimate: 10min
  - Files: supabase/schema.sql, supabase/migrations/002_storage_buckets.sql
  - Verify: cat supabase/migrations/002_storage_buckets.sql | grep 'INSERT INTO storage.buckets'
