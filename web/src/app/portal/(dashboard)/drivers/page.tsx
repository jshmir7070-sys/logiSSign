'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import Badge from '@/components/shared/Badge';
import { createBrowserSupabaseClient } from '@/lib/supabase';
import { getDrivers, type DriverListItem } from '@/services/driver.service';

const statusVariant: Record<string, 'success' | 'warning' | 'error'> = {
  active: 'success',
  resting: 'warning',
  inactive: 'error',
};

const statusLabel: Record<string, string> = {
  active: '활동중',
  resting: '휴식중',
  inactive: '퇴사',
};

interface PrincipalOption {
  id: string;
  name: string;
}

export default function DriversPage() {
  const [drivers, setDrivers] = useState<DriverListItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');
  const [agencyId, setAgencyId] = useState<string | null>(null);

  // 원청사(카테고리) 필터
  const [principals, setPrincipals] = useState<PrincipalOption[]>([]);
  const [selectedPrincipal, setSelectedPrincipal] = useState<string | null>(null); // null = 전체

  // 초기 로드: 원청사 목록 + 기사 목록
  useEffect(() => {
    async function load() {
      const supabase = createBrowserSupabaseClient();
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      const aid = user.app_metadata?.agency_id as string | undefined;
      if (!aid) return;
      setAgencyId(aid);

      // 원청사(카테고리) 목록
      const { data: pList } = await supabase
        .from('principals')
        .select('id, name')
        .eq('agency_id', aid)
        .eq('is_active', true)
        .order('created_at', { ascending: true });
      setPrincipals(pList ?? []);

      // 기사 목록 (전체)
      const result = await getDrivers(aid);
      if (result.data) setDrivers(result.data);
      setLoading(false);
    }
    load();
  }, []);

  // 원청사 탭 변경 시 기사 목록 다시 로드
  useEffect(() => {
    if (!agencyId) return;
    setLoading(true);
    getDrivers(agencyId, selectedPrincipal).then(result => {
      if (result.data) setDrivers(result.data);
      setLoading(false);
    });
  }, [selectedPrincipal, agencyId]);

  const filtered = drivers.filter((d) => {
    const matchesSearch =
      !search ||
      d.name.includes(search) ||
      (d.phone ?? '').includes(search) ||
      (d.employee_code ?? '').includes(search);
    const matchesStatus = statusFilter === 'all' || d.status === statusFilter;
    return matchesSearch && matchesStatus;
  });

  return (
    <div className="space-y-6">
      {/* Page Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-headline font-bold text-on-surface">
            <span className="font-korean">기사 관리</span>
          </h1>
          <p className="mt-1 text-sm text-on-surface-variant font-korean">
            소속 배달 기사를 관리하고 현황을 확인하세요
          </p>
        </div>
        <Link
          href="/portal/drivers/new"
          className="bg-power-gradient text-white px-5 py-2.5 rounded-xl font-label font-semibold text-sm hover:shadow-lg transition-shadow flex items-center gap-2"
        >
          <svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor">
            <path d="M19 13h-6v6h-2v-6H5v-2h6V5h2v6h6v2z" />
          </svg>
          <span className="font-korean">신규 기사 등록</span>
        </Link>
      </div>

      {/* 원청사(카테고리) 탭 — 2개 이상일 때만 표시 */}
      {principals.length >= 2 && (
        <div className="flex items-center gap-1 bg-surface-container-low rounded-xl p-1">
          <button
            onClick={() => setSelectedPrincipal(null)}
            className={`px-4 py-2 rounded-lg text-sm font-korean font-medium transition-all ${
              selectedPrincipal === null
                ? 'bg-white text-on-surface shadow-sm'
                : 'text-on-surface-variant hover:text-on-surface hover:bg-white/50'
            }`}
          >
            전체 ({drivers.length})
          </button>
          {principals.map(p => (
            <button
              key={p.id}
              onClick={() => setSelectedPrincipal(p.id)}
              className={`px-4 py-2 rounded-lg text-sm font-korean font-medium transition-all ${
                selectedPrincipal === p.id
                  ? 'bg-white text-on-surface shadow-sm'
                  : 'text-on-surface-variant hover:text-on-surface hover:bg-white/50'
              }`}
            >
              {p.name}
            </button>
          ))}
        </div>
      )}

      {/* Search & Filter */}
      <div className="flex items-center gap-4">
        <div className="flex-1 relative">
          <svg className="absolute left-4 top-1/2 -translate-y-1/2 text-on-surface-variant" width="18" height="18" viewBox="0 0 24 24" fill="currentColor">
            <path d="M15.5 14h-.79l-.28-.27C15.41 12.59 16 11.11 16 9.5 16 5.91 13.09 3 9.5 3S3 5.91 3 9.5 5.91 16 9.5 16c1.61 0 3.09-.59 4.23-1.57l.27.28v.79l5 4.99L20.49 19l-4.99-5zm-6 0C7.01 14 5 11.99 5 9.5S7.01 5 9.5 5 14 7.01 14 9.5 11.99 14 9.5 14z" />
          </svg>
          <input
            type="text"
            placeholder="기사 이름, 연락처, 사번 검색"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full pl-11 pr-4 py-2.5 rounded-xl bg-surface-container-lowest shadow-ambient text-sm font-body text-on-surface placeholder:text-on-surface-variant font-korean focus:outline-none focus:ring-2 focus:ring-primary/30"
          />
        </div>
        <select
          value={statusFilter}
          onChange={(e) => setStatusFilter(e.target.value)}
          className="px-4 py-2.5 rounded-xl bg-surface-container-lowest shadow-ambient text-sm font-label text-on-surface font-korean focus:outline-none focus:ring-2 focus:ring-primary/30 appearance-none pr-10"
        >
          <option value="all">전체 상태</option>
          <option value="active">활동중</option>
          <option value="resting">휴식중</option>
          <option value="inactive">퇴사</option>
        </select>
      </div>

      {/* Table */}
      <div className="bg-surface-container-lowest rounded-2xl shadow-ambient">
        <div className="overflow-x-auto">
          <table className="w-full text-left">
            <thead>
              <tr className="bg-surface-container-low">
                <th className="px-6 py-3 text-xs font-label font-semibold text-on-surface-variant uppercase tracking-wider font-korean">
                  이름
                </th>
                <th className="px-6 py-3 text-xs font-label font-semibold text-on-surface-variant uppercase tracking-wider font-korean">
                  사번
                </th>
                <th className="px-6 py-3 text-xs font-label font-semibold text-on-surface-variant uppercase tracking-wider font-korean">
                  소속 카테고리
                </th>
                <th className="px-6 py-3 text-xs font-label font-semibold text-on-surface-variant uppercase tracking-wider font-korean">
                  배송구역
                </th>
                <th className="px-6 py-3 text-xs font-label font-semibold text-on-surface-variant uppercase tracking-wider font-korean">
                  연락처
                </th>
                <th className="px-6 py-3 text-xs font-label font-semibold text-on-surface-variant uppercase tracking-wider font-korean">
                  상태
                </th>
                <th className="px-6 py-3 text-xs font-label font-semibold text-on-surface-variant uppercase tracking-wider font-korean">
                  등록일
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-outline-variant/30">
              {loading ? (
                <tr>
                  <td colSpan={7} className="px-6 py-8 text-center text-sm text-on-surface-variant font-korean">
                    데이터를 불러오는 중...
                  </td>
                </tr>
              ) : filtered.length === 0 ? (
                <tr>
                  <td colSpan={7} className="px-6 py-8 text-center text-sm text-on-surface-variant font-korean">
                    {search || statusFilter !== 'all' ? '검색 결과가 없습니다' : '등록된 기사가 없습니다'}
                  </td>
                </tr>
              ) : (
                filtered.map((driver) => (
                  <tr
                    key={driver.id}
                    className="hover:bg-surface-container-low/50 transition-colors cursor-pointer"
                    onClick={() => window.location.href = `/portal/drivers/${driver.id}`}
                  >
                    <td className="px-6 py-4 text-sm font-body text-on-surface font-korean">
                      <span className="text-primary hover:underline">{driver.name}</span>
                    </td>
                    <td className="px-6 py-4 text-xs font-data text-on-surface-variant">
                      {driver.employee_code || '-'}
                    </td>
                    <td className="px-6 py-4">
                      {driver.principal_names.length > 0 ? (
                        <div className="flex flex-wrap gap-1">
                          {driver.principal_names.map((pn, i) => (
                            <span key={i} className="inline-block px-2 py-0.5 rounded-md bg-primary/10 text-primary text-[11px] font-korean font-medium">
                              {pn}
                            </span>
                          ))}
                        </div>
                      ) : (
                        <span className="text-xs text-on-surface-variant/40 font-korean">미배정</span>
                      )}
                    </td>
                    <td className="px-6 py-4 text-xs text-on-surface-variant font-korean">
                      {driver.delivery_area || '-'}
                    </td>
                    <td className="px-6 py-4 text-sm font-data text-on-surface">
                      {driver.phone ?? '-'}
                    </td>
                    <td className="px-6 py-4">
                      <Badge
                        label={statusLabel[driver.status] ?? driver.status}
                        variant={statusVariant[driver.status] ?? 'default'}
                      />
                    </td>
                    <td className="px-6 py-4 text-sm font-data text-on-surface-variant">
                      {driver.created_at ? new Date(driver.created_at).toLocaleDateString('ko-KR') : '-'}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
