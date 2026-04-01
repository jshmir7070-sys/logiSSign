'use client';

import { useEffect, useState } from 'react';
import Badge from '@/components/shared/Badge';
import { createBrowserSupabaseClient } from '@/lib/supabase';
import {
  getTaxInvoices,
  getTaxInvoiceSummary,
  type TaxInvoiceWithDriver,
  type TaxInvoiceSummary,
} from '@/services/tax-invoice.service';

const statusLabel: Record<string, string> = {
  issued: '발행완료',
  pending: '미발행',
  cancelled: '취소',
  draft: '작성중',
  requested: '발행요청',
};

const statusVariant: Record<string, 'success' | 'warning' | 'error' | 'default'> = {
  issued: 'success',
  requested: 'warning',
  pending: 'warning',
  cancelled: 'error',
  draft: 'default',
};

function formatKRW(amount: number): string {
  return `₩${amount.toLocaleString('ko-KR')}`;
}

function getYearMonthOptions(): { value: string; label: string }[] {
  const options: { value: string; label: string }[] = [];
  const now = new Date();
  for (let i = 0; i < 6; i++) {
    const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
    const value = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
    const label = `${d.getFullYear()}년 ${d.getMonth() + 1}월`;
    options.push({ value, label });
  }
  return options;
}

export default function TaxInvoicesPage() {
  const [invoices, setInvoices] = useState<TaxInvoiceWithDriver[]>([]);
  const [summary, setSummary] = useState<TaxInvoiceSummary | null>(null);
  const [loading, setLoading] = useState(true);
  const [agencyId, setAgencyId] = useState<string | null>(null);
  const [showForm, setShowForm] = useState(false);
  const [saving, setSaving] = useState(false);

  const now = new Date();
  const defaultYM = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
  const [yearMonth, setYearMonth] = useState(defaultYM);
  const ymOptions = getYearMonthOptions();

  /* ── 수기 역발행 폼 ── */
  const [formData, setFormData] = useState({
    driver_id: '',
    supply_amount: '',
    business_reg_number: '',
    representative_name: '',
    business_address: '',
    business_type: '',
    business_category: '',
    email: '',
    memo: '',
  });

  /* ── 사업자 기사 목록 ── */
  const [bizDrivers, setBizDrivers] = useState<{ id: string; name: string; business_reg_number: string | null; representative_name: string | null; business_address: string | null; business_type: string | null; business_category: string | null; email: string | null }[]>([]);

  useEffect(() => {
    async function init() {
      const supabase = createBrowserSupabaseClient();
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;
      const aid = user.app_metadata?.agency_id as string | undefined;
      if (!aid) return;
      setAgencyId(aid);

      // Load business-owner drivers for manual form
      const { data: drivers } = await supabase
        .from('drivers')
        .select('id, name, business_reg_number, representative_name, business_address, business_type, business_category, email')
        .eq('agency_id', aid)
        .eq('is_business_owner', true)
        .eq('status', 'active');
      if (drivers) setBizDrivers(drivers as typeof bizDrivers);
    }
    init();
  }, []);

  useEffect(() => {
    if (!agencyId) return;
    async function load() {
      setLoading(true);
      const [invResult, sumResult] = await Promise.all([
        getTaxInvoices(agencyId!, yearMonth),
        getTaxInvoiceSummary(agencyId!, yearMonth),
      ]);
      if (invResult.data) setInvoices(invResult.data);
      if (sumResult.data) setSummary(sumResult.data);
      setLoading(false);
    }
    load();
  }, [agencyId, yearMonth]);

  /* Auto-fill business info when driver selected */
  function handleDriverSelect(driverId: string) {
    const d = bizDrivers.find((dr) => dr.id === driverId);
    setFormData((f) => ({
      ...f,
      driver_id: driverId,
      business_reg_number: d?.business_reg_number ?? '',
      representative_name: d?.representative_name ?? '',
      business_address: d?.business_address ?? '',
      business_type: d?.business_type ?? '',
      business_category: d?.business_category ?? '',
      email: d?.email ?? '',
    }));
  }

  async function handleManualSubmit() {
    if (!agencyId || !formData.driver_id || !formData.supply_amount) return;
    setSaving(true);

    const supplyAmount = Number(formData.supply_amount);
    const taxAmount = Math.round(supplyAmount * 0.1);

    const supabase = createBrowserSupabaseClient();
    await supabase.from('tax_invoices').insert({
      agency_id: agencyId,
      driver_id: formData.driver_id,
      year_month: yearMonth,
      supply_amount: supplyAmount,
      tax_amount: taxAmount,
      total_amount: supplyAmount + taxAmount,
      invoice_type: 'manual_reverse',
      business_reg_number: formData.business_reg_number || null,
      representative_name: formData.representative_name || null,
      business_address: formData.business_address || null,
      business_type: formData.business_type || null,
      business_category: formData.business_category || null,
      email: formData.email || null,
      memo: formData.memo || null,
      status: 'draft',
    } as never);

    setFormData({ driver_id: '', supply_amount: '', business_reg_number: '', representative_name: '', business_address: '', business_type: '', business_category: '', email: '', memo: '' });
    setShowForm(false);
    setSaving(false);

    // Reload
    const [invResult, sumResult] = await Promise.all([
      getTaxInvoices(agencyId, yearMonth),
      getTaxInvoiceSummary(agencyId, yearMonth),
    ]);
    if (invResult.data) setInvoices(invResult.data);
    if (sumResult.data) setSummary(sumResult.data);
  }

  const summaryCards = [
    { title: '공급가액 합계', value: formatKRW(summary?.totalSupply ?? 0), color: 'text-primary' },
    { title: '세액 합계', value: formatKRW(summary?.totalTax ?? 0), color: 'text-on-surface-variant' },
    { title: '합계금액', value: formatKRW(summary?.totalAmount ?? 0), color: 'text-tertiary' },
    { title: '발행 현황', value: `${summary?.issuedCount ?? 0} / ${summary?.invoiceCount ?? 0}건`, color: 'text-on-surface' },
  ];

  const inputCls = 'w-full h-10 px-3 rounded-xl bg-surface-container-low text-on-surface text-sm focus:outline-none focus:ring-2 focus:ring-primary/30';
  const labelCls = 'block text-xs font-label font-medium text-on-surface-variant mb-1.5 font-korean';

  return (
    <div className="space-y-8">
      {/* Page Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-headline font-bold text-on-surface font-korean">세금계산서 관리</h1>
          <p className="mt-1 text-sm text-on-surface-variant font-korean">사업자 등록 기사에 대한 세금계산서를 관리하세요</p>
        </div>
        <div className="flex items-center gap-3">
          <select
            value={yearMonth}
            onChange={(e) => setYearMonth(e.target.value)}
            className="px-4 py-2.5 rounded-xl bg-surface-container-lowest shadow-ambient text-sm font-label text-on-surface font-korean focus:outline-none focus:ring-2 focus:ring-primary/30"
          >
            {ymOptions.map((opt) => (
              <option key={opt.value} value={opt.value}>{opt.label}</option>
            ))}
          </select>
          <button
            onClick={() => setShowForm(!showForm)}
            className="bg-power-gradient text-white px-5 py-2.5 rounded-xl font-label font-semibold text-sm hover:shadow-lg transition-shadow flex items-center gap-2 font-korean"
          >
            <svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor">
              <path d="M19 13h-6v6h-2v-6H5v-2h6V5h2v6h6v2z" />
            </svg>
            수기 역발행
          </button>
        </div>
      </div>

      {/* ═══ 수기 역발행 폼 ═══ */}
      {showForm && (
        <div className="bg-surface-container-lowest rounded-2xl shadow-ambient p-6 space-y-4 border-2 border-primary/20">
          <h2 className="text-base font-headline font-semibold text-on-surface font-korean">수기 역발행 작성</h2>
          <p className="text-xs text-on-surface-variant font-korean">대리점에서 직접 세금계산서를 역발행합니다. 기사 선택 시 사업자 정보가 자동 입력됩니다.</p>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            <div>
              <label className={labelCls}>기사 선택 *</label>
              <select value={formData.driver_id} onChange={(e) => handleDriverSelect(e.target.value)}
                className={`${inputCls} font-korean`}>
                <option value="">기사를 선택하세요</option>
                {bizDrivers.map((d) => (
                  <option key={d.id} value={d.id}>{d.name}</option>
                ))}
              </select>
            </div>
            <div>
              <label className={labelCls}>공급가액 *</label>
              <input type="number" value={formData.supply_amount}
                onChange={(e) => setFormData((f) => ({ ...f, supply_amount: e.target.value }))}
                placeholder="1000000" className={`${inputCls} font-data`} />
              {formData.supply_amount && (
                <p className="text-[11px] text-on-surface-variant/60 mt-1 font-data">
                  세액: {formatKRW(Math.round(Number(formData.supply_amount) * 0.1))} / 합계: {formatKRW(Math.round(Number(formData.supply_amount) * 1.1))}
                </p>
              )}
            </div>
            <div>
              <label className={labelCls}>사업자등록번호</label>
              <input type="text" value={formData.business_reg_number}
                onChange={(e) => setFormData((f) => ({ ...f, business_reg_number: e.target.value }))}
                placeholder="123-45-67890" className={`${inputCls} font-data`} />
            </div>
            <div>
              <label className={labelCls}>대표자</label>
              <input type="text" value={formData.representative_name}
                onChange={(e) => setFormData((f) => ({ ...f, representative_name: e.target.value }))}
                className={`${inputCls} font-korean`} />
            </div>
            <div>
              <label className={labelCls}>사업장주소</label>
              <input type="text" value={formData.business_address}
                onChange={(e) => setFormData((f) => ({ ...f, business_address: e.target.value }))}
                className={`${inputCls} font-korean`} />
            </div>
            <div>
              <label className={labelCls}>업종 / 업태</label>
              <div className="flex gap-2">
                <input type="text" value={formData.business_type} placeholder="업종"
                  onChange={(e) => setFormData((f) => ({ ...f, business_type: e.target.value }))}
                  className={`${inputCls} font-korean`} />
                <input type="text" value={formData.business_category} placeholder="업태"
                  onChange={(e) => setFormData((f) => ({ ...f, business_category: e.target.value }))}
                  className={`${inputCls} font-korean`} />
              </div>
            </div>
            <div>
              <label className={labelCls}>이메일</label>
              <input type="email" value={formData.email}
                onChange={(e) => setFormData((f) => ({ ...f, email: e.target.value }))}
                className={`${inputCls} font-data`} />
            </div>
            <div className="sm:col-span-2">
              <label className={labelCls}>비고</label>
              <input type="text" value={formData.memo}
                onChange={(e) => setFormData((f) => ({ ...f, memo: e.target.value }))}
                placeholder="참고사항" className={`${inputCls} font-korean`} />
            </div>
          </div>

          <div className="flex justify-end gap-3">
            <button onClick={() => setShowForm(false)}
              className="h-10 px-5 rounded-xl bg-surface-container-high text-on-surface-variant font-label text-sm hover:bg-surface-container-highest transition-colors font-korean">
              취소
            </button>
            <button onClick={handleManualSubmit}
              disabled={saving || !formData.driver_id || !formData.supply_amount}
              className="h-10 px-6 rounded-xl bg-primary text-white font-label font-semibold text-sm hover:bg-primary/90 disabled:opacity-50 font-korean">
              {saving ? '저장 중...' : '역발행 저장'}
            </button>
          </div>
        </div>
      )}

      {/* Summary Cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {summaryCards.map((card) => (
          <div key={card.title} className="bg-surface-container-lowest rounded-2xl shadow-ambient p-5">
            <p className="text-xs font-label text-on-surface-variant font-korean">{card.title}</p>
            <p className={`mt-2 text-xl font-data font-bold ${card.color}`}>
              {loading ? '...' : card.value}
            </p>
          </div>
        ))}
      </div>

      {/* Table */}
      <div className="bg-surface-container-lowest rounded-2xl shadow-ambient">
        <div className="overflow-x-auto">
          <table className="w-full text-left">
            <thead>
              <tr className="bg-surface-container-low">
                <th className="px-5 py-3 text-xs font-label font-semibold text-on-surface-variant uppercase tracking-wider font-korean">기사명</th>
                <th className="px-5 py-3 text-xs font-label font-semibold text-on-surface-variant uppercase tracking-wider font-korean">유형</th>
                <th className="px-5 py-3 text-xs font-label font-semibold text-on-surface-variant uppercase tracking-wider font-korean">사업자번호</th>
                <th className="px-5 py-3 text-xs font-label font-semibold text-on-surface-variant uppercase tracking-wider font-korean text-right">공급가액</th>
                <th className="px-5 py-3 text-xs font-label font-semibold text-on-surface-variant uppercase tracking-wider font-korean text-right">세액</th>
                <th className="px-5 py-3 text-xs font-label font-semibold text-on-surface-variant uppercase tracking-wider font-korean text-right">합계</th>
                <th className="px-5 py-3 text-xs font-label font-semibold text-on-surface-variant uppercase tracking-wider font-korean">발행일</th>
                <th className="px-5 py-3 text-xs font-label font-semibold text-on-surface-variant uppercase tracking-wider font-korean">상태</th>
                <th className="px-5 py-3 text-xs font-label font-semibold text-on-surface-variant uppercase tracking-wider font-korean w-16"></th>
              </tr>
            </thead>
            <tbody className="divide-y divide-outline-variant/30">
              {loading ? (
                <tr>
                  <td colSpan={9} className="px-6 py-8 text-center text-sm text-on-surface-variant font-korean">데이터를 불러오는 중...</td>
                </tr>
              ) : invoices.length === 0 ? (
                <tr>
                  <td colSpan={9} className="px-6 py-8 text-center text-sm text-on-surface-variant font-korean">해당 월 세금계산서 데이터가 없습니다</td>
                </tr>
              ) : (
                invoices.map((inv) => (
                  <tr key={inv.id} className="hover:bg-surface-container-low/50 transition-colors">
                    <td className="px-5 py-4 text-sm font-body text-on-surface font-korean">
                      <div>{inv.drivers?.name ?? '이름 없음'}</div>
                      {inv.drivers?.representative_name && (
                        <div className="text-xs text-on-surface-variant">{inv.drivers.representative_name}</div>
                      )}
                    </td>
                    <td className="px-5 py-4">
                      <span className={`text-[10px] px-2 py-1 rounded-lg font-label font-korean ${
                        inv.invoice_type === 'manual_reverse'
                          ? 'bg-tertiary/10 text-tertiary'
                          : 'bg-primary/10 text-primary'
                      }`}>
                        {inv.invoice_type === 'manual_reverse' ? '수기역발행' : '발행요청'}
                      </span>
                    </td>
                    <td className="px-5 py-4 text-sm font-data text-on-surface-variant">
                      {inv.drivers?.business_reg_number ?? '-'}
                    </td>
                    <td className="px-5 py-4 text-sm font-data text-on-surface text-right">
                      {formatKRW(inv.supply_amount)}
                    </td>
                    <td className="px-5 py-4 text-sm font-data text-on-surface-variant text-right">
                      {formatKRW(inv.tax_amount)}
                    </td>
                    <td className="px-5 py-4 text-sm font-data font-semibold text-on-surface text-right">
                      {formatKRW(inv.total_amount)}
                    </td>
                    <td className="px-5 py-4 text-sm font-data text-on-surface-variant">
                      {inv.issued_at ? new Date(inv.issued_at).toLocaleDateString('ko-KR') : '-'}
                    </td>
                    <td className="px-5 py-4">
                      <Badge
                        label={statusLabel[inv.status] ?? inv.status}
                        variant={statusVariant[inv.status] ?? 'default'}
                      />
                    </td>
                    <td className="px-5 py-4">
                      <a
                        href={`/portal/tax-invoices/${inv.id}/print`}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-xs text-primary hover:underline font-korean"
                      >
                        출력
                      </a>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Bottom Action Bar */}
      {invoices.length > 0 && (
        <div className="bg-surface-container-lowest rounded-2xl shadow-ambient px-6 py-4 flex items-center justify-between">
          <p className="text-sm text-on-surface-variant font-korean">
            총 <span className="font-data font-semibold text-on-surface">{invoices.length}</span>건의 세금계산서
          </p>
          <button className="bg-power-gradient text-white px-6 py-2.5 rounded-xl font-label font-semibold text-sm hover:shadow-lg transition-shadow font-korean">
            세금계산서 일괄 발행
          </button>
        </div>
      )}
    </div>
  );
}
