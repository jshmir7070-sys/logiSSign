'use client';

import { useCallback, useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import Badge from '@/components/shared/Badge';
import { createBrowserSupabaseClient } from '@/lib/supabase';
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

function shouldHideUnsavedDraft(status: string, fieldCount: number) {
  return status === 'draft' && fieldCount === 0;
}

function stripPdfExtension(title: string) {
  return title.replace(/\.pdf$/i, '').trim();
}

export default function DocumentsPage() {
  const router = useRouter();
  const [documents, setDocuments] = useState<DocumentFile[]>([]);
  const [previewDoc, setPreviewDoc] = useState<DocumentFile | null>(null);
  const [loading, setLoading] = useState(true);
  const [agencyId, setAgencyId] = useState<string | null>(null);
  const [uploading, setUploading] = useState(false);
  const [creatingTemplateId, setCreatingTemplateId] = useState<string | null>(null);
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
      const docIds = data.map((doc) => doc.id);
      const [fieldCountsRes, ...signedUrlResults] = await Promise.all([
        supabase
          .from('document_sign_fields')
          .select('document_file_id')
          .in('document_file_id', docIds),
        ...data.map((doc) => {
          const storagePath = (doc as Record<string, unknown>).file_url as string;
          if (storagePath && !storagePath.startsWith('http')) {
            return supabase.storage.from('documents').createSignedUrl(storagePath, 3600);
          }
          return Promise.resolve({ data: null });
        }),
      ]);

      const fieldCountMap = new Map<string, number>();
      for (const row of fieldCountsRes.data ?? []) {
        fieldCountMap.set(row.document_file_id, (fieldCountMap.get(row.document_file_id) ?? 0) + 1);
      }

      const updatePromises: PromiseLike<unknown>[] = [];
      const docs: DocumentFile[] = data.map((doc, index) => {
        const fieldCount = fieldCountMap.get(doc.id) ?? 0;
        let status = (doc as Record<string, unknown>).status as string;
        if (status === 'draft' && fieldCount > 0) {
          status = 'ready';
          updatePromises.push(
            supabase
              .from('document_files')
              .update({ status: 'ready' })
              .eq('id', doc.id)
              .then(() => undefined),
          );
        }

        const signedRes = signedUrlResults[index] as { data: { signedUrl: string } | null };
        const viewUrl = signedRes?.data?.signedUrl ?? ((doc as Record<string, unknown>).file_url as string);
        return {
          ...(doc as Record<string, unknown>),
          file_url: viewUrl,
          field_count: fieldCount,
          status,
        } as DocumentFile;
      });

      if (updatePromises.length > 0) {
        await Promise.all(updatePromises);
      }

      setDocuments(docs.filter((doc) => !shouldHideUnsavedDraft(doc.status, doc.field_count)));
    }

    setLoading(false);
  }, []);

  useEffect(() => {
    (async () => {
      const supabase = createBrowserSupabaseClient();
      const {
        data: { user },
      } = await supabase.auth.getUser();
      if (!user) return;
      const aid = user.app_metadata?.agency_id as string | undefined;
      if (!aid) return;

      setAgencyId(aid);
      setUserPlan((user.app_metadata?.plan as string) ?? 'free');
      await loadDocuments(aid);
    })();
  }, [loadDocuments]);

  const handleUpload = async () => {
    if (!agencyId || !uploadFile || !uploadTitle.trim()) return;
    setUploading(true);

    try {
      const formData = new FormData();
      formData.append('file', uploadFile);
      formData.append('title', uploadTitle.trim());

      const response = await fetch('/api/documents/upload', {
        method: 'POST',
        body: formData,
      });

      const result = await response.json();
      setUploading(false);

      if (!response.ok || result.error) {
        alert(`업로드 실패: ${result.error ?? '알 수 없는 오류'}`);
        return;
      }

      setShowUpload(false);
      setUploadTitle('');
      setUploadFile(null);
      router.push(`/portal/documents/field-editor?docId=${result.id}`);
    } catch (error) {
      setUploading(false);
      alert(`업로드 중 오류가 발생했습니다: ${error instanceof Error ? error.message : ''}`);
    }
  };

  const handleDelete = async (id: string, title: string) => {
    if (!confirm(`"${title}" 문서를 삭제하시겠습니까?`)) return;
    const supabase = createBrowserSupabaseClient();
    await supabase.from('document_sign_fields').delete().eq('document_file_id', id);
    await supabase.from('document_files').delete().eq('id', id);
    setDocuments((previous) => previous.filter((doc) => doc.id !== id));
    setPreviewDoc((current) => (current?.id === id ? null : current));
  };

  const handleCreateTemplateFromDoc = async (doc: DocumentFile) => {
    if (!agencyId) return;
    setCreatingTemplateId(doc.id);

    try {
      const supabase = createBrowserSupabaseClient();

      const { data: template, error: templateError } = await supabase
        .from('contract_templates')
        .insert({
          agency_id: agencyId,
          title: `${stripPdfExtension(doc.title)} 템플릿`,
          content: '(PDF 템플릿)',
          template_type: 'pdf',
        })
        .select('id')
        .single();

      if (templateError || !template) {
        alert('템플릿을 생성하지 못했습니다.');
        return;
      }

      const { data: sourceDoc, error: sourceError } = await supabase
        .from('document_files')
        .select('file_url')
        .eq('id', doc.id)
        .single();

      if (sourceError || !sourceDoc?.file_url) {
        alert('원본 문서 경로를 찾지 못했습니다.');
        return;
      }

      const sourcePath = sourceDoc.file_url.startsWith('http')
        ? decodeURIComponent(sourceDoc.file_url.split('/documents/')[1] ?? '')
        : sourceDoc.file_url;

      if (!sourcePath) {
        alert('원본 문서 경로를 확인할 수 없습니다.');
        return;
      }

      const { data: sourceSigned } = await supabase.storage.from('documents').createSignedUrl(sourcePath, 3600);
      if (!sourceSigned?.signedUrl) {
        alert('원본 문서를 불러오지 못했습니다.');
        return;
      }

      const downloadResponse = await fetch(sourceSigned.signedUrl);
      const pdfBlob = await downloadResponse.blob();
      const targetPath = `templates/${template.id}.pdf`;

      const { error: uploadError } = await supabase.storage
        .from('contracts')
        .upload(targetPath, pdfBlob, { upsert: true, contentType: 'application/pdf' });

      if (uploadError) {
        alert(`템플릿 PDF 저장 실패: ${uploadError.message}`);
        return;
      }

      await supabase
        .from('contract_templates')
        .update({ template_pdf_url: targetPath, template_type: 'pdf' })
        .eq('id', template.id);

      router.push(`/portal/contracts/field-editor?templateId=${template.id}`);
    } finally {
      setCreatingTemplateId(null);
    }
  };

  const statusLabel = (status: string) => {
    const labels: Record<string, string> = {
      draft: '작성 중',
      ready: '저장 완료',
      sent: '전송됨',
      uploaded: '업로드됨',
    };
    return labels[status] ?? status;
  };

  const statusVariant = (status: string): 'warning' | 'success' | 'info' | 'default' => {
    const variants: Record<string, 'warning' | 'success' | 'info'> = {
      draft: 'warning',
      ready: 'success',
      sent: 'info',
    };
    return variants[status] ?? 'default';
  };

  const inputCls =
    'w-full h-11 px-4 rounded-xl bg-surface-container-low text-on-surface text-sm font-korean focus:outline-none focus:ring-2 focus:ring-primary/30 placeholder:text-on-surface-variant/40';

  const limits = getPlanLimits(userPlan);
  const canUpload = documents.length < limits.maxUploadTemplates;
  const paid = isPaidPlan(userPlan as PlanType);

  return (
    <div className="space-y-8">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-headline font-bold text-on-surface font-korean">내 문서함</h1>
          <p className="mt-1 text-sm text-on-surface-variant font-korean">
            저장한 계약 서류를 파일처럼 모아 보고, 클릭하면 크게 미리본 뒤 바로 템플릿 만들기나 필드 편집으로 이어집니다.
          </p>
        </div>

        {!paid ? (
          <button
            onClick={() =>
              alert('문서함 기능은 유료 플랜에서 사용할 수 있습니다.\n\n설정 > 결제에서 플랜을 변경해 주세요.')
            }
            className="h-10 px-5 rounded-xl border border-amber-400/50 bg-amber-50 text-amber-700 font-label text-sm font-semibold hover:bg-amber-100 transition-all flex items-center gap-2 font-korean"
          >
            플랜 업그레이드
          </button>
        ) : !canUpload ? (
          <button
            onClick={() =>
              alert(
                `현재 ${PLAN_LABELS[userPlan as PlanType]} 플랜의 문서 업로드 한도(${limits.maxUploadTemplates}개)를 모두 사용했습니다.\n\n더 많은 문서를 쓰려면 상위 플랜으로 변경해 주세요.`,
              )
            }
            className="h-10 px-5 rounded-xl border border-amber-400/50 bg-amber-50 text-amber-700 font-label text-sm font-semibold hover:bg-amber-100 transition-all flex items-center gap-2 font-korean"
          >
            플랜 업그레이드
          </button>
        ) : (
          <button
            onClick={() => setShowUpload(true)}
            className="h-10 px-5 rounded-xl bg-power-gradient text-white font-label text-sm font-semibold shadow-ambient hover:shadow-float transition-all flex items-center gap-2 font-korean"
          >
            <svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor">
              <path d="M19 13h-6v6h-2v-6H5v-2h6V5h2v6h6v2z" />
            </svg>
            문서 업로드 ({documents.length}개)
          </button>
        )}
      </div>

      {showUpload && (
        <div className="bg-surface-container-lowest rounded-2xl shadow-ambient p-6 space-y-5">
          <h2 className="text-lg font-headline font-bold text-on-surface font-korean">PDF 문서 업로드</h2>
          <p className="text-xs text-on-surface-variant font-korean -mt-3">
            PDF를 올린 뒤 문서 이름을 입력하고 필드를 저장하면 내 문서함에 파일처럼 보관됩니다.
          </p>

          <div>
            <label className="block text-xs font-label font-medium text-on-surface-variant mb-1.5 font-korean">
              문서 이름 *
            </label>
            <input
              type="text"
              placeholder="예: 택배용 화물자동차 전속 운송 계약서"
              value={uploadTitle}
              onChange={(event) => setUploadTitle(event.target.value)}
              className={inputCls}
            />
          </div>

          <div>
            <label className="block text-xs font-label font-medium text-on-surface-variant mb-1.5 font-korean">
              PDF 파일 *
            </label>
            <div className="border-2 border-dashed border-outline-variant/30 rounded-xl p-6 text-center hover:border-primary/40 transition-colors">
              {uploadFile ? (
                <div className="flex items-center justify-center gap-3">
                  <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="#059669" strokeWidth="2">
                    <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
                    <polyline points="14 2 14 8 20 8" />
                  </svg>
                  <div className="text-left">
                    <p className="text-sm font-semibold text-on-surface font-korean">{uploadFile.name}</p>
                    <p className="text-xs text-on-surface-variant">
                      {(uploadFile.size / 1024 / 1024).toFixed(2)} MB
                    </p>
                  </div>
                  <button
                    type="button"
                    onClick={() => setUploadFile(null)}
                    className="text-xs text-error hover:underline font-korean ml-2"
                  >
                    파일 변경
                  </button>
                </div>
              ) : (
                <label className="cursor-pointer">
                  <svg
                    width="40"
                    height="40"
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="#94a3b8"
                    strokeWidth="1.5"
                    className="mx-auto mb-2"
                  >
                    <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
                    <polyline points="17 8 12 3 7 8" />
                    <line x1="12" y1="3" x2="12" y2="15" />
                  </svg>
                  <p className="text-sm text-on-surface-variant font-korean">클릭해서 PDF 파일을 선택해 주세요.</p>
                  <p className="text-xs text-on-surface-variant/50 mt-1">최대 10MB</p>
                  <input
                    type="file"
                    accept=".pdf"
                    className="hidden"
                    onChange={(event) => setUploadFile(event.target.files?.[0] ?? null)}
                  />
                </label>
              )}
            </div>
          </div>

          <div className="flex justify-end gap-3">
            <button
              type="button"
              onClick={() => {
                setShowUpload(false);
                setUploadTitle('');
                setUploadFile(null);
              }}
              className="h-10 px-6 rounded-xl bg-surface-container-high text-on-surface-variant font-label text-sm hover:bg-surface-container-highest transition-colors font-korean"
            >
              취소
            </button>
            <button
              type="button"
              onClick={handleUpload}
              disabled={uploading || !uploadTitle.trim() || !uploadFile}
              className="h-10 px-6 rounded-xl bg-power-gradient text-white font-label font-semibold text-sm hover:shadow-lg transition-shadow disabled:opacity-50 font-korean"
            >
              {uploading ? '업로드 중...' : '업로드 후 필드 배치'}
            </button>
          </div>
        </div>
      )}

      {loading ? (
        <div className="bg-surface-container-lowest rounded-2xl shadow-ambient p-12 text-center">
          <span className="text-sm text-on-surface-variant font-korean">불러오는 중...</span>
        </div>
      ) : documents.length === 0 ? (
        <div className="bg-surface-container-lowest rounded-2xl shadow-ambient p-12 text-center space-y-3">
          <div className="text-4xl">📂</div>
          <p className="text-sm text-on-surface-variant font-korean">아직 저장된 문서가 없습니다.</p>
          <p className="text-xs text-on-surface-variant/60 font-korean">
            문서를 업로드하고 이름을 입력해 저장하면 이곳에 파일처럼 쌓입니다.
          </p>
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-5">
          {documents.map((doc) => (
            <button
              key={doc.id}
              type="button"
              onClick={() => setPreviewDoc(doc)}
              className="bg-surface-container-lowest rounded-2xl shadow-ambient p-4 text-left hover:shadow-card transition-shadow group"
            >
              <div className="rounded-2xl border border-outline-variant/15 bg-slate-50 overflow-hidden">
                <div className="aspect-[3/4] bg-white relative">
                  <iframe
                    src={`${doc.file_url}#toolbar=0&navpanes=0&scrollbar=0&view=FitH`}
                    className="absolute inset-0 h-full w-full pointer-events-none"
                    style={{ transform: 'scale(0.9)', transformOrigin: 'top center' }}
                    title={doc.title}
                  />
                </div>
              </div>

              <div className="mt-3 space-y-1">
                <div className="flex items-center justify-between gap-2">
                  <Badge label={statusLabel(doc.status)} variant={statusVariant(doc.status)} />
                  <span className="text-[11px] text-on-surface-variant font-data">필드 {doc.field_count}개</span>
                </div>
                <p className="text-sm font-semibold text-on-surface font-korean line-clamp-2">{doc.title}</p>
                <p className="text-[11px] text-on-surface-variant font-korean">
                  PDF 문서 · {new Date(doc.created_at).toLocaleDateString('ko-KR')}
                </p>
              </div>
            </button>
          ))}
        </div>
      )}

      <div className="bg-surface-container-low rounded-2xl p-6">
        <h3 className="text-sm font-headline font-bold text-on-surface font-korean mb-3">사용 안내</h3>
        <ul className="space-y-2 text-xs text-on-surface-variant font-korean">
          <li className="flex items-start gap-2">
            <span className="text-primary mt-0.5">1.</span>
            PDF를 업로드한 뒤 문서 이름을 입력하고 저장해야 내 문서함에 보입니다.
          </li>
          <li className="flex items-start gap-2">
            <span className="text-primary mt-0.5">2.</span>
            저장된 문서를 클릭하면 크게 미리본 뒤 필드 편집이나 템플릿 만들기로 바로 이어집니다.
          </li>
          <li className="flex items-start gap-2">
            <span className="text-primary mt-0.5">3.</span>
            템플릿 만들기를 누르면 계약 템플릿으로 복사되어 기사에게 보낼 필드를 배치할 수 있습니다.
          </li>
        </ul>
      </div>

      {previewDoc && (
        <div
          className="fixed inset-0 z-50 bg-black/50 flex items-center justify-center p-4"
          onClick={() => setPreviewDoc(null)}
        >
          <div
            className="w-full max-w-6xl max-h-[88vh] bg-white rounded-3xl shadow-2xl overflow-hidden flex flex-col"
            onClick={(event) => event.stopPropagation()}
          >
            <div className="flex items-center justify-between px-6 py-4 border-b border-outline-variant/15">
              <div>
                <h2 className="text-lg font-bold text-on-surface font-korean">{previewDoc.title}</h2>
                <p className="text-xs text-on-surface-variant font-korean">
                  문서를 확인한 뒤 템플릿 만들기 또는 필드 편집을 진행하세요.
                </p>
              </div>
              <button
                type="button"
                onClick={() => setPreviewDoc(null)}
                className="text-on-surface-variant/60 hover:text-on-surface"
              >
                <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <path d="M18 6L6 18M6 6l12 12" />
                </svg>
              </button>
            </div>

            <div className="flex-1 min-h-0 bg-slate-100 p-6">
              <div className="h-full rounded-2xl overflow-hidden bg-white border border-outline-variant/15">
                <iframe
                  src={`${previewDoc.file_url}#toolbar=0&navpanes=0`}
                  title={previewDoc.title}
                  className="h-full w-full"
                />
              </div>
            </div>

            <div className="px-6 py-4 border-t border-outline-variant/15 flex flex-wrap items-center justify-between gap-3">
              <div className="flex items-center gap-2">
                <Badge label={statusLabel(previewDoc.status)} variant={statusVariant(previewDoc.status)} />
                <span className="text-xs text-on-surface-variant font-korean">
                  필드 {previewDoc.field_count}개 · {new Date(previewDoc.created_at).toLocaleDateString('ko-KR')}
                </span>
              </div>

              <div className="flex flex-wrap items-center justify-end gap-3">
                <button
                  type="button"
                  onClick={() => handleDelete(previewDoc.id, previewDoc.title)}
                  className="h-10 px-4 rounded-xl text-error text-sm font-korean hover:bg-error/10 transition-colors"
                >
                  삭제
                </button>
                <button
                  type="button"
                  onClick={() => window.open(previewDoc.file_url, '_blank')}
                  className="h-10 px-4 rounded-xl bg-surface-container-high text-on-surface-variant text-sm font-korean hover:bg-surface-container-highest transition-colors"
                >
                  원본 보기
                </button>
                <button
                  type="button"
                  onClick={() => router.push(`/portal/documents/field-editor?docId=${previewDoc.id}`)}
                  className="h-10 px-4 rounded-xl bg-primary/10 text-primary text-sm font-semibold font-korean hover:bg-primary/20 transition-colors"
                >
                  필드 편집
                </button>
                <button
                  type="button"
                  onClick={() => handleCreateTemplateFromDoc(previewDoc)}
                  disabled={creatingTemplateId === previewDoc.id}
                  className="h-10 px-5 rounded-xl bg-power-gradient text-white text-sm font-semibold font-korean disabled:opacity-50"
                >
                  {creatingTemplateId === previewDoc.id ? '템플릿 생성 중...' : '템플릿 만들기'}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
