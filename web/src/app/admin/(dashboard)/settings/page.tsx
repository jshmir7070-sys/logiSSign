'use client';

import { useEffect, useState, useCallback } from 'react';
import { FEATURE_LABELS } from '@/lib/plan-limits';
import type { PlanFeature } from '@/lib/plan-limits';

interface PlanConfig {
  plan: string;
  label: string;
  price_monthly: number;
  max_drivers: number | null;
  max_admin_accounts: number;
  max_default_templates: number;
  max_upload_templates: number;
  features: Record<string, boolean>;
  description: string | null;
  sort_order: number;
}

function formatKRW(n: number): string {
  return `₩${n.toLocaleString('ko-KR')}`;
}

const inputCls = 'w-full h-10 px-3 rounded-xl bg-surface-container-low text-on-surface text-sm focus:outline-none focus:ring-2 focus:ring-primary/30';

export default function AdminSettingsPage() {
  const [activeTab, setActiveTab] = useState<'general' | 'plans' | 'email'>('general');
  const [plans, setPlans] = useState<PlanConfig[]>([]);
  const [loading, setLoading] = useState(false);
  const [editingPlan, setEditingPlan] = useState<PlanConfig | null>(null);
  const [saving, setSaving] = useState(false);

  const tabs = [
    { id: 'general' as const, label: '일반' },
    { id: 'plans' as const, label: '플랜 관리' },
    { id: 'email' as const, label: '이메일 템플릿' },
  ];

  const loadPlans = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch('/api/admin/plan-configs');
      if (res.ok) {
        const { data } = await res.json();
        setPlans(data ?? []);
      }
    } catch { /* ignore */ }
    setLoading(false);
  }, []);

  useEffect(() => {
    if (activeTab === 'plans') loadPlans();
  }, [activeTab, loadPlans]);

  const handleSavePlan = async () => {
    if (!editingPlan) return;
    setSaving(true);
    try {
      const res = await fetch('/api/admin/plan-configs', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(editingPlan),
      });
      if (res.ok) {
        setEditingPlan(null);
        loadPlans();
      } else {
        const err = await res.json();
        alert('저장 실패: ' + (err.error || ''));
      }
    } catch { alert('저장 중 오류 발생'); }
    setSaving(false);
  };

  return (
    <div className="space-y-8">
      <div>
        <h2 className="font-headline text-on-surface text-[26px] font-bold tracking-tight">설정</h2>
        <p className="font-body text-on-surface-variant text-[14px] mt-1">플랫폼 전반 설정을 관리합니다</p>
      </div>

      <div className="flex gap-2">
        {tabs.map((tab) => (
          <button
            key={tab.id}
            onClick={() => setActiveTab(tab.id)}
            className={`px-4 py-2 rounded-xl text-sm font-label font-medium transition-colors ${
              activeTab === tab.id
                ? 'bg-primary text-white'
                : 'bg-surface-container-low text-on-surface-variant hover:bg-surface-container-high'
            }`}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {/* General Tab */}
      {activeTab === 'general' && (
        <div className="bg-surface-container-lowest rounded-2xl shadow-ambient p-8 space-y-6">
          <h3 className="font-headline text-on-surface text-[16px] font-bold">플랫폼 정보</h3>
          <div className="grid grid-cols-2 gap-6">
            <div>
              <label className="block text-xs font-label font-medium text-on-surface-variant mb-1.5">플랫폼명</label>
              <input type="text" defaultValue="logiSSign" className={inputCls} />
            </div>
            <div>
              <label className="block text-xs font-label font-medium text-on-surface-variant mb-1.5">관리자 이메일</label>
              <input type="email" defaultValue="admin@precision.io" className={inputCls} />
            </div>
            <div>
              <label className="block text-xs font-label font-medium text-on-surface-variant mb-1.5">고객센터 연락처</label>
              <input type="text" defaultValue="1588-0000" className={inputCls} />
            </div>
            <div>
              <label className="block text-xs font-label font-medium text-on-surface-variant mb-1.5">정산 마감일</label>
              <input type="text" defaultValue="매월 25일" className={inputCls} />
            </div>
          </div>
          <div className="flex justify-end pt-2">
            <button className="h-11 px-8 rounded-xl bg-power-gradient text-white font-label font-medium text-sm shadow-ambient hover:shadow-float transition-all">
              저장
            </button>
          </div>
        </div>
      )}

      {/* Plans Tab — DB 연동 */}
      {activeTab === 'plans' && (
        <div className="space-y-5">
          {loading ? (
            <p className="text-center text-sm text-on-surface-variant py-8">불러오는 중...</p>
          ) : plans.length === 0 ? (
            <p className="text-center text-sm text-on-surface-variant py-8">플랜 데이터가 없습니다. 마이그레이션을 실행하세요.</p>
          ) : plans.map((p) => (
            <div key={p.plan} className="bg-surface-container-lowest rounded-2xl shadow-ambient p-6">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-6">
                  <div>
                    <h3 className="font-headline text-on-surface text-[16px] font-bold">{p.label}</h3>
                    <p className="font-data text-primary text-[20px] font-bold mt-1">
                      {formatKRW(p.price_monthly)}
                      <span className="text-on-surface-variant text-[13px] font-normal"> / 월</span>
                    </p>
                  </div>
                  <div className="h-12 w-px bg-surface-container-high" />
                  <div>
                    <p className="text-sm text-on-surface font-body">
                      기사 {p.max_drivers === null ? '무제한' : `${p.max_drivers}명`}
                      {' / '}관리자 {p.max_admin_accounts}명
                      {' / '}템플릿 {p.max_default_templates}개
                    </p>
                    <p className="text-xs text-on-surface-variant font-body mt-1">{p.description || '-'}</p>
                  </div>
                </div>
                <button
                  onClick={() => setEditingPlan({ ...p })}
                  className="h-9 px-5 rounded-xl bg-surface-container-high text-on-surface-variant font-label text-[13px] font-medium hover:bg-surface-container-highest transition-colors"
                >
                  수정
                </button>
              </div>

              {/* 기능 플래그 미리보기 */}
              <div className="mt-4 flex flex-wrap gap-2">
                {Object.entries(p.features).map(([key, enabled]) => (
                  <span key={key} className={`px-2 py-0.5 rounded-full text-[11px] font-label ${
                    enabled ? 'bg-tertiary-fixed text-tertiary' : 'bg-surface-container-low text-on-surface-variant/40 line-through'
                  }`}>
                    {FEATURE_LABELS[key as PlanFeature] || key}
                  </span>
                ))}
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Plan Edit Modal */}
      {editingPlan && (
        <div className="fixed inset-0 bg-black/40 z-50 flex items-center justify-center p-4" onClick={() => setEditingPlan(null)}>
          <div className="bg-surface-container-lowest rounded-2xl shadow-float w-full max-w-2xl max-h-[80vh] overflow-y-auto p-8 space-y-6" onClick={e => e.stopPropagation()}>
            <h3 className="font-headline text-on-surface text-[18px] font-bold">
              {editingPlan.label} 플랜 수정
            </h3>

            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-xs font-label font-medium text-on-surface-variant mb-1.5">라벨</label>
                <input type="text" value={editingPlan.label}
                  onChange={e => setEditingPlan(p => p && { ...p, label: e.target.value })}
                  className={inputCls} />
              </div>
              <div>
                <label className="block text-xs font-label font-medium text-on-surface-variant mb-1.5">월 요금 (원)</label>
                <input type="number" value={editingPlan.price_monthly}
                  onChange={e => setEditingPlan(p => p && { ...p, price_monthly: Number(e.target.value) })}
                  className={inputCls} />
              </div>
              <div>
                <label className="block text-xs font-label font-medium text-on-surface-variant mb-1.5">
                  최대 기사 수 {editingPlan.max_drivers === null && '(무제한)'}
                </label>
                <input type="number" value={editingPlan.max_drivers ?? ''}
                  placeholder="비워두면 무제한"
                  onChange={e => setEditingPlan(p => p && { ...p, max_drivers: e.target.value ? Number(e.target.value) : null })}
                  className={inputCls} />
              </div>
              <div>
                <label className="block text-xs font-label font-medium text-on-surface-variant mb-1.5">추가 관리자 수</label>
                <input type="number" value={editingPlan.max_admin_accounts}
                  onChange={e => setEditingPlan(p => p && { ...p, max_admin_accounts: Number(e.target.value) })}
                  className={inputCls} />
              </div>
              <div>
                <label className="block text-xs font-label font-medium text-on-surface-variant mb-1.5">기본 템플릿 수</label>
                <input type="number" value={editingPlan.max_default_templates}
                  onChange={e => setEditingPlan(p => p && { ...p, max_default_templates: Number(e.target.value) })}
                  className={inputCls} />
              </div>
              <div>
                <label className="block text-xs font-label font-medium text-on-surface-variant mb-1.5">업로드 템플릿 수</label>
                <input type="number" value={editingPlan.max_upload_templates}
                  onChange={e => setEditingPlan(p => p && { ...p, max_upload_templates: Number(e.target.value) })}
                  className={inputCls} />
              </div>
            </div>

            <div>
              <label className="block text-xs font-label font-medium text-on-surface-variant mb-1.5">설명</label>
              <input type="text" value={editingPlan.description || ''}
                onChange={e => setEditingPlan(p => p && { ...p, description: e.target.value })}
                className={inputCls} />
            </div>

            {/* Feature Toggles */}
            <div>
              <label className="block text-xs font-label font-medium text-on-surface-variant mb-3">기능 접근 권한</label>
              <div className="grid grid-cols-2 gap-2">
                {Object.entries(FEATURE_LABELS).map(([key, label]) => (
                  <label key={key} className="flex items-center gap-2 p-2 rounded-lg hover:bg-surface-container-low cursor-pointer">
                    <input
                      type="checkbox"
                      checked={editingPlan.features[key] ?? false}
                      onChange={e => setEditingPlan(p => {
                        if (!p) return p;
                        return { ...p, features: { ...p.features, [key]: e.target.checked } };
                      })}
                      className="w-4 h-4 accent-primary"
                    />
                    <span className="text-sm text-on-surface font-korean">{label}</span>
                  </label>
                ))}
              </div>
            </div>

            <div className="flex justify-end gap-3 pt-2">
              <button onClick={() => setEditingPlan(null)}
                className="h-10 px-6 rounded-xl bg-surface-container-high text-on-surface-variant font-label text-sm font-medium hover:bg-surface-container-highest transition-colors">
                취소
              </button>
              <button onClick={handleSavePlan} disabled={saving}
                className="h-10 px-6 rounded-xl bg-power-gradient text-white font-label text-sm font-semibold shadow-ambient hover:shadow-float transition-all disabled:opacity-50">
                {saving ? '저장 중...' : '저장'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Email Tab */}
      {activeTab === 'email' && (
        <div className="space-y-5">
          {[
            { name: '회원가입 환영', subject: '환영합니다! logiSSign 가입이 완료되었습니다', status: '활성' },
            { name: '정산서 발송', subject: '[{month}월] 정산서가 발행되었습니다', status: '활성' },
            { name: '계약서 서명 요청', subject: '전자계약서 서명을 요청드립니다', status: '활성' },
            { name: '결제 실패', subject: '구독료 결제에 실패했습니다. 확인해주세요', status: '비활성' },
            { name: '구독 만료 안내', subject: '구독 만료 7일 전 안내', status: '활성' },
          ].map((tmpl) => (
            <div key={tmpl.name} className="bg-surface-container-lowest rounded-2xl shadow-ambient p-6 flex items-center justify-between">
              <div>
                <div className="flex items-center gap-2">
                  <h3 className="font-headline text-on-surface text-[14px] font-bold">{tmpl.name}</h3>
                  <span className={`px-2 py-0.5 rounded-full text-[11px] font-label font-medium ${
                    tmpl.status === '활성' ? 'text-tertiary bg-tertiary-fixed' : 'text-on-surface-variant bg-surface-container-low'
                  }`}>
                    {tmpl.status}
                  </span>
                </div>
                <p className="text-xs text-on-surface-variant font-body mt-1">{tmpl.subject}</p>
              </div>
              <button className="h-9 px-5 rounded-xl bg-surface-container-high text-on-surface-variant font-label text-[13px] font-medium hover:bg-surface-container-highest transition-colors">
                편집
              </button>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
