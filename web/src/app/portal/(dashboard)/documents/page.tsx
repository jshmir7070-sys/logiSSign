'use client';

import { useEffect, useState, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { createBrowserSupabaseClient } from '@/lib/supabase';
import Badge from '@/components/shared/Badge';
import { getPlanLimits, isPaidPlan, PLAN_LABELS, type PlanType } from '@/lib/plan-limits';

interface DocumentFile {
  id: string;
  agency_id: string;
  title: string;
  file_url: string;
  status: string;
  field_count: number;
  created_at: string;
}

export default function DocumentsPage() {
  const router = useRouter();
  const [documents, setDocuments] = useState<DocumentFile[]>([]);
  const [loading, setLoading] = useState(true);
  const [agencyId, setAgencyId] = useState<string | null>(null);
  const [uploading, setUploading] = useState(false);
  const [showUpload, setShowUpload] = useState(false);
  const [uploadTitle, setUploadTitle] = useState('');
  const [uploadFile, setUploadFile] = useState<File | null>(null);
  const [userPlan, setUserPlan] = useState<string>('free');

  const loadDocuments = useCallback(async (aid: string) => {
    const supabase = createBrowserSupabaseClient();
    const { data } = await supabase
      .from('document_files')
      .select('*')
      .eq('agency_id', aid)
      .order('created_at', { ascending: false });

    if (data) {
      // 각 문서의 필드 수 조회
      const docs: DocumentFile[] = [];
      for (const doc of data) {
        const { count } = await supabase
          .from('document_sign_fields')
          .select('id', { count: 'exact', head: true })
          .eq('document_file_id', doc.id);
        docs.push({ ...doc, field_count: count ?? 0 } as DocumentFile);
      }
      setDocuments(docs);
    }
    setLoading(false);
  }, []);

  useEffect(() => {
    (async () => {
      const supabase = createBrowserSupabaseClient();
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;
      const aid = user.app_metadata?.agency_id as string | undefined;
      if (!aid) return;
      setAgencyId(aid);
      setUserPlan(user.app_metadata?.plan as string ?? 'free');
      await loadDocuments(aid);
    })();
  }, [loadDocuments]);

  const handleUpload = async () => {
    if (!agencyId || !uploadFile || !uploadTitle.trim()) return;
    setUploading(true);

    const supabase = createBrowserSupabaseClient();

    // 1. Storage에 PDF 업로드
    const fileName = `documents/${agencyId}/${Date.now()}_${uploadFile.name}`;
    const { error: storageErr } = await supabase.storage
      .from('documents')
      .upload(fileName, uploadFile, { contentType: 'application/pdf' });

    if (storageErr) {
      alert('파일 업로드 실패: ' + storageErr.message);
      setUploading(false);
      return;
    }

    const { data: urlData } = supabase.storage.from('documents').getPublicUrl(fileName);
    const fileUrl = urlData?.publicUrl ?? '';

    // 2. document_files 테이블에 레코드 생성
    const { data: doc, error: insertErr } = await supabase
      .from('document_files')
      .insert({
        agency_id: agencyId,
        title: uploadTitle.trim(),
        file_url: fileUrl,
        file_name: uploadFile.name,
        file_size: uploadFile.size,
        mime_type: 'application/pdf',
        status: 'draft',
      })
      .select()
      .single();

    setUploading(false);

    if (insertErr || !doc) {
      alert('문서 등록 실패: ' + (insertErr?.message ?? ''));
      return;
    }

    // 3. 필드 에디터로 이동
    setShowUpload(false);
    setUploadTitle('');
    setUploadFile(null);
    router.push(`/portal/documents/field-editor?docId=${doc.id}`);
  };

  const handleDelete = async (id: string, title: string) => {
    if (!confirm(`"${title}" 문서를 삭제하시겠습니까?`)) return;
    const supabase = createBrowserSupabaseClient();
    await supabase.from('document_sign_fields').delete().eq('document_file_id', id);
    await supabase.from('document_files').delete().eq('id', id);
    setDocuments(prev => prev.filter(d => d.id !== id));
  };

  const statusLabel = (s: string) => {
    const map: Record<string, string> = { draft: '작성중', ready: '준비완료', sent: '발송됨' };
    return map[s] ?? s;
  };

  const statusVariant = (s: string): 'warning' | 'success' | 'info' | 'default' => {
    const map: Record<string, 'warning' | 'success' | 'info'> = { draft: 'warning', ready: 'success', sent: 'info' };
    return map[s] ?? 'default';
  };

  const inputCls = 'w-full h-11 px-4 rounded-xl bg-surface-container-low text-on-surface text-sm font-korean focus:outline-none focus:ring-2 focus:ring-primary/30 placeholder:text-on-surface-variant/40';

  return (
    <div className="space-y-8">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-headline font-bold text-on-surface font-korean">외부 문서 관리</h1>
          <p className="mt-1 text-sm text-on-surface-variant font-korean">
            PDF 문서를 업로드하고, 서명/체크 필드를 배치한 뒤 기사에게 전송합니다
          </p>
        </div>
        {(() => {
          const limits = getPlanLimits(userPlan);
          const canUpload = documents.length < limits.maxUploadTemplates;
          const paid = isPaidPlan(userPlan as PlanType);

          if (!paid) {
            return (
              <button
                onClick={() => alert('외부문서 기능은 유료 플랜(Basic 이상)에서 사용할 수 있습니다.\n\n설정 → 구독/결제에서 플랜을 변경하세요.')}
                className="h-10 px-5 rounded-xl border border-amber-400/50 bg-amber-50 text-amber-700 font-label text-sm font-semibold hover:bg-amber-100 transition-all flex items-center gap-2 font-korean"
              >
                ⬆ 플랜 업그레이드
              </button>
            );
          }
          if (!canUpload) {
            return (
              <button
                onClick={() => alert(`현재 ${PLAN_LABELS[userPlan as PlanType]} 플랜의 외부문서 한도(${limits.maxUploadTemplates}개)를 초과했습니다.\n\n더 많은 문서를 업로드하려면 상위 플랜으로 업그레이드하세요.\n\n설정 → 구독/결제에서 플랜을 변경할 수 있습니다.`)}
                className="h-10 px-5 rounded-xl border border-amber-400/50 bg-amber-50 text-amber-700 font-label text-sm font-semibold hover:bg-amber-100 transition-all flex items-center gap-2 font-korean"
              >
                ⬆ 플랜 업그레이드 ({documents.length}/{limits.maxUploadTemplates})
              </button>
            );
          }
          return (
            <button
              onClick={() => setShowUpload(true)}
              className="h-10 px-5 rounded-xl bg-power-gradient text-white font-label text-sm font-semibold shadow-ambient hover:shadow-float transition-all flex items-center gap-2 font-korean"
            >
              <svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor">
                <path d="M19 13h-6v6h-2v-6H5v-2h6V5h2v6h6v2z" />
              </svg>
              문서 업로드 ({documents.length}/{limits.maxUploadTemplates})
            </button>
          );
        })()}
      </div>

      {/* Upload Form */}
      {showUpload && (
        <div className="bg-surface-container-lowest rounded-2xl shadow-ambient p-6 space-y-5">
          <h2 className="text-lg font-headline font-bold text-on-surface font-korean">PDF 문서 업로드</h2>
          <p className="text-xs text-on-surface-variant font-korean -mt-3">
            PDF를 업로드하면 서명/체크박스/텍스트 필드를 시각적으로 배치할 수 있는 에디터가 열립니다.
          </p>

          <div>
            <label className="block text-xs font-label font-medium text-on-surface-variant mb-1.5 font-korean">문서 제목 *</label>
            <input
              type="text"
              placeholder="예) 안전운행 서약서"
              value={uploadTitle}
              onChange={e => setUploadTitle(e.target.value)}
              className={inputCls}
            />
          </div>

          <div>
            <label className="block text-xs font-label font-medium text-on-surface-variant mb-1.5 font-korean">PDF 파일 *</label>
            <div className="border-2 border-dashed border-outline-variant/30 rounded-xl p-6 text-center hover:border-primary/40 transition-colors">
              {uploadFile ? (
                <div className="flex items-center justify-center gap-3">
                  <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="#059669" strokeWidth="2">
                    <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
                    <polyline points="14 2 14 8 20 8" />
                  </svg>
                  <div className="text-left">
                    <p className="text-sm font-semibold text-on-surface font-korean">{uploadFile.name}</p>
                    <p className="text-xs text-on-surface-variant">{(uploadFile.size / 1024 / 1024).toFixed(2)} MB</p>
                  </div>
                  <button
                    onClick={() => setUploadFile(null)}
                    className="text-xs text-error hover:underline font-korean ml-2"
                  >
                    변경
                  </button>
                </div>
              ) : (
                <label className="cursor-pointer">
                  <svg width="40" height="40" viewBox="0 0 24 24" fill="none" stroke="#94a3b8" strokeWidth="1.5" className="mx-auto mb-2">
                    <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
                    <polyline points="17 8 12 3 7 8" />
                    <line x1="12" y1="3" x2="12" y2="15" />
                  </svg>
                  <p className="text-sm text-on-surface-variant font-korean">클릭하여 PDF 파일을 선택하세요</p>
                  <p className="text-xs text-on-surface-variant/50 mt-1">최대 10MB</p>
                  <input
                    type="file"
                    accept=".pdf"
                    className="hidden"
                    onChange={e => setUploadFile(e.target.files?.[0] ?? null)}
                  />
                </label>
              )}
            </div>
          </div>

          <div className="flex justify-end gap-3">
            <button
              onClick={() => { setShowUpload(false); setUploadTitle(''); setUploadFile(null); }}
              className="h-10 px-6 rounded-xl bg-surface-container-high text-on-surface-variant font-label text-sm hover:bg-surface-container-highest transition-colors font-korean"
            >
              취소
            </button>
            <button
              onClick={handleUpload}
              disabled={uploading || !uploadTitle.trim() || !uploadFile}
              className="h-10 px-6 rounded-xl bg-power-gradient text-white font-label font-semibold text-sm hover:shadow-lg transition-shadow disabled:opacity-50 font-korean"
            >
              {uploading ? '업로드 중...' : '업로드 후 필드 배치'}
            </button>
          </div>
        </div>
      )}

      {/* Document List */}
      {loading ? (
        <div className="bg-surface-container-lowest rounded-2xl shadow-ambient p-12 text-center">
          <span className="text-sm text-on-surface-variant font-korean">불러오는 중...</span>
        </div>
      ) : documents.length === 0 ? (
        <div className="bg-surface-container-lowest rounded-2xl shadow-ambient p-12 text-center space-y-3">
          <div className="text-4xl">📄</div>
          <p className="text-sm text-on-surface-variant font-korean">등록된 문서가 없습니다</p>
          <p className="text-xs text-on-surface-variant/60 font-korean">
            PDF를 업로드하고 서명 필드를 배치하세요
          </p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
          {documents.map(doc => (
            <div
              key={doc.id}
              className="bg-surface-container-lowest rounded-2xl shadow-ambient p-5 flex flex-col justify-between hover:shadow-card transition-shadow"
            >
              <div>
                <div className="flex items-center justify-between mb-3">
                  <Badge label={statusLabel(doc.status)} variant={statusVariant(doc.status)} />
                  <span className="text-xs text-on-surface-variant font-data">
                    필드 {doc.field_count}개
                  </span>
                </div>
                <h3 className="text-base font-headline font-bold text-on-surface font-korean mb-1">{doc.title}</h3>
                <p className="text-xs text-on-surface-variant font-data">
                  {new Date(doc.created_at).toLocaleDateString('ko-KR')}
                </p>
              </div>

              <div className="mt-4 flex gap-2">
                <button
                  onClick={() => router.push(`/portal/documents/field-editor?docId=${doc.id}`)}
                  className="flex-1 h-9 rounded-lg bg-primary/10 text-primary font-label text-xs font-semibold hover:bg-primary/20 transition-colors font-korean"
                >
                  필드 배치
                </button>
                <button
                  onClick={() => window.open(doc.file_url, '_blank')}
                  className="h-9 px-3 rounded-lg bg-surface-container-high text-on-surface-variant text-xs hover:bg-surface-container-highest transition-colors font-korean"
                >
                  원본 보기
                </button>
                <button
                  onClick={() => handleDelete(doc.id, doc.title)}
                  className="h-9 px-3 rounded-lg text-error text-xs hover:bg-error/10 transition-colors font-korean"
                >
                  삭제
                </button>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Tips */}
      <div className="bg-surface-container-low rounded-2xl p-6">
        <h3 className="text-sm font-headline font-bold text-on-surface font-korean mb-3">사용 안내</h3>
        <ul className="space-y-2 text-xs text-on-surface-variant font-korean">
          <li className="flex items-start gap-2">
            <span className="text-primary mt-0.5">1.</span>
            <strong>문서 업로드</strong> — PDF 파일을 업로드합니다. (안전운행 서약서, 동의서, 기타 서류)
          </li>
          <li className="flex items-start gap-2">
            <span className="text-primary mt-0.5">2.</span>
            <strong>필드 배치</strong> — PDF 위에 체크박스, 서명란, 텍스트 입력 위치를 드래그&드롭으로 설정합니다.
          </li>
          <li className="flex items-start gap-2">
            <span className="text-primary mt-0.5">3.</span>
            <strong>기사 전송</strong> — 설정 완료 후 기사에게 전송하면, 기사가 앱에서 해당 위치에 입력/서명합니다.
          </li>
          <li className="flex items-start gap-2">
            <span className="text-primary mt-0.5">4.</span>
            <strong>자동 합성</strong> — 기사가 입력한 내용이 원본 PDF 위에 자동으로 합성되어 서명 완료 PDF가 생성됩니다.
          </li>
        </ul>
      </div>
    </div>
  );
}
