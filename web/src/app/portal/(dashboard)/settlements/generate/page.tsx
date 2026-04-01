'use client';

import React, { useEffect, useState, useMemo, useRef } from 'react';
import Badge from '@/components/shared/Badge';
import { toastSuccess, toastWarning } from '@/components/shared/Toast';
import { createBrowserSupabaseClient } from '@/lib/supabase';
import { getPrincipals, type Principal, type ItemType, ITEM_LABELS, normalizeFieldConfig, buildExcelHeaders, type SettlementDisplayConfig, DEFAULT_SETTLEMENT_DISPLAY } from '@/services/principal.service';
import {
  getSettlements,
  getSettlementSummary,
  sendSettlements,
  confirmSettlements,
  generateTaxInvoicesFromSettlements,
  type SettlementWithDriver,
  type SettlementSummary,
} from '@/services/settlement.service';

const statusLabel: Record<string, string> = {
  draft: '작성중',
  confirmed: '정산완료',
  sent: '발송완료',
  pending: '대기',
};

const statusVariant: Record<string, 'success' | 'warning' | 'error' | 'default'> = {
  confirmed: 'success',
  sent: 'success',
  pending: 'warning',
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

export default function SettlementsGeneratePage() {
  const [settlements, setSettlements] = useState<SettlementWithDriver[]>([]);
  const [summary, setSummary] = useState<SettlementSummary | null>(null);
  const [principals, setPrincipals] = useState<Principal[]>([]);
  const [loading, setLoading] = useState(true);
  const [agencyId, setAgencyId] = useState<string | null>(null);
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [selectedPrincipal, setSelectedPrincipal] = useState<string>('all');
  const [actionLoading, setActionLoading] = useState(false);
  const [toast, setToast] = useState('');

  const now = new Date();
  const defaultYM = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
  const [yearMonth, setYearMonth] = useState(defaultYM);
  const ymOptions = getYearMonthOptions();

  useEffect(() => {
    async function init() {
      const supabase = createBrowserSupabaseClient();
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;
      const aid = user.app_metadata?.agency_id as string | undefined;
      if (!aid) return;
      setAgencyId(aid);
      const result = await getPrincipals(aid);
      if (result.data) setPrincipals(result.data);
    }
    init();
  }, []);

  useEffect(() => {
    if (!agencyId) return;
    async function load() {
      setLoading(true);
      const pid = selectedPrincipal === 'all' ? undefined : selectedPrincipal;
      const [settlementsResult, summaryResult] = await Promise.all([
        getSettlements(agencyId!, yearMonth, pid),
        getSettlementSummary(agencyId!, yearMonth, pid),
      ]);
      if (settlementsResult.data) setSettlements(settlementsResult.data);
      if (summaryResult.data) setSummary(summaryResult.data);
      setLoading(false);
    }
    load();
  }, [agencyId, yearMonth, selectedPrincipal]);

  /* ── Get display config from selected principal's field_config ── */
  const displayConfig: SettlementDisplayConfig = useMemo(() => {
    if (selectedPrincipal === 'all') return DEFAULT_SETTLEMENT_DISPLAY;
    const p = principals.find((pr) => pr.id === selectedPrincipal);
    if (!p) return DEFAULT_SETTLEMENT_DISPLAY;
    const fc = normalizeFieldConfig(p.field_config);
    return fc.settlement_display ?? DEFAULT_SETTLEMENT_DISPLAY;
  }, [selectedPrincipal, principals]);

  const viewMode = useMemo(() => {
    if (selectedPrincipal === 'all') return 'detail' as const;
    const p = principals.find((pr) => pr.id === selectedPrincipal);
    if (!p) return 'detail' as const;
    const fc = normalizeFieldConfig(p.field_config);
    return fc.settlement_view_mode ?? 'detail';
  }, [selectedPrincipal, principals]);

  /* ── Detect which columns have data AND are enabled by display config ── */
  const columnFlags = useMemo(() => {
    const hasReturn = (displayConfig.return_count || displayConfig.return_amount) &&
      settlements.some((s) => (s.return_count ?? 0) > 0 || (s.return_amount ?? 0) > 0);
    const hasPickup = (displayConfig.pickup_count || displayConfig.pickup_amount) &&
      settlements.some((s) => (s.pickup_count ?? 0) > 0 || (s.pickup_amount ?? 0) > 0);
    const hasFresh = displayConfig.fresh_back &&
      settlements.some((s) => (s.fresh_incentive ?? 0) > 0);
    const hasExtra = displayConfig.incentive_amount &&
      settlements.some((s) => (s.extra_incentive ?? 0) > 0);
    const hasVat = settlements.some((s) => (s.vat_amount ?? 0) > 0);
    const hasWithholding = settlements.some((s) => {
      const dd = s.deduction_detail as Record<string, number> | null;
      return dd && (dd['원천징수 (3.3%)'] ?? 0) > 0;
    });
    const hasDeduction = displayConfig.deduction_detail &&
      settlements.some((s) => (s.total_deduction ?? 0) > 0);
    const hasRouteDetail = settlements.some((s) => (s.route_details ?? []).length > 0);
    const hasPercentage = settlements.some((s) => s.rate_mode === 'percentage');
    const hasGross = settlements.some((s) => (s.gross_total ?? 0) > 0);
    // 간편 모드: 배송건/금액 + 지급액만 표시
    const isSimple = viewMode === 'simple';
    return {
      hasReturn: isSimple ? false : hasReturn,
      hasPickup: isSimple ? false : hasPickup,
      hasFresh: isSimple ? false : hasFresh,
      hasExtra: isSimple ? false : hasExtra,
      hasVat: isSimple ? false : hasVat,
      hasWithholding: isSimple ? false : hasWithholding,
      hasDeduction: isSimple ? false : hasDeduction,
      hasRouteDetail: isSimple ? false : hasRouteDetail,
      hasPercentage: isSimple ? false : hasPercentage,
      hasGross: isSimple ? false : hasGross,
    };
  }, [settlements, displayConfig, viewMode]);

  /* ── Dynamic column count for colSpan ── */
  const colCount = 5 /* 기본: 확장, 기사, 사번, 배송건, 배송금액 */
    + (columnFlags.hasReturn ? 2 : 0)
    + (columnFlags.hasPickup ? 2 : 0)
    + (columnFlags.hasGross ? 1 : 0)
    + (columnFlags.hasPercentage ? 1 : 0)
    + (columnFlags.hasFresh ? 1 : 0)
    + (columnFlags.hasExtra ? 1 : 0)
    + (columnFlags.hasDeduction ? 1 : 0)
    + (columnFlags.hasVat ? 1 : 0)
    + (columnFlags.hasWithholding ? 1 : 0)
    + 2; /* 실수령액, 상태 */

  const summaryCards = [
    { title: '총 정산액', value: formatKRW(summary?.totalAmount ?? 0), color: 'text-primary' },
    { title: '총 공제액', value: formatKRW(summary?.totalDeduction ?? 0), color: 'text-error' },
    ...(summary?.totalVat ? [{ title: '부가세 합계', value: formatKRW(summary.totalVat), color: 'text-on-surface-variant' }] : []),
    { title: '순 지급액', value: formatKRW(summary?.netAmount ?? 0), color: 'text-tertiary' },
    { title: '대상 기사', value: `${summary?.driverCount ?? 0}명`, color: 'text-on-surface' },
  ];

  function showToast(msg: string) {
    setToast(msg);
    setTimeout(() => setToast(''), 3000);
  }

  async function reloadData() {
    const pid = selectedPrincipal === 'all' ? undefined : selectedPrincipal;
    const [sr, smr] = await Promise.all([
      getSettlements(agencyId!, yearMonth, pid),
      getSettlementSummary(agencyId!, yearMonth, pid),
    ]);
    if (sr.data) setSettlements(sr.data);
    if (smr.data) setSummary(smr.data);
  }

  /* ── Send settlements (draft → sent) ── */
  async function handleSendAll() {
    const draftIds = settlements.filter((s) => s.status === 'draft').map((s) => s.id);
    if (draftIds.length === 0) { showToast('발송할 정산서가 없습니다'); return; }
    if (!confirm(`${draftIds.length}건의 정산서를 발송하시겠습니까?`)) return;
    setActionLoading(true);
    const result = await sendSettlements(draftIds);
    if (result.error) showToast(`오류: ${result.error}`);
    else showToast(`${draftIds.length}건 발송 완료`);
    await reloadData();
    setActionLoading(false);
  }

  /* ── Confirm settlements (sent → confirmed) → auto-generate tax invoices ── */
  async function handleConfirmAll() {
    const sentIds = settlements.filter((s) => s.status === 'sent').map((s) => s.id);
    if (sentIds.length === 0) { showToast('확정할 정산서가 없습니다'); return; }
    if (!confirm(`${sentIds.length}건의 정산서를 확정하고 세금계산서를 생성하시겠습니까?`)) return;
    setActionLoading(true);
    const confirmResult = await confirmSettlements(sentIds);
    if (confirmResult.error) {
      showToast(`확정 오류: ${confirmResult.error}`);
      setActionLoading(false);
      return;
    }
    // Auto-generate tax invoices
    const taxResult = await generateTaxInvoicesFromSettlements(agencyId!, sentIds, yearMonth);
    if (taxResult.error) showToast(`세금계산서 생성 오류: ${taxResult.error}`);
    else showToast(`${sentIds.length}건 확정, 세금계산서 ${taxResult.created}건 생성`);
    await reloadData();
    setActionLoading(false);
  }

  const fileRef = useRef<HTMLInputElement>(null);

  /* ── Excel Template Download (auto_filter: 기사별 단가 자동 입력) ── */
  async function handleDownloadTemplate() {
    const principal = principals.find((p) => p.id === selectedPrincipal);
    if (!principal) {
      toastWarning('카테고리를 선택한 후 다운로드하세요');
      return;
    }
    const fc = normalizeFieldConfig(principal.field_config);
    const headers = buildExcelHeaders(fc);
    const rows: (string | number)[][] = [headers];

    // auto_filter 모드: 기사별 데이터 행 자동 생성
    if (fc.excel_mode === 'auto_filter') {
      const supabase = createBrowserSupabaseClient();
      const { data: drivers } = await supabase
        .from('drivers')
        .select('id, name, employee_code, custom_values')
        .eq('agency_id', agencyId!)
        .eq('status', 'active');

      const { data: driverRates } = await supabase
        .from('driver_rates')
        .select('driver_id, package_type, unit_price, rate_type')
        .in('driver_id', (drivers ?? []).map((d: { id: string }) => d.id))
        .eq('is_active', true);

      const rateMap = new Map<string, Map<string, { unit_price: number; rate_type: string }>>();
      for (const r of (driverRates ?? []) as { driver_id: string; package_type: string; unit_price: number; rate_type: string }[]) {
        if (!rateMap.has(r.driver_id)) rateMap.set(r.driver_id, new Map());
        rateMap.get(r.driver_id)!.set(r.package_type, { unit_price: r.unit_price, rate_type: r.rate_type });
      }

      const itemTypes: ('delivery' | 'return' | 'pickup')[] = ['delivery', 'return', 'pickup'];

      for (const d of (drivers ?? []) as { id: string; name: string; employee_code: string | null; custom_values: Record<string, unknown> | null }[]) {
        const row: (string | number)[] = [d.name, d.employee_code ?? ''];
        const rates = rateMap.get(d.id) ?? new Map();

        // 기본 항목 (배송/반품/집하)
        for (const t of itemTypes) {
          const cfg = fc.items[t];
          if (!cfg?.enabled) continue;
          if (cfg.rate_mode === 'unit_price') {
            row.push(0); // 수량 (빈칸)
          } else {
            row.push(0, 0, 0); // 수량, 금액, 수수료%
          }
        }
        // 커스텀 수입 항목
        for (const item of fc.custom_income_items ?? []) {
          const rate = rates.get(item.name);
          if (item.calc_method === 'fixed') {
            row.push(rate?.unit_price ?? item.default_value ?? 0);
          } else {
            row.push(0, rate?.unit_price ?? item.default_value ?? 0);
          }
        }
        // 커스텀 차감 항목
        for (const item of fc.custom_deduction_items ?? []) {
          if (item.calc_method === 'fixed') {
            row.push(item.default_value ?? 0);
          } else if (item.calc_method === 'per_count') {
            row.push(0); // 수량
          } else {
            row.push(item.default_value ?? 0);
          }
        }
        rows.push(row);
      }
    }

    const XLSX = await import('xlsx');
    const ws = XLSX.utils.aoa_to_sheet(rows);
    ws['!cols'] = headers.map(() => ({ wch: 15 }));
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, '정산');
    XLSX.writeFile(wb, `${principal.name}_정산양식_${yearMonth}.xlsx`);
  }

  /* ── Excel Upload & Parse ── */
  async function handleExcelUpload(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    const principal = principals.find((p) => p.id === selectedPrincipal);
    if (!principal) {
      toastWarning('카테고리를 선택한 후 업로드하세요');
      return;
    }
    const fc = normalizeFieldConfig(principal.field_config);

    const data = await file.arrayBuffer();
    const XLSX = await import('xlsx');
    const wb = XLSX.read(data);
    const ws = wb.Sheets[wb.SheetNames[0]];
    const rows: Record<string, unknown>[] = XLSX.utils.sheet_to_json(ws);

    if (rows.length === 0) {
      toastWarning('엑셀 파일에 데이터가 없습니다');
      return;
    }

    const supabase = createBrowserSupabaseClient();

    // Get all drivers with custom_values (for unit prices)
    const { data: drivers } = await supabase
      .from('drivers')
      .select('id, name, employee_code, custom_values')
      .eq('agency_id', agencyId!);
    const driverList = (drivers ?? []) as { id: string; name: string; employee_code: string | null; custom_values: Record<string, unknown> | null }[];

    let created = 0;
    let skipped = 0;
    const itemTypes: ItemType[] = ['delivery', 'return', 'pickup'];

    for (const row of rows) {
      const nameVal = String(row['기사명'] ?? '').trim();
      const codeVal = String(row['사번'] ?? '').trim();
      const driver = driverList.find((d) =>
        (codeVal && d.employee_code === codeVal) || d.name === nameVal
      );
      if (!driver) { skipped++; continue; }

      let deliveryCount = 0, deliveryAmount = 0;
      let returnCount = 0, returnAmount = 0;
      let pickupCount = 0, pickupAmount = 0;
      const cv = (driver.custom_values ?? {}) as Record<string, unknown>;

      for (const t of itemTypes) {
        const cfg = fc.items[t];
        if (!cfg?.enabled) continue;
        const label = ITEM_LABELS[t];

        const qty = Number(row[`${label}_수량`] ?? 0);
        let amount = 0;

        if (cfg.rate_mode === 'unit_price') {
          const unitPrice = Number(cv[`${t}_unit_price`] ?? 0);
          amount = qty * unitPrice;
        } else {
          amount = Number(row[`${label}_금액`] ?? 0);
          const pct = Number(row[`${label}_수수료%`] ?? 0);
          if (pct > 0) amount = amount * (pct / 100);
        }

        if (t === 'delivery') { deliveryCount = qty; deliveryAmount = amount; }
        if (t === 'return') { returnCount = qty; returnAmount = amount; }
        if (t === 'pickup') { pickupCount = qty; pickupAmount = amount; }
      }

      // 커스텀 수입 항목 계산
      let customIncomeTotal = 0;
      const customIncomeDetails: Record<string, number> = {};
      for (const item of fc.custom_income_items ?? []) {
        let amount = 0;
        if (item.calc_method === 'fixed') {
          amount = Number(row[`${item.name}_금액`] ?? 0) || Number(cv[`income_${item.id}`] ?? item.default_value ?? 0);
        } else {
          const baseAmt = Number(row[`${item.name}_금액`] ?? 0);
          const pct = Number(row[`${item.name}_수수료%`] ?? 0) || Number(cv[`income_${item.id}`] ?? item.default_value ?? 0);
          amount = baseAmt > 0 ? Math.round(baseAmt * (pct / 100)) : Math.round(pct);
        }
        customIncomeTotal += amount;
        if (amount > 0) customIncomeDetails[`수입_${item.name}`] = amount;
      }

      // 커스텀 차감 항목 계산
      let customDeductionTotal = 0;
      const deductionDetail: Record<string, number> = {};
      for (const item of fc.custom_deduction_items ?? []) {
        let amount = 0;
        if (item.calc_method === 'fixed') {
          amount = Number(row[`[차감]${item.name}`] ?? 0) || item.default_value;
        } else if (item.calc_method === 'per_count') {
          const countMap: Record<string, number> = {
            delivery_count: deliveryCount,
            return_count: returnCount,
            pickup_count: pickupCount,
          };
          const qty = Number(row[`[차감]${item.name}_수량`] ?? 0) || countMap[item.count_field ?? ''] || 0;
          amount = qty * item.default_value;
        } else {
          // rate_percent
          const pct = Number(row[`[차감]${item.name}_%`] ?? 0) || item.default_value;
          const baseForPct = deliveryAmount + returnAmount + pickupAmount + customIncomeTotal;
          amount = Math.round(baseForPct * (pct / 100));
        }
        customDeductionTotal += amount;
        if (amount > 0) deductionDetail[`차감_${item.name}`] = amount;
      }

      const totalAmount = deliveryAmount + returnAmount + pickupAmount + customIncomeTotal;
      const totalDeduction = customDeductionTotal;
      const netAmount = totalAmount - totalDeduction;

      const settlementData = {
        agency_id: agencyId!,
        driver_id: driver.id,
        principal_id: principal.id,
        year_month: yearMonth,
        delivery_count: deliveryCount,
        delivery_amount: deliveryAmount,
        return_count: returnCount,
        return_amount: returnAmount,
        pickup_count: pickupCount,
        pickup_amount: pickupAmount,
        base_amount: totalAmount,
        total_amount: totalAmount,
        total_deduction: totalDeduction,
        deduction_detail: Object.keys(deductionDetail).length > 0 ? deductionDetail : null,
        net_amount: netAmount,
        status: 'draft',
      };

      const { error } = await supabase
        .from('settlements')
        .upsert(settlementData as never, { onConflict: 'agency_id,driver_id,principal_id,year_month' });
      if (!error) created++;
      else skipped++;
    }

    toastSuccess(`업로드 완료: ${created}건 생성, ${skipped}건 건너뜀`);
    if (fileRef.current) fileRef.current.value = '';
    const pid = selectedPrincipal === 'all' ? undefined : selectedPrincipal;
    const [settlementsResult, summaryResult] = await Promise.all([
      getSettlements(agencyId!, yearMonth, pid),
      getSettlementSummary(agencyId!, yearMonth, pid),
    ]);
    if (settlementsResult.data) setSettlements(settlementsResult.data);
    if (summaryResult.data) setSummary(summaryResult.data);
  }

  const thCls = 'px-4 py-3 text-xs font-label font-semibold text-on-surface-variant uppercase tracking-wider font-korean';

  return (
    <div className="space-y-6">
      {/* Page Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-headline font-bold text-on-surface font-korean">정산서 생성</h1>
          <p className="mt-1 text-sm text-on-surface-variant font-korean">월별 기사 정산서를 생성하고 발행하세요</p>
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
          {selectedPrincipal !== 'all' && (
            <>
              <button
                onClick={handleDownloadTemplate}
                className="h-10 px-4 rounded-xl bg-surface-container-lowest shadow-ambient text-sm font-label text-on-surface-variant hover:bg-surface-container-low transition-colors font-korean flex items-center gap-1.5"
              >
                <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor"><path d="M19 9h-4V3H9v6H5l7 7 7-7zM5 18v2h14v-2H5z"/></svg>
                양식 다운
              </button>
              <label className="h-10 px-4 rounded-xl bg-tertiary/10 text-tertiary text-sm font-label font-semibold hover:bg-tertiary/20 transition-colors cursor-pointer flex items-center gap-1.5 font-korean">
                <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor"><path d="M9 16h6v-6h4l-7-7-7 7h4zm-4 2h14v2H5z"/></svg>
                엑셀 업로드
                <input ref={fileRef} type="file" accept=".xlsx,.xls" className="hidden" onChange={handleExcelUpload} />
              </label>
            </>
          )}
        </div>
      </div>

      {/* Category Tabs */}
      <div className="flex items-center gap-2 overflow-x-auto pb-1">
        <button
          onClick={() => setSelectedPrincipal('all')}
          className={`shrink-0 px-4 py-2 rounded-xl text-sm font-label font-semibold transition-all ${
            selectedPrincipal === 'all'
              ? 'bg-primary text-white shadow-md'
              : 'bg-surface-container-lowest text-on-surface-variant hover:bg-surface-container-low shadow-ambient'
          } font-korean`}
        >
          전체
        </button>
        {principals.map((p) => (
          <button
            key={p.id}
            onClick={() => setSelectedPrincipal(p.id)}
            className={`shrink-0 px-4 py-2 rounded-xl text-sm font-label font-semibold transition-all ${
              selectedPrincipal === p.id
                ? 'bg-primary text-white shadow-md'
                : 'bg-surface-container-lowest text-on-surface-variant hover:bg-surface-container-low shadow-ambient'
            } font-korean`}
          >
            {p.name}
          </button>
        ))}
      </div>

      {/* Summary Cards */}
      <div className={`grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-${summaryCards.length} gap-4`}>
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
                <th className={`${thCls} w-8`}></th>
                <th className={thCls}>기사명</th>
                <th className={thCls}>사번</th>
                <th className={`${thCls} text-right`}>배송건</th>
                <th className={`${thCls} text-right`}>배송금액</th>
                {columnFlags.hasReturn && <th className={`${thCls} text-right`}>반품건</th>}
                {columnFlags.hasReturn && <th className={`${thCls} text-right`}>반품금액</th>}
                {columnFlags.hasPickup && <th className={`${thCls} text-right`}>집하건</th>}
                {columnFlags.hasPickup && <th className={`${thCls} text-right`}>집하금액</th>}
                {columnFlags.hasGross && <th className={`${thCls} text-right`}>총매출</th>}
                {columnFlags.hasPercentage && <th className={`${thCls} text-right`}>요율</th>}
                {columnFlags.hasFresh && <th className={`${thCls} text-right`}>프레쉬백</th>}
                {columnFlags.hasExtra && <th className={`${thCls} text-right`}>인센티브</th>}
                {columnFlags.hasDeduction && <th className={`${thCls} text-right`}>공제액</th>}
                {columnFlags.hasVat && <th className={`${thCls} text-right`}>부가세</th>}
                {columnFlags.hasWithholding && <th className={`${thCls} text-right`}>원천징수</th>}
                <th className={`${thCls} text-right`}>실수령액</th>
                <th className={thCls}>상태</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-outline-variant/30">
              {loading ? (
                <tr>
                  <td colSpan={colCount} className="px-6 py-8 text-center text-sm text-on-surface-variant font-korean">
                    데이터를 불러오는 중...
                  </td>
                </tr>
              ) : settlements.length === 0 ? (
                <tr>
                  <td colSpan={colCount} className="px-6 py-8 text-center text-sm text-on-surface-variant font-korean">
                    해당 월 정산 데이터가 없습니다
                  </td>
                </tr>
              ) : (
                settlements.map((row) => {
                  const isExpanded = expandedId === row.id;
                  const routeDetails = row.route_details ?? [];
                  const deductionDetail = row.deduction_detail ?? {};
                  const deductionEntries = Object.entries(deductionDetail);

                  return (
                    <React.Fragment key={row.id}>
                      <tr
                        className="hover:bg-surface-container-low/50 transition-colors cursor-pointer"
                        onClick={() => setExpandedId(isExpanded ? null : row.id)}
                      >
                        <td className="px-4 py-4 text-on-surface-variant">
                          <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor"
                            className={`transition-transform ${isExpanded ? 'rotate-180' : ''}`}>
                            <path d="M7.41 8.59L12 13.17l4.59-4.58L18 10l-6 6-6-6 1.41-1.41z" />
                          </svg>
                        </td>
                        <td className="px-4 py-4 text-sm font-body text-on-surface font-korean">
                          <div>{row.drivers?.name ?? '이름 없음'}</div>
                          {selectedPrincipal === 'all' && row.principals?.name && (
                            <span className="text-[10px] text-on-surface-variant">{row.principals.name}</span>
                          )}
                          {row.is_business_owner && (
                            <span className="ml-1 text-[10px] px-1.5 py-0.5 rounded bg-primary/10 text-primary font-label">사업자</span>
                          )}
                        </td>
                        <td className="px-4 py-4 text-xs font-data text-on-surface-variant">
                          {row.drivers?.employee_code ?? '-'}
                        </td>
                        <td className="px-4 py-4 text-sm font-data text-on-surface text-right">
                          {row.delivery_count}건
                        </td>
                        <td className="px-4 py-4 text-sm font-data text-on-surface text-right">
                          {formatKRW(row.delivery_amount ?? row.base_amount)}
                        </td>
                        {columnFlags.hasReturn && (
                          <td className="px-4 py-4 text-sm font-data text-on-surface text-right">
                            {(row.return_count ?? 0) > 0 ? `${row.return_count}건` : '-'}
                          </td>
                        )}
                        {columnFlags.hasReturn && (
                          <td className="px-4 py-4 text-sm font-data text-on-surface text-right">
                            {(row.return_amount ?? 0) > 0 ? formatKRW(row.return_amount) : '-'}
                          </td>
                        )}
                        {columnFlags.hasPickup && (
                          <td className="px-4 py-4 text-sm font-data text-on-surface text-right">
                            {(row.pickup_count ?? 0) > 0 ? `${row.pickup_count}건` : '-'}
                          </td>
                        )}
                        {columnFlags.hasPickup && (
                          <td className="px-4 py-4 text-sm font-data text-on-surface text-right">
                            {(row.pickup_amount ?? 0) > 0 ? formatKRW(row.pickup_amount) : '-'}
                          </td>
                        )}
                        {columnFlags.hasGross && (
                          <td className="px-4 py-4 text-sm font-data text-on-surface text-right">
                            {(row.gross_total ?? 0) > 0 ? formatKRW(row.gross_total) : '-'}
                          </td>
                        )}
                        {columnFlags.hasPercentage && (
                          <td className="px-4 py-4 text-sm font-data text-on-surface-variant text-right">
                            {row.rate_mode === 'percentage' ? `${row.rate_percentage}%` : '-'}
                          </td>
                        )}
                        {columnFlags.hasFresh && (
                          <td className="px-4 py-4 text-sm font-data text-on-surface text-right">
                            {(row.fresh_incentive ?? 0) > 0 ? formatKRW(row.fresh_incentive) : '-'}
                          </td>
                        )}
                        {columnFlags.hasExtra && (
                          <td className="px-4 py-4 text-sm font-data text-on-surface text-right">
                            {(row.extra_incentive ?? 0) > 0 ? formatKRW(row.extra_incentive) : '-'}
                          </td>
                        )}
                        {columnFlags.hasDeduction && (
                          <td className="px-4 py-4 text-sm font-data text-error text-right">
                            {row.total_deduction > 0 ? `-${formatKRW(row.total_deduction)}` : '-'}
                          </td>
                        )}
                        {columnFlags.hasVat && (
                          <td className="px-4 py-4 text-sm font-data text-error text-right">
                            {(row.vat_amount ?? 0) > 0 ? `-${formatKRW(row.vat_amount)}` : '-'}
                          </td>
                        )}
                        {columnFlags.hasWithholding && (
                          <td className="px-4 py-4 text-sm font-data text-error text-right">
                            {(() => {
                              const dd = row.deduction_detail as Record<string, number> | null;
                              const wh = dd?.['원천징수 (3.3%)'] ?? 0;
                              return wh > 0 ? `-${formatKRW(wh)}` : '-';
                            })()}
                          </td>
                        )}
                        <td className="px-4 py-4 text-sm font-data font-semibold text-on-surface text-right">
                          {formatKRW(row.net_amount)}
                        </td>
                        <td className="px-4 py-4">
                          <Badge
                            label={statusLabel[row.status] ?? row.status}
                            variant={statusVariant[row.status] ?? 'default'}
                          />
                        </td>
                      </tr>

                      {/* Expanded detail row */}
                      {isExpanded && (
                        <tr key={`${row.id}-detail`}>
                          <td colSpan={colCount} className="px-6 py-4 bg-surface-container-low/30">
                            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                              {/* Route breakdown */}
                              {routeDetails.length > 0 && (
                                <div>
                                  <p className="text-xs font-label font-semibold text-on-surface-variant mb-2 font-korean">라우트별 상세</p>
                                  <table className="w-full text-xs">
                                    <thead>
                                      <tr className="border-b border-outline-variant/20">
                                        <th className="py-1.5 text-left font-label text-on-surface-variant font-korean">라우트</th>
                                        <th className="py-1.5 text-right font-label text-on-surface-variant font-korean">배송</th>
                                        <th className="py-1.5 text-right font-label text-on-surface-variant font-korean">반품</th>
                                        <th className="py-1.5 text-right font-label text-on-surface-variant font-korean">단가</th>
                                        <th className="py-1.5 text-right font-label text-on-surface-variant font-korean">소계</th>
                                      </tr>
                                    </thead>
                                    <tbody>
                                      {routeDetails.map((rd, i) => (
                                        <tr key={i} className="border-b border-outline-variant/10">
                                          <td className="py-1.5 font-data font-semibold text-on-surface">{rd.route_code}</td>
                                          <td className="py-1.5 font-data text-on-surface text-right">{rd.delivery_count}건</td>
                                          <td className="py-1.5 font-data text-on-surface text-right">{rd.return_count}건</td>
                                          <td className="py-1.5 font-data text-on-surface-variant text-right">₩{rd.delivery_rate?.toLocaleString()}</td>
                                          <td className="py-1.5 font-data text-on-surface text-right">{formatKRW(rd.amount)}</td>
                                        </tr>
                                      ))}
                                    </tbody>
                                  </table>
                                </div>
                              )}

                              {/* Deduction + settings */}
                              <div className="space-y-4">
                                {deductionEntries.length > 0 && (
                                  <div>
                                    <p className="text-xs font-label font-semibold text-on-surface-variant mb-2 font-korean">공제 상세</p>
                                    <div className="space-y-1">
                                      {deductionEntries.map(([name, amount]) => (
                                        <div key={name} className="flex items-center justify-between text-xs">
                                          <span className="text-on-surface-variant font-korean">{name}</span>
                                          <span className="font-data text-error">-{formatKRW(amount as number)}</span>
                                        </div>
                                      ))}
                                    </div>
                                  </div>
                                )}

                                {/* Rate mode info */}
                                <div>
                                  <p className="text-xs font-label font-semibold text-on-surface-variant mb-2 font-korean">정산 설정</p>
                                  <div className="flex flex-wrap gap-2 text-xs">
                                    <span className="px-2 py-1 rounded-lg bg-surface-container-high text-on-surface-variant font-korean">
                                      정산방식: {row.rate_mode === 'route' ? '라우트별 단가' : row.rate_mode === 'flat' ? '통합 단가' : row.rate_mode === 'percentage' ? `요율 ${row.rate_percentage}%` : row.rate_mode ?? '-'}
                                    </span>
                                    <span className="px-2 py-1 rounded-lg bg-surface-container-high text-on-surface-variant font-korean">
                                      부가세: {row.vat_included ? '포함가' : '별도'}
                                    </span>
                                    <span className="px-2 py-1 rounded-lg bg-surface-container-high text-on-surface-variant font-korean">
                                      사업자: {row.is_business_owner ? '유' : '무'}
                                    </span>
                                  </div>
                                </div>
                              </div>
                            </div>
                          </td>
                        </tr>
                      )}
                    </React.Fragment>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Toast */}
      {toast && (
        <div className="fixed top-6 right-6 z-50 bg-tertiary text-white px-5 py-3 rounded-xl shadow-card text-sm font-korean animate-pulse">
          {toast}
        </div>
      )}

      {/* Bottom Action Bar */}
      <div className="bg-surface-container-lowest rounded-2xl shadow-ambient px-6 py-4 flex items-center justify-between">
        <p className="text-sm text-on-surface-variant font-korean">
          {selectedPrincipal !== 'all' && principals.find((p) => p.id === selectedPrincipal)?.name && (
            <span className="font-semibold text-on-surface mr-1">[{principals.find((p) => p.id === selectedPrincipal)?.name}]</span>
          )}
          총 <span className="font-data font-semibold text-on-surface">{settlements.length}</span>명의 기사에 대한 정산서
          {settlements.filter((s) => s.status === 'draft').length > 0 && (
            <span className="ml-2 text-xs text-on-surface-variant">(작성중 {settlements.filter((s) => s.status === 'draft').length}건)</span>
          )}
          {settlements.filter((s) => s.status === 'sent').length > 0 && (
            <span className="ml-2 text-xs text-primary">(발송완료 {settlements.filter((s) => s.status === 'sent').length}건)</span>
          )}
          {settlements.filter((s) => s.status === 'confirmed').length > 0 && (
            <span className="ml-2 text-xs text-tertiary">(확정 {settlements.filter((s) => s.status === 'confirmed').length}건)</span>
          )}
        </p>
        <div className="flex items-center gap-3">
          {settlements.some((s) => s.status === 'sent') && (
            <button
              onClick={handleConfirmAll}
              disabled={actionLoading}
              className="bg-tertiary text-white px-5 py-2.5 rounded-xl font-label font-semibold text-sm hover:shadow-lg transition-shadow disabled:opacity-50 font-korean"
            >
              {actionLoading ? '처리중...' : '정산 확정 + 세금계산서 생성'}
            </button>
          )}
          {settlements.some((s) => s.status === 'draft') && (
            <button
              onClick={handleSendAll}
              disabled={actionLoading}
              className="bg-power-gradient text-white px-6 py-2.5 rounded-xl font-label font-semibold text-sm hover:shadow-lg transition-shadow disabled:opacity-50 font-korean"
            >
              {actionLoading ? '처리중...' : '기사 일괄 발송'}
            </button>
          )}
        </div>
      </div>
    </div>
  );
}