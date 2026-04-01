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
      setUserPlan(user.user_metadata?.plan as string ?? 'free');
      const [tmplRes, princRes] = await Promise.all([
        getContractTemplates(aid),
        getPrincipals(aid),
      ]);
      if (tmplRes.data) setTemplates(tmplRes.data);
      if (princRes.data) setPrincipals(princRes.data);
      setLoading(false);
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

  // 시스템 템플릿 vs 사용자 업로드 템플릿 구분
  const systemTemplates = templates.filter((t) => SYSTEM_TEMPLATE_IDS.has(t.id));
  const userTemplates = templates.filter((t) => !SYSTEM_TEMPLATE_IDS.has(t.id));

  // 활성화된 기본 템플릿 수
  const activeDefaultCount = systemTemplates.filter((t) => t.is_active).length;
  const canActivateDefault = activeDefaultCount < limits.maxDefaultTemplates;
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
            </p>
          )}
        </div>
        {paid && canUploadMore ? (
          <button
            onClick={() => setShowForm(true)}
            className="h-10 px-5 rounded-xl bg-power-gradient text-white font-label text-sm font-semibold shadow-ambient hover:shadow-float transition-all flex items-center gap-2 font-korean"
          >
            <svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor"><path d="M19 13h-6v6h-2v-6H5v-2h6V5h2v6h6v2z"/></svg>
            새 템플릿 만들기
          </button>
        ) : paid ? (
          <span className="text-xs text-on-surface-variant/50 font-korean">업로드 한도 초과 ({limits.maxUploadTemplates}개)</span>
        ) : (
          <span className="text-xs text-on-surface-variant/50 font-korean">유료 플랜에서 사용 가능</span>
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
                !tmpl.is_active ? 'opacity-50' : ''
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
                  <label className="flex items-center gap-2 cursor-pointer">
                    <span className="text-xs text-on-surface-variant font-korean">
                      {tmpl.is_active ? '사용중' : '미사용'}
                    </span>
                    <div
                      className={`relative w-10 h-5 rounded-full transition-colors ${
                        tmpl.is_active ? 'bg-primary' : 'bg-surface-container-high'
                      }`}
                      onClick={() => handleToggleActive(tmpl.id, tmpl.is_active)}
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
