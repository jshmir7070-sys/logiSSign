'use client';

import { useEffect, useState } from 'react';
import Badge from '@/components/shared/Badge';
import { createBrowserSupabaseClient } from '@/lib/supabase';
import {
  getContractTemplates,
  createContractTemplate,
  deleteContractTemplate,
  updateContractTemplate,
  CONTRACT_VARIABLES,
  type ContractTemplate,
} from '@/services/contract.service';
import { getPrincipals, type Principal } from '@/services/principal.service';
import { getPlanLimits, isPaidPlan, PLAN_LABELS, type PlanType } from '@/lib/plan-limits';

/** 시스템 기본 양식 ID — 삭제 불가 */
const SYSTEM_TEMPLATE_IDS = new Set([
  'f36661e4-e53e-423a-9177-0e2ea82f4c35', // 영업점-택배기사 위수탁 표준계약서
  '1304ca4c-4baf-4c35-b4b8-2f7eac7d8022', // 차량 임대차 계약서
  '2a0c9182-d6af-4c6d-b02d-c6ceed799170', // 부속합의서 (택배서비스 위수탁)
  '5f6aaa65-ec75-4023-bbc8-b00765d82c73', // 화물 위탁운송 계약서
  'efdc01fb-5609-4ce6-9049-01e81fc2d1aa', // 개인정보 수집·이용 동의서
  '6d391463-c8d1-4323-90dd-7907a5cbbf8a', // 개인정보보호 비밀유지 서약서
  'bab14b00-5a96-49f8-b5ed-234cc839c7f2', // 안전운행 서약서
  'a1b2c3d4-1111-4aaa-bbbb-000000000001', // 택배용 화물자동차 운송사업 신규허가 신청서
  'a1b2c3d4-2222-4aaa-bbbb-000000000002', // 택배용 화물자동차 전속 운송 계약서
  'a1b2c3d4-3333-4aaa-bbbb-000000000003', // 통합물류협회 개인정보활용 동의서
]);

export default function ContractTemplatesPage() {
  const [templates, setTemplates] = useState<ContractTemplate[]>([]);
  const [principals, setPrincipals] = useState<Principal[]>([]);
  const [loading, setLoading] = useState(true);
  const [agencyId, setAgencyId] = useState<string | null>(null);
  const [userPlan, setUserPlan] = useState<string>('free');
  const [showForm, setShowForm] = useState(false);
  const [saving, setSaving] = useState(false);
  const [previewTemplate, setPreviewTemplate] = useState<ContractTemplate | null>(null);
  const [showPlanGuide, setShowPlanGuide] = useState(false);
  const [templatesLocked, setTemplatesLocked] = useState(false);
  const [userRole, setUserRole] = useState<string>('agency_admin');

  /* ── Form state ── */
  const [formTitle, setFormTitle] = useState('');
  const [formPrincipalId, setFormPrincipalId] = useState('');
  const [formContent, setFormContent] = useState('');

  useEffect(() => {
    async function load() {
      const supabase = createBrowserSupabaseClient();
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) { setLoading(false); return; }
      const aid = user.app_metadata?.agency_id as string | undefined;
      if (!aid) { setLoading(false); return; }
      setAgencyId(aid);
      setUserPlan(user.app_metadata?.plan as string ?? 'free');
      setUserRole(user.app_metadata?.role as string ?? 'agency_admin');

      const [tmplRes, princRes, agencyRes] = await Promise.all([
        getContractTemplates(aid),
        getPrincipals(aid),
        supabase.from('agencies').select('templates_locked').eq('id', aid).single(),
      ]);
      if (tmplRes.data) setTemplates(tmplRes.data);
      if (princRes.data) setPrincipals(princRes.data);
      if (agencyRes.data) {
        setTemplatesLocked((agencyRes.data as { templates_locked: boolean }).templates_locked ?? false);
      }
      setLoading(false);

      // 최초 방문 시 플랜 안내 팝업 표시
      const guideKey = `template_guide_shown_${aid}`;
      if (!sessionStorage.getItem(guideKey)) {
        setShowPlanGuide(true);
        sessionStorage.setItem(guideKey, 'true');
      }
    }
    load();
  }, []);

  function resetForm() {
    setFormTitle('');
    setFormPrincipalId('');
    setFormContent('');
    setShowForm(false);
  }

  async function handleCreate() {
    if (!agencyId || !formTitle.trim() || !formContent.trim()) return;
    setSaving(true);
    const result = await createContractTemplate({
      agency_id: agencyId,
      principal_id: formPrincipalId || undefined,
      title: formTitle.trim(),
      content: formContent.trim(),
    });
    if (result.data) {
      setTemplates((prev) => [...prev, result.data!]);
      resetForm();
    }
    setSaving(false);
  }

  async function handleDelete(id: string, title: string) {
    if (!confirm(`"${title}" 템플릿을 삭제하시겠습니까?`)) return;
    const result = await deleteContractTemplate(id);
    if (!result.error) {
      setTemplates((prev) => prev.filter((t) => t.id !== id));
    }
  }

  async function handleToggleActive(id: string, currentActive: boolean) {
    // 잠금 상태면 변경 불가
    if (templatesLocked) {
      alert('템플릿 선택이 확정되어 변경할 수 없습니다. 변경이 필요하면 관리자에게 문의하세요.');
      return;
    }

    // 기본 템플릿 활성화 시 제한 체크
    if (!currentActive && SYSTEM_TEMPLATE_IDS.has(id)) {
      const currentActiveDefaults = templates.filter((t) => SYSTEM_TEMPLATE_IDS.has(t.id) && t.is_active).length;
      if (currentActiveDefaults >= limits.maxDefaultTemplates) {
        alert(`${PLAN_LABELS[userPlan as PlanType]} 플랜에서는 기본 템플릿을 최대 ${limits.maxDefaultTemplates}개까지 선택할 수 있습니다.`);
        return;
      }
    }
    await updateContractTemplate(id, { is_active: !currentActive });
    setTemplates((prev) => prev.map((t) => t.id === id ? { ...t, is_active: !currentActive } : t));
  }

  function insertVariable(key: string) {
    setFormContent((prev) => prev + `{{${key}}}`);
  }

  const inputCls = 'w-full h-11 px-4 rounded-xl bg-surface-container-low text-on-surface text-sm font-korean focus:outline-none focus:ring-2 focus:ring-primary/30 placeholder:text-on-surface-variant/40';
  const labelCls = 'block text-xs font-label font-medium text-on-surface-variant mb-1.5 font-korean';

  const limits = getPlanLimits(userPlan);
  const paid = isPaidPlan(userPlan as PlanType);
  const isProviderAdmin = userRole === 'provider_admin';
  const isAdmin = userRole === 'provider_admin' || userRole === 'agency_admin';

  // 시스템 템플릿 vs 사용자 업로드 템플릿 구분
  const systemTemplates = templates.filter((t) => SYSTEM_TEMPLATE_IDS.has(t.id));
  const userTemplates = templates.filter((t) => !SYSTEM_TEMPLATE_IDS.has(t.id));

  // 활성화된 기본 템플릿 수
  const activeDefaultCount = systemTemplates.filter((t) => t.is_active).length;
  const canLockTemplates = activeDefaultCount === limits.maxDefaultTemplates && !templatesLocked && paid;

  // 템플릿 확정
  async function handleLockTemplates() {
    if (!agencyId) return;
    if (!confirm(
      `기본 템플릿 ${activeDefaultCount}개, 업로드 템플릿 ${userTemplates.length}개로 확정합니다.\n\n⚠ 확정 후에는 템플릿을 변경할 수 없습니다.\n정말 확정하시겠습니까?`
    )) return;

    const supabase = createBrowserSupabaseClient();
    await supabase.from('agencies').update({ templates_locked: true }).eq('id', agencyId);
    setTemplatesLocked(true);
  }

  // 관리자 잠금 해제
  async function handleUnlockTemplates() {
    if (!agencyId || !isAdmin) return;
    if (!confirm('템플릿 잠금을 해제하시겠습니까? 운영사가 다시 변경할 수 있게 됩니다.')) return;

    const supabase = createBrowserSupabaseClient();
    await supabase.from('agencies').update({ templates_locked: false }).eq('id', agencyId);
    setTemplatesLocked(false);
  }
  const canUploadMore = userTemplates.length < limits.maxUploadTemplates;

  return (
    <div className="space-y-8">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-headline font-bold text-on-surface font-korean">계약서 템플릿</h1>
          <p className="mt-1 text-sm text-on-surface-variant font-korean">계약서 양식을 관리하고 기사 등록 시 자동 전송합니다</p>
          {paid && (
            <p className="mt-0.5 text-xs text-on-surface-variant/60 font-korean">
              {PLAN_LABELS[userPlan as PlanType]} 플랜: 기본 템플릿 {activeDefaultCount}/{limits.maxDefaultTemplates}개 · 업로드 {userTemplates.length}/{limits.maxUploadTemplates}개
              {templatesLocked && <span className="text-error ml-2">🔒 확정됨</span>}
            </p>
          )}
        </div>
        {paid && !templatesLocked && isAdmin && canUploadMore ? (
          <button
            onClick={() => setShowForm(true)}
            className="h-10 px-5 rounded-xl bg-power-gradient text-white font-label text-sm font-semibold shadow-ambient hover:shadow-float transition-all flex items-center gap-2 font-korean"
          >
            <svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor"><path d="M19 13h-6v6h-2v-6H5v-2h6V5h2v6h6v2z"/></svg>
            새 템플릿 만들기
          </button>
        ) : paid && !isAdmin ? (
          <span className="text-xs text-on-surface-variant/50 font-korean">템플릿 추가는 관리자만 가능</span>
        ) : paid && templatesLocked && isAdmin ? (
          <button
            onClick={handleUnlockTemplates}
            className="h-10 px-5 rounded-xl border border-error/30 text-error font-label text-sm font-semibold hover:bg-error/5 transition-all flex items-center gap-2 font-korean"
          >
            🔓 잠금 해제
          </button>
        ) : paid ? (
          <button
            onClick={() => alert(`현재 ${PLAN_LABELS[userPlan as PlanType]} 플랜의 업로드 한도(${limits.maxUploadTemplates}개)를 초과했습니다.\n\n더 많은 템플릿을 사용하려면 상위 플랜으로 업그레이드하세요.\n\n설정 → 구독/결제에서 플랜을 변경할 수 있습니다.`)}
            className="h-10 px-5 rounded-xl border border-amber-400/50 bg-amber-50 text-amber-700 font-label text-sm font-semibold hover:bg-amber-100 transition-all flex items-center gap-2 font-korean"
          >
            ⬆ 플랜 업그레이드
          </button>
        ) : (
          <button
            onClick={() => alert('템플릿 기능은 유료 플랜(Basic 이상)에서 사용할 수 있습니다.\n\n설정 → 구독/결제에서 플랜을 변경하세요.')}
            className="h-10 px-5 rounded-xl border border-amber-400/50 bg-amber-50 text-amber-700 font-label text-sm font-semibold hover:bg-amber-100 transition-all flex items-center gap-2 font-korean"
          >
            ⬆ 플랜 업그레이드
          </button>
        )}
      </div>

      {/* ═══ Creation Form ═══ */}
      {showForm && (
        <div className="bg-surface-container-lowest rounded-2xl shadow-ambient p-6 space-y-5">
          <h2 className="text-lg font-headline font-bold text-on-surface font-korean">새 계약서 템플릿</h2>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className={labelCls}>템플릿 제목 *</label>
              <input
                type="text"
                placeholder="예) 배달 위탁 계약서 (표준)"
                value={formTitle}
                onChange={(e) => setFormTitle(e.target.value)}
                className={inputCls}
              />
            </div>
            <div>
              <label className={labelCls}>적용 카테고리</label>
              <select
                value={formPrincipalId}
                onChange={(e) => setFormPrincipalId(e.target.value)}
                className={inputCls}
              >
                <option value="">전체 카테고리</option>
                {principals.map((p) => (
                  <option key={p.id} value={p.id}>{p.name}</option>
                ))}
              </select>
            </div>
          </div>

          {/* 변수 삽입 버튼 */}
          <div>
            <label className={labelCls}>변수 삽입 (클릭하면 본문에 추가됩니다)</label>
            <div className="flex flex-wrap gap-1.5">
              {CONTRACT_VARIABLES.map((v) => (
                <button
                  key={v.key}
                  onClick={() => insertVariable(v.key)}
                  className="px-2.5 py-1 rounded-lg bg-primary/10 text-primary text-[11px] font-label font-semibold hover:bg-primary/20 transition-colors"
                  title={v.description}
                >
                  {`{{${v.key}}}`}
                </button>
              ))}
            </div>
          </div>

          {/* 계약서 본문 */}
          <div>
            <label className={labelCls}>계약서 본문 *</label>
            <textarea
              value={formContent}
              onChange={(e) => setFormContent(e.target.value)}
              placeholder={`운송 위탁 계약서\n\n제1조 (계약 당사자)\n갑: {{대리점명}}\n을: {{기사명}} (전화: {{전화번호}})\n\n제2조 (계약 내용)\n배송 단가: {{배송단가}}\n계약일: {{계약일}}\n\n...`}
              rows={12}
              className="w-full px-4 py-3 rounded-xl bg-surface-container-low text-on-surface text-sm font-korean focus:outline-none focus:ring-2 focus:ring-primary/30 placeholder:text-on-surface-variant/40 resize-y"
            />
          </div>

          <div className="flex justify-end gap-3">
            <button
              onClick={resetForm}
              className="h-10 px-6 rounded-xl bg-surface-container-high text-on-surface-variant font-label text-sm hover:bg-surface-container-highest transition-colors font-korean"
            >
              취소
            </button>
            <button
              onClick={handleCreate}
              disabled={saving || !formTitle.trim() || !formContent.trim()}
              className="h-10 px-6 rounded-xl bg-power-gradient text-white font-label font-semibold text-sm hover:shadow-lg transition-shadow disabled:opacity-50 font-korean"
            >
              {saving ? '생성 중...' : '템플릿 생성'}
            </button>
          </div>
        </div>
      )}

      {/* ═══ 잠금 배너 ═══ */}
      {templatesLocked && (
        <div className="bg-error/5 border border-error/20 rounded-2xl p-5 flex items-center gap-4">
          <div className="w-10 h-10 rounded-xl bg-error/10 flex items-center justify-center text-xl shrink-0">🔒</div>
          <div className="flex-1">
            <p className="text-sm font-semibold text-on-surface font-korean">템플릿 선택이 확정되었습니다</p>
            <p className="text-xs text-on-surface-variant font-korean mt-0.5">
              기본 템플릿 {activeDefaultCount}개, 업로드 템플릿 {userTemplates.length}개가 확정되었습니다. 변경이 필요하면 관리자에게 문의하세요.
            </p>
          </div>
        </div>
      )}

      {/* ═══ 확정 버튼 ═══ */}
      {canLockTemplates && (
        <div className="bg-amber-50 border border-amber-200 rounded-2xl p-5 flex items-center justify-between">
          <div className="flex items-center gap-4">
            <div className="w-10 h-10 rounded-xl bg-amber-100 flex items-center justify-center text-xl shrink-0">⚠️</div>
            <div>
              <p className="text-sm font-semibold text-on-surface font-korean">
                기본 템플릿 {activeDefaultCount}/{limits.maxDefaultTemplates}개 선택 완료
              </p>
              <p className="text-xs text-on-surface-variant font-korean mt-0.5">
                확정 후에는 템플릿을 변경할 수 없습니다. 신중하게 선택해주세요.
              </p>
            </div>
          </div>
          <button
            onClick={handleLockTemplates}
            className="h-10 px-6 rounded-xl bg-gradient-to-r from-amber-500 to-orange-500 text-white font-label text-sm font-bold hover:shadow-lg transition-all shrink-0 font-korean"
          >
            선택 확정하기
          </button>
        </div>
      )}

      {/* ═══ Template Cards ═══ */}
      {loading ? (
        <div className="bg-surface-container-lowest rounded-2xl shadow-ambient p-12 text-center">
          <span className="text-sm text-on-surface-variant font-korean">불러오는 중...</span>
        </div>
      ) : templates.length === 0 ? (
        <div className="bg-surface-container-lowest rounded-2xl shadow-ambient p-12 text-center space-y-3">
          <div className="text-4xl">📋</div>
          <p className="text-sm text-on-surface-variant font-korean">등록된 계약서 템플릿이 없습니다</p>
          <p className="text-xs text-on-surface-variant/60 font-korean">
            &quot;새 템플릿 만들기&quot; 버튼을 눌러 계약서를 등록하세요
          </p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
          {templates.map((tmpl) => {
            const isSystem = SYSTEM_TEMPLATE_IDS.has(tmpl.id);
            return (
            <div
              key={tmpl.id}
              className={`bg-surface-container-lowest rounded-2xl shadow-ambient p-6 flex flex-col justify-between transition-transform hover:scale-[1.01] ${
                !tmpl.is_active ? 'opacity-40 grayscale scale-[0.98]' : ''
              }`}
            >
              <div>
                <div className="flex items-center justify-between mb-3">
                  <div className="flex items-center gap-2">
                    {tmpl.principals?.name ? (
                      <Badge label={tmpl.principals.name} variant="info" />
                    ) : (
                      <Badge label="전체" variant="default" />
                    )}
                    {isSystem && (
                      <Badge label="기본양식" variant="warning" />
                    )}
                  </div>
                  {/* 활성화/비활성화 토글 */}
                  <label className={`flex items-center gap-2 ${templatesLocked ? 'opacity-50 cursor-not-allowed' : 'cursor-pointer'}`}>
                    <span className="text-xs text-on-surface-variant font-korean">
                      {templatesLocked ? '🔒' : tmpl.is_active ? '사용중' : '미사용'}
                    </span>
                    <div
                      className={`relative w-10 h-5 rounded-full transition-colors ${
                        tmpl.is_active ? 'bg-primary' : 'bg-surface-container-high'
                      } ${templatesLocked ? 'pointer-events-none' : ''}`}
                      onClick={() => !templatesLocked && handleToggleActive(tmpl.id, tmpl.is_active)}
                    >
                      <div
                        className={`absolute top-0.5 w-4 h-4 rounded-full bg-white shadow transition-transform ${
                          tmpl.is_active ? 'translate-x-5' : 'translate-x-0.5'
                        }`}
                      />
                    </div>
                  </label>
                </div>
                <h3 className="text-base font-headline font-bold text-on-surface font-korean">{tmpl.title}</h3>
                <p className="text-xs text-on-surface-variant mt-1 font-korean line-clamp-2">
                  {tmpl.content.substring(0, 100)}...
                </p>
              </div>

              <div className="mt-5 flex items-center justify-between">
                <span className="text-xs text-on-surface-variant font-data">
                  {new Date(tmpl.created_at).toLocaleDateString('ko-KR')}
                </span>
                <div className="flex gap-2">
                  <button
                    onClick={() => setPreviewTemplate(tmpl)}
                    className="h-8 px-3 rounded-lg bg-primary/10 text-primary font-label text-xs font-semibold hover:bg-primary/20 transition-colors font-korean"
                  >
                    미리보기
                  </button>
                  {!isSystem && (
                    <button
                      onClick={() => handleDelete(tmpl.id, tmpl.title)}
                      className="h-8 px-3 rounded-lg text-error text-xs font-label hover:bg-error/10 transition-colors font-korean"
                    >
                      삭제
                    </button>
                  )}
                </div>
              </div>
            </div>
            );
          })}
        </div>
      )}

      {/* ═══ Preview Modal ═══ */}
      {previewTemplate && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4" onClick={() => setPreviewTemplate(null)}>
          <div
            className="bg-surface-container-lowest rounded-2xl shadow-float w-full max-w-3xl max-h-[85vh] flex flex-col"
            onClick={(e) => e.stopPropagation()}
          >
            {/* Header */}
            <div className="flex items-center justify-between p-6 border-b border-outline-variant/20">
              <div>
                <h2 className="text-lg font-headline font-bold text-on-surface font-korean">{previewTemplate.title}</h2>
                <p className="text-xs text-on-surface-variant mt-1 font-korean">
                  {previewTemplate.principals?.name ? `카테고리: ${previewTemplate.principals.name}` : '전체 카테고리'} · 등록일: {new Date(previewTemplate.created_at).toLocaleDateString('ko-KR')}
                </p>
              </div>
              <button
                onClick={() => setPreviewTemplate(null)}
                className="w-8 h-8 rounded-lg bg-surface-container-high flex items-center justify-center hover:bg-surface-container-highest transition-colors"
              >
                ✕
              </button>
            </div>

            {/* Body — 변수 하이라이트 */}
            <div className="flex-1 overflow-y-auto p-6">
              <div className="bg-surface-container-low rounded-xl p-5 text-sm font-korean leading-relaxed whitespace-pre-wrap">
                {previewTemplate.content.split(/(\{\{[^}]+\}\})/).map((part, i) =>
                  /^\{\{.+\}\}$/.test(part) ? (
                    <span key={i} className="inline-block bg-primary/15 text-primary font-semibold px-1 rounded text-xs mx-0.5">
                      {part}
                    </span>
                  ) : (
                    <span key={i}>{part}</span>
                  )
                )}
              </div>
            </div>

            {/* Footer — 변수 목록 */}
            <div className="p-4 border-t border-outline-variant/20 bg-surface-container-low rounded-b-2xl">
              <p className="text-xs text-on-surface-variant mb-2 font-korean font-semibold">사용된 변수:</p>
              <div className="flex flex-wrap gap-1.5">
                {Array.from(previewTemplate.content.matchAll(/\{\{([^}]+)\}\}/g)).map((m, i) => (
                  <span key={i} className="px-2 py-0.5 rounded bg-primary/10 text-primary text-[10px] font-label font-semibold">
                    {`{{${m[1]}}}`}
                  </span>
                ))}
                {!previewTemplate.content.includes('{{') && (
                  <span className="text-xs text-on-surface-variant/60 font-korean">변수 없음</span>
                )}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ═══ Plan Guide Popup ═══ */}
      {showPlanGuide && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4" onClick={() => setShowPlanGuide(false)}>
          <div
            className="bg-surface-container-lowest rounded-2xl shadow-float w-full max-w-lg"
            onClick={(e) => e.stopPropagation()}
          >
            {/* Header */}
            <div className="bg-gradient-to-r from-[#004ac6] to-[#2563eb] rounded-t-2xl p-6 text-white text-center">
              <div className="w-14 h-14 rounded-2xl bg-white/20 flex items-center justify-center mx-auto mb-3">
                <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M14.5 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V7.5L14.5 2z" />
                  <polyline points="14 2 14 8 20 8" />
                </svg>
              </div>
              <h2 className="text-xl font-bold">계약서 템플릿 안내</h2>
              <p className="text-white/80 text-sm mt-1">현재 <span className="font-bold text-white">{PLAN_LABELS[userPlan as PlanType]}</span> 플랜</p>
            </div>

            {/* Body */}
            <div className="p-6 space-y-5">
              {/* 할당량 카드 */}
              <div className="grid grid-cols-2 gap-3">
                <div className="bg-primary/[0.06] rounded-xl p-4 text-center">
                  <p className="text-2xl font-extrabold text-primary">{limits.maxDefaultTemplates}개</p>
                  <p className="text-xs text-on-surface-variant mt-1 font-medium">기본 템플릿 선택</p>
                </div>
                <div className="bg-tertiary/[0.06] rounded-xl p-4 text-center">
                  <p className="text-2xl font-extrabold text-tertiary">{limits.maxUploadTemplates}개</p>
                  <p className="text-xs text-on-surface-variant mt-1 font-medium">업로드 계약서</p>
                </div>
              </div>

              {/* 안내 문구 */}
              <div className="space-y-3 text-sm text-on-surface-variant">
                <div className="flex items-start gap-3">
                  <span className="w-6 h-6 rounded-full bg-primary/10 text-primary flex items-center justify-center text-xs font-bold shrink-0 mt-0.5">1</span>
                  <p><span className="font-semibold text-on-surface">기본 템플릿</span>은 시스템에서 제공하는 표준 양식입니다. 플랜에 따라 {limits.maxDefaultTemplates}개까지 활성화할 수 있습니다.</p>
                </div>
                <div className="flex items-start gap-3">
                  <span className="w-6 h-6 rounded-full bg-tertiary/10 text-tertiary flex items-center justify-center text-xs font-bold shrink-0 mt-0.5">2</span>
                  <p><span className="font-semibold text-on-surface">업로드 계약서</span>는 직접 작성하여 등록하는 양식입니다. 최대 {limits.maxUploadTemplates}개까지 등록 가능합니다.</p>
                </div>
                <div className="flex items-start gap-3">
                  <span className="w-6 h-6 rounded-full bg-error/10 text-error flex items-center justify-center text-xs font-bold shrink-0 mt-0.5">!</span>
                  <p><span className="font-semibold text-on-surface">템플릿 선택은 신중하게</span> 해주세요. 활성화된 템플릿은 기사 등록 시 자동으로 계약서 발송에 사용됩니다.</p>
                </div>
              </div>

              {/* 플랜별 비교 */}
              {!isPaidPlan(userPlan as PlanType) && (
                <div className="bg-surface-container-low rounded-xl p-4">
                  <p className="text-xs font-semibold text-on-surface mb-2">💡 유료 플랜 업그레이드 시</p>
                  <div className="grid grid-cols-3 gap-2 text-center text-xs">
                    <div>
                      <p className="font-bold text-primary">Basic</p>
                      <p className="text-on-surface-variant">기본 3개 + 업로드 3개</p>
                    </div>
                    <div>
                      <p className="font-bold text-primary">Standard</p>
                      <p className="text-on-surface-variant">기본 6개 + 업로드 6개</p>
                    </div>
                    <div>
                      <p className="font-bold text-primary">Enterprise</p>
                      <p className="text-on-surface-variant">기본 10개 + 업로드 10개</p>
                    </div>
                  </div>
                </div>
              )}
            </div>

            {/* Footer */}
            <div className="px-6 pb-6">
              <button
                onClick={() => setShowPlanGuide(false)}
                className="w-full h-12 rounded-xl bg-gradient-to-r from-[#004ac6] to-[#2563eb] text-white font-bold text-sm hover:shadow-lg hover:shadow-blue-500/20 transition-all"
              >
                확인했습니다
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Tips */}
      <div className="bg-surface-container-low rounded-2xl p-6">
        <h3 className="text-sm font-headline font-bold text-on-surface font-korean mb-3">템플릿 사용 안내</h3>
        <ul className="space-y-2 text-xs text-on-surface-variant font-korean">
          <li className="flex items-start gap-2">
            <span className="text-primary mt-0.5">1.</span>
            기사 등록 시 해당 카테고리의 템플릿이 자동으로 표시되며, 선택한 계약서가 즉시 전송됩니다.
          </li>
          <li className="flex items-start gap-2">
            <span className="text-primary mt-0.5">2.</span>
            <span>{'{{기사명}}, {{배송단가}}, {{계약일}}'} 등의 변수를 사용하면 전송 시 자동으로 채워집니다.</span>
          </li>
          <li className="flex items-start gap-2">
            <span className="text-primary mt-0.5">3.</span>
            기사는 앱에서 계약서를 확인하고 전자서명을 진행합니다. 서명 완료 시 알림이 발송됩니다.
          </li>
        </ul>
      </div>
    </div>
  );
}
