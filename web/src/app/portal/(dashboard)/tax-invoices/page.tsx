'use client';

import { useEffect, useMemo, useState } from 'react';

import Badge from '@/components/shared/Badge';
import { formatBusinessNumber } from '@/lib/formatters';
import { createBrowserSupabaseClient } from '@/lib/supabase';
import {
  getTaxInvoiceSendLogs,
  getTaxInvoiceSummary,
  getTaxInvoices,
  type TaxInvoiceSendLog,
  type TaxInvoiceSummary,
  type TaxInvoiceWithDriver,
} from '@/services/tax-invoice.service';

type BusinessDriver = {
  id: string;
  name: string;
  business_reg_number: string | null;
  representative_name: string | null;
  business_address: string | null;
  business_type: string | null;
  business_category: string | null;
  email: string | null;
};

type SendResult = {
  invoiceId: string;
  driverName: string;
  channel: 'push' | 'sms' | 'none';
  success: boolean;
  reason?: string;
  createdAt: string;
};

const statusLabel: Record<string, string> = {
  issued: '발행 완료',
  pending: '발행 대기',
  cancelled: '취소',
};

const statusVariant: Record<string, 'success' | 'warning' | 'error' | 'default'> = {
  issued: 'success',
  pending: 'warning',
  cancelled: 'error',
};

function formatKRW(amount: number): string {
  return `₩${amount.toLocaleString('ko-KR')}`;
}

function formatDate(value: string | null): string {
  if (!value) return '-';

  return new Date(value).toLocaleString('ko-KR', {
    year: 'numeric',
    month: 'numeric',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
}

function getYearMonthOptions(): { value: string; label: string }[] {
  const options: { value: string; label: string }[] = [];
  const now = new Date();

  for (let index = 0; index < 6; index += 1) {
    const date = new Date(now.getFullYear(), now.getMonth() - index, 1);
    const value = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`;
    const label = `${date.getFullYear()}년 ${date.getMonth() + 1}월`;
    options.push({ value, label });
  }

  return options;
}

function invoiceTypeLabel(invoiceType: string): string {
  if (invoiceType === 'manual_reverse') return '수기 역발행';
  if (invoiceType === 'withholding_3_3') return '3.3% 원천징수';
  return '세금계산서';
}

function sendChannelLabel(channel: SendResult['channel'] | TaxInvoiceSendLog['channel']): string {
  if (channel === 'push') return '앱 푸시';
  if (channel === 'sms') return '문자 전송';
  return '미전송';
}

export default function TaxInvoicesPage() {
  const [invoices, setInvoices] = useState<TaxInvoiceWithDriver[]>([]);
  const [summary, setSummary] = useState<TaxInvoiceSummary | null>(null);
  const [sendLogs, setSendLogs] = useState<TaxInvoiceSendLog[]>([]);
  const [loading, setLoading] = useState(true);
  const [agencyId, setAgencyId] = useState<string | null>(null);
  const [showForm, setShowForm] = useState(false);
  const [saving, setSaving] = useState(false);
  const [issuing, setIssuing] = useState(false);
  const [sending, setSending] = useState(false);
  const [downloading, setDownloading] = useState(false);
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [sendResults, setSendResults] = useState<SendResult[]>([]);

  const now = new Date();
  const defaultYearMonth = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
  const [yearMonth, setYearMonth] = useState(defaultYearMonth);
  const yearMonthOptions = getYearMonthOptions();

  const [formData, setFormData] = useState({
    driver_id: '',
    supply_amount: '',
    business_reg_number: '',
    representative_name: '',
    business_address: '',
    business_type: '',
    business_category: '',
    email: '',
  });

  const [businessDrivers, setBusinessDrivers] = useState<BusinessDriver[]>([]);

  useEffect(() => {
    async function init() {
      const supabase = createBrowserSupabaseClient();
      const {
        data: { user },
      } = await supabase.auth.getUser();

      if (!user) return;

      const resolvedAgencyId = user.app_metadata?.agency_id as string | undefined;
      if (!resolvedAgencyId) return;

      setAgencyId(resolvedAgencyId);

      const { data: drivers } = await supabase
        .from('drivers')
        .select(
          'id, name, business_reg_number, representative_name, business_address, business_type, business_category, email',
        )
        .eq('agency_id', resolvedAgencyId)
        .eq('is_business_owner', true)
        .eq('status', 'active')
        .order('name', { ascending: true });

      if (drivers) setBusinessDrivers(drivers as BusinessDriver[]);
    }

    void init();
  }, []);

  async function loadInvoices(targetAgencyId: string, targetYearMonth: string) {
    setLoading(true);

    const [invoiceResult, summaryResult] = await Promise.all([
      getTaxInvoices(targetAgencyId, targetYearMonth),
      getTaxInvoiceSummary(targetAgencyId, targetYearMonth),
    ]);

    const nextInvoices = invoiceResult.data ?? [];
    setInvoices(nextInvoices);
    setSelectedIds((prev) => prev.filter((id) => nextInvoices.some((invoice) => invoice.id === id)));
    setSummary(summaryResult.data ?? null);

    if (nextInvoices.length > 0) {
      const logResult = await getTaxInvoiceSendLogs(
        targetAgencyId,
        nextInvoices.map((invoice) => invoice.id),
      );
      setSendLogs(logResult.data ?? []);
    } else {
      setSendLogs([]);
    }

    setLoading(false);
  }

  useEffect(() => {
    if (!agencyId) return;
    void loadInvoices(agencyId, yearMonth);
  }, [agencyId, yearMonth]);

  function handleDriverSelect(driverId: string) {
    const driver = businessDrivers.find((row) => row.id === driverId);
    setFormData((prev) => ({
      ...prev,
      driver_id: driverId,
      business_reg_number: driver?.business_reg_number ?? '',
      representative_name: driver?.representative_name ?? '',
      business_address: driver?.business_address ?? '',
      business_type: driver?.business_type ?? '',
      business_category: driver?.business_category ?? '',
      email: driver?.email ?? '',
    }));
  }

  async function handleManualSubmit() {
    if (!agencyId || !formData.driver_id || !formData.supply_amount) return;

    setSaving(true);
    const supplyAmount = Number(formData.supply_amount);
    const taxAmount = Math.round(supplyAmount * 0.1);
    const supabase = createBrowserSupabaseClient();

    const { error } = await supabase.from('tax_invoices').insert({
      agency_id: agencyId,
      driver_id: formData.driver_id,
      year_month: yearMonth,
      supply_amount: supplyAmount,
      tax_amount: taxAmount,
      total_amount: supplyAmount + taxAmount,
      invoice_type: 'manual_reverse',
      status: 'pending',
    } as never);

    setSaving(false);

    if (error) {
      window.alert(`수기 역발행 생성 중 오류가 발생했습니다.\n${error.message}`);
      return;
    }

    setFormData({
      driver_id: '',
      supply_amount: '',
      business_reg_number: '',
      representative_name: '',
      business_address: '',
      business_type: '',
      business_category: '',
      email: '',
    });
    setShowForm(false);
    await loadInvoices(agencyId, yearMonth);
  }

  const selectableInvoices = useMemo(() => invoices.filter((invoice) => invoice.status !== 'cancelled'), [invoices]);
  const selectedInvoices = useMemo(() => invoices.filter((invoice) => selectedIds.includes(invoice.id)), [invoices, selectedIds]);
  const allSelected = selectableInvoices.length > 0 && selectableInvoices.every((invoice) => selectedIds.includes(invoice.id));

  const latestSendLogByInvoiceId = useMemo(() => {
    const map = new Map<string, TaxInvoiceSendLog>();
    for (const log of sendLogs) {
      if (!map.has(log.tax_invoice_id)) map.set(log.tax_invoice_id, log);
    }
    return map;
  }, [sendLogs]);

  const recentSendLogs = useMemo(() => sendLogs.slice(0, 10), [sendLogs]);
  const sendLogStats = useMemo(() => {
    const successLogs = sendLogs.filter((log) => log.success);
    const pushSuccessCount = successLogs.filter((log) => log.channel === 'push').length;
    const smsSuccessCount = successLogs.filter((log) => log.channel === 'sms').length;
    const failureCount = sendLogs.filter((log) => !log.success).length;
    const latestSentAt = sendLogs[0]?.created_at ?? null;

    return {
      total: sendLogs.length,
      success: successLogs.length,
      pushSuccessCount,
      smsSuccessCount,
      failureCount,
      latestSentAt,
    };
  }, [sendLogs]);

  const summaryCards = [
    { title: '공급가액 합계', value: formatKRW(summary?.totalSupply ?? 0), color: 'text-primary' },
    { title: '세액 합계', value: formatKRW(summary?.totalTax ?? 0), color: 'text-on-surface-variant' },
    { title: '총 합계', value: formatKRW(summary?.totalAmount ?? 0), color: 'text-tertiary' },
    { title: '발행 진행', value: `${summary?.issuedCount ?? 0} / ${summary?.invoiceCount ?? 0}건`, color: 'text-on-surface' },
  ];
  const sendStatCards = [
    {
      title: '전송 이력',
      value: `${sendLogStats.total}건`,
      description: sendLogStats.latestSentAt ? `최근 ${formatDate(sendLogStats.latestSentAt)}` : '전송 이력이 없습니다.',
      color: 'text-primary',
    },
    {
      title: '전송 성공',
      value: `${sendLogStats.success}건`,
      description: `실패 ${sendLogStats.failureCount}건`,
      color: 'text-tertiary',
    },
    {
      title: '앱 푸시 성공',
      value: `${sendLogStats.pushSuccessCount}건`,
      description: '앱 알림으로 도착',
      color: 'text-on-surface',
    },
    {
      title: '문자 전송 성공',
      value: `${sendLogStats.smsSuccessCount}건`,
      description: '문자 fallback 포함',
      color: 'text-on-surface-variant',
    },
  ];

  const inputCls = 'w-full h-10 px-3 rounded-xl bg-surface-container-low text-on-surface text-sm focus:outline-none focus:ring-2 focus:ring-primary/30';
  const labelCls = 'block text-xs font-label font-medium text-on-surface-variant mb-1.5 font-korean';

  function toggleSelect(id: string) {
    setSelectedIds((prev) => (prev.includes(id) ? prev.filter((value) => value !== id) : [...prev, id]));
  }

  function toggleSelectAll() {
    if (allSelected) {
      setSelectedIds([]);
      return;
    }
    setSelectedIds(selectableInvoices.map((invoice) => invoice.id));
  }

  async function handleBulkIssue() {
    if (!agencyId || selectedInvoices.length === 0) return;

    const pendingIds = selectedInvoices.filter((invoice) => invoice.status === 'pending').map((invoice) => invoice.id);
    if (pendingIds.length === 0) {
      window.alert('선택한 항목 중 발행 대기 상태가 없습니다.');
      return;
    }

    if (!window.confirm(`${pendingIds.length}건을 발행 완료 처리하시겠습니까?`)) return;

    setIssuing(true);
    const supabase = createBrowserSupabaseClient();
    const { error } = await supabase.from('tax_invoices').update({ status: 'issued', issued_at: new Date().toISOString() } as never).in('id', pendingIds);
    setIssuing(false);

    if (error) {
      window.alert(`발행 처리 중 오류가 발생했습니다.\n${error.message}`);
      return;
    }

    await loadInvoices(agencyId, yearMonth);
  }

  async function handleDownloadSelected() {
    if (selectedInvoices.length === 0) return;

    setDownloading(true);
    const XLSX = await import('xlsx');
    const rows = selectedInvoices.map((invoice) => ({
      기사명: invoice.drivers?.name ?? '',
      사업자번호: invoice.drivers?.business_reg_number ?? '',
      발행유형: invoiceTypeLabel(invoice.invoice_type),
      공급가액: invoice.supply_amount,
      세액: invoice.tax_amount,
      합계: invoice.total_amount,
      상태: statusLabel[invoice.status] ?? invoice.status,
      발행일: invoice.issued_at ? new Date(invoice.issued_at).toLocaleDateString('ko-KR') : '',
    }));

    const sheet = XLSX.utils.json_to_sheet(rows);
    sheet['!cols'] = [{ wch: 18 }, { wch: 18 }, { wch: 14 }, { wch: 14 }, { wch: 12 }, { wch: 14 }, { wch: 12 }, { wch: 14 }];
    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, sheet, '세금계산서');
    XLSX.writeFile(workbook, `세금계산서_${yearMonth}.xlsx`);
    setDownloading(false);
  }

  async function handleSendSelected() {
    if (!agencyId || selectedInvoices.length === 0) return;

    const issuedCount = selectedInvoices.filter((invoice) => invoice.status === 'issued').length;
    if (issuedCount === 0) {
      window.alert('발행 완료된 세금계산서를 먼저 선택해 주세요.');
      return;
    }

    if (!window.confirm(`${issuedCount}건을 공급자에게 전송하시겠습니까?`)) return;

    setSending(true);
    setSendResults([]);

    try {
      const response = await fetch('/api/tax-invoices/send', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ invoiceIds: selectedIds }),
      });

      const result = await response.json();
      if (!response.ok) throw new Error(result.error ?? '세금계산서 전송에 실패했습니다.');

      setSendResults(Array.isArray(result.results) ? result.results : []);
      await loadInvoices(agencyId, yearMonth);

      const summaryMessage = [
        '공급자 전송이 완료되었습니다.',
        '',
        `앱 푸시: ${result.pushSent ?? 0}건`,
        `문자 전송: ${result.smsSent ?? 0}건`,
        `실패: ${result.failed ?? 0}건`,
        result.logPersisted === false ? '전송 이력 저장에는 실패했습니다. 관리자에게 문의해 주세요.' : '',
      ].filter(Boolean).join('\n');

      window.alert(summaryMessage);
    } catch (error) {
      const message = error instanceof Error ? error.message : '세금계산서 전송 중 오류가 발생했습니다.';
      window.alert(message);
    } finally {
      setSending(false);
    }
  }

  return (
    <div className="space-y-8">
      <div className="flex items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-headline font-bold text-on-surface font-korean">세금계산서 관리</h1>
          <p className="mt-1 text-sm text-on-surface-variant font-korean">기사별 공급가액과 세액을 확인하고, 발행 완료 처리 후 공급자에게 바로 전송할 수 있습니다.</p>
        </div>
        <div className="flex items-center gap-3">
          <select value={yearMonth} onChange={(event) => setYearMonth(event.target.value)} className="px-4 py-2.5 rounded-xl bg-surface-container-lowest shadow-ambient text-sm font-label text-on-surface font-korean focus:outline-none focus:ring-2 focus:ring-primary/30">
            {yearMonthOptions.map((option) => (
              <option key={option.value} value={option.value}>{option.label}</option>
            ))}
          </select>
          <button onClick={() => setShowForm((prev) => !prev)} className="bg-power-gradient text-white px-5 py-2.5 rounded-xl font-label font-semibold text-sm hover:shadow-lg transition-shadow flex items-center gap-2 font-korean">
            <svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor"><path d="M19 13h-6v6h-2v-6H5v-2h6V5h2v6h6v2z" /></svg>
            수기 역발행 추가
          </button>
        </div>
      </div>

      {sendResults.length > 0 ? (
        <div className="bg-surface-container-lowest rounded-2xl shadow-ambient p-5 space-y-3">
          <div className="flex items-center justify-between">
            <h2 className="text-base font-headline font-semibold text-on-surface font-korean">방금 전송한 결과</h2>
            <span className="text-xs text-on-surface-variant font-korean">성공 {sendResults.filter((item) => item.success).length}건 / 실패 {sendResults.filter((item) => !item.success).length}건</span>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            {sendResults.map((result) => (
              <div key={`${result.invoiceId}-${result.createdAt}`} className="rounded-xl border border-outline-variant/30 bg-surface-container-low p-4">
                <div className="flex items-center justify-between gap-3">
                  <div>
                    <p className="text-sm font-semibold text-on-surface font-korean">{result.driverName}</p>
                    <p className="text-xs text-on-surface-variant font-korean">전송 방식: {sendChannelLabel(result.channel)}</p>
                  </div>
                  <Badge label={result.success ? '전송 성공' : '전송 실패'} variant={result.success ? 'success' : 'error'} />
                </div>
                <p className="mt-2 text-xs text-on-surface-variant font-korean">{formatDate(result.createdAt)}</p>
                {result.reason ? <p className="mt-2 text-xs text-on-surface-variant font-korean">{result.reason}</p> : null}
              </div>
            ))}
          </div>
        </div>
      ) : null}

      {showForm ? (
        <div className="bg-surface-container-lowest rounded-2xl shadow-ambient p-6 space-y-4 border-2 border-primary/20">
          <h2 className="text-base font-headline font-semibold text-on-surface font-korean">수기 역발행 작성</h2>
          <p className="text-xs text-on-surface-variant font-korean">기존 정산과 별도로 공급자를 지정해 수기 역발행 대기 목록에 추가합니다.</p>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            <div>
              <label className={labelCls}>기사 선택 *</label>
              <select value={formData.driver_id} onChange={(event) => handleDriverSelect(event.target.value)} className={`${inputCls} font-korean`}>
                <option value="">기사를 선택해 주세요</option>
                {businessDrivers.map((driver) => <option key={driver.id} value={driver.id}>{driver.name}</option>)}
              </select>
            </div>
            <div>
              <label className={labelCls}>공급가액 *</label>
              <input type="number" value={formData.supply_amount} onChange={(event) => setFormData((prev) => ({ ...prev, supply_amount: event.target.value }))} placeholder="1000000" className={`${inputCls} font-data`} />
              {formData.supply_amount ? <p className="text-[11px] text-on-surface-variant/60 mt-1 font-data">세액: {formatKRW(Math.round(Number(formData.supply_amount) * 0.1))} / 합계: {formatKRW(Math.round(Number(formData.supply_amount) * 1.1))}</p> : null}
            </div>
            <div>
              <label className={labelCls}>사업자등록번호</label>
              <input type="text" value={formData.business_reg_number} onChange={(event) => setFormData((prev) => ({ ...prev, business_reg_number: formatBusinessNumber(event.target.value) }))} placeholder="123-45-67890" maxLength={12} className={`${inputCls} font-data`} />
            </div>
            <div>
              <label className={labelCls}>대표자명</label>
              <input type="text" value={formData.representative_name} onChange={(event) => setFormData((prev) => ({ ...prev, representative_name: event.target.value }))} className={`${inputCls} font-korean`} />
            </div>
            <div>
              <label className={labelCls}>사업장 주소</label>
              <input type="text" value={formData.business_address} onChange={(event) => setFormData((prev) => ({ ...prev, business_address: event.target.value }))} className={`${inputCls} font-korean`} />
            </div>
            <div>
              <label className={labelCls}>업태 / 종목</label>
              <div className="flex gap-2">
                <input type="text" value={formData.business_type} placeholder="업태" onChange={(event) => setFormData((prev) => ({ ...prev, business_type: event.target.value }))} className={`${inputCls} font-korean`} />
                <input type="text" value={formData.business_category} placeholder="종목" onChange={(event) => setFormData((prev) => ({ ...prev, business_category: event.target.value }))} className={`${inputCls} font-korean`} />
              </div>
            </div>
          </div>
          <div className="flex justify-end gap-3">
            <button onClick={() => setShowForm(false)} className="h-10 px-5 rounded-xl bg-surface-container-high text-on-surface-variant font-label text-sm hover:bg-surface-container-highest transition-colors font-korean">취소</button>
            <button onClick={handleManualSubmit} disabled={saving || !formData.driver_id || !formData.supply_amount} className="h-10 px-6 rounded-xl bg-primary text-white font-label font-semibold text-sm hover:bg-primary/90 disabled:opacity-50 font-korean">{saving ? '저장 중...' : '발행 대기 추가'}</button>
          </div>
        </div>
      ) : null}

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {summaryCards.map((card) => (
          <div key={card.title} className="bg-surface-container-lowest rounded-2xl shadow-ambient p-5">
            <p className="text-xs font-label text-on-surface-variant font-korean">{card.title}</p>
            <p className={`mt-2 text-xl font-data font-bold ${card.color}`}>{loading ? '...' : card.value}</p>
          </div>
        ))}
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-4">
        {sendStatCards.map((card) => (
          <div key={card.title} className="bg-surface-container-lowest rounded-2xl shadow-ambient p-5">
            <p className="text-xs font-label text-on-surface-variant font-korean">{card.title}</p>
            <p className={`mt-2 text-xl font-data font-bold ${card.color}`}>{card.value}</p>
            <p className="mt-1 text-xs text-on-surface-variant font-korean">{card.description}</p>
          </div>
        ))}
      </div>

      <div className="bg-surface-container-lowest rounded-2xl shadow-ambient overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left">
            <thead>
              <tr className="bg-surface-container-low">
                <th className="px-5 py-3 text-xs font-label font-semibold text-on-surface-variant font-korean w-12"><input type="checkbox" checked={allSelected} onChange={toggleSelectAll} aria-label="전체 선택" /></th>
                <th className="px-5 py-3 text-xs font-label font-semibold text-on-surface-variant font-korean">기사명</th>
                <th className="px-5 py-3 text-xs font-label font-semibold text-on-surface-variant font-korean">사업자번호</th>
                <th className="px-5 py-3 text-xs font-label font-semibold text-on-surface-variant font-korean text-right">공급가액</th>
                <th className="px-5 py-3 text-xs font-label font-semibold text-on-surface-variant font-korean text-right">세액</th>
                <th className="px-5 py-3 text-xs font-label font-semibold text-on-surface-variant font-korean text-right">합계</th>
                <th className="px-5 py-3 text-xs font-label font-semibold text-on-surface-variant font-korean">유형</th>
                <th className="px-5 py-3 text-xs font-label font-semibold text-on-surface-variant font-korean">상태</th>
                <th className="px-5 py-3 text-xs font-label font-semibold text-on-surface-variant font-korean">최근 전송</th>
                <th className="px-5 py-3 text-xs font-label font-semibold text-on-surface-variant font-korean">발행일</th>
                <th className="px-5 py-3 text-xs font-label font-semibold text-on-surface-variant font-korean">출력</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-outline-variant/30">
              {loading ? (
                <tr><td colSpan={11} className="px-6 py-8 text-center text-sm text-on-surface-variant font-korean">데이터를 불러오는 중입니다...</td></tr>
              ) : invoices.length === 0 ? (
                <tr><td colSpan={11} className="px-6 py-8 text-center text-sm text-on-surface-variant font-korean">해당 월의 세금계산서 데이터가 없습니다.</td></tr>
              ) : (
                invoices.map((invoice) => {
                  const latestLog = latestSendLogByInvoiceId.get(invoice.id);
                  return (
                    <tr key={invoice.id} className="hover:bg-surface-container-low/50 transition-colors">
                      <td className="px-5 py-4"><input type="checkbox" checked={selectedIds.includes(invoice.id)} disabled={invoice.status === 'cancelled'} onChange={() => toggleSelect(invoice.id)} aria-label={`${invoice.drivers?.name ?? '기사'} 선택`} /></td>
                      <td className="px-5 py-4 text-sm font-body text-on-surface font-korean"><div>{invoice.drivers?.name ?? '이름 없음'}</div>{invoice.drivers?.representative_name ? <div className="text-xs text-on-surface-variant">대표자 {invoice.drivers.representative_name}</div> : null}</td>
                      <td className="px-5 py-4 text-sm font-data text-on-surface-variant">{invoice.drivers?.business_reg_number ?? '-'}</td>
                      <td className="px-5 py-4 text-sm font-data text-on-surface text-right">{formatKRW(invoice.supply_amount)}</td>
                      <td className="px-5 py-4 text-sm font-data text-on-surface-variant text-right">{formatKRW(invoice.tax_amount)}</td>
                      <td className="px-5 py-4 text-sm font-data font-semibold text-on-surface text-right">{formatKRW(invoice.total_amount)}</td>
                      <td className="px-5 py-4 text-sm text-on-surface font-korean">{invoiceTypeLabel(invoice.invoice_type)}</td>
                      <td className="px-5 py-4"><Badge label={statusLabel[invoice.status] ?? invoice.status} variant={statusVariant[invoice.status] ?? 'default'} /></td>
                      <td className="px-5 py-4 text-sm text-on-surface-variant font-korean">{latestLog ? <div className="space-y-1"><div className={latestLog.success ? 'text-primary' : 'text-red-500'}>{sendChannelLabel(latestLog.channel)} · {latestLog.success ? '성공' : '실패'}</div><div className="text-xs">{formatDate(latestLog.created_at)}</div></div> : '-'}</td>
                      <td className="px-5 py-4 text-sm font-data text-on-surface-variant">{invoice.issued_at ? new Date(invoice.issued_at).toLocaleDateString('ko-KR') : '-'}</td>
                      <td className="px-5 py-4"><a href={`/portal/tax-invoices/${invoice.id}/print`} target="_blank" rel="noopener noreferrer" className="text-xs text-primary hover:underline font-korean">출력 보기</a></td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>

      {recentSendLogs.length > 0 ? (
        <div className="bg-surface-container-lowest rounded-2xl shadow-ambient p-6 space-y-4">
          <div className="flex items-center justify-between gap-3">
            <div>
              <h2 className="text-base font-headline font-semibold text-on-surface font-korean">최근 공급자 전송 이력</h2>
              <p className="mt-1 text-xs text-on-surface-variant font-korean">누가 어떤 채널로 전송되었는지 다시 확인할 수 있습니다.</p>
            </div>
            <Badge label={`${recentSendLogs.length}건 표시`} variant="default" />
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            {recentSendLogs.map((log) => (
              <div key={log.id} className="rounded-xl border border-outline-variant/30 bg-surface-container-low p-4">
                <div className="flex items-center justify-between gap-3">
                  <div>
                    <p className="text-sm font-semibold text-on-surface font-korean">{log.drivers?.name ?? '기사 정보 없음'}</p>
                    <p className="text-xs text-on-surface-variant font-korean">전송 방식: {sendChannelLabel(log.channel)}</p>
                  </div>
                  <Badge label={log.success ? '전송 성공' : '전송 실패'} variant={log.success ? 'success' : 'error'} />
                </div>
                <p className="mt-2 text-xs text-on-surface-variant font-korean">{formatDate(log.created_at)}</p>
                {log.reason ? <p className="mt-2 text-xs text-on-surface-variant font-korean">{log.reason}</p> : null}
              </div>
            ))}
          </div>
        </div>
      ) : null}

      {invoices.length > 0 ? (
        <div className="bg-surface-container-lowest rounded-2xl shadow-ambient px-6 py-4 flex items-center justify-between gap-4">
          <p className="text-sm text-on-surface-variant font-korean">총 <span className="font-data font-semibold text-on-surface">{invoices.length}</span>건 / 선택 <span className="font-data font-semibold text-on-surface">{selectedIds.length}</span>건</p>
          <div className="flex items-center gap-3">
            <button onClick={handleSendSelected} disabled={selectedIds.length === 0 || sending} className="px-5 py-2.5 rounded-xl border border-primary/20 text-primary font-label font-semibold text-sm hover:bg-primary/5 disabled:opacity-50 font-korean">{sending ? '공급자 전송 중...' : '선택 공급자 전송'}</button>
            <button onClick={handleDownloadSelected} disabled={selectedIds.length === 0 || downloading} className="px-5 py-2.5 rounded-xl border border-outline-variant/30 text-on-surface font-label font-semibold text-sm hover:bg-surface-container-low disabled:opacity-50 font-korean">{downloading ? '다운로드 중...' : '선택 내역 다운로드'}</button>
            <button onClick={handleBulkIssue} disabled={selectedIds.length === 0 || issuing} className="bg-power-gradient text-white px-6 py-2.5 rounded-xl font-label font-semibold text-sm hover:shadow-lg transition-shadow disabled:opacity-50 font-korean">{issuing ? '발행 처리 중...' : '선택 발행 완료'}</button>
          </div>
        </div>
      ) : null}
    </div>
  );
}
