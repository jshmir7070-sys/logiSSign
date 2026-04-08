'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import Badge from '@/components/shared/Badge';
import { createBrowserSupabaseClient } from '@/lib/supabase';
import {
  getContractTemplates,
  deleteContractTemplate,
  type ContractTemplate,
} from '@/services/contract.service';
import { getPlanLimits, isPaidPlan, PLAN_LABELS, type PlanType } from '@/lib/plan-limits';

function isSystemTemplate(template: ContractTemplate) {
  return template.agency_id === null || template.is_system === true;
}

export default function ContractTemplatesPage() {
  const router = useRouter();
  const [templates, setTemplates] = useState<ContractTemplate[]>([]);
  const [loading, setLoading] = useState(true);
  const [agencyId, setAgencyId] = useState<string | null>(null);
  const [userPlan, setUserPlan] = useState<string>('free');
  const [previewTemplate, setPreviewTemplate] = useState<ContractTemplate | null>(null);
  const [showPlanGuide, setShowPlanGuide] = useState(false);
  const [templatesLocked, setTemplatesLocked] = useState(false);
  const [userRole, setUserRole] = useState<string>('agency_admin');
  const [creatingPdf, setCreatingPdf] = useState(false);
  const [templatePreviewUrls, setTemplatePreviewUrls] = useState<Record<string, string>>({});
  const fileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    async function load() {
      const supabase = createBrowserSupabaseClient();
      const {
        data: { user },
      } = await supabase.auth.getUser();

      if (!user) {
        setLoading(false);
        return;
      }

      const aid = user.app_metadata?.agency_id as string | undefined;
      if (!aid) {
        setLoading(false);
        return;
      }

      setAgencyId(aid);
      setUserPlan((user.app_metadata?.plan as string) ?? 'free');
      setUserRole((user.app_metadata?.role as string) ?? 'agency_admin');

      const [tmplRes, agencyRes] = await Promise.all([
        getContractTemplates(aid),
        supabase.from('agencies').select('templates_locked').eq('id', aid).single(),
      ]);

      if (tmplRes.data) setTemplates(tmplRes.data);
      if (agencyRes.data) {
        setTemplatesLocked((agencyRes.data as { templates_locked: boolean }).templates_locked ?? false);
      }
      setLoading(false);

      const guideKey = `template_guide_shown_${aid}`;
      if (!sessionStorage.getItem(guideKey)) {
        setShowPlanGuide(true);
        sessionStorage.setItem(guideKey, 'true');
      }
    }

    void load();
  }, []);

  useEffect(() => {
    let active = true;

    async function loadTemplatePreviewUrls() {
      const pdfTemplates = templates.filter((template) => template.template_pdf_url);
      if (pdfTemplates.length === 0) {
        if (active) setTemplatePreviewUrls({});
        return;
      }

      const supabase = createBrowserSupabaseClient();
      const entries = await Promise.all(
        pdfTemplates.map(async (template) => {
          if (!template.template_pdf_url) return null;
          if (template.template_pdf_url.startsWith('http')) {
            return [template.id, template.template_pdf_url] as const;
          }

          const { data } = await supabase.storage.from('contracts').createSignedUrl(template.template_pdf_url, 3600);
          if (!data?.signedUrl) return null;
          return [template.id, data.signedUrl] as const;
        }),
      );

      if (!active) return;
      setTemplatePreviewUrls(
        Object.fromEntries(entries.filter((entry): entry is readonly [string, string] => Boolean(entry))),
      );
    }

    void loadTemplatePreviewUrls();
    return () => {
      active = false;
    };
  }, [templates]);

  const limits = getPlanLimits(userPlan);
  const paid = isPaidPlan(userPlan as PlanType);
  const isAdmin = userRole === 'provider_admin' || userRole === 'agency_admin';

  const systemTemplates = useMemo(
    () => templates.filter((template) => isSystemTemplate(template)),
    [templates],
  );
  const userTemplates = useMemo(
    () => templates.filter((template) => !isSystemTemplate(template)),
    [templates],
  );
  const activeDefaultCount = systemTemplates.filter((template) => template.is_active).length;
  const canLockTemplates = activeDefaultCount === limits.maxDefaultTemplates && !templatesLocked && paid;
  const canUploadMore = userTemplates.length < limits.maxUploadTemplates;

  async function handleDelete(id: string, title: string) {
    if (!confirm(`"${title}" 템플릿을 삭제하시겠습니까?`)) return;
    const result = await deleteContractTemplate(id);
    if (!result.error) {
      setTemplates((previous) => previous.filter((template) => template.id !== id));
      setPreviewTemplate((current) => (current?.id === id ? null : current));
    }
  }

  async function handleEditTemplate(template: ContractTemplate) {
    if (isSystemTemplate(template)) {
      const response = await fetch('/api/contracts/templates/clone-system', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ templateId: template.id }),
      });
      const result = await response.json();

      if (!response.ok || !result.templateId) {
        alert(result.error || '기본 템플릿을 편집용으로 준비하지 못했습니다.');
        return;
      }

      router.push(`/portal/contracts/field-editor?templateId=${result.templateId}`);
      return;
    }

    router.push(`/portal/contracts/field-editor?templateId=${template.id}`);
  }

  async function handleLockTemplates() {
    if (!agencyId) return;
    if (!confirm(`기본 템플릿 ${activeDefaultCount}개와 업로드 템플릿 ${userTemplates.length}개 구성을 확정하시겠습니까?\n\n확정 후에는 운영사가 직접 변경할 수 없습니다.`)) return;

    const supabase = createBrowserSupabaseClient();
    await supabase.from('agencies').update({ templates_locked: true }).eq('id', agencyId);
    setTemplatesLocked(true);
  }

  async function handleUnlockTemplates() {
    if (!agencyId || !isAdmin) return;
    if (!confirm('템플릿 잠금을 해제하시겠습니까? 해제 후 다시 변경할 수 있습니다.')) return;

    const supabase = createBrowserSupabaseClient();
    await supabase.from('agencies').update({ templates_locked: false }).eq('id', agencyId);
    setTemplatesLocked(false);
  }

  async function handleCreatePdfTemplate(file: File) {
    setCreatingPdf(true);
    try {
      const formData = new FormData();
      formData.append('file', file);

      const response = await fetch('/api/documents/draft', {
        method: 'POST',
        body: formData,
      });
      const result = await response.json();

      if (!response.ok || !result.id) {
        alert(result.error || '문서 초안을 생성하지 못했습니다.');
        return;
      }

      router.push(`/portal/contracts/field-editor?docId=${result.id}&draft=1&from=templates`);
    } catch (error) {
      console.error('문서 초안 생성 실패:', error);
      alert('문서 초안을 생성하지 못했습니다.');
    } finally {
      setCreatingPdf(false);
      if (fileInputRef.current) {
        fileInputRef.current.value = '';
      }
    }
  }

  const getTemplatePreviewUrl = (template: ContractTemplate) => templatePreviewUrls[template.id] ?? null;
  const isPdfTemplate = (template: ContractTemplate) => Boolean(template.template_pdf_url || template.template_type === 'pdf');

  return (
    <div className="space-y-8">
      <div className="flex items-center justify-between gap-4 flex-wrap">
        <div>
          <h1 className="text-2xl font-headline font-bold text-on-surface font-korean">템플릿 만들기</h1>
          <p className="mt-1 text-sm text-on-surface-variant font-korean">
            문서함처럼 계약서 템플릿을 파일로 모아 보고, 클릭하면 크게 미리본 뒤 바로 필드 편집으로 이어집니다.
          </p>
          {paid && (
            <p className="mt-0.5 text-xs text-on-surface-variant/60 font-korean">
              {PLAN_LABELS[userPlan as PlanType]} 플랜 · 기본 템플릿 {activeDefaultCount}개 · 업로드 템플릿 {userTemplates.length}개
              {templatesLocked && <span className="text-error ml-2">잠금 확정됨</span>}
            </p>
          )}
        </div>

        {paid && !templatesLocked && isAdmin && canUploadMore ? (
          <div className="flex items-center gap-2 flex-wrap">
            <button
              onClick={() => fileInputRef.current?.click()}
              disabled={creatingPdf}
              className="h-10 px-5 rounded-xl bg-surface-container-high text-on-surface font-label text-sm font-semibold hover:bg-surface-container-highest transition-all flex items-center gap-2 font-korean disabled:opacity-50"
            >
              내 컴퓨터 문서 가져오기
            </button>
            <input
              ref={fileInputRef}
              type="file"
              accept=".pdf,.doc,.docx,.png,.jpg,.jpeg"
              className="hidden"
              onChange={(event) => {
                const file = event.target.files?.[0];
                if (file) {
                  void handleCreatePdfTemplate(file);
                }
              }}
            />
          </div>
        ) : paid && templatesLocked && isAdmin ? (
          <button
            onClick={handleUnlockTemplates}
            className="h-10 px-5 rounded-xl border border-error/30 text-error font-label text-sm font-semibold hover:bg-error/5 transition-all flex items-center gap-2 font-korean"
          >
            잠금 해제
          </button>
        ) : paid ? (
          <button
            onClick={() => alert(`현재 ${PLAN_LABELS[userPlan as PlanType]} 플랜의 템플릿 한도를 모두 사용했습니다.`)}
            className="h-10 px-5 rounded-xl border border-amber-400/50 bg-amber-50 text-amber-700 font-label text-sm font-semibold hover:bg-amber-100 transition-all flex items-center gap-2 font-korean"
          >
            플랜 업그레이드
          </button>
        ) : (
          <button
            onClick={() => alert('템플릿 기능은 유료 플랜에서 사용할 수 있습니다. 설정 > 결제에서 플랜을 변경해 주세요.')}
            className="h-10 px-5 rounded-xl border border-amber-400/50 bg-amber-50 text-amber-700 font-label text-sm font-semibold hover:bg-amber-100 transition-all flex items-center gap-2 font-korean"
          >
            플랜 업그레이드
          </button>
        )}
      </div>

      {templatesLocked && (
        <div className="bg-error/5 border border-error/20 rounded-2xl p-5 flex items-center gap-4">
          <div className="w-10 h-10 rounded-xl bg-error/10 flex items-center justify-center text-xl shrink-0">🔒</div>
          <div className="flex-1">
            <p className="text-sm font-semibold text-on-surface font-korean">템플릿 구성이 확정되었습니다.</p>
            <p className="text-xs text-on-surface-variant font-korean mt-0.5">
              운영 중에는 템플릿이 잠겨 있으며, 필요하면 관리자 권한으로만 해제할 수 있습니다.
            </p>
          </div>
        </div>
      )}

      {canLockTemplates && (
        <div className="bg-amber-50 border border-amber-200 rounded-2xl p-5 flex items-center justify-between gap-4">
          <div>
            <p className="text-sm font-semibold text-on-surface font-korean">기본 템플릿 선택이 모두 끝났습니다.</p>
            <p className="text-xs text-on-surface-variant font-korean mt-0.5">
              현재 구성을 확정하면 운영사가 실수로 템플릿을 바꾸지 않도록 잠글 수 있습니다.
            </p>
          </div>
          <button
            onClick={handleLockTemplates}
            className="h-10 px-6 rounded-xl bg-gradient-to-r from-amber-500 to-orange-500 text-white font-label text-sm font-bold hover:shadow-lg transition-all shrink-0 font-korean"
          >
            선택 확정
          </button>
        </div>
      )}

      {loading ? (
        <div className="bg-surface-container-lowest rounded-2xl shadow-ambient p-12 text-center">
          <span className="text-sm text-on-surface-variant font-korean">불러오는 중...</span>
        </div>
      ) : templates.length === 0 ? (
        <div className="bg-surface-container-lowest rounded-2xl shadow-ambient p-12 text-center space-y-3">
          <div className="text-4xl">📄</div>
          <p className="text-sm text-on-surface-variant font-korean">등록된 계약서 템플릿이 없습니다.</p>
          <p className="text-xs text-on-surface-variant/60 font-korean">
            내 컴퓨터 문서를 가져와 실제 계약서 템플릿으로 저장해 보세요.
          </p>
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-5">
          {templates.map((template) => {
            const isSystem = isSystemTemplate(template);
            const previewUrl = getTemplatePreviewUrl(template);
            const pdfTemplate = isPdfTemplate(template);

            return (
              <button
                key={template.id}
                type="button"
                onClick={() => setPreviewTemplate(template)}
                className={`bg-surface-container-lowest rounded-2xl shadow-ambient p-4 text-left hover:shadow-card transition-shadow group ${
                  !template.is_active ? 'opacity-50 grayscale' : ''
                }`}
              >
                <div className="rounded-2xl border border-outline-variant/15 bg-slate-50 overflow-hidden">
                  <div className="aspect-[3/4] bg-white relative">
                    {previewUrl ? (
                      <iframe
                        src={`${previewUrl}#toolbar=0&navpanes=0&scrollbar=0&view=FitV`}
                        className="absolute inset-0 h-full w-full pointer-events-none"
                        style={{ transform: 'scale(0.92)', transformOrigin: 'top center' }}
                        title={template.title}
                      />
                    ) : (
                      <div className="absolute inset-0 flex flex-col items-center justify-center gap-3 px-6 text-center">
                        <div className="w-14 h-14 rounded-2xl bg-primary/10 text-primary flex items-center justify-center">
                          <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6">
                            <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
                            <polyline points="14 2 14 8 20 8" />
                          </svg>
                        </div>
                        <p className="text-sm font-semibold text-on-surface font-korean line-clamp-3">
                          {pdfTemplate ? 'PDF 템플릿 미리보기를 준비하는 중입니다.' : '텍스트 계약서 템플릿입니다.'}
                        </p>
                      </div>
                    )}
                  </div>
                </div>

                <div className="mt-3 space-y-1">
                  <div className="flex items-center justify-between gap-2">
                    <div className="flex items-center gap-2 min-w-0">
                      <Badge label={template.principals?.name ?? '전체'} variant={template.principals?.name ? 'info' : 'default'} />
                      {isSystem && <Badge label="기본양식" variant="warning" />}
                      {pdfTemplate && (
                        <span className="px-1.5 py-0.5 rounded text-[10px] font-bold bg-primary/10 text-primary">PDF</span>
                      )}
                    </div>
                    <span className="text-[11px] text-on-surface-variant font-korean shrink-0">
                      {template.is_active ? '사용 중' : '비활성'}
                    </span>
                  </div>
                  <p className="text-sm font-semibold text-on-surface font-korean line-clamp-2">{template.title}</p>
                  <p className="text-[11px] text-on-surface-variant font-korean">
                    {new Date(template.created_at).toLocaleDateString('ko-KR')}
                  </p>
                </div>
              </button>
            );
          })}
        </div>
      )}

      {previewTemplate && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4" onClick={() => setPreviewTemplate(null)}>
          <div
            className="w-full max-w-[880px] max-h-[90vh] bg-white rounded-3xl shadow-2xl overflow-hidden flex flex-col"
            onClick={(event) => event.stopPropagation()}
          >
            <div className="flex items-center justify-between px-6 py-4 border-b border-outline-variant/15">
              <div>
                <h2 className="text-lg font-bold text-on-surface font-korean">{previewTemplate.title}</h2>
                <p className="text-xs text-on-surface-variant font-korean">
                  {previewTemplate.principals?.name ? `카테고리: ${previewTemplate.principals.name}` : '전체 카테고리'} · 등록일 {new Date(previewTemplate.created_at).toLocaleDateString('ko-KR')}
                </p>
              </div>
              <button
                type="button"
                onClick={() => setPreviewTemplate(null)}
                className="text-on-surface-variant/60 hover:text-on-surface"
              >
                <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <path d="M18 6L6 18M6 6l12 12" />
                </svg>
              </button>
            </div>

            {getTemplatePreviewUrl(previewTemplate) ? (
              <div className="flex-1 min-h-0 overflow-auto bg-slate-100 px-6 py-5">
                <div className="mx-auto w-full max-w-[620px]">
                  <div className="aspect-[210/297] rounded-[28px] overflow-hidden bg-white border border-outline-variant/15 shadow-sm">
                    <iframe
                      src={`${getTemplatePreviewUrl(previewTemplate)}#toolbar=0&navpanes=0&view=FitV`}
                      title={previewTemplate.title}
                      className="h-full w-full"
                    />
                  </div>
                </div>
              </div>
            ) : (
              <div className="flex-1 overflow-y-auto p-6 bg-slate-100">
                <div className="mx-auto max-w-3xl bg-white rounded-2xl border border-outline-variant/15 shadow-sm p-6">
                  <div className="text-sm font-korean leading-relaxed whitespace-pre-wrap">
                    {previewTemplate.content.split(/(\{\{[^}]+\}\})/).map((part, index) =>
                      /^\{\{.+\}\}$/.test(part) ? (
                        <span key={index} className="inline-block bg-primary/15 text-primary font-semibold px-1 rounded text-xs mx-0.5">
                          {part}
                        </span>
                      ) : (
                        <span key={index}>{part}</span>
                      ),
                    )}
                  </div>
                </div>
              </div>
            )}

            <div className="px-6 py-4 border-t border-outline-variant/15 flex flex-wrap items-center justify-between gap-3">
                <div className="flex items-center gap-2">
                  <Badge label={previewTemplate.principals?.name ?? '전체'} variant={previewTemplate.principals?.name ? 'info' : 'default'} />
                  <span className="text-xs text-on-surface-variant font-korean">
                    PDF 템플릿
                  </span>
                </div>

              <div className="flex flex-wrap items-center justify-end gap-3">
                {getTemplatePreviewUrl(previewTemplate) && (
                  <button
                    type="button"
                    onClick={() => window.open(getTemplatePreviewUrl(previewTemplate) ?? '', '_blank')}
                    className="h-10 px-4 rounded-xl bg-surface-container-high text-on-surface-variant text-sm font-korean hover:bg-surface-container-highest transition-colors"
                  >
                    원본 보기
                  </button>
                )}
                {previewTemplate.is_active && (
                  <button
                    type="button"
                    onClick={() => void handleEditTemplate(previewTemplate)}
                    className="h-10 px-4 rounded-xl bg-primary/10 text-primary text-sm font-semibold font-korean hover:bg-primary/20 transition-colors"
                  >
                    {isSystemTemplate(previewTemplate) ? '편집 시작' : '필드 편집'}
                  </button>
                )}
                {!isSystemTemplate(previewTemplate) && (
                  <button
                    type="button"
                    onClick={() => handleDelete(previewTemplate.id, previewTemplate.title)}
                    className="h-10 px-4 rounded-xl text-error text-sm font-korean hover:bg-error/10 transition-colors"
                  >
                    삭제
                  </button>
                )}
              </div>
            </div>
          </div>
        </div>
      )}

      {showPlanGuide && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4" onClick={() => setShowPlanGuide(false)}>
          <div
            className="bg-surface-container-lowest rounded-2xl shadow-float w-full max-w-lg"
            onClick={(event) => event.stopPropagation()}
          >
            <div className="bg-gradient-to-r from-[#004ac6] to-[#2563eb] rounded-t-2xl p-6 text-white text-center">
              <h2 className="text-xl font-bold">계약서 템플릿 안내</h2>
              <p className="text-white/80 text-sm mt-1">현재 <span className="font-bold text-white">{PLAN_LABELS[userPlan as PlanType]}</span> 플랜</p>
            </div>

            <div className="p-6 space-y-5">
              <div className="grid grid-cols-2 gap-3">
                <div className="bg-primary/[0.06] rounded-xl p-4 text-center">
                  <p className="text-2xl font-extrabold text-primary">무제한</p>
                  <p className="text-xs text-on-surface-variant mt-1 font-medium">기본 템플릿 선택</p>
                </div>
                <div className="bg-tertiary/[0.06] rounded-xl p-4 text-center">
                  <p className="text-2xl font-extrabold text-tertiary">무제한</p>
                  <p className="text-xs text-on-surface-variant mt-1 font-medium">업로드 계약서</p>
                </div>
              </div>

              <div className="space-y-3 text-sm text-on-surface-variant">
                <div className="flex items-start gap-3">
                  <span className="w-6 h-6 rounded-full bg-primary/10 text-primary flex items-center justify-center text-xs font-bold shrink-0 mt-0.5">1</span>
                  <p><span className="font-semibold text-on-surface">기본 템플릿</span>은 시스템에서 제공하는 표준 양식입니다.</p>
                </div>
                <div className="flex items-start gap-3">
                  <span className="w-6 h-6 rounded-full bg-tertiary/10 text-tertiary flex items-center justify-center text-xs font-bold shrink-0 mt-0.5">2</span>
                  <p><span className="font-semibold text-on-surface">업로드 계약서</span>는 직접 만든 PDF를 문서처럼 불러와 템플릿으로 저장하는 방식입니다.</p>
                </div>
                <div className="flex items-start gap-3">
                  <span className="w-6 h-6 rounded-full bg-amber-100 text-amber-700 flex items-center justify-center text-xs font-bold shrink-0 mt-0.5">3</span>
                  <p>클릭하면 큰 문서 미리보기로 열리고, 바로 필드 편집으로 이어집니다.</p>
                </div>
              </div>
            </div>

            <div className="px-6 pb-6">
              <button
                onClick={() => setShowPlanGuide(false)}
                className="w-full h-11 rounded-xl bg-gradient-to-r from-[#004ac6] to-[#2563eb] text-white font-label text-sm font-bold hover:shadow-lg transition-all font-korean"
              >
                확인했어요
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
