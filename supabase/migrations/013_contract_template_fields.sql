-- 013: 계약서 템플릿 PDF 업로드 + 필드 배치 지원
-- 모두싸인 방식: PDF 위에 서명/도장/텍스트/체크/날짜 필드 드래그앤드롭

-- 1. contract_templates 확장
ALTER TABLE contract_templates ADD COLUMN IF NOT EXISTS template_type TEXT DEFAULT 'text'
  CHECK (template_type IN ('text', 'pdf'));
ALTER TABLE contract_templates ADD COLUMN IF NOT EXISTS template_pdf_url TEXT;
ALTER TABLE contract_templates ADD COLUMN IF NOT EXISTS sign_fields JSONB DEFAULT '[]';

-- 2. contracts 테이블에도 PDF + 필드 정보 저장 (전송 시점 스냅샷)
ALTER TABLE contracts ADD COLUMN IF NOT EXISTS template_type TEXT DEFAULT 'text';
ALTER TABLE contracts ADD COLUMN IF NOT EXISTS template_pdf_url TEXT;
ALTER TABLE contracts ADD COLUMN IF NOT EXISTS sign_fields JSONB DEFAULT '[]';

-- 3. contract_signatures에 필드별 응답 저장
ALTER TABLE contract_signatures ADD COLUMN IF NOT EXISTS field_responses JSONB DEFAULT '[]';
