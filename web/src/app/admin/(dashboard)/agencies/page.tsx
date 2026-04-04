'use client';

import { useEffect, useState } from 'react';
import Badge from '@/components/shared/Badge';
import { createBrowserSupabaseClient } from '@/lib/supabase';

interface AgencyRow {
  id: string;
  name: string;
  owner_name: string | null;
  plan: string;
  monthly_fee: number;
  created_at: string;
  status?: string;
  driver_count?: number;
}

const VALID_PLANS = ['free', 'basic', 'standard', 'pro', 'enterprise'];

const planBadgeVariant: Record<string, 'info' | 'success' | 'default' | 'warning'> = {
  free: 'default',
  basic: 'info',
  standard: 'success',
  pro: 'warning',
  enterprise: 'warning',
};

const statusBadgeVariant: Record<string, 'success' | 'error' | 'warning'> = {
  active: 'success',
  overdue: 'error',
  cancelled: 'warning',
};

const statusLabel: Record<string, string> = {
  active: '활성',
  overdue: '미납',
  cancelled: '해지',
};

function formatKRW(n: number): string {
  return `₩${n.toLocaleString('ko-KR')}`;
}

export default function AgenciesPage() {
  const [agencies, setAgencies] = useState<AgencyRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [filterPlan, setFilterPlan] = useState('전체');
  const [search, setSearch] = useState('');

  // Plan change modal
  const [changingAgency, setChangingAgency] = useState<AgencyRow | null>(null);
  const [newPlan, setNewPlan] = useState('');
  const [reason, setReason] = useState('');
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    async function load() {
      const supabase = createBrowserSupabaseClient();

      // agencies + subscription status join
      const { data } = await supabase
        .from('agencies')
        .select('id, name, owner_name, plan, monthly_fee, created_at')
        .order('created_at', { ascending: false });

      // driver count per agency
      const { data: driverCounts } = await supabase
        .from('drivers')
        .select('agency_id');

      const countMap: Record<string, number> = {};
      (driverCounts ?? []).forEach((d: Record<string, string>) => {
        countMap[d.agency_id] = (countMap[d.agency_id] || 0) + 1;
      });

      // subscription status
      const { data: subs } = await supabase
        .from('subscriptions')
        .select('agency_id, status');

      const statusMap: Record<string, string> = {};
      (subs ?? []).forEach((s: Record<string, string>) => {
        statusMap[s.agency_id] = s.status;
      });

      setAgencies((data ?? []).map((a) => {
        const row = a as unknown as AgencyRow;
        return {
          ...row,
          driver_count: countMap[row.id] || 0,
          status: statusMap[row.id] || 'active',
        };
      }));
      setLoading(false);
    }
    load();
  }, []);

  const handlePlanChange = async () => {
    if (!changingAgency || !newPlan) return;
    setSaving(true);
    try {
      const res = await fetch('/api/admin/plan-change', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          agencyId: changingAgency.id,
          newPlan,
          reason: reason || undefined,
        }),
      });
      if (res.ok) {
        // 로컬 상태 업데이트
        setAgencies(prev => prev.map(a =>
          a.id === changingAgency.id ? { ...a, plan: newPlan } : a
        ));
        setChangingAgency(null);
        setReason('');
      } else {
        const err = await res.json();
        alert('플랜 변경 실패: ' + (err.error || ''));
      }
    } catch { alert('오류가 발생했습니다'); }
    setSaving(false);
  };

  const filtered = agencies.filter(a => {
    if (filterPlan !== '전체' && a.plan.toLowerCase() !== filterPlan.toLowerCase()) return false;
    if (search && !a.name.includes(search) && !(a.owner_name || '').includes(search)) return false;
    return true;
  });

  return (
    <div className="space-y-8">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="font-headline text-on-surface text-[26px] font-bold tracking-tight">구독사 관리</h2>
          <p className="font-body text-on-surface-variant text-[14px] mt-1">대리점 구독 현황 및 관리</p>
        </div>
      </div>

      {/* Search + Filter */}
      <div className="bg-surface-container-lowest rounded-2xl shadow-ambient p-6">
        <div className="flex items-center gap-4">
          <div className="flex-1 relative">
            <span className="material-symbols-outlined text-[20px] text-on-surface-variant absolute left-3 top-1/2 -translate-y-1/2"
              style={{ fontVariationSettings: "'FILL' 0, 'wght' 300, 'GRAD' 0, 'opsz' 20" }}>
              search
            </span>
            <input type="text" value={search} onChange={e => setSearch(e.target.value)}
              placeholder="대리점명 또는 대표자 검색"
              className="w-full h-10 pl-10 pr-4 rounded-xl bg-surface-container-low font-body text-[14px] text-on-surface placeholder:text-on-surface-variant/50 outline-none focus:ring-2 focus:ring-primary/20" />
          </div>
          <div className="flex items-center gap-2">
            {['전체', 'Free', 'Basic', 'Standard', 'Pro', 'Enterprise'].map((p) => (
              <button key={p} onClick={() => setFilterPlan(p)}
                className={`h-9 px-4 rounded-xl font-label text-[13px] font-medium transition-colors ${
                  filterPlan === p
                    ? 'bg-primary text-on-primary'
                    : 'bg-surface-container-low text-on-surface-variant hover:bg-surface-container'
                }`}>
                {p}
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* Table */}
      <div className="bg-surface-container-lowest rounded-2xl shadow-ambient p-6">
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead>
              <tr className="bg-surface-container-low">
                <th className="text-left font-label text-on-surface-variant text-[12px] font-semibold px-4 py-3 rounded-l-xl">대리점명</th>
                <th className="text-left font-label text-on-surface-variant text-[12px] font-semibold px-4 py-3">대표자</th>
                <th className="text-left font-label text-on-surface-variant text-[12px] font-semibold px-4 py-3">플랜</th>
                <th className="text-right font-label text-on-surface-variant text-[12px] font-semibold px-4 py-3">기사 수</th>
                <th className="text-right font-label text-on-surface-variant text-[12px] font-semibold px-4 py-3">MRR</th>
                <th className="text-left font-label text-on-surface-variant text-[12px] font-semibold px-4 py-3">가입일</th>
                <th className="text-left font-label text-on-surface-variant text-[12px] font-semibold px-4 py-3">상태</th>
                <th className="text-center font-label text-on-surface-variant text-[12px] font-semibold px-4 py-3 rounded-r-xl">관리</th>
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr><td colSpan={8} className="px-4 py-8 text-center text-sm text-on-surface-variant">불러오는 중...</td></tr>
              ) : filtered.length === 0 ? (
                <tr><td colSpan={8} className="px-4 py-8 text-center text-sm text-on-surface-variant">대리점이 없습니다</td></tr>
              ) : filtered.map((agency) => (
                <tr key={agency.id} className="group hover:bg-surface-container-lowest/60 transition-colors">
                  <td className="px-4 py-3.5">
                    <span className="font-body text-on-surface text-[14px] font-medium">{agency.name}</span>
                  </td>
                  <td className="px-4 py-3.5">
                    <span className="font-body text-on-surface-variant text-[14px]">{agency.owner_name || '-'}</span>
                  </td>
                  <td className="px-4 py-3.5">
                    <Badge label={agency.plan} variant={planBadgeVariant[agency.plan] || 'default'} />
                  </td>
                  <td className="px-4 py-3.5 text-right">
                    <span className="font-data text-on-surface text-[14px]">{agency.driver_count || 0}명</span>
                  </td>
                  <td className="px-4 py-3.5 text-right">
                    <span className="font-data text-on-surface text-[14px]">{formatKRW(agency.monthly_fee || 0)}</span>
                  </td>
                  <td className="px-4 py-3.5">
                    <span className="font-data text-on-surface-variant text-[13px]">
                      {new Date(agency.created_at).toLocaleDateString('ko-KR')}
                    </span>
                  </td>
                  <td className="px-4 py-3.5">
                    <Badge
                      label={statusLabel[agency.status || 'active'] || '활성'}
                      variant={statusBadgeVariant[agency.status || 'active'] || 'success'}
                    />
                  </td>
                  <td className="px-4 py-3.5 text-center">
                    <button
                      onClick={() => { setChangingAgency(agency); setNewPlan(agency.plan); }}
                      className="text-xs text-primary font-semibold hover:underline font-korean"
                    >
                      플랜 변경
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* Plan Change Modal */}
      {changingAgency && (
        <div className="fixed inset-0 bg-black/40 z-50 flex items-center justify-center p-4" onClick={() => setChangingAgency(null)}>
          <div className="bg-surface-container-lowest rounded-2xl shadow-float w-full max-w-md p-8 space-y-6" onClick={e => e.stopPropagation()}>
            <h3 className="font-headline text-on-surface text-[18px] font-bold font-korean">플랜 변경</h3>
            <p className="text-sm text-on-surface-variant font-korean">
              <strong>{changingAgency.name}</strong>의 플랜을 변경합니다.
            </p>

            <div>
              <label className="block text-xs font-label font-medium text-on-surface-variant mb-2 font-korean">변경할 플랜</label>
              <div className="grid grid-cols-5 gap-2">
                {VALID_PLANS.map(p => (
                  <button key={p} onClick={() => setNewPlan(p)}
                    className={`py-2 rounded-xl text-xs font-label font-medium transition-colors capitalize ${
                      newPlan === p
                        ? 'bg-primary text-white'
                        : 'bg-surface-container-low text-on-surface-variant hover:bg-surface-container-high'
                    }`}>
                    {p}
                  </button>
                ))}
              </div>
            </div>

            <div>
              <label className="block text-xs font-label font-medium text-on-surface-variant mb-1.5 font-korean">변경 사유 (선택)</label>
              <input type="text" value={reason} onChange={e => setReason(e.target.value)}
                placeholder="예: 고객 요청에 의한 업그레이드"
                className="w-full h-10 px-3 rounded-xl bg-surface-container-low text-on-surface text-sm focus:outline-none focus:ring-2 focus:ring-primary/30 font-korean" />
            </div>

            {newPlan === changingAgency.plan && (
              <p className="text-xs text-on-surface-variant/60 font-korean">현재 플랜과 동일합니다</p>
            )}

            <div className="flex justify-end gap-3 pt-2">
              <button onClick={() => setChangingAgency(null)}
                className="h-10 px-6 rounded-xl bg-surface-container-high text-on-surface-variant font-label text-sm font-medium hover:bg-surface-container-highest transition-colors">
                취소
              </button>
              <button onClick={handlePlanChange}
                disabled={saving || newPlan === changingAgency.plan}
                className="h-10 px-6 rounded-xl bg-power-gradient text-white font-label text-sm font-semibold shadow-ambient hover:shadow-float transition-all disabled:opacity-50">
                {saving ? '변경 중...' : '플랜 변경'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
