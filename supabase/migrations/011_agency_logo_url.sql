-- ============================================================
-- 011: agencies.logo_url 컬럼 추가
-- Supabase 대시보드 SQL Editor에서 실행
-- ============================================================

ALTER TABLE agencies ADD COLUMN IF NOT EXISTS logo_url TEXT;

COMMENT ON COLUMN agencies.logo_url IS '운영사 로고 이미지 URL (Storage signed URL)';
