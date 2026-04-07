'use client';

import { useCallback, useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import Badge from '@/components/shared/Badge';
import { createBrowserSupabaseClient } from '@/lib/supabase';

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

function formatDate(value: string) {
  return new Date(value).toLocaleDateString('ko-KR');
}

export default function DocumentsPage() {
  const router = useRouter();
  const [documents, setDocuments] = useState<DocumentFile[]>([]);
  const [previewDoc, setPreviewDoc] = useState<DocumentFile | null>(null);
  const [loading, setLoading] = useState(true);
  const [agencyId, setAgencyId] = useState<string | null>(null);
  const [creatingTemplateId, setCreatingTemplateId] = useState<string | null>(null);

  const loadDocuments = useCallback(async (aid: string) => {
    const supabase = createBrowserSupabaseClient();
    const { data } = await supabase
      .from('document_files')
      .select('*')
      .eq('agency_id', aid)
      .order('created_at', { ascending: false });

    if (!data) {
      setDocuments([]);
      setLoading(false);
      return;
    }

    const docIds = data.map((doc) => doc.id);
    const [fieldCountsRes, ...signedUrlResults] = await Promise.all([
      supabase.from('document_sign_fields').select('document_file_id').in('document_file_id', docIds),
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
    const nextDocuments: DocumentFile[] = data.map((doc, index) => {
      const fieldCount = fieldCountMap.get(doc.id) ?? 0;
      let status = (doc as Record<string, unknown>).status as string;
      if (status === 'draft' && fieldCount > 0) {
        status = 'ready';
        updatePromises.push(
          supabase.from('document_files').update({ status: 'ready' }).eq('id', doc.id).then(() => undefined),
        );
      }

      const signedRes = signedUrlResults[index] as { data: { signedUrl: string } | null };
      return {
        ...(doc as Record<string, unknown>),
        file_url: signedRes?.data?.signedUrl ?? ((doc as Record<string, unknown>).file_url as string),
        field_count: fieldCount,
        status,
      } as DocumentFile;
    });

    if (updatePromises.length > 0) {
      await Promise.all(updatePromises);
    }

    setDocuments(nextDocuments.filter((doc) => !shouldHideUnsavedDraft(doc.status, doc.field_count)));
    setLoading(false);
  }, []);

  useEffect(() => {
    (async () => {
      const supabase = createBrowserSupabaseClient();
      const {
        data: { user },
      } = await supabase.auth.getUser();

      const aid = user?.app_metadata?.agency_id as string | undefined;
      if (!aid) {
        setLoading(false);
        return;
      }

      setAgencyId(aid);
      await loadDocuments(aid);
    })();
  }, [loadDocuments]);

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

  return (
    <div className="space-y-8">
      <div className="flex items-center justify-between gap-4 flex-wrap">
        <div>
          <h1 className="text-2xl font-headline font-bold text-on-surface font-korean">내 문서함</h1>
          <p className="mt-1 text-sm text-on-surface-variant font-korean">
            저장한 계약 서류를 파일처럼 모아 보고, 클릭하면 크게 미리본 뒤 바로 템플릿 만들기나 필드 편집으로 이어집니다.
          </p>
        </div>

        <button
          type="button"
          onClick={() => router.push('/portal/contracts/templates')}
          className="h-10 px-5 rounded-xl bg-power-gradient text-white font-label text-sm font-semibold shadow-ambient hover:shadow-float transition-all flex items-center gap-2 font-korean"
        >
          <svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor">
            <path d="M19 13h-6v6h-2v-6H5v-2h6V5h2v6h6v2z" />
          </svg>
          템플릿 만들기
        </button>
      </div>

      {loading ? (
        <div className="bg-surface-container-lowest rounded-2xl shadow-ambient p-12 text-center">
          <span className="text-sm text-on-surface-variant font-korean">불러오는 중...</span>
        </div>
      ) : documents.length === 0 ? (
        <div className="bg-surface-container-lowest rounded-2xl shadow-ambient p-12 text-center space-y-3">
          <div className="text-4xl">📁</div>
          <p className="text-sm text-on-surface-variant font-korean">아직 저장된 문서가 없습니다.</p>
          <p className="text-xs text-on-surface-variant/60 font-korean">
            템플릿 만들기에서 내 컴퓨터 문서를 불러와 저장하면 이곳에 자동으로 모입니다.
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
                    src={`${doc.file_url}#toolbar=0&navpanes=0&scrollbar=0&view=FitV`}
                    className="absolute inset-0 h-full w-full pointer-events-none"
                    style={{ transform: 'scale(0.92)', transformOrigin: 'top center' }}
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
                  PDF 문서 · {formatDate(doc.created_at)}
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
            템플릿 만들기에서 내 컴퓨터 문서를 불러온 뒤 저장하면 내 문서함에 자동으로 보입니다.
          </li>
          <li className="flex items-start gap-2">
            <span className="text-primary mt-0.5">2.</span>
            저장된 문서를 클릭하면 크게 미리본 뒤 필드 편집이나 템플릿 만들기로 바로 이어집니다.
          </li>
          <li className="flex items-start gap-2">
            <span className="text-primary mt-0.5">3.</span>
            저장되지 않은 초안 문서는 목록에서 자동으로 숨겨져 유령 문서처럼 남지 않습니다.
          </li>
        </ul>
      </div>

      {previewDoc && (
        <div
          className="fixed inset-0 z-50 bg-black/50 flex items-center justify-center p-4"
          onClick={() => setPreviewDoc(null)}
        >
          <div
            className="w-full max-w-[880px] max-h-[90vh] bg-white rounded-3xl shadow-2xl overflow-hidden flex flex-col"
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

            <div className="flex-1 min-h-0 overflow-auto bg-slate-100 px-6 py-5">
              <div className="mx-auto w-full max-w-[620px]">
                <div className="aspect-[210/297] rounded-[28px] overflow-hidden bg-white border border-outline-variant/15 shadow-sm">
                  <iframe
                    src={`${previewDoc.file_url}#toolbar=0&navpanes=0&view=FitV`}
                    title={previewDoc.title}
                    className="h-full w-full"
                  />
                </div>
              </div>
            </div>

            <div className="px-6 py-4 border-t border-outline-variant/15 flex flex-wrap items-center justify-between gap-3">
              <div className="flex items-center gap-2">
                <Badge label={statusLabel(previewDoc.status)} variant={statusVariant(previewDoc.status)} />
                <span className="text-xs text-on-surface-variant font-korean">
                  필드 {previewDoc.field_count}개 · {formatDate(previewDoc.created_at)}
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
