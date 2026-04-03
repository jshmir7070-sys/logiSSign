-- ═══════════════════════════════════════════
-- 008: agencies 로고 URL 컬럼 추가
-- ═══════════════════════════════════════════

ALTER TABLE agencies ADD COLUMN IF NOT EXISTS logo_url TEXT;
