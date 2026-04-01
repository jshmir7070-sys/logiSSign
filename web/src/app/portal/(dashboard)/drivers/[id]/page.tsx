'use client';

import { useEffect, useState, useCallback } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { createBrowserSupabaseClient } from '@/lib/supabase';
import type { DeductionType } from '@/types/database';
import {
  getDriverRouteRates,
  bulkUpsertDriverRouteRates,
  deleteDriverRouteRate,
  updateDriverBusinessSettings,
  type DriverRouteRate,
  type DriverBusinessSettings,
} from '@/services/driver-route-rate.service';
import {
  getDriverDeductions,
  bulkUpsertDriverDeductions,
  deleteDriverDeduction,
  type DriverDeduction,
} from '@/services/driver-deduction.service';
import {
  getDriverPeriods,
  PERIOD_STATUS_LABELS,
  type DriverContractPeriod,
} from '@/services/contractPeriod.service';

interface DriverDetail {
  id: string
  name: string
  phone: string
  employee_code: string | null
  delivery_area: string | null
  status: string
  is_business_owner: boolean
  vat_included: boolean
  fresh_incentive_pct: number
  extra_incentive_pct: number
  tax_type: string
  principals: { name: string } | null
}

export default function DriverDetailPage() {
  const { id } = useParams<{ id: string }>();
  const router = useRouter();

  const [driver, setDriver] = useState<DriverDetail | null>(null);
  const [routeRates, setRouteRates] = useState<DriverRouteRate[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');

  /* ── Deductions ── */
  const [deductions, setDeductions] = useState<DriverDeduction[]>([]);
  const [periods, setPeriods] = useState<DriverContractPeriod[]>([]);
  const [newDeductions, setNewDeductions] = useState<{ name: string; deduction_type: DeductionType; amount: string }[]>([]);

  /* ── New route rate form ── */
  const [newRoutes, setNewRoutes] = useState<{ route_code: string; delivery_rate: string; return_rate: string }[]>([
    { route_code: '', delivery_rate: '', return_rate: '' },
  ]);

  /* ── Business settings ── */
  const [bizSettings, setBizSettings] = useState<DriverBusinessSettings>({
    is_business_owner: false,
    vat_included: true,
    fresh_incentive_pct: 100,
    extra_incentive_pct: 100,
  });

  const loadData = useCallback(async () => {
    if (!id) return;
    const supabase = createBrowserSupabaseClient();

    const { data: driverData } = await supabase
      .from('drivers')
      .select('id, name, phone, employee_code, delivery_area, status, is_business_owner, vat_included, fresh_incentive_pct, extra_incentive_pct, tax_type, principals(name)')
      .eq('id', id)
      .single();

    if (driverData) {
      const d = driverData as unknown as DriverDetail;
      setDriver(d);
      setBizSettings({
        is_business_owner: d.is_business_owner,
        vat_included: d.vat_included,
        fresh_incentive_pct: d.fresh_incentive_pct,
        extra_incentive_pct: d.extra_incentive_pct,
        tax_type: d.tax_type || (d.is_business_owner ? 'vat_invoice' : 'withholding_3_3'),
      });
    }

    const ratesResult = await getDriverRouteRates(id);
    if (ratesResult.data) setRouteRates(ratesResult.data);

    const deductionsResult = await getDriverDeductions(id);
    if (deductionsResult.data) setDeductions(deductionsResult.data);

    const periodsResult = await getDriverPeriods(id);
    if (periodsResult.data) setPeriods(periodsResult.data);

    setLoading(false);
  }, [id]);

  useEffect(() => { loadData(); }, [loadData]);

  /* ── Add new route rate row ── */
  function addNewRouteRow() {
    setNewRoutes((prev) => [...prev, { route_code: '', delivery_rate: '', return_rate: '' }]);
  }

  function removeNewRouteRow(idx: number) {
    setNewRoutes((prev) => prev.filter((_, i) => i !== idx));
  }

  function updateNewRoute(idx: number, field: string, value: string) {
    setNewRoutes((prev) => prev.map((r, i) => i === idx ? { ...r, [field]: value } : r));
  }

  /* ── Save route rates ── */
  async function handleSaveRoutes() {
    if (!id) return;
    setSaving(true);
    setError('');
    setSuccess('');

    const validRoutes = newRoutes
      .filter((r) => r.route_code.trim() && (Number(r.delivery_rate) > 0 || Number(r.return_rate) > 0))
      .map((r) => ({
        route_code: r.route_code.trim().toUpperCase(),
        delivery_rate: Number(r.delivery_rate) || 0,
        return_rate: Number(r.return_rate) || Number(r.delivery_rate) || 0, // default return = delivery
      }));

    if (validRoutes.length === 0) {
      setError('최소 1개 라우트 단가를 입력하세요');
      setSaving(false);
      return;
    }

    const result = await bulkUpsertDriverRouteRates(id, validRoutes);
    if (result.error) {
      setError(result.error);
    } else {
      setSuccess('라우트 단가가 저장되었습니다');
      setNewRoutes([{ route_code: '', delivery_rate: '', return_rate: '' }]);
      await loadData();
    }
    setSaving(false);
  }

  /* ── Delete route rate ── */
  async function handleDeleteRoute(rateId: string) {
    const result = await deleteDriverRouteRate(rateId);
    if (!result.error) await loadData();
  }

  /* ── Save business settings ── */
  async function handleSaveBizSettings() {
    if (!id) return;
    setSaving(true);
    setError('');
    setSuccess('');

    const result = await updateDriverBusinessSettings(id, bizSettings);
    if (result.error) {
      setError(result.error);
    } else {
      setSuccess('설정이 저장되었습니다');
      await loadData();
    }
    setSaving(false);
  }

  /* ── Deduction helpers ── */
  function addNewDeductionRow() {
    setNewDeductions((prev) => [...prev, { name: '', deduction_type: 'fixed', amount: '' }]);
  }

  function removeNewDeductionRow(idx: number) {
    setNewDeductions((prev) => prev.filter((_, i) => i !== idx));
  }

  function updateNewDeduction(idx: number, field: string, value: string | DeductionType) {
    setNewDeductions((prev) => prev.map((d, i) => i === idx ? { ...d, [field]: value } : d));
  }

  async function handleSaveDeductions() {
    if (!id) return;
    setSaving(true);
    setError('');
    setSuccess('');

    const valid = newDeductions
      .filter((d) => d.name.trim() && Number(d.amount) > 0)
      .map((d) => ({
        name: d.name.trim(),
        deduction_type: d.deduction_type,
        amount: Number(d.amount),
      }));

    if (valid.length === 0) {
      setError('최소 1개 공제 항목을 입력하세요');
      setSaving(false);
      return;
    }

    const result = await bulkUpsertDriverDeductions(id, valid);
    if (result.error) {
      setError(result.error);
    } else {
      setSuccess('공제 항목이 저장되었습니다');
      setNewDeductions([]);
      await loadData();
    }
    setSaving(false);
  }

  async function handleDeleteDeduction(deductionId: string) {
    const result = await deleteDriverDeduction(deductionId);
    if (!result.error) await loadData();
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="w-8 h-8 border-2 border-primary border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  if (!driver) {
    return <div className="text-center text-on-surface-variant py-12 font-korean">기사를 찾을 수 없습니다</div>;
  }

  return (
    <div className="space-y-8">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <button onClick={() => router.back()} className="text-sm text-primary hover:underline mb-2 font-korean">&larr; 기사 목록</button>
          <h1 className="text-2xl font-headline font-bold text-on-surface font-korean">{driver.name}</h1>
          <div className="flex items-center gap-4 mt-1 text-sm text-on-surface-variant">
            <span className="font-data">{driver.employee_code ?? '사번 미설정'}</span>
            <span className="font-korean">{driver.principals?.name ?? '카테고리 없음'}</span>
            <span className="font-korean">{driver.delivery_area ?? ''}</span>
          </div>
        </div>
      </div>

      {error && <div className="bg-error/10 text-error rounded-xl px-4 py-3 text-sm font-korean">{error}</div>}
      {success && <div className="bg-success/10 text-success rounded-xl px-4 py-3 text-sm font-korean">{success}</div>}

      {/* ═══ Section 1: Business / Tax Settings ═══ */}
      <div className="bg-surface-container-lowest rounded-2xl shadow-ambient p-6 space-y-4">
        <h2 className="text-base font-headline font-semibold text-on-surface font-korean">사업자 / 세금 / 정산 설정</h2>

        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-4">
          <div>
            <label className="block text-xs font-label font-medium text-on-surface-variant mb-1.5 font-korean">사업자 등록</label>
            <select
              value={bizSettings.is_business_owner ? 'true' : 'false'}
              onChange={(e) => {
                const biz = e.target.value === 'true';
                setBizSettings((s) => ({
                  ...s,
                  is_business_owner: biz,
                  tax_type: biz ? 'vat_invoice' : 'withholding_3_3',
                }));
              }}
              className="w-full h-10 px-3 rounded-xl bg-surface-container-low text-on-surface text-sm font-korean focus:outline-none focus:ring-2 focus:ring-primary/30"
            >
              <option value="true">유</option>
              <option value="false">무</option>
            </select>
          </div>
          <div>
            <label className="block text-xs font-label font-medium text-on-surface-variant mb-1.5 font-korean">세금 처리</label>
            <select
              value={bizSettings.tax_type ?? 'none'}
              onChange={(e) => setBizSettings((s) => ({ ...s, tax_type: e.target.value }))}
              className="w-full h-10 px-3 rounded-xl bg-surface-container-low text-on-surface text-sm font-korean focus:outline-none focus:ring-2 focus:ring-primary/30"
            >
              {bizSettings.is_business_owner ? (
                <>
                  <option value="vat_invoice">세금계산서 발행요청</option>
                  <option value="manual_reverse">수기 역발행</option>
                </>
              ) : (
                <>
                  <option value="withholding_3_3">3.3% 원천징수</option>
                  <option value="none">세금 미적용</option>
                </>
              )}
            </select>
          </div>
          {bizSettings.is_business_owner && (
            <div>
              <label className="block text-xs font-label font-medium text-on-surface-variant mb-1.5 font-korean">부가세</label>
              <select
                value={bizSettings.vat_included ? 'included' : 'excluded'}
                onChange={(e) => setBizSettings((s) => ({ ...s, vat_included: e.target.value === 'included' }))}
                className="w-full h-10 px-3 rounded-xl bg-surface-container-low text-on-surface text-sm font-korean focus:outline-none focus:ring-2 focus:ring-primary/30"
              >
                <option value="included">포함가</option>
                <option value="excluded">별도</option>
              </select>
            </div>
          )}
          <div>
            <label className="block text-xs font-label font-medium text-on-surface-variant mb-1.5 font-korean">프레쉬백 지급률</label>
            <div className="flex items-center gap-1">
              <input
                type="number"
                value={bizSettings.fresh_incentive_pct}
                onChange={(e) => setBizSettings((s) => ({ ...s, fresh_incentive_pct: Number(e.target.value) || 0 }))}
                className="w-full h-10 px-3 rounded-xl bg-surface-container-low text-on-surface text-sm font-data focus:outline-none focus:ring-2 focus:ring-primary/30"
              />
              <span className="text-sm text-on-surface-variant">%</span>
            </div>
          </div>
          <div>
            <label className="block text-xs font-label font-medium text-on-surface-variant mb-1.5 font-korean">인센티브 지급률</label>
            <div className="flex items-center gap-1">
              <input
                type="number"
                value={bizSettings.extra_incentive_pct}
                onChange={(e) => setBizSettings((s) => ({ ...s, extra_incentive_pct: Number(e.target.value) || 0 }))}
                className="w-full h-10 px-3 rounded-xl bg-surface-container-low text-on-surface text-sm font-data focus:outline-none focus:ring-2 focus:ring-primary/30"
              />
              <span className="text-sm text-on-surface-variant">%</span>
            </div>
          </div>
        </div>

        {/* Tax info note */}
        <div className="p-3 rounded-xl bg-surface-container-low text-xs text-on-surface-variant font-korean">
          {bizSettings.is_business_owner ? (
            bizSettings.tax_type === 'manual_reverse' ? (
              <span>수기 역발행: 대리점에서 세금계산서를 직접 작성하여 역발행 처리합니다. 부가세 {bizSettings.vat_included ? '포함가 → 공급가액 역산(÷1.1)' : '별도 청구'}</span>
            ) : (
              <span>발행요청: 기사에게 세금계산서 발행을 요청합니다. 부가세 {bizSettings.vat_included ? '포함가 → 공급가액 역산(÷1.1)' : '별도 청구'}</span>
            )
          ) : bizSettings.tax_type === 'withholding_3_3' ? (
            <span>3.3% 원천징수: 정산금액에서 소득세 3% + 지방소득세 0.3% = 3.3%를 공제 후 지급합니다</span>
          ) : (
            <span>세금 미적용</span>
          )}
        </div>

        <div className="flex justify-end">
          <button
            onClick={handleSaveBizSettings}
            disabled={saving}
            className="h-10 px-6 rounded-xl bg-primary text-white font-label font-semibold text-sm hover:bg-primary/90 disabled:opacity-50 font-korean"
          >
            설정 저장
          </button>
        </div>
      </div>

      {/* ═══ Section 2: Current Route Rates ═══ */}
      <div className="bg-surface-container-lowest rounded-2xl shadow-ambient p-6 space-y-4">
        <h2 className="text-base font-headline font-semibold text-on-surface font-korean">
          라우트별 단가 설정
          <span className="ml-2 text-xs font-label text-on-surface-variant font-normal">({routeRates.length}개 라우트)</span>
        </h2>

        {/* Existing routes */}
        {routeRates.length > 0 && (
          <div className="overflow-x-auto rounded-xl border border-outline-variant/20">
            <table className="w-full text-left text-sm">
              <thead>
                <tr className="bg-surface-container-low">
                  <th className="px-4 py-2.5 text-xs font-label font-semibold text-on-surface-variant font-korean">라우트</th>
                  <th className="px-4 py-2.5 text-xs font-label font-semibold text-on-surface-variant font-korean text-right">배송 단가</th>
                  <th className="px-4 py-2.5 text-xs font-label font-semibold text-on-surface-variant font-korean text-right">반품 단가</th>
                  <th className="px-4 py-2.5 text-xs font-label font-semibold text-on-surface-variant font-korean w-16"></th>
                </tr>
              </thead>
              <tbody className="divide-y divide-outline-variant/20">
                {routeRates.map((rr) => (
                  <tr key={rr.id}>
                    <td className="px-4 py-2.5 font-data font-semibold text-on-surface">{rr.route_code}</td>
                    <td className="px-4 py-2.5 font-data text-on-surface text-right">₩{Number(rr.delivery_rate).toLocaleString()}</td>
                    <td className="px-4 py-2.5 font-data text-on-surface text-right">₩{Number(rr.return_rate).toLocaleString()}</td>
                    <td className="px-4 py-2.5 text-right">
                      <button
                        onClick={() => handleDeleteRoute(rr.id)}
                        className="text-xs text-error hover:underline font-korean"
                      >
                        삭제
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        {/* Add new routes */}
        <div className="space-y-3">
          <p className="text-xs font-label font-medium text-on-surface-variant font-korean">라우트 추가</p>
          {newRoutes.map((nr, idx) => (
            <div key={idx} className="flex items-center gap-3">
              <input
                type="text"
                placeholder="라우트 코드"
                value={nr.route_code}
                onChange={(e) => updateNewRoute(idx, 'route_code', e.target.value)}
                className="w-32 h-10 px-3 rounded-xl bg-surface-container-low text-on-surface text-sm font-data uppercase focus:outline-none focus:ring-2 focus:ring-primary/30"
              />
              <div className="flex items-center gap-1">
                <input
                  type="number"
                  placeholder="배송 단가"
                  value={nr.delivery_rate}
                  onChange={(e) => updateNewRoute(idx, 'delivery_rate', e.target.value)}
                  className="w-28 h-10 px-3 rounded-xl bg-surface-container-low text-on-surface text-sm font-data focus:outline-none focus:ring-2 focus:ring-primary/30"
                />
                <span className="text-xs text-on-surface-variant font-korean">원</span>
              </div>
              <div className="flex items-center gap-1">
                <input
                  type="number"
                  placeholder="반품 단가"
                  value={nr.return_rate}
                  onChange={(e) => updateNewRoute(idx, 'return_rate', e.target.value)}
                  className="w-28 h-10 px-3 rounded-xl bg-surface-container-low text-on-surface text-sm font-data focus:outline-none focus:ring-2 focus:ring-primary/30"
                />
                <span className="text-xs text-on-surface-variant font-korean">원</span>
              </div>
              {newRoutes.length > 1 && (
                <button
                  onClick={() => removeNewRouteRow(idx)}
                  className="text-xs text-error hover:underline font-korean"
                >
                  제거
                </button>
              )}
            </div>
          ))}

          <div className="flex items-center gap-3">
            <button
              onClick={addNewRouteRow}
              className="h-9 px-4 rounded-xl bg-surface-container-high text-on-surface-variant font-label text-xs hover:bg-surface-container-highest transition-colors font-korean"
            >
              + 라우트 추가
            </button>
            <button
              onClick={handleSaveRoutes}
              disabled={saving}
              className="h-9 px-6 rounded-xl bg-power-gradient text-white font-label font-semibold text-xs hover:shadow-lg transition-shadow disabled:opacity-50 font-korean"
            >
              {saving ? '저장 중...' : '단가 저장'}
            </button>
          </div>
        </div>
      </div>

      {/* ═══ Section 3: 공제 항목 ═══ */}
      <div className="bg-surface-container-lowest rounded-2xl shadow-ambient p-6 space-y-4">
        <h2 className="text-base font-headline font-semibold text-on-surface font-korean">
          공제 항목
          <span className="ml-2 text-xs font-label text-on-surface-variant font-normal">({deductions.length}개 항목)</span>
        </h2>

        {/* Existing deductions */}
        {deductions.length > 0 && (
          <div className="overflow-x-auto rounded-xl border border-outline-variant/20">
            <table className="w-full text-left text-sm">
              <thead>
                <tr className="bg-surface-container-low">
                  <th className="px-4 py-2.5 text-xs font-label font-semibold text-on-surface-variant font-korean">항목명</th>
                  <th className="px-4 py-2.5 text-xs font-label font-semibold text-on-surface-variant font-korean">유형</th>
                  <th className="px-4 py-2.5 text-xs font-label font-semibold text-on-surface-variant font-korean text-right">금액</th>
                  <th className="px-4 py-2.5 text-xs font-label font-semibold text-on-surface-variant font-korean w-16"></th>
                </tr>
              </thead>
              <tbody className="divide-y divide-outline-variant/20">
                {deductions.map((ded) => (
                  <tr key={ded.id}>
                    <td className="px-4 py-2.5 font-body text-on-surface font-korean">{ded.name}</td>
                    <td className="px-4 py-2.5 text-on-surface-variant font-korean">
                      {ded.deduction_type === 'fixed' ? '고정금액' : ded.deduction_type === 'per_unit' ? '건당' : '요율'}
                    </td>
                    <td className="px-4 py-2.5 font-data text-on-surface text-right">
                      {ded.deduction_type === 'percentage' ? `${ded.amount}%` : `₩${Number(ded.amount).toLocaleString()}`}
                    </td>
                    <td className="px-4 py-2.5 text-right">
                      <button onClick={() => handleDeleteDeduction(ded.id)} className="text-xs text-error hover:underline font-korean">삭제</button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        {/* Add new deductions */}
        <div className="space-y-3">
          {newDeductions.map((nd, idx) => (
            <div key={idx} className="flex items-center gap-3">
              <input type="text" placeholder="항목명 (예: 보험료)" value={nd.name}
                onChange={(e) => updateNewDeduction(idx, 'name', e.target.value)}
                className="w-40 h-10 px-3 rounded-xl bg-surface-container-low text-on-surface text-sm font-korean focus:outline-none focus:ring-2 focus:ring-primary/30" />
              <select value={nd.deduction_type}
                onChange={(e) => updateNewDeduction(idx, 'deduction_type', e.target.value as DeductionType)}
                className="h-10 px-3 rounded-xl bg-surface-container-low text-on-surface text-sm font-korean focus:outline-none focus:ring-2 focus:ring-primary/30">
                <option value="fixed">고정금액</option>
                <option value="per_delivery">건당</option>
                <option value="percentage">요율(%)</option>
              </select>
              <div className="flex items-center gap-1">
                <input type="number" placeholder="금액" value={nd.amount}
                  onChange={(e) => updateNewDeduction(idx, 'amount', e.target.value)}
                  className="w-28 h-10 px-3 rounded-xl bg-surface-container-low text-on-surface text-sm font-data focus:outline-none focus:ring-2 focus:ring-primary/30" />
                <span className="text-xs text-on-surface-variant">{nd.deduction_type === 'percentage' ? '%' : '원'}</span>
              </div>
              <button onClick={() => removeNewDeductionRow(idx)} className="text-xs text-error hover:underline font-korean">제거</button>
            </div>
          ))}

          <div className="flex items-center gap-3">
            <button onClick={addNewDeductionRow}
              className="h-9 px-4 rounded-xl bg-surface-container-high text-on-surface-variant font-label text-xs hover:bg-surface-container-highest transition-colors font-korean">
              + 공제 항목 추가
            </button>
            {newDeductions.length > 0 && (
              <button onClick={handleSaveDeductions} disabled={saving}
                className="h-9 px-6 rounded-xl bg-power-gradient text-white font-label font-semibold text-xs hover:shadow-lg transition-shadow disabled:opacity-50 font-korean">
                {saving ? '저장 중...' : '공제 저장'}
              </button>
            )}
          </div>
        </div>
      </div>

      {/* ── 계약 기간 이력 ── */}
      <div className="bg-surface-container-lowest rounded-2xl p-6 shadow-sm border border-outline-variant/20">
        <h2 className="text-lg font-headline font-semibold text-on-surface mb-4 font-korean">계약 기간 / 정산 적용 이력</h2>
        {periods.length === 0 ? (
          <p className="text-sm text-on-surface-variant font-korean">등록된 계약 기간이 없습니다.</p>
        ) : (
          <div className="space-y-3">
            {periods.map((p) => {
              const isActive = p.status === 'active';
              const isUpcoming = p.status === 'upcoming';
              const rc = p.rate_config ?? {};
              const daysLeft = Math.ceil((new Date(p.period_end).getTime() - Date.now()) / (1000 * 60 * 60 * 24));
              return (
                <div
                  key={p.id}
                  className={`border rounded-xl p-4 ${
                    isActive ? 'border-primary/30 bg-primary/5' : isUpcoming ? 'border-tertiary/30 bg-tertiary/5' : 'border-outline-variant/20 bg-surface-container-low'
                  }`}
                >
                  <div className="flex items-center justify-between mb-2">
                    <div className="flex items-center gap-2">
                      <span className={`inline-block w-2 h-2 rounded-full ${
                        isActive ? 'bg-primary' : isUpcoming ? 'bg-tertiary' : 'bg-on-surface-variant'
                      }`} />
                      <span className={`text-sm font-semibold font-korean ${
                        isActive ? 'text-primary' : isUpcoming ? 'text-tertiary' : 'text-on-surface-variant'
                      }`}>
                        {PERIOD_STATUS_LABELS[p.status]}
                      </span>
                      {p.memo && <span className="text-xs text-on-surface-variant bg-surface-container-high px-2 py-0.5 rounded font-korean">{p.memo}</span>}
                    </div>
                    {isActive && daysLeft <= 60 && daysLeft > 0 && (
                      <span className="text-xs text-error font-semibold font-korean">만료 {daysLeft}일 전</span>
                    )}
                  </div>
                  <div className="text-sm text-on-surface font-data">
                    {new Date(p.period_start).toLocaleDateString('ko-KR')} ~ {new Date(p.period_end).toLocaleDateString('ko-KR')}
                  </div>
                  {/* 단가 요약 */}
                  <div className="mt-2 flex flex-wrap gap-x-4 gap-y-1 text-xs text-on-surface-variant">
                    {rc.delivery_unit_price != null && rc.delivery_unit_price > 0 && (
                      <span className="font-korean">배송 <strong className="text-on-surface font-data">{Number(rc.delivery_unit_price).toLocaleString()}원</strong></span>
                    )}
                    {rc.return_unit_price != null && (rc.return_unit_price as number) > 0 && (
                      <span className="font-korean">반품 <strong className="text-on-surface font-data">{Number(rc.return_unit_price).toLocaleString()}원</strong></span>
                    )}
                    {rc.pickup_unit_price != null && (rc.pickup_unit_price as number) > 0 && (
                      <span className="font-korean">집하 <strong className="text-on-surface font-data">{Number(rc.pickup_unit_price).toLocaleString()}원</strong></span>
                    )}
                    {rc.insurance?.employment_driver && rc.insurance.employment_driver !== '-' && (
                      <span className="font-korean">고용보험 기사 <strong className="text-on-surface">{rc.insurance.employment_driver}</strong></span>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
