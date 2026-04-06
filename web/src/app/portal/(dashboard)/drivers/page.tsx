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
  const [sendingInvite, setSendingInvite] = useState<string | null>(null);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [bulkProcessing, setBulkProcessing] = useState(false);
  const [principals, setPrincipals] = useState<PrincipalOption[]>([]);
  const [selectedPrincipal, setSelectedPrincipal] = useState<string | null>(null);

  const handleResendInvite = async (
    driverId: string,
    driverName: string,
    driverPhone: string,
    driverCode: string | null,
  ) => {
    if (!agencyId || !driverPhone) {
      alert('전화번호가 없습니다');
      return;
    }

    if (!confirm(`${driverName} 기사에게 가입 안내 SMS를 다시 전송하시겠습니까?`)) {
      return;
    }

    setSendingInvite(driverId);
    try {
      const res = await fetch('/api/sms/invite', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          driverPhone,
          driverName,
          agencyId,
          driverCode,
        }),
      });
      const result = await res.json();
      if (res.ok && result.sent) {
        alert(`${driverName} 기사에게 가입 안내 SMS를 전송했습니다.`);
      } else {
        alert(`SMS 전송 실패: ${result.error ?? ''}`);
      }
    } catch {
      alert('SMS 전송 중 오류가 발생했습니다.');
    }
    setSendingInvite(null);
  };

  useEffect(() => {
    async function load() {
      const supabase = createBrowserSupabaseClient();
      const {
        data: { user },
      } = await supabase.auth.getUser();
      if (!user) return;

      const aid = user.app_metadata?.agency_id as string | undefined;
      if (!aid) return;
      setAgencyId(aid);

      const { data: pList } = await supabase
        .from('principals')
        .select('id, name')
        .eq('agency_id', aid)
        .eq('is_active', true)
        .order('created_at', { ascending: true });
      setPrincipals(pList ?? []);

      const result = await getDrivers(aid);
      if (result.data) setDrivers(result.data);
      setLoading(false);
    }
    load();
  }, []);

  useEffect(() => {
    if (!agencyId) return;
    setLoading(true);
    getDrivers(agencyId, selectedPrincipal).then((result) => {
      if (result.data) setDrivers(result.data);
      setLoading(false);
    });
  }, [selectedPrincipal, agencyId]);

  const handleBulkStatusChange = async (newStatus: string) => {
    if (selectedIds.size === 0) return;

    const label =
      newStatus === 'inactive' ? '퇴사' : newStatus === 'active' ? '활동' : '휴식';
    if (!confirm(`선택한 ${selectedIds.size}명의 기사를 "${label}" 상태로 변경하시겠습니까?`)) {
      return;
    }

    setBulkProcessing(true);
    let successCount = 0;
    for (const driverId of Array.from(selectedIds)) {
      try {
        const body: Record<string, unknown> = { driverId, status: newStatus };
        if (newStatus === 'inactive') body.resigned_at = new Date().toISOString();
        if (newStatus === 'active') body.resigned_at = null;
        const res = await fetch('/api/drivers/update', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(body),
        });
        if (res.ok) successCount++;
      } catch {
        // keep going for other drivers
      }
    }

    alert(`${successCount}명 ${label} 처리 완료`);
    setSelectedIds(new Set());

    if (agencyId) {
      const result = await getDrivers(agencyId, selectedPrincipal);
      if (result.data) setDrivers(result.data);
    }
    setBulkProcessing(false);
  };

  const toggleSelect = (id: string) => {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const toggleSelectAll = () => {
    if (selectedIds.size === filtered.length) {
      setSelectedIds(new Set());
    } else {
      setSelectedIds(new Set(filtered.map((driver) => driver.id)));
    }
  };

  const filtered = drivers.filter((driver) => {
    const matchesSearch =
      !search ||
      driver.name.includes(search) ||
      (driver.phone ?? '').includes(search) ||
      (driver.employee_code ?? '').includes(search) ||
      (driver.driver_code ?? '').includes(search);
    const matchesStatus =
      statusFilter === 'all' || driver.status === statusFilter;
    return matchesSearch && matchesStatus;
  });

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-headline font-bold text-on-surface">
            <span className="font-korean">기사 관리</span>
          </h1>
          <p className="mt-1 text-sm text-on-surface-variant font-korean">
            소속 배송 기사 정보를 확인하고 초대 상태를 관리합니다.
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

      {principals.length >= 1 && (
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
          {principals.map((principal) => (
            <button
              key={principal.id}
              onClick={() => setSelectedPrincipal(principal.id)}
              className={`px-4 py-2 rounded-lg text-sm font-korean font-medium transition-all ${
                selectedPrincipal === principal.id
                  ? 'bg-white text-on-surface shadow-sm'
                  : 'text-on-surface-variant hover:text-on-surface hover:bg-white/50'
              }`}
            >
              {principal.name}
            </button>
          ))}
        </div>
      )}

      <div className="flex items-center gap-4">
        <div className="flex-1 relative">
          <svg
            className="absolute left-4 top-1/2 -translate-y-1/2 text-on-surface-variant"
            width="18"
            height="18"
            viewBox="0 0 24 24"
            fill="currentColor"
          >
            <path d="M15.5 14h-.79l-.28-.27C15.41 12.59 16 11.11 16 9.5 16 5.91 13.09 3 9.5 3S3 5.91 3 9.5 5.91 16 9.5 16c1.61 0 3.09-.59 4.23-1.57l.27.28v.79l5 4.99L20.49 19l-4.99-5zm-6 0C7.01 14 5 11.99 5 9.5S7.01 5 9.5 5 14 7.01 14 9.5 11.99 14 9.5 14z" />
          </svg>
          <input
            type="text"
            placeholder="기사 이름, 연락처, 사번, 기사 고유코드 검색"
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

      {selectedIds.size > 0 && (
        <div className="flex items-center gap-3 bg-primary/5 border border-primary/20 rounded-xl px-5 py-3">
          <span className="text-sm font-bold text-primary font-korean">
            {selectedIds.size}명 선택
          </span>
          <div className="flex items-center gap-2 ml-auto">
            <button
              onClick={() => handleBulkStatusChange('active')}
              disabled={bulkProcessing}
              className="h-8 px-4 rounded-lg bg-emerald-500 text-white text-xs font-bold font-korean hover:bg-emerald-600 transition-colors disabled:opacity-50"
            >
              활동 처리
            </button>
            <button
              onClick={() => handleBulkStatusChange('resting')}
              disabled={bulkProcessing}
              className="h-8 px-4 rounded-lg bg-amber-500 text-white text-xs font-bold font-korean hover:bg-amber-600 transition-colors disabled:opacity-50"
            >
              휴식 처리
            </button>
            <button
              onClick={() => handleBulkStatusChange('inactive')}
              disabled={bulkProcessing}
              className="h-8 px-4 rounded-lg bg-red-500 text-white text-xs font-bold font-korean hover:bg-red-600 transition-colors disabled:opacity-50"
            >
              퇴사 처리
            </button>
            <button
              onClick={() => setSelectedIds(new Set())}
              className="h-8 px-3 rounded-lg bg-surface-container-high text-on-surface-variant text-xs font-korean hover:bg-surface-container-highest transition-colors"
            >
              선택 해제
            </button>
          </div>
        </div>
      )}

      <div className="bg-surface-container-lowest rounded-2xl shadow-ambient">
        <div className="overflow-x-auto">
          <table className="w-full text-left">
            <thead>
              <tr className="bg-surface-container-low">
                <th className="px-3 py-3 w-10">
                  <input
                    type="checkbox"
                    checked={filtered.length > 0 && selectedIds.size === filtered.length}
                    onChange={toggleSelectAll}
                    className="w-4 h-4 rounded border-outline-variant accent-primary cursor-pointer"
                  />
                </th>
                <th className="px-6 py-3 text-xs font-label font-semibold text-on-surface-variant uppercase tracking-wider font-korean">
                  이름
                </th>
                <th className="px-6 py-3 text-xs font-label font-semibold text-on-surface-variant uppercase tracking-wider font-korean">
                  기사코드 / 사번
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
                <th className="px-6 py-3 text-xs font-label font-semibold text-on-surface-variant uppercase tracking-wider font-korean">
                  가입안내
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-outline-variant/30">
              {loading ? (
                <tr>
                  <td colSpan={9} className="px-6 py-8 text-center text-sm text-on-surface-variant font-korean">
                    데이터를 불러오는 중...
                  </td>
                </tr>
              ) : filtered.length === 0 ? (
                <tr>
                  <td colSpan={9} className="px-6 py-8 text-center text-sm text-on-surface-variant font-korean">
                    {search || statusFilter !== 'all'
                      ? '검색 결과가 없습니다'
                      : '등록된 기사가 없습니다'}
                  </td>
                </tr>
              ) : (
                filtered.map((driver) => (
                  <tr
                    key={driver.id}
                    className={`hover:bg-surface-container-low/50 transition-colors cursor-pointer ${
                      driver.status === 'inactive' ? 'opacity-60' : ''
                    }`}
                    onClick={() => {
                      window.location.href = `/portal/drivers/${driver.id}`;
                    }}
                  >
                    <td className="px-3 py-4" onClick={(e) => e.stopPropagation()}>
                      <input
                        type="checkbox"
                        checked={selectedIds.has(driver.id)}
                        onChange={() => toggleSelect(driver.id)}
                        className="w-4 h-4 rounded border-outline-variant accent-primary cursor-pointer"
                      />
                    </td>
                    <td className="px-6 py-4 text-sm font-body text-on-surface font-korean">
                      <div className="flex flex-col">
                        <span className="text-primary hover:underline">{driver.name}</span>
                        {driver.driver_code && (
                          <span className="text-[11px] text-on-surface-variant/70 font-data">
                            {driver.driver_code}
                          </span>
                        )}
                      </div>
                    </td>
                    <td className="px-6 py-4 text-xs font-data text-on-surface-variant">
                      <div className="flex flex-col gap-0.5">
                        <span>{driver.driver_code || '-'}</span>
                        <span>{driver.employee_code || '-'}</span>
                      </div>
                    </td>
                    <td className="px-6 py-4">
                      {driver.principal_names.length > 0 ? (
                        <div className="flex flex-wrap gap-1">
                          {driver.principal_names.map((principalName, index) => (
                            <span
                              key={index}
                              className="inline-block px-2 py-0.5 rounded-md bg-primary/10 text-primary text-[11px] font-korean font-medium"
                            >
                              {principalName}
                            </span>
                          ))}
                        </div>
                      ) : (
                        <span className="text-xs text-on-surface-variant/40 font-korean">
                          미배정
                        </span>
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
                      {driver.created_at
                        ? new Date(driver.created_at).toLocaleDateString('ko-KR')
                        : '-'}
                    </td>
                    <td className="px-6 py-4" onClick={(e) => e.stopPropagation()}>
                      <button
                        onClick={() =>
                          handleResendInvite(
                            driver.id,
                            driver.name,
                            driver.phone ?? '',
                            driver.driver_code,
                          )
                        }
                        disabled={sendingInvite === driver.id || !driver.phone}
                        className="px-3 py-1.5 rounded-lg bg-primary/10 text-primary text-[11px] font-semibold font-korean hover:bg-primary/20 disabled:opacity-40 transition-colors"
                      >
                        {sendingInvite === driver.id ? '전송중...' : 'SMS 전송'}
                      </button>
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
