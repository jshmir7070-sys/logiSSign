-- 016: 계약서 서명 필드 응답 저장 컬럼
-- PDF 타입 계약서에서 기사가 입력한 필드별 응답(서명/도장/체크/날짜/텍스트)을 저장

ALTER TABLE contracts ADD COLUMN IF NOT EXISTS sign_field_responses JSONB DEFAULT NULL;

COMMENT ON COLUMN contracts.sign_field_responses IS 'PDF 타입 계약서의 서명 필드 응답 (기사 입력값). NULL이면 text 모드';
