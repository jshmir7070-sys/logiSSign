'use client';

import { useEffect, useState } from 'react';
import Badge from '@/components/shared/Badge';
import { toastSuccess, toastError } from '@/components/shared/Toast';
import { createBrowserSupabaseClient } from '@/lib/supabase';
import {
  type AmendmentType,
  type AmendmentStatus,
  type AmendmentChanges,
  type ContractAmendment,
  AMENDMENT_TYPE_LABELS,
  AMENDMENT_STATUS_LABELS,
} from '@/services/amendment.service';
import { sendPushToDriver } from '@/services/push.service';

interface DriverItem {
  id: string;
  name: string;
  phone: string;
  employee_code: string | null;
}

const STATUS_TAB_OPTIONS: { value: AmendmentStatus | 'all'; label: string }[] = [
  { value: 'all', label: '전체' },
  { value: 'pending', label: '확인 대기' },
  { value: 'approved', label: '수락' },
  { value: 'rejected', label: '거부' },
  { value: 'cancelled', label: '취소' },
];

const AMENDMENT_TYPES: { value: AmendmentType; label: string }[] = [
  { value: 'rate_change', label: '단가 변경' },
  { value: 'insurance_change', label: '보험 부담비율 변경' },
  { value: 'deduction_change', label: '차감항목 변경' },
  { value: 'area_change', label: '배송구역 변경' },
  { value: 'renewal', label: '재계약' },
  { value: 'general_change', label: '기타 변경' },
];

export default function AmendmentsPage() {
  const [agencyId, setAgencyId] = useState<string | null>(null);
  const [amendments, setAmendments] = useState<ContractAmendment[]>([]);
  const [drivers, setDrivers] = useState<DriverItem[]>([]);
  const [statusFilter, setStatusFilter] = useState<AmendmentStatus | 'all'>('all');
  const [loading, setLoading] = useState(true);

  // 새 변경 요청 폼
  const [showForm, setShowForm] = useState(false);
  const [selectedDriverIds, setSelectedDriverIds] = useState<Set<string>>(new Set());
  const [amendmentType, setAmendmentType] = useState<AmendmentType>('rate_change');
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [effectiveDate, setEffectiveDate] = useState('');
  const [changeItems, setChangeItems] = useState<{ field: string; before: string; after: string }[]>([
    { field: '', before: '', after: '' },
  ]);
  const [sending, setSending] = useState(false);

  useEffect(() => {
    async function init() {
      const supabase = createBrowserSupabaseClient();
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;
      const aid = user.app_metadata?.agency_id as string;
      if (!aid) return;
      setAgencyId(aid);

      // 기사 목록 + 변경 요청 목록 병렬 로드
      const [driversRes, amendmentsRes] = await Promise.all([
        supabase.from('drivers').select('id, name, phone, employee_code').eq('agency_id', aid).eq('status', 'active').order('name'),
        supabase.from('contract_amendments').select('*, driver:drivers(name, phone, employee_code)').eq('agency_id', aid).order('created_at', { ascending: false }),
      ]);

      if (driversRes.data) setDrivers(driversRes.data as DriverItem[]);
      if (amendmentsRes.data) setAmendments(amendmentsRes.data as ContractAmendment[]);
      setLoading(false);
    }
    init();
  }, []);

  const filteredAmendments = statusFilter === 'all'
    ? amendments
    : amendments.filter((a) => a.status === statusFilter);

  const toggleDriver = (id: string) => {
    setSelectedDriverIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const selectAllDrivers = () => {
    if (selectedDriverIds.size === drivers.length) {
      setSelectedDriverIds(new Set());
    } else {
      setSelectedDriverIds(new Set(drivers.map((d) => d.id)));
    }
  };

  const addChangeItem = () => setChangeItems((prev) => [...prev, { field: '', before: '', after: '' }]);
  const removeChangeItem = (idx: number) => setChangeItems((prev) => prev.filter((_, i) => i !== idx));
  const updateChangeItem = (idx: number, key: 'field' | 'before' | 'after', value: string) => {
    setChangeItems((prev) => prev.map((item, i) => i === idx ? { ...item, [key]: value } : item));
  };

  const handleSend = async () => {
    if (!agencyId || selectedDriverIds.size === 0 || !title.trim()) return;
    setSending(true);

    const changes: AmendmentChanges = {
      before: {},
      after: {},
    };
    for (const item of changeItems) {
      if (item.field.trim()) {
        changes.before[item.field.trim()] = item.before.trim();
        changes.after[item.field.trim()] = item.after.trim();
      }
    }

    try {
      const res = await fetch('/api/amendments', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          agencyId,
          driverIds: Array.from(selectedDriverIds),
          amendmentType,
          title: title.trim(),
          description: description.trim() || undefined,
          changes,
          effectiveDate: effectiveDate || undefined,
        }),
      });
      const result = await res.json();

      if (result.error) {
        toastError(`오류: ${result.error}`);
      } else {
        // 푸시 알림 전송
        for (const item of result.data ?? []) {
          const dItem = item as { id: string; driver_id: string };
          await sendPushToDriver(dItem.driver_id, {
            title: '⚠️ 계약 변경 요청',
            body: `"${title.trim()}" 변경 요청이 도착했습니다. 확인 후 수락/거부해주세요.`,
            data: { type: 'amendment', id: dItem.id },
          }).catch(() => {});
        }

        toastSuccess(`${result.created}건의 변경 요청이 전송되었습니다.`);

        // 리셋 + 새로고침
        setShowForm(false);
        setSelectedDriverIds(new Set());
        setTitle('');
        setDescription('');
        setEffectiveDate('');
        setChangeItems([{ field: '', before: '', after: '' }]);

        // 목록 새로고침
        const supabase = createBrowserSupabaseClient();
        const { data } = await supabase
          .from('contract_amendments')
          .select('*, driver:drivers(name, phone, employee_code)')
          .eq('agency_id', agencyId)
          .order('created_at', { ascending: false });
        if (data) setAmendments(data as ContractAmendment[]);
      }
    } catch (err) {
      toastError('전송 실패');
    }

    setSending(false);
  };

  const handleCancel = async (id: string) => {
    if (!confirm('이 변경 요청을 취소하시겠습니까?')) return;
    try {
      const res = await fetch('/api/amendments', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ amendmentId: id, action: 'cancel' }),
      });
      const result = await res.json();
      if (result.error) {
        toastError(`오류: ${result.error}`);
      } else {
        setAmendments((prev) => prev.map((a) => a.id === id ? { ...a, status: 'cancelled' as AmendmentStatus } : a));
      }
    } catch {
      toastError('취소 실패');
    }
  };

  const badgeVariant = (status: AmendmentStatus): 'warning' | 'success' | 'error' | 'default' => {
    if (status === 'pending') return 'warning';
    if (status === 'approved') return 'success';
    if (status === 'rejected') return 'error';
    return 'default';
  };

  if (loading) {
    return <div className="p-6 text-gray-500">로딩 중...</div>;
  }

  return (
    <div className="max-w-6xl mx-auto p-6 space-y-6">
      {/* 헤더 */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">계약 변경 관리</h1>
          <p className="text-gray-500 mt-1">
            계약 내용 변경 시 기사에게 동의를 요청하고, 기사가 수락해야 변경이 적용됩니다.
          </p>
        </div>
        <button
          onClick={() => setShowForm(!showForm)}
          className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition font-medium"
        >
          {showForm ? '닫기' : '+ 변경 요청'}
        </button>
      </div>

      {/* 새 변경 요청 폼 */}
      {showForm && (
        <div className="bg-white border rounded-xl p-6 space-y-5 shadow-sm">
          <h2 className="text-lg font-semibold text-gray-800">새 변경 요청</h2>

          {/* 기사 선택 */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              대상 기사 선택
              <button onClick={selectAllDrivers} className="ml-3 text-blue-600 text-xs hover:underline">
                {selectedDriverIds.size === drivers.length ? '전체 해제' : '전체 선택'}
              </button>
            </label>
            <div className="max-h-40 overflow-y-auto border rounded-lg p-2 space-y-1">
              {drivers.map((d) => (
                <label key={d.id} className="flex items-center gap-2 px-2 py-1 hover:bg-gray-50 rounded cursor-pointer">
                  <input
                    type="checkbox"
                    checked={selectedDriverIds.has(d.id)}
                    onChange={() => toggleDriver(d.id)}
                    className="rounded text-blue-600"
                  />
                  <span className="text-sm text-gray-800">{d.name}</span>
                  <span className="text-xs text-gray-400">{d.phone}</span>
                </label>
              ))}
            </div>
            <p className="text-xs text-gray-500 mt-1">{selectedDriverIds.size}명 선택</p>
          </div>

          {/* 변경 유형 */}
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">변경 유형</label>
              <select
                value={amendmentType}
                onChange={(e) => setAmendmentType(e.target.value as AmendmentType)}
                className="w-full border rounded-lg px-3 py-2 text-sm"
              >
                {AMENDMENT_TYPES.map((t) => (
                  <option key={t.value} value={t.value}>{t.label}</option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">적용 예정일</label>
              <input
                type="date"
                value={effectiveDate}
                onChange={(e) => setEffectiveDate(e.target.value)}
                className="w-full border rounded-lg px-3 py-2 text-sm"
              />
            </div>
          </div>

          {/* 제목 & 설명 */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">제목 *</label>
            <input
              type="text"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="예: 2026년 4월 배송단가 인상 안내"
              className="w-full border rounded-lg px-3 py-2 text-sm"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">상세 설명</label>
            <textarea
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              rows={3}
              placeholder="변경 사유 및 상세 내용을 입력하세요"
              className="w-full border rounded-lg px-3 py-2 text-sm resize-none"
            />
          </div>

          {/* 변경 항목 (전/후) */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">변경 항목 (변경 전 → 변경 후)</label>
            {changeItems.map((item, idx) => (
              <div key={idx} className="flex items-center gap-2 mb-2">
                <input
                  type="text"
                  value={item.field}
                  onChange={(e) => updateChangeItem(idx, 'field', e.target.value)}
                  placeholder="항목명 (예: 배송단가)"
                  className="flex-1 border rounded px-2 py-1.5 text-sm"
                />
                <input
                  type="text"
                  value={item.before}
                  onChange={(e) => updateChangeItem(idx, 'before', e.target.value)}
                  placeholder="변경 전"
                  className="flex-1 border rounded px-2 py-1.5 text-sm"
                />
                <span className="text-gray-400">→</span>
                <input
                  type="text"
                  value={item.after}
                  onChange={(e) => updateChangeItem(idx, 'after', e.target.value)}
                  placeholder="변경 후"
                  className="flex-1 border rounded px-2 py-1.5 text-sm"
                />
                {changeItems.length > 1 && (
                  <button onClick={() => removeChangeItem(idx)} className="text-red-400 hover:text-red-600 text-sm">✕</button>
                )}
              </div>
            ))}
            <button onClick={addChangeItem} className="text-blue-600 text-sm hover:underline">+ 항목 추가</button>
          </div>

          {/* 전송 */}
          <div className="flex justify-end gap-3 pt-2">
            <button onClick={() => setShowForm(false)} className="px-4 py-2 text-gray-600 border rounded-lg hover:bg-gray-50 text-sm">
              취소
            </button>
            <button
              onClick={handleSend}
              disabled={sending || selectedDriverIds.size === 0 || !title.trim()}
              className="px-6 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 text-sm font-medium"
            >
              {sending ? '전송 중...' : `${selectedDriverIds.size}명에게 변경 요청 전송`}
            </button>
          </div>
        </div>
      )}

      {/* 상태 필터 탭 */}
      <div className="flex gap-2 border-b pb-2">
        {STATUS_TAB_OPTIONS.map((tab) => {
          const count = tab.value === 'all' ? amendments.length : amendments.filter((a) => a.status === tab.value).length;
          return (
            <button
              key={tab.value}
              onClick={() => setStatusFilter(tab.value)}
              className={`px-3 py-1.5 text-sm rounded-t-lg transition ${
                statusFilter === tab.value
                  ? 'bg-blue-50 text-blue-700 border-b-2 border-blue-600 font-medium'
                  : 'text-gray-500 hover:text-gray-700'
              }`}
            >
              {tab.label} ({count})
            </button>
          );
        })}
      </div>

      {/* 변경 요청 목록 */}
      {filteredAmendments.length === 0 ? (
        <div className="text-center py-12 text-gray-400">
          변경 요청이 없습니다.
        </div>
      ) : (
        <div className="space-y-3">
          {filteredAmendments.map((a) => {
            const changes = a.changes as AmendmentChanges | null;
            const driverInfo = a.driver as { name: string; phone: string } | undefined;
            return (
              <div key={a.id} className="bg-white border rounded-xl p-4 hover:shadow-sm transition">
                <div className="flex items-start justify-between">
                  <div className="flex-1">
                    <div className="flex items-center gap-2 mb-1">
                      <Badge label={AMENDMENT_STATUS_LABELS[a.status]} variant={badgeVariant(a.status)} />
                      <span className="text-xs text-gray-400 bg-gray-100 px-2 py-0.5 rounded">
                        {AMENDMENT_TYPE_LABELS[a.amendment_type]}
                      </span>
                    </div>
                    <h3 className="font-semibold text-gray-800">{a.title}</h3>
                    <p className="text-sm text-gray-500 mt-0.5">
                      기사: {driverInfo?.name ?? '알 수 없음'} · {new Date(a.requested_at).toLocaleDateString('ko-KR')}
                      {a.effective_date && ` · 적용일: ${new Date(a.effective_date).toLocaleDateString('ko-KR')}`}
                    </p>
                    {a.description && (
                      <p className="text-sm text-gray-600 mt-1">{a.description}</p>
                    )}
                  </div>

                  {a.status === 'pending' && (
                    <button
                      onClick={() => handleCancel(a.id)}
                      className="text-sm text-red-500 hover:text-red-700 whitespace-nowrap ml-4"
                    >
                      취소
                    </button>
                  )}
                </div>

                {/* 변경 전/후 */}
                {changes && Object.keys(changes.before ?? {}).length > 0 && (
                  <div className="mt-3 bg-gray-50 rounded-lg p-3">
                    <table className="w-full text-sm">
                      <thead>
                        <tr className="text-gray-500">
                          <th className="text-left font-medium pb-1">항목</th>
                          <th className="text-left font-medium pb-1">변경 전</th>
                          <th className="text-left font-medium pb-1">변경 후</th>
                        </tr>
                      </thead>
                      <tbody>
                        {Object.entries(changes.before ?? {}).map(([field, beforeVal]) => (
                          <tr key={field}>
                            <td className="py-0.5 text-gray-700 font-medium">{field}</td>
                            <td className="py-0.5 text-red-600 line-through">{beforeVal}</td>
                            <td className="py-0.5 text-green-700 font-medium">{changes.after?.[field] ?? ''}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}

                {/* 거부 사유 */}
                {a.status === 'rejected' && a.rejection_reason && (
                  <div className="mt-2 bg-red-50 text-red-700 text-sm rounded-lg px-3 py-2">
                    거부 사유: {a.rejection_reason}
                  </div>
                )}

                {/* 응답 시간 */}
                {a.responded_at && (
                  <p className="text-xs text-gray-400 mt-2">
                    응답일: {new Date(a.responded_at).toLocaleString('ko-KR')}
                  </p>
                )}
              </div>
            )
          })}
        </div>
      )}
    </div>
  );
}