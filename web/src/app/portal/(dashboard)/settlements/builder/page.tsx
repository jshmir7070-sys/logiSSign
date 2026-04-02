'use client';

import { useEffect, useState, useCallback } from 'react';
import { createBrowserSupabaseClient } from '@/lib/supabase';
import {
  getSettlementTemplates,
  createSettlementTemplate,
  updateSettlementTemplate,
  deleteSettlementTemplate,
  type SettlementTemplateRow,
} from '@/services/settlement-template.service';
import {
  type SettlementTemplate,
  type SettlementItem,
  type SettlementDriverData,
  type SettlementMeta,
  DEFAULT_TEMPLATE,
  PRESET_TEMPLATES,
} from '@/types/settlement-template';
import { generateSettlementPdf } from '@/services/settlement-pdf.service';

/* ── Sample Data ── */
const SAMPLE_DRIVER: SettlementDriverData = {
  name: '홍길동',
  id: 'DRV001',
  phone: '010-1234-5678',
  region: '서울 강남',
  period: '2026년 3월 1일 ~ 31일',
  incomeItems: { '기본운임': 520000, '프레쉬백 인센티브': 35000, '추가 인센티브': 12000 },
  deductionItems: { '수수료 (3.3%)': 18700, '보험료': 15000, '장비 임대': 30000 },
  incomeTotal: 567000,
  deductionTotal: 63700,
  netAmount: 503300,
};

/* ── Helpers ── */
function formatKRW(n: number): string {
  if (n < 0) return `-₩${Math.abs(n).toLocaleString('ko-KR')}`;
  return `₩${n.toLocaleString('ko-KR')}`;
}

function makeId(): string {
  return Math.random().toString(36).slice(2, 8);
}

/* ── Color Picker ── */
const COLOR_PRESETS = [
  '#1a1a1a', '#374151', '#1a56db', '#7B2FF7', '#dc2626',
  '#059669', '#d97706', '#6366f1', '#ec4899', '#0891b2',
];

function ColorPicker({ value, onChange, label }: { value: string; onChange: (c: string) => void; label: string }) {
  return (
    <div>
      <label className="block text-[11px] font-medium text-on-surface-variant mb-1 font-korean">{label}</label>
      <div className="flex items-center gap-1.5">
        {COLOR_PRESETS.map(c => (
          <button key={c} onClick={() => onChange(c)}
            className={`w-5 h-5 rounded-full border-2 transition-all ${value === c ? 'border-primary scale-110' : 'border-transparent'}`}
            style={{ backgroundColor: c }} />
        ))}
        <input type="color" value={value} onChange={e => onChange(e.target.value)}
          className="w-5 h-5 rounded cursor-pointer border-0 p-0" />
      </div>
    </div>
  );
}

/* ── Main Page ── */
export default function SettlementBuilderPage() {
  const [agencyId, setAgencyId] = useState<string | null>(null);
  const [agencyName, setAgencyName] = useState('');
  const [customTemplates, setCustomTemplates] = useState<SettlementTemplateRow[]>([]);
  const [template, setTemplate] = useState<SettlementTemplate>({ ...DEFAULT_TEMPLATE });
  const [editingId, setEditingId] = useState<string | null>(null); // null = new
  const [templateName, setTemplateName] = useState('');
  const [saving, setSaving] = useState(false);
  const [previewPdf, setPreviewPdf] = useState<string | null>(null);
  const [generating, setGenerating] = useState(false);
  const [activeTab, setActiveTab] = useState<'presets' | 'title' | 'items' | 'style' | 'footer'>('presets');

  useEffect(() => {
    async function init() {
      const supabase = createBrowserSupabaseClient();
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;
      const aid = user.app_metadata?.agency_id as string;
      setAgencyId(aid);
      const { data: agency } = await supabase.from('agencies').select('name').eq('id', aid).single();
      setAgencyName((agency as Record<string, string>)?.name ?? '');
      const result = await getSettlementTemplates(aid);
      setCustomTemplates(result.custom);
    }
    init();
  }, []);

  /* ── Template Actions ── */
  const selectPreset = (presetId: string) => {
    const preset = PRESET_TEMPLATES.find(p => p.id === presetId);
    if (preset) {
      setTemplate({ ...preset.template });
      setTemplateName(preset.name);
      setEditingId(null);
    }
  };

  const selectCustom = (row: SettlementTemplateRow) => {
    setTemplate(row.template_config);
    setTemplateName(row.name);
    setEditingId(row.id);
  };

  const handleSave = async () => {
    if (!agencyId || !templateName.trim()) return;
    setSaving(true);
    if (editingId) {
      await updateSettlementTemplate(editingId, { name: templateName, template_config: template });
    } else {
      const result = await createSettlementTemplate({
        agency_id: agencyId,
        name: templateName,
        template_config: template,
      });
      if (result.data) setEditingId(result.data.id);
    }
    const updated = await getSettlementTemplates(agencyId);
    setCustomTemplates(updated.custom);
    setSaving(false);
  };

  const handleDelete = async () => {
    if (!editingId || !confirm('이 템플릿을 삭제하시겠습니까?')) return;
    await deleteSettlementTemplate(editingId);
    if (agencyId) {
      const updated = await getSettlementTemplates(agencyId);
      setCustomTemplates(updated.custom);
    }
    setTemplate({ ...DEFAULT_TEMPLATE });
    setTemplateName('');
    setEditingId(null);
  };

  /* ── Preview ── */
  const handlePreview = useCallback(async () => {
    setGenerating(true);
    try {
      const now = new Date();
      const meta: SettlementMeta = {
        agencyName: agencyName || '테스트 대리점',
        year: now.getFullYear(),
        month: now.getMonth() + 1,
        generatedAt: now.toLocaleDateString('ko-KR'),
      };
      // 템플릿에 항목이 비어있으면 샘플 데이터 기반 자동 생성
      const tpl = { ...template };
      if (tpl.incomeSection.items.length === 0) {
        tpl.incomeSection.items = Object.keys(SAMPLE_DRIVER.incomeItems).map(label => ({
          id: makeId(), label, field: label, enabled: true, numberFormat: 'currency' as const,
        }));
      }
      if (tpl.deductionSection.items.length === 0) {
        tpl.deductionSection.items = Object.keys(SAMPLE_DRIVER.deductionItems).map(label => ({
          id: makeId(), label, field: label, enabled: true, numberFormat: 'currency' as const,
        }));
      }
      const pdfBytes = await generateSettlementPdf(tpl, SAMPLE_DRIVER, meta);
      const blob = new Blob([pdfBytes.buffer as ArrayBuffer], { type: 'application/pdf' });
      const url = URL.createObjectURL(blob);
      setPreviewPdf(url);
    } catch (err) {
      alert('PDF 생성 실패: ' + (err instanceof Error ? err.message : ''));
    }
    setGenerating(false);
  }, [template, agencyName]);

  /* ── Item Management ── */
  const addItem = (section: 'income' | 'deduction') => {
    const key = section === 'income' ? 'incomeSection' : 'deductionSection';
    setTemplate(prev => ({
      ...prev,
      [key]: {
        ...prev[key],
        items: [...prev[key].items, {
          id: makeId(),
          label: '',
          field: '',
          enabled: true,
          numberFormat: 'currency' as const,
        }],
      },
    }));
  };

  const updateItem = (section: 'income' | 'deduction', id: string, updates: Partial<SettlementItem>) => {
    const key = section === 'income' ? 'incomeSection' : 'deductionSection';
    setTemplate(prev => ({
      ...prev,
      [key]: {
        ...prev[key],
        items: prev[key].items.map(i => i.id === id ? { ...i, ...updates } : i),
      },
    }));
  };

  const removeItem = (section: 'income' | 'deduction', id: string) => {
    const key = section === 'income' ? 'incomeSection' : 'deductionSection';
    setTemplate(prev => ({
      ...prev,
      [key]: {
        ...prev[key],
        items: prev[key].items.filter(i => i.id !== id),
      },
    }));
  };

  const inputCls = 'w-full h-9 px-3 rounded-lg bg-surface-container-low text-sm text-on-surface focus:outline-none focus:ring-2 focus:ring-primary/30 placeholder:text-on-surface-variant/40 font-korean';

  /* ── Tab Configs ── */
  const tabs = [
    { id: 'presets' as const, label: '프리셋' },
    { id: 'title' as const, label: '타이틀' },
    { id: 'items' as const, label: '항목 설정' },
    { id: 'style' as const, label: '스타일' },
    { id: 'footer' as const, label: '푸터' },
  ];

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-headline font-bold text-on-surface font-korean">정산서 빌더</h1>
          <p className="mt-1 text-sm text-on-surface-variant font-korean">정산서 템플릿을 커스터마이징하고 미리보기합니다</p>
        </div>
        <div className="flex items-center gap-3">
          <button onClick={handlePreview} disabled={generating}
            className="h-10 px-5 rounded-xl bg-surface-container-low text-on-surface-variant text-sm font-semibold font-korean hover:bg-surface-container-high transition-colors flex items-center gap-2 disabled:opacity-50">
            {generating ? (
              <><svg className="animate-spin w-4 h-4" viewBox="0 0 24 24" fill="none"><circle cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="3" opacity="0.3"/><path d="M12 2a10 10 0 0110 10" stroke="currentColor" strokeWidth="3" strokeLinecap="round"/></svg> 생성 중...</>
            ) : '📄 미리보기'}
          </button>
          <button onClick={handleSave} disabled={saving || !templateName.trim()}
            className="h-10 px-5 rounded-xl bg-primary text-white text-sm font-semibold font-korean hover:bg-primary/90 transition-colors disabled:opacity-50">
            {saving ? '저장 중...' : editingId ? '수정 저장' : '새로 저장'}
          </button>
        </div>
      </div>

      {/* Template Name */}
      <div className="flex items-center gap-4">
        <input type="text" value={templateName} onChange={e => setTemplateName(e.target.value)}
          placeholder="템플릿 이름을 입력하세요" className={`${inputCls} max-w-xs`} />
        {editingId && (
          <button onClick={handleDelete} className="text-xs text-error hover:underline font-korean">삭제</button>
        )}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Left: Editor */}
        <div className="lg:col-span-2 space-y-4">
          {/* Tabs */}
          <div className="flex gap-2">
            {tabs.map(t => (
              <button key={t.id} onClick={() => setActiveTab(t.id)}
                className={`px-4 py-2 rounded-xl text-sm font-label font-medium transition-colors font-korean ${
                  activeTab === t.id ? 'bg-primary text-white' : 'bg-surface-container-low text-on-surface-variant hover:bg-surface-container-high'
                }`}>
                {t.label}
              </button>
            ))}
          </div>

          {/* Tab Content */}
          <div className="bg-surface-container-lowest rounded-2xl shadow-ambient p-6 min-h-[400px]">
            {activeTab === 'presets' && (
              <div className="space-y-4">
                <h3 className="text-sm font-bold text-on-surface font-korean">기본 제공 프리셋</h3>
                <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
                  {PRESET_TEMPLATES.map(p => (
                    <button key={p.id} onClick={() => selectPreset(p.id)}
                      className={`p-4 rounded-xl border-2 text-left transition-all hover:shadow-md ${
                        template.id === p.id && !editingId ? 'border-primary bg-primary/5' : 'border-outline-variant/15'
                      }`}>
                      <p className="text-sm font-bold text-on-surface font-korean">{p.name}</p>
                      <p className="text-xs text-on-surface-variant mt-1 font-korean">{p.description}</p>
                    </button>
                  ))}
                </div>

                {customTemplates.length > 0 && (
                  <>
                    <h3 className="text-sm font-bold text-on-surface font-korean mt-6">내 템플릿</h3>
                    <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
                      {customTemplates.map(t => (
                        <button key={t.id} onClick={() => selectCustom(t)}
                          className={`p-4 rounded-xl border-2 text-left transition-all hover:shadow-md ${
                            editingId === t.id ? 'border-primary bg-primary/5' : 'border-outline-variant/15'
                          }`}>
                          <p className="text-sm font-bold text-on-surface font-korean">{t.name}</p>
                          <p className="text-[11px] text-on-surface-variant/60 font-data mt-1">{new Date(t.created_at).toLocaleDateString('ko-KR')}</p>
                        </button>
                      ))}
                    </div>
                  </>
                )}
              </div>
            )}

            {activeTab === 'title' && (
              <div className="space-y-5">
                <div>
                  <label className="block text-xs font-medium text-on-surface-variant mb-1.5 font-korean">타이틀 텍스트</label>
                  <input type="text" value={template.title.text}
                    onChange={e => setTemplate(p => ({ ...p, title: { ...p.title, text: e.target.value } }))}
                    placeholder="{{year}}년 {{month}}월 정산서" className={inputCls} />
                  <p className="text-[11px] text-on-surface-variant/50 mt-1 font-korean">{'{{year}}, {{month}}, {{agency_name}} 변수 사용 가능'}</p>
                </div>
                <div className="grid grid-cols-3 gap-4">
                  <div>
                    <label className="block text-xs font-medium text-on-surface-variant mb-1.5 font-korean">폰트 크기</label>
                    <input type="number" value={template.title.fontSize} min={12} max={32}
                      onChange={e => setTemplate(p => ({ ...p, title: { ...p.title, fontSize: Number(e.target.value) } }))}
                      className={inputCls} />
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-on-surface-variant mb-1.5 font-korean">굵기</label>
                    <select value={template.title.fontWeight}
                      onChange={e => setTemplate(p => ({ ...p, title: { ...p.title, fontWeight: e.target.value as 'normal' | 'bold' } }))}
                      className={inputCls}>
                      <option value="bold">굵게</option>
                      <option value="normal">보통</option>
                    </select>
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-on-surface-variant mb-1.5 font-korean">정렬</label>
                    <select value={template.title.alignment}
                      onChange={e => setTemplate(p => ({ ...p, title: { ...p.title, alignment: e.target.value as 'left' | 'center' | 'right' } }))}
                      className={inputCls}>
                      <option value="center">가운데</option>
                      <option value="left">왼쪽</option>
                      <option value="right">오른쪽</option>
                    </select>
                  </div>
                </div>
                <ColorPicker label="헤더 텍스트 색상" value={template.header.textColor}
                  onChange={c => setTemplate(p => ({ ...p, header: { ...p.header, textColor: c } }))} />
              </div>
            )}

            {activeTab === 'items' && (
              <div className="space-y-6">
                {/* 수익 항목 */}
                <div>
                  <div className="flex items-center justify-between mb-3">
                    <h3 className="text-sm font-bold font-korean" style={{ color: template.incomeSection.titleColor }}>
                      {template.incomeSection.title}
                    </h3>
                    <button onClick={() => addItem('income')}
                      className="text-xs text-primary font-semibold font-korean hover:underline">+ 항목 추가</button>
                  </div>
                  <div className="space-y-2">
                    {template.incomeSection.items.map(item => (
                      <div key={item.id} className="flex items-center gap-3 p-3 rounded-xl bg-surface-container-low">
                        <input type="checkbox" checked={item.enabled}
                          onChange={() => updateItem('income', item.id, { enabled: !item.enabled })}
                          className="w-4 h-4 accent-primary" />
                        <input type="text" value={item.label} placeholder="항목명"
                          onChange={e => updateItem('income', item.id, { label: e.target.value, field: e.target.value })}
                          className="flex-1 h-8 px-2 rounded bg-surface-container-lowest text-sm font-korean focus:outline-none focus:ring-1 focus:ring-primary/30" />
                        <button onClick={() => removeItem('income', item.id)}
                          className="text-error text-xs hover:underline font-korean">삭제</button>
                      </div>
                    ))}
                    {template.incomeSection.items.length === 0 && (
                      <p className="text-xs text-on-surface-variant/50 font-korean py-4 text-center">
                        항목이 없습니다. 미리보기 시 샘플 데이터로 자동 생성됩니다.
                      </p>
                    )}
                  </div>
                </div>

                {/* 차감 항목 */}
                <div>
                  <div className="flex items-center justify-between mb-3">
                    <h3 className="text-sm font-bold font-korean" style={{ color: template.deductionSection.titleColor }}>
                      {template.deductionSection.title}
                    </h3>
                    <button onClick={() => addItem('deduction')}
                      className="text-xs text-primary font-semibold font-korean hover:underline">+ 항목 추가</button>
                  </div>
                  <div className="space-y-2">
                    {template.deductionSection.items.map(item => (
                      <div key={item.id} className="flex items-center gap-3 p-3 rounded-xl bg-surface-container-low">
                        <input type="checkbox" checked={item.enabled}
                          onChange={() => updateItem('deduction', item.id, { enabled: !item.enabled })}
                          className="w-4 h-4 accent-primary" />
                        <input type="text" value={item.label} placeholder="항목명"
                          onChange={e => updateItem('deduction', item.id, { label: e.target.value, field: e.target.value })}
                          className="flex-1 h-8 px-2 rounded bg-surface-container-lowest text-sm font-korean focus:outline-none focus:ring-1 focus:ring-primary/30" />
                        <button onClick={() => removeItem('deduction', item.id)}
                          className="text-error text-xs hover:underline font-korean">삭제</button>
                      </div>
                    ))}
                    {template.deductionSection.items.length === 0 && (
                      <p className="text-xs text-on-surface-variant/50 font-korean py-4 text-center">
                        항목이 없습니다. 미리보기 시 샘플 데이터로 자동 생성됩니다.
                      </p>
                    )}
                  </div>
                </div>
              </div>
            )}

            {activeTab === 'style' && (
              <div className="space-y-5">
                <ColorPicker label="테이블 헤더 배경색" value={template.tableStyle.headerBgColor}
                  onChange={c => setTemplate(p => ({ ...p, tableStyle: { ...p.tableStyle, headerBgColor: c } }))} />
                <ColorPicker label="테이블 헤더 텍스트색" value={template.tableStyle.headerTextColor}
                  onChange={c => setTemplate(p => ({ ...p, tableStyle: { ...p.tableStyle, headerTextColor: c } }))} />
                <ColorPicker label="수익 섹션 타이틀 색상" value={template.incomeSection.titleColor}
                  onChange={c => setTemplate(p => ({ ...p, incomeSection: { ...p.incomeSection, titleColor: c } }))} />
                <ColorPicker label="차감 섹션 타이틀 색상" value={template.deductionSection.titleColor}
                  onChange={c => setTemplate(p => ({ ...p, deductionSection: { ...p.deductionSection, titleColor: c } }))} />
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-[11px] font-medium text-on-surface-variant mb-1 font-korean">헤더 폰트 크기</label>
                    <input type="number" value={template.tableStyle.headerFontSize} min={8} max={16}
                      onChange={e => setTemplate(p => ({ ...p, tableStyle: { ...p.tableStyle, headerFontSize: Number(e.target.value) } }))}
                      className={inputCls} />
                  </div>
                  <div>
                    <label className="block text-[11px] font-medium text-on-surface-variant mb-1 font-korean">본문 폰트 크기</label>
                    <input type="number" value={template.tableStyle.bodyFontSize} min={8} max={14}
                      onChange={e => setTemplate(p => ({ ...p, tableStyle: { ...p.tableStyle, bodyFontSize: Number(e.target.value) } }))}
                      className={inputCls} />
                  </div>
                </div>
                <div className="flex items-center gap-3">
                  <input type="checkbox" checked={template.tableStyle.zebraStriping}
                    onChange={() => setTemplate(p => ({ ...p, tableStyle: { ...p.tableStyle, zebraStriping: !p.tableStyle.zebraStriping } }))}
                    className="w-4 h-4 accent-primary" />
                  <span className="text-sm text-on-surface font-korean">줄무늬 배경 (Zebra Striping)</span>
                </div>
                <ColorPicker label="합계 배경색" value={template.totalSection.backgroundColor || '#f0f9ff'}
                  onChange={c => setTemplate(p => ({ ...p, totalSection: { ...p.totalSection, backgroundColor: c } }))} />
              </div>
            )}

            {activeTab === 'footer' && (
              <div className="space-y-5">
                <div>
                  <label className="block text-xs font-medium text-on-surface-variant mb-1.5 font-korean">비고 / 안내 문구</label>
                  <textarea value={template.footer.notes}
                    onChange={e => setTemplate(p => ({ ...p, footer: { ...p.footer, notes: e.target.value } }))}
                    placeholder="정산서 하단에 표시할 안내 문구를 입력하세요"
                    rows={3} className={`${inputCls} h-auto py-2 resize-none`} />
                </div>
                <div className="space-y-3">
                  {[
                    { key: 'showDate' as const, label: '발행일 표시' },
                    { key: 'showSignatureLine' as const, label: '서명란 표시' },
                    { key: 'showStamp' as const, label: '직인 표시' },
                  ].map(opt => (
                    <div key={opt.key} className="flex items-center gap-3">
                      <input type="checkbox" checked={template.footer[opt.key]}
                        onChange={() => setTemplate(p => ({ ...p, footer: { ...p.footer, [opt.key]: !p.footer[opt.key] } }))}
                        className="w-4 h-4 accent-primary" />
                      <span className="text-sm text-on-surface font-korean">{opt.label}</span>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        </div>

        {/* Right: Preview */}
        <div className="space-y-4">
          <div className="bg-surface-container-lowest rounded-2xl shadow-ambient p-4">
            <h3 className="text-sm font-bold text-on-surface font-korean mb-3">미리보기</h3>
            {previewPdf ? (
              <div className="space-y-3">
                <iframe src={previewPdf} className="w-full h-[600px] rounded-xl border border-outline-variant/15" />
                <a href={previewPdf} download="정산서_미리보기.pdf"
                  className="block text-center h-9 leading-9 rounded-xl bg-primary/10 text-primary text-sm font-semibold font-korean hover:bg-primary/20 transition-colors">
                  PDF 다운로드
                </a>
              </div>
            ) : (
              <div className="h-[600px] rounded-xl border-2 border-dashed border-outline-variant/20 flex flex-col items-center justify-center">
                <div className="w-16 h-16 rounded-full bg-surface-container-high flex items-center justify-center mb-4">
                  <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" className="text-on-surface-variant/40">
                    <path d="M14 2H6a2 2 0 00-2 2v16a2 2 0 002 2h12a2 2 0 002-2V8z"/><polyline points="14 2 14 8 20 8"/>
                  </svg>
                </div>
                <p className="text-sm text-on-surface-variant/60 font-korean">미리보기 버튼을 클릭하세요</p>
                <p className="text-xs text-on-surface-variant/40 font-korean mt-1">샘플 데이터 1명 기준으로 생성됩니다</p>
              </div>
            )}
          </div>

          {/* Quick Summary */}
          <div className="bg-surface-container-lowest rounded-2xl shadow-ambient p-4 space-y-2">
            <h4 className="text-xs font-bold text-on-surface-variant font-korean">샘플 데이터</h4>
            <div className="text-[11px] text-on-surface-variant/70 font-korean space-y-1">
              <p>기사명: {SAMPLE_DRIVER.name}</p>
              <p>수익: {formatKRW(SAMPLE_DRIVER.incomeTotal)}</p>
              <p>차감: {formatKRW(SAMPLE_DRIVER.deductionTotal)}</p>
              <p className="font-bold text-on-surface">실수령: {formatKRW(SAMPLE_DRIVER.netAmount)}</p>
            </div>
          </div>

          {/* Bulk Generate (Client-side) */}
          <div className="bg-surface-container-lowest rounded-2xl shadow-ambient p-4 space-y-3">
            <h4 className="text-xs font-bold text-on-surface-variant font-korean">일괄 생성 테스트</h4>
            <p className="text-[11px] text-on-surface-variant/60 font-korean">
              샘플 데이터로 여러 정산서를 ZIP으로 생성합니다.
              실제 엑셀 데이터 기반 일괄 생성은 &apos;엑셀 업로드 정산&apos; 메뉴를 이용하세요.
            </p>
            <BulkGenerateButton template={template} agencyName={agencyName} />
          </div>
        </div>
      </div>
    </div>
  );
}

/* ── Bulk Generate Button ── */
function BulkGenerateButton({ template, agencyName }: { template: SettlementTemplate; agencyName: string }) {
  const [count, setCount] = useState(5);
  const [generating, setGenerating] = useState(false);
  const [progress, setProgress] = useState(0);

  const handleBulkGenerate = async () => {
    setGenerating(true);
    setProgress(0);
    try {
      const JSZip = (await import('jszip')).default;
      const zip = new JSZip();
      const now = new Date();
      const meta: SettlementMeta = {
        agencyName: agencyName || '테스트 대리점',
        year: now.getFullYear(),
        month: now.getMonth() + 1,
        generatedAt: now.toLocaleDateString('ko-KR'),
      };

      // 템플릿에 항목이 비어있으면 샘플 기반 자동 생성
      const tpl = { ...template };
      if (tpl.incomeSection.items.length === 0) {
        tpl.incomeSection.items = Object.keys(SAMPLE_DRIVER.incomeItems).map(label => ({
          id: Math.random().toString(36).slice(2, 8), label, field: label, enabled: true, numberFormat: 'currency' as const,
        }));
      }
      if (tpl.deductionSection.items.length === 0) {
        tpl.deductionSection.items = Object.keys(SAMPLE_DRIVER.deductionItems).map(label => ({
          id: Math.random().toString(36).slice(2, 8), label, field: label, enabled: true, numberFormat: 'currency' as const,
        }));
      }

      const names = ['홍길동', '김철수', '이영희', '박민수', '정수진', '최동혁', '한소영', '윤재호', '장미란', '송민지'];
      for (let i = 0; i < count; i++) {
        const driver: SettlementDriverData = {
          ...SAMPLE_DRIVER,
          name: names[i % names.length],
          id: `DRV${String(i + 1).padStart(3, '0')}`,
          incomeTotal: SAMPLE_DRIVER.incomeTotal + Math.floor(Math.random() * 50000),
          deductionTotal: SAMPLE_DRIVER.deductionTotal + Math.floor(Math.random() * 10000),
          netAmount: 0,
        };
        driver.netAmount = driver.incomeTotal - driver.deductionTotal;

        const pdfBytes = await generateSettlementPdf(tpl, driver, meta);
        zip.file(`정산서_${driver.name}_${meta.month}월.pdf`, pdfBytes);
        setProgress(Math.round(((i + 1) / count) * 100));
      }

      const blob = await zip.generateAsync({ type: 'blob' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `정산서_${count}명_${meta.year}년${meta.month}월.zip`;
      a.click();
      URL.revokeObjectURL(url);
    } catch (err) {
      alert('일괄 생성 실패: ' + (err instanceof Error ? err.message : ''));
    }
    setGenerating(false);
  };

  return (
    <div className="space-y-3">
      <div className="flex items-center gap-3">
        <input type="number" value={count} min={1} max={100} onChange={e => setCount(Number(e.target.value))}
          className="w-16 h-8 px-2 rounded-lg bg-surface-container-low text-sm text-center font-data focus:outline-none focus:ring-1 focus:ring-primary/30" />
        <span className="text-xs text-on-surface-variant font-korean">명</span>
        <button onClick={handleBulkGenerate} disabled={generating || count < 1}
          className="flex-1 h-8 rounded-lg bg-primary text-white text-xs font-semibold font-korean hover:bg-primary/90 transition-colors disabled:opacity-50 flex items-center justify-center gap-1.5">
          {generating ? (
            <><svg className="animate-spin w-3.5 h-3.5" viewBox="0 0 24 24" fill="none"><circle cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="3" opacity="0.3"/><path d="M12 2a10 10 0 0110 10" stroke="currentColor" strokeWidth="3" strokeLinecap="round"/></svg> {progress}%</>
          ) : 'ZIP 생성'}
        </button>
      </div>
      {generating && (
        <div className="w-full h-1.5 rounded-full bg-surface-container-high overflow-hidden">
          <div className="h-full bg-primary rounded-full transition-all duration-300" style={{ width: `${progress}%` }} />
        </div>
      )}
    </div>
  );
}
