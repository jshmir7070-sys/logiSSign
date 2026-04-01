'use client';

import { useEffect, useState } from 'react';
import Badge from '@/components/shared/Badge';
import { createBrowserSupabaseClient } from '@/lib/supabase';

interface SystemTemplate {
  id: string;
  title: string;
  content: string;
  category: string | null;
  is_active: boolean;
  created_at: string;
}

export default function AdminTemplatesPage() {
  const [templates, setTemplates] = useState<SystemTemplate[]>([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  const [formTitle, setFormTitle] = useState('');
  const [formContent, setFormContent] = useState('');
  const [formCategory, setFormCategory] = useState('standard');

  const supabase = createBrowserSupabaseClient();

  const loadTemplates = async () => {
    setLoading(true);
    const { data } = await supabase
      .from('contract_templates')
      .select('id, title, content, category, is_active, created_at')
      .is('agency_id', null) // 시스템 템플릿만 (agency_id가 null)
      .order('created_at', { ascending: true });
    setTemplates((data ?? []) as SystemTemplate[]);
    setLoading(false);
  };

  useEffect(() => { loadTemplates(); }, []);

  const resetForm = () => {
    setFormTitle('');
    setFormContent('');
    setFormCategory('standard');
    setShowForm(false);
    setEditingId(null);
  };

  const handleEdit = (tmpl: SystemTemplate) => {
    setFormTitle(tmpl.title);
    setFormContent(tmpl.content);
    setFormCategory(tmpl.category ?? 'standard');
    setEditingId(tmpl.id);
    setShowForm(true);
  };

  const handleSave = async () => {
    if (!formTitle.trim() || !formContent.trim()) return;
    setSaving(true);

    if (editingId) {
      await supabase
        .from('contract_templates')
        .update({ title: formTitle.trim(), content: formContent.trim(), category: formCategory })
        .eq('id', editingId);
    } else {
      await supabase
        .from('contract_templates')
        .insert({
          title: formTitle.trim(),
          content: formContent.trim(),
          category: formCategory,
          agency_id: null, // 시스템 템플릿
          is_active: true,
        });
    }

    setSaving(false);
    resetForm();
    loadTemplates();
  };

  const handleDelete = async (id: string, title: string) => {
    if (!confirm(`"${title}" 템플릿을 삭제하시겠습니까?\n\n운영사들이 이미 선택한 경우 영향이 있을 수 있습니다.`)) return;
    await supabase.from('contract_templates').delete().eq('id', id);
    loadTemplates();
  };

  const handleToggle = async (id: string, current: boolean) => {
    await supabase.from('contract_templates').update({ is_active: !current }).eq('id', id);
    setTemplates(prev => prev.map(t => t.id === id ? { ...t, is_active: !current } : t));
  };

  const CONTRACT_VARIABLES = [
    '기사명', '전화번호', '주소', '사번', '카테고리명', '배송지역',
    '배송단가', '반품단가', '집하단가', '계약시작일', '계약종료일', '계약일',
    '대리점명', '대리점사업자번호', '대리점주소', '대리점대표자',
    '사업자번호', '대표자명', '사업장주소', '차량번호', '차종', '연식',
  ];

  const inputCls = 'w-full h-11 px-4 rounded-xl bg-surface-container-low text-on-surface text-sm font-korean focus:outline-none focus:ring-2 focus:ring-primary/30 placeholder:text-on-surface-variant/40';

  return (
    <div className="space-y-8">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-headline font-bold text-on-surface font-korean">시스템 계약서 템플릿</h1>
          <p className="mt-1 text-sm text-on-surface-variant font-korean">
            모든 운영사가 선택할 수 있는 기본 계약서 양식을 관리합니다
          </p>
          <p className="mt-0.5 text-xs text-on-surface-variant/60 font-korean">
            현재 {templates.length}개 등록 · 운영사들은 플랜에 따라 이 중 일부를 선택합니다
          </p>
        </div>
        <button
          onClick={() => { resetForm(); setShowForm(true); }}
          className="h-10 px-5 rounded-xl bg-power-gradient text-white font-label text-sm font-semibold shadow-ambient hover:shadow-float transition-all flex items-center gap-2 font-korean"
        >
          <svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor"><path d="M19 13h-6v6h-2v-6H5v-2h6V5h2v6h6v2z"/></svg>
          새 템플릿 등록
        </button>
      </div>

      {/* 등록/수정 폼 */}
      {showForm && (
        <div className="bg-surface-container-lowest rounded-2xl shadow-ambient p-6 space-y-5">
          <h2 className="text-lg font-headline font-bold text-on-surface font-korean">
            {editingId ? '템플릿 수정' : '새 시스템 템플릿'}
          </h2>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-label font-medium text-on-surface-variant mb-1.5 font-korean">템플릿 제목 *</label>
              <input type="text" value={formTitle} onChange={e => setFormTitle(e.target.value)}
                placeholder="예) 영업점-택배기사 위수탁 표준계약서" className={inputCls} />
            </div>
            <div>
              <label className="block text-xs font-label font-medium text-on-surface-variant mb-1.5 font-korean">분류</label>
              <select value={formCategory} onChange={e => setFormCategory(e.target.value)} className={inputCls}>
                <option value="standard">표준계약서</option>
                <option value="supplementary">부속합의서</option>
                <option value="consent">동의서/서약서</option>
                <option value="government">관공서 양식</option>
              </select>
            </div>
          </div>

          {/* 변수 삽입 */}
          <div>
            <label className="block text-xs font-label font-medium text-on-surface-variant mb-1.5 font-korean">
              변수 삽입 <span className="text-on-surface-variant/50">(클릭하면 본문에 추가)</span>
            </label>
            <div className="flex flex-wrap gap-1.5">
              {CONTRACT_VARIABLES.map(v => (
                <button key={v} type="button"
                  onClick={() => setFormContent(prev => prev + `{{${v}}}`)}
                  className="px-2 py-1 rounded-lg bg-primary/10 text-primary text-[11px] font-label font-semibold hover:bg-primary/20">
                  {`{{${v}}}`}
                </button>
              ))}
            </div>
          </div>

          {/* 본문 */}
          <div>
            <label className="block text-xs font-label font-medium text-on-surface-variant mb-1.5 font-korean">계약서 본문 *</label>
            <textarea value={formContent} onChange={e => setFormContent(e.target.value)}
              placeholder="계약서 본문을 작성하세요. {{기사명}}, {{대리점명}} 등 변수를 사용할 수 있습니다."
              rows={16}
              className="w-full px-4 py-3 rounded-xl bg-surface-container-low text-on-surface text-sm font-korean focus:outline-none focus:ring-2 focus:ring-primary/30 resize-y" />
          </div>

          <div className="flex justify-end gap-3">
            <button onClick={resetForm}
              className="h-10 px-6 rounded-xl bg-surface-container-high text-on-surface-variant font-label text-sm font-korean">취소</button>
            <button onClick={handleSave} disabled={saving || !formTitle.trim() || !formContent.trim()}
              className="h-10 px-6 rounded-xl bg-power-gradient text-white font-label font-semibold text-sm disabled:opacity-50 font-korean">
              {saving ? '저장 중...' : editingId ? '수정 완료' : '템플릿 등록'}
            </button>
          </div>
        </div>
      )}

      {/* 템플릿 목록 */}
      {loading ? (
        <div className="bg-surface-container-lowest rounded-2xl shadow-ambient p-12 text-center">
          <span className="text-sm text-on-surface-variant font-korean">불러오는 중...</span>
        </div>
      ) : templates.length === 0 ? (
        <div className="bg-surface-container-lowest rounded-2xl shadow-ambient p-12 text-center space-y-3">
          <div className="text-4xl">📋</div>
          <p className="text-sm text-on-surface-variant font-korean">등록된 시스템 템플릿이 없습니다</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
          {templates.map(tmpl => (
            <div key={tmpl.id}
              className={`bg-surface-container-lowest rounded-2xl shadow-ambient p-6 flex flex-col justify-between transition-all ${
                !tmpl.is_active ? 'opacity-40 grayscale' : ''
              }`}>
              <div>
                <div className="flex items-center justify-between mb-3">
                  <div className="flex items-center gap-2">
                    <Badge label={
                      tmpl.category === 'standard' ? '표준계약서' :
                      tmpl.category === 'supplementary' ? '부속합의서' :
                      tmpl.category === 'consent' ? '동의서' :
                      tmpl.category === 'government' ? '관공서' : '기타'
                    } variant="info" />
                    <Badge label="시스템" variant="warning" />
                  </div>
                  <label className="flex items-center gap-2 cursor-pointer">
                    <span className="text-xs text-on-surface-variant font-korean">
                      {tmpl.is_active ? '활성' : '비활성'}
                    </span>
                    <div className={`relative w-10 h-5 rounded-full transition-colors ${tmpl.is_active ? 'bg-primary' : 'bg-surface-container-high'}`}
                      onClick={() => handleToggle(tmpl.id, tmpl.is_active)}>
                      <div className={`absolute top-0.5 w-4 h-4 rounded-full bg-white shadow transition-transform ${tmpl.is_active ? 'translate-x-5' : 'translate-x-0.5'}`} />
                    </div>
                  </label>
                </div>
                <h3 className="text-base font-headline font-bold text-on-surface font-korean">{tmpl.title}</h3>
                <p className="text-xs text-on-surface-variant mt-1 font-korean line-clamp-2">{tmpl.content.substring(0, 100)}...</p>
                <p className="text-[10px] text-on-surface-variant/50 mt-2 font-data">ID: {tmpl.id.slice(0, 8)}...</p>
              </div>
              <div className="mt-4 flex gap-2">
                <button onClick={() => handleEdit(tmpl)}
                  className="flex-1 h-8 rounded-lg bg-primary/10 text-primary font-label text-xs font-semibold hover:bg-primary/20 font-korean">수정</button>
                <button onClick={() => handleDelete(tmpl.id, tmpl.title)}
                  className="h-8 px-3 rounded-lg text-error text-xs font-label hover:bg-error/10 font-korean">삭제</button>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* 안내 */}
      <div className="bg-surface-container-low rounded-2xl p-6">
        <h3 className="text-sm font-headline font-bold text-on-surface font-korean mb-3">관리자 안내</h3>
        <ul className="space-y-2 text-xs text-on-surface-variant font-korean">
          <li>• 여기서 등록한 템플릿은 <strong>모든 운영사</strong>가 플랜 한도 내에서 선택할 수 있습니다.</li>
          <li>• 운영사는 템플릿을 직접 추가할 수 없고, 관리자가 등록한 것만 선택합니다.</li>
          <li>• <code className="bg-primary/10 text-primary px-1 rounded">{`{{기사명}}`}</code> 형태의 변수는 발송 시 자동 치환됩니다.</li>
          <li>• 템플릿을 비활성화하면 운영사 선택 목록에서 숨겨집니다.</li>
        </ul>
      </div>
    </div>
  );
}
