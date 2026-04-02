'use client';

import { useEffect, useState } from 'react';
import { createBrowserSupabaseClient } from '@/lib/supabase';
import { getPlanLimits, isPaidPlan, PLAN_LABELS, type PlanType } from '@/lib/plan-limits';

interface AdminAccount {
  id: string;
  name: string;
  email: string;
  role: string;
  created_at: string;
}

export default function AdminsTab({ agencyId, plan }: { agencyId: string; plan: string }) {
  const limits = getPlanLimits(plan);
  const paid = isPaidPlan(plan as PlanType);
  const [admins, setAdmins] = useState<AdminAccount[]>([]);
  const [showForm, setShowForm] = useState(false);
  const [formName, setFormName] = useState('');
  const [formEmail, setFormEmail] = useState('');
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    async function loadAdmins() {
      const supabase = createBrowserSupabaseClient();
      const { data } = await supabase
        .from('admin_accounts')
        .select('*')
        .eq('agency_id', agencyId)
        .order('created_at', { ascending: true });
      if (data) setAdmins(data as AdminAccount[]);
    }
    if (paid) loadAdmins();
  }, [agencyId, paid]);

  const handleAdd = async () => {
    if (!formName.trim() || !formEmail.trim()) return;
    if (admins.length >= limits.maxAdminAccounts) return;
    setSaving(true);
    const supabase = createBrowserSupabaseClient();
    const { data, error } = await supabase
      .from('admin_accounts')
      .insert({ agency_id: agencyId, name: formName.trim(), email: formEmail.trim(), role: 'admin' })
      .select()
      .single();
    if (!error && data) {
      setAdmins((prev) => [...prev, data as AdminAccount]);
      setFormName('');
      setFormEmail('');
      setShowForm(false);
    }
    setSaving(false);
  };

  const handleRemove = async (id: string) => {
    const supabase = createBrowserSupabaseClient();
    await supabase.from('admin_accounts').delete().eq('id', id);
    setAdmins((prev) => prev.filter((a) => a.id !== id));
  };

  const inputCls = 'w-full h-11 rounded-xl border border-outline-variant/20 bg-surface-container-lowest px-3 text-sm text-on-surface placeholder:text-on-surface-variant/40 focus:outline-none focus:ring-2 focus:ring-primary/30 font-korean';

  if (!paid) {
    return (
      <div className="bg-surface-container-lowest rounded-2xl shadow-ambient p-8 text-center">
        <div className="w-16 h-16 mx-auto mb-4 rounded-full bg-surface-container-high/50 flex items-center justify-center">
          <svg width="32" height="32" viewBox="0 0 24 24" fill="currentColor" className="text-on-surface-variant/40">
            <path d="M18 8h-1V6c0-2.76-2.24-5-5-5S7 3.24 7 6v2H6c-1.1 0-2 .9-2 2v10c0 1.1.9 2 2 2h12c1.1 0 2-.9 2-2V10c0-1.1-.9-2-2-2zm-6 9c-1.1 0-2-.9-2-2s.9-2 2-2 2 .9 2 2-.9 2-2 2zm3.1-9H8.9V6c0-1.71 1.39-3.1 3.1-3.1 1.71 0 3.1 1.39 3.1 3.1v2z"/>
          </svg>
        </div>
        <h2 className="text-lg font-headline font-bold text-on-surface font-korean mb-2">유료 플랜 전용 기능</h2>
        <p className="text-sm text-on-surface-variant font-korean mb-4">
          관리자 계정 추가는 Basic 이상 유료 플랜에서 사용할 수 있습니다.
        </p>
        <p className="text-xs text-on-surface-variant/60 font-korean">
          유료 플랜에서는 대표가입자 외 최대 3명의 관리자 계정을 추가할 수 있습니다.
        </p>
      </div>
    );
  }

  return (
    <div className="bg-surface-container-lowest rounded-2xl shadow-ambient p-8 space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-lg font-headline font-bold text-on-surface font-korean">관리자 계정</h2>
          <p className="text-xs text-on-surface-variant mt-1 font-korean">
            대표가입자 외 최대 {limits.maxAdminAccounts}명의 관리자를 추가할 수 있습니다 ({PLAN_LABELS[plan as PlanType] || plan} 플랜)
          </p>
        </div>
        {admins.length < limits.maxAdminAccounts && !showForm && (
          <button
            onClick={() => setShowForm(true)}
            className="h-9 px-4 rounded-xl bg-primary text-on-primary font-label text-sm hover:bg-primary/90 transition-colors font-korean flex items-center gap-1.5"
          >
            <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor"><path d="M19 13h-6v6h-2v-6H5v-2h6V5h2v6h6v2z"/></svg>
            관리자 추가
          </button>
        )}
      </div>

      <div className="space-y-3">
        <p className="text-xs font-semibold text-on-surface-variant font-korean">
          등록된 관리자 ({admins.length}/{limits.maxAdminAccounts})
        </p>
        {admins.length === 0 && (
          <p className="text-sm text-on-surface-variant/50 text-center py-6 font-korean">등록된 관리자가 없습니다</p>
        )}
        {admins.map((admin) => (
          <div key={admin.id} className="flex items-center justify-between p-4 rounded-xl border border-outline-variant/15 bg-surface-container-low/30">
            <div className="flex items-center gap-3">
              <div className="w-9 h-9 rounded-full bg-primary/10 flex items-center justify-center">
                <span className="text-primary text-xs font-bold">{admin.name.charAt(0)}</span>
              </div>
              <div>
                <p className="text-sm font-semibold text-on-surface font-korean">{admin.name}</p>
                <p className="text-xs text-on-surface-variant">{admin.email}</p>
              </div>
            </div>
            <button
              onClick={() => handleRemove(admin.id)}
              className="h-8 px-3 rounded-lg text-error text-xs font-semibold hover:bg-error/10 transition-colors font-korean"
            >
              삭제
            </button>
          </div>
        ))}
      </div>

      {showForm && (
        <div className="p-4 rounded-xl border border-primary/20 bg-primary/[0.02] space-y-4">
          <p className="text-sm font-semibold text-on-surface font-korean">새 관리자 추가</p>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-label font-medium text-on-surface-variant mb-1.5 font-korean">이름 *</label>
              <input type="text" value={formName} onChange={(e) => setFormName(e.target.value)} placeholder="관리자 이름" className={inputCls} />
            </div>
            <div>
              <label className="block text-xs font-label font-medium text-on-surface-variant mb-1.5 font-korean">이메일 *</label>
              <input type="email" value={formEmail} onChange={(e) => setFormEmail(e.target.value)} placeholder="email@example.com" className={inputCls} />
            </div>
          </div>
          <div className="flex justify-end gap-2">
            <button onClick={() => { setShowForm(false); setFormName(''); setFormEmail(''); }}
              className="h-9 px-4 rounded-xl border border-outline-variant/20 text-on-surface-variant text-sm font-korean hover:bg-surface-container-high/50 transition-colors">
              취소
            </button>
            <button onClick={handleAdd} disabled={saving || !formName.trim() || !formEmail.trim()}
              className="h-9 px-4 rounded-xl bg-primary text-on-primary text-sm font-korean hover:bg-primary/90 transition-colors disabled:opacity-50">
              {saving ? '저장 중...' : '추가'}
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
