-- ═══════════════════════════════════════════
-- Supabase Storage Buckets Migration
-- Run this in Supabase SQL Editor to create storage buckets
-- ═══════════════════════════════════════════

-- 계약서 PDF (서명 완료 PDF, 감사추적인증서)
INSERT INTO storage.buckets (id, name, public) VALUES ('contracts', 'contracts', true)
  ON CONFLICT (id) DO NOTHING;

-- 문서 파일 (사업자등록증, 첨부 서류)
INSERT INTO storage.buckets (id, name, public) VALUES ('documents', 'documents', true)
  ON CONFLICT (id) DO NOTHING;

-- 교육 이수증 PDF
INSERT INTO storage.buckets (id, name, public) VALUES ('education', 'education', true)
  ON CONFLICT (id) DO NOTHING;

-- 도장 이미지
INSERT INTO storage.buckets (id, name, public) VALUES ('seals', 'seals', true)
  ON CONFLICT (id) DO NOTHING;

-- 정산서 (비공개 — 인증 필요)
INSERT INTO storage.buckets (id, name, public) VALUES ('settlements', 'settlements', false)
  ON CONFLICT (id) DO NOTHING;

-- ═══════════════════════════════════════════
-- Storage Policies
-- 인증된 계정만 업로드, public 버킷은 누구나 다운로드
-- ═══════════════════════════════════════════

-- contracts
CREATE POLICY "storage_contracts_select" ON storage.objects FOR SELECT USING (bucket_id = 'contracts');
CREATE POLICY "storage_contracts_insert" ON storage.objects FOR INSERT WITH CHECK (bucket_id = 'contracts' AND auth.role() = 'authenticated');

-- documents
CREATE POLICY "storage_documents_select" ON storage.objects FOR SELECT USING (bucket_id = 'documents');
CREATE POLICY "storage_documents_insert" ON storage.objects FOR INSERT WITH CHECK (bucket_id = 'documents' AND auth.role() = 'authenticated');

-- education
CREATE POLICY "storage_education_select" ON storage.objects FOR SELECT USING (bucket_id = 'education');
CREATE POLICY "storage_education_insert" ON storage.objects FOR INSERT WITH CHECK (bucket_id = 'education' AND auth.role() = 'authenticated');

-- seals
CREATE POLICY "storage_seals_select" ON storage.objects FOR SELECT USING (bucket_id = 'seals');
CREATE POLICY "storage_seals_insert" ON storage.objects FOR INSERT WITH CHECK (bucket_id = 'seals' AND auth.role() = 'authenticated');

-- settlements (비공개 — 인증 계정만 접근)
CREATE POLICY "storage_settlements_select" ON storage.objects FOR SELECT USING (bucket_id = 'settlements' AND auth.role() = 'authenticated');
CREATE POLICY "storage_settlements_insert" ON storage.objects FOR INSERT WITH CHECK (bucket_id = 'settlements' AND auth.role() = 'authenticated');
