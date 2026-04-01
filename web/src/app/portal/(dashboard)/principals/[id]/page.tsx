'use client';

import { useEffect, useState, useCallback } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { toastError, toastWarning } from '@/components/shared/Toast';
import { createBrowserSupabaseClient } from '@/lib/supabase';
import {
  getPrincipalFull,
  updatePrincipal,
  updateFieldConfig,
  updateExcelConfig,
  type PrincipalFull,
  type FieldConfig,
  type ItemType,
  type RateMode,
  type ExcelConfig,
  type AdditionalItemType,
  COMPANY_OPTIONS,
  ITEM_LABELS,
  ADDITIONAL_ITEM_LABELS,
  ADDITIONAL_ITEM_DESCS,
  DEFAULT_FIELD_CONFIG,
  normalizeFieldConfig,
  buildExcelHeaders,
  getUnitPriceFields,
  DELIVERY_RATE_OPTIONS,
  RETURN_RATE_OPTIONS,
  PICKUP_RATE_OPTIONS,
  INSURANCE_SPLIT_OPTIONS,
  CARGO_ACCIDENT_OPTIONS,
  WAYBILL_PRESET_OPTIONS,
  VAT_MODE_OPTIONS,
  SETTLEMENT_VIEW_OPTIONS,
  SETTLEMENT_DISPLAY_LABELS,
  SETTLEMENT_DISPLAY_GROUPS,
  type SettlementDisplayConfig,
} from '@/services/principal.service';

/* ═══════════════════════ Radio Option Component ═══════════════════════ */
function RadioOption({
  checked,
  onChange,
  label,
  desc,
}: {
  checked: boolean;
  onChange: () => void;
  label: string;
  desc: string;
}) {
  return (
    <div
      role="radio"
      aria-checked={checked}
      onClick={onChange}
      className={`flex items-start gap-3 p-3 rounded-xl cursor-pointer transition-all border ${
        checked
          ? 'border-primary/40 bg-primary/[0.04]'
          : 'border-transparent hover:bg-surface-container-low'
      }`}
    >
      <div className="mt-0.5 shrink-0">
        <div
          className={`w-[18px] h-[18px] rounded-full border-2 flex items-center justify-center transition-colors ${
            checked ? 'border-primary' : 'border-outline-variant'
          }`}
        >
          {checked && <div className="w-2.5 h-2.5 rounded-full bg-primary" />}
        </div>
      </div>
      <div className="flex-1 min-w-0">
        <p className="text-sm font-semibold text-on-surface font-korean">{label}</p>
        <p className="text-xs text-on-surface-variant/70 mt-0.5 font-korean">{desc}</p>
      </div>
    </div>
  );
}

/* ═══════════════════════ Section Toggle Component ═══════════════════════ */
function SectionToggle({
  enabled,
  onToggle,
  label,
  icon,
}: {
  enabled: boolean;
  onToggle: () => void;
  label: string;
  icon: React.ReactNode;
}) {
  return (
    <button
      type="button"
      onClick={onToggle}
      className={`flex items-center gap-3 w-full p-3.5 rounded-xl transition-all border-2 ${
        enabled
          ? 'border-primary/30 bg-primary/[0.06]'
          : 'border-outline-variant/15 bg-surface-container-low/50 hover:border-outline-variant/30'
      }`}
    >
      <div
        className={`w-9 h-9 rounded-lg flex items-center justify-center transition-colors ${
          enabled ? 'bg-primary text-white' : 'bg-surface-container-high text-on-surface-variant'
        }`}
      >
        {icon}
      </div>
      <span
        className={`text-sm font-bold font-korean ${
          enabled ? 'text-on-surface' : 'text-on-surface-variant'
        }`}
      >
        {label}
      </span>
      <div className="ml-auto">
        <div
          className={`relative w-11 h-6 rounded-full transition-colors ${
            enabled ? 'bg-primary' : 'bg-outline-variant/30'
          }`}
        >
          <div
            className={`absolute top-1 w-4 h-4 rounded-full bg-white shadow-sm transition-all ${
              enabled ? 'left-6' : 'left-1'
            }`}
          />
        </div>
      </div>
    </button>
  );
}

/* ═══════════════════════ Icons ═══════════════════════ */
const TruckIcon = (
  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M14 18V6a2 2 0 0 0-2-2H4a2 2 0 0 0-2 2v11a1 1 0 0 0 1 1h2" />
    <path d="M15 18H9" />
    <path d="M19 18h2a1 1 0 0 0 1-1v-3.65a1 1 0 0 0-.22-.624l-3.48-4.35A1 1 0 0 0 17.52 8H14" />
    <circle cx="7" cy="18" r="2" /><circle cx="17" cy="18" r="2" />
  </svg>
);
const ReturnIcon = (
  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <polyline points="1 4 1 10 7 10" />
    <path d="M3.51 15a9 9 0 1 0 2.13-9.36L1 10" />
  </svg>
);
const PickupIcon = (
  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M21 8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16Z" />
    <path d="m3.3 7 8.7 5 8.7-5" /><path d="M12 22V12" />
  </svg>
);

/* ═══════════════════════ Checkbox Option Component ═══════════════════════ */
function CheckboxOption({
  checked,
  onChange,
  label,
  desc,
}: {
  checked: boolean;
  onChange: () => void;
  label: string;
  desc: string;
}) {
  return (
    <div
      role="checkbox"
      aria-checked={checked}
      onClick={onChange}
      className={`flex items-start gap-3 p-3 rounded-xl cursor-pointer transition-all border ${
        checked
          ? 'border-primary/40 bg-primary/[0.04]'
          : 'border-transparent hover:bg-surface-container-low'
      }`}
    >
      <div className="mt-0.5 shrink-0">
        <div
          className={`w-[18px] h-[18px] rounded-md border-2 flex items-center justify-center transition-colors ${
            checked ? 'border-primary bg-primary' : 'border-outline-variant'
          }`}
        >
          {checked && (
            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round">
              <polyline points="20 6 9 17 4 12" />
            </svg>
          )}
        </div>
      </div>
      <div className="flex-1 min-w-0">
        <p className="text-sm font-semibold text-on-surface font-korean">{label}</p>
        <p className="text-xs text-on-surface-variant/70 mt-0.5 font-korean">{desc}</p>
      </div>
    </div>
  );
}

const GiftIcon = (
  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <polyline points="20 12 20 22 4 22 4 12" />
    <rect x="2" y="7" width="20" height="5" />
    <line x1="12" y1="22" x2="12" y2="7" />
    <path d="M12 7H7.5a2.5 2.5 0 0 1 0-5C11 2 12 7 12 7z" />
    <path d="M12 7h4.5a2.5 2.5 0 0 0 0-5C13 2 12 7 12 7z" />
  </svg>
);

/* ═══════════════════════ Deduction Icons ═══════════════════════ */
const ShieldIcon = (
  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" />
  </svg>
);
const AlertTriangleIcon = (
  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="m21.73 18-8-14a2 2 0 0 0-3.48 0l-8 14A2 2 0 0 0 4 21h16a2 2 0 0 0 1.73-3Z" />
    <line x1="12" y1="9" x2="12" y2="13" /><line x1="12" y1="17" x2="12.01" y2="17" />
  </svg>
);
const CarIcon = (
  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M19 17h2c.6 0 1-.4 1-1v-3c0-.9-.7-1.7-1.5-1.9C18.7 10.6 16 10 16 10s-1.3-1.4-2.2-2.3c-.5-.4-1.1-.7-1.8-.7H5c-.6 0-1.1.4-1.4.9l-1.5 2.8C1.4 11.3 1 12.1 1 13v3c0 .6.4 1 1 1h2" />
    <circle cx="7" cy="17" r="2" /><circle cx="17" cy="17" r="2" />
  </svg>
);
const FileTextIcon = (
  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
    <polyline points="14 2 14 8 20 8" /><line x1="16" y1="13" x2="8" y2="13" /><line x1="16" y1="17" x2="8" y2="17" />
  </svg>
);

/* ═══════════════════════ Main Page ═══════════════════════ */
export default function PrincipalDetailPage() {
  const params = useParams();
  const router = useRouter();
  const principalId = params.id as string;

  const [data, setData] = useState<PrincipalFull | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  /* ── Form state ── */
  const [principalName, setPrincipalName] = useState('');
  const [contactName, setContactName] = useState('');
  const [contactPhone, setContactPhone] = useState('');
  const [fieldConfig, setFieldConfig] = useState<FieldConfig>({ ...DEFAULT_FIELD_CONFIG });

  useEffect(() => {
    async function load() {
      const result = await getPrincipalFull(principalId);
      if (result.data) {
        const p = result.data;
        setData(p);
        setPrincipalName(p.name);

        // Parse contact info from memo: "담당: {name} | 연락처: {phone}"
        if (p.memo) {
          const contactMatch = p.memo.match(/담당:\s*([^|]*)/);
          const phoneMatch = p.memo.match(/연락처:\s*([^|]*)/);
          if (contactMatch) setContactName(contactMatch[1].trim());
          if (phoneMatch) setContactPhone(phoneMatch[1].trim());
        }

        // Load field config
        const fc = normalizeFieldConfig(p.field_config);
        setFieldConfig(fc);
      }
      setLoading(false);
    }
    load();
  }, [principalId]);

  function toggleItem(type: ItemType) {
    setFieldConfig((fc) => ({
      ...fc,
      items: { ...fc.items, [type]: { ...fc.items[type], enabled: !fc.items[type].enabled } },
    }));
  }

  function setRateMode(type: ItemType, mode: RateMode) {
    setFieldConfig((fc) => ({
      ...fc,
      items: { ...fc.items, [type]: { ...fc.items[type], rate_mode: mode } },
    }));
  }

  function toggleAdditionalItem(type: AdditionalItemType) {
    setFieldConfig((fc) => ({
      ...fc,
      additional_items: {
        ...fc.additional_items,
        [type]: { ...fc.additional_items[type], enabled: !fc.additional_items[type].enabled },
      },
    }));
  }

  async function handleSave() {
    if (!principalName.trim()) {
      toastWarning('카테고리명은 필수입니다.');
      return;
    }
    setSaving(true);
    try {
      const memoWithContact = [
        contactName && `담당: ${contactName}`,
        contactPhone && `연락처: ${contactPhone}`,
      ].filter(Boolean).join(' | ');

      const headers = buildExcelHeaders(fieldConfig);
      const excelConfig = {
        columns: headers.map((h, i) => ({
          key: h.replace(/[^a-zA-Z0-9가-힣]/g, '_').toLowerCase(),
          label: h,
          excel_col: String.fromCharCode(65 + i),
        })),
      };

      const result = await updatePrincipal(principalId, {
        name: principalName,
        memo: memoWithContact || undefined,
      });

      if (!result.error) {
        await updateFieldConfig(principalId, fieldConfig);
        await updateExcelConfig(principalId, excelConfig);
        toastWarning('설정이 저장되었습니다.');
      } else {
        toastError('저장 오류: ' + String(result.error));
      }
    } catch (e) {
      toastError('저장 오류: ' + (e instanceof Error ? e.message : String(e)));
    }
    setSaving(false);
  }

  const inputCls = 'w-full h-11 px-4 rounded-xl bg-surface-container-low text-on-surface text-sm font-korean focus:outline-none focus:ring-2 focus:ring-primary/30 placeholder:text-on-surface-variant/40';
  const labelCls = 'block text-xs font-label font-medium text-on-surface-variant mb-1.5 font-korean';

  const previewHeaders = buildExcelHeaders(fieldConfig);

  if (loading) {
    return (
      <div className="bg-surface-container-lowest rounded-2xl shadow-ambient p-12 text-center">
        <span className="text-sm text-on-surface-variant font-korean">불러오는 중...</span>
      </div>
    );
  }

  if (!data) {
    return (
      <div className="bg-surface-container-lowest rounded-2xl shadow-ambient p-12 text-center space-y-3">
        <p className="text-base font-semibold text-on-surface font-korean">카테고리를 찾을 수 없습니다</p>
        <button
          onClick={() => router.back()}
          className="mt-4 inline-flex items-center gap-2 h-10 px-5 rounded-xl bg-primary/10 text-primary text-sm font-semibold hover:bg-primary/20 transition-colors font-korean"
        >
          돌아가기
        </button>
      </div>
    );
  }

  return (
    <div className="space-y-8">
      {/* ═══ Header ═══ */}
      <div className="flex items-center gap-3">
        <button
          onClick={() => router.back()}
          className="h-10 w-10 rounded-lg hover:bg-surface-container-high transition-colors flex items-center justify-center text-on-surface-variant/60 hover:text-on-surface-variant"
        >
          <svg width="20" height="20" viewBox="0 0 24 24" fill="currentColor"><path d="M19 12H5m7-7-7 7 7 7"/></svg>
        </button>
        <div>
          <h1 className="text-2xl font-headline font-bold text-on-surface font-korean">{principalName}</h1>
          <p className="mt-1 text-sm text-on-surface-variant font-korean">
            카테고리 설정 변경
          </p>
        </div>
      </div>

      {/* ═══ 계약 기간 카드 (최상단) ═══ */}
      <div className="bg-surface-container-lowest rounded-2xl shadow-ambient p-5">
        <div className="flex items-center gap-2.5 mb-4">
          <div className="w-9 h-9 rounded-lg bg-primary/10 text-primary flex items-center justify-center">
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <rect x="3" y="4" width="18" height="18" rx="2" ry="2"/><line x1="16" y1="2" x2="16" y2="6"/><line x1="8" y1="2" x2="8" y2="6"/><line x1="3" y1="10" x2="21" y2="10"/>
            </svg>
          </div>
          <div>
            <h2 className="text-sm font-headline font-bold text-on-surface font-korean">계약 기간 설정</h2>
            <p className="text-[11px] text-on-surface-variant font-korean">재계약 시점과 만료일을 설정합니다. 기사 등록 및 재계약 시 적용됩니다.</p>
          </div>
        </div>
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
          <div>
            <label className={labelCls}>계약 시작일</label>
            <input
              type="date"
              value={fieldConfig.contract_renewal_date ?? ''}
              onChange={(e) => setFieldConfig((fc) => ({ ...fc, contract_renewal_date: e.target.value }))}
              className={inputCls}
            />
          </div>
          <div>
            <label className={labelCls}>계약 기간 (개월)</label>
            <input
              type="number"
              placeholder="12"
              value={fieldConfig.contract_duration_months ?? ''}
              onChange={(e) => setFieldConfig((fc) => ({ ...fc, contract_duration_months: e.target.value ? Number(e.target.value) : undefined }))}
              className={inputCls}
            />
          </div>
          <div>
            <label className={labelCls}>만료일</label>
            <input
              type="date"
              value={
                fieldConfig.contract_expiry_date
                  ? fieldConfig.contract_expiry_date
                  : fieldConfig.contract_renewal_date && fieldConfig.contract_duration_months
                    ? (() => {
                        const d = new Date(fieldConfig.contract_renewal_date);
                        d.setMonth(d.getMonth() + fieldConfig.contract_duration_months);
                        d.setDate(d.getDate() - 1);
                        return d.toISOString().split('T')[0];
                      })()
                    : ''
              }
              onChange={(e) => setFieldConfig((fc) => ({ ...fc, contract_expiry_date: e.target.value || undefined }))}
              className={inputCls}
            />
            {fieldConfig.contract_renewal_date && fieldConfig.contract_duration_months && !fieldConfig.contract_expiry_date && (
              <p className="text-[10px] text-on-surface-variant mt-0.5 font-korean">자동 계산 (시작일 + {fieldConfig.contract_duration_months}개월 - 1일)</p>
            )}
          </div>
          <div>
            <label className={labelCls}>재계약 시점</label>
            <input
              type="text"
              readOnly
              value={
                (() => {
                  const expiry = fieldConfig.contract_expiry_date
                    || (fieldConfig.contract_renewal_date && fieldConfig.contract_duration_months
                      ? (() => {
                          const d = new Date(fieldConfig.contract_renewal_date);
                          d.setMonth(d.getMonth() + fieldConfig.contract_duration_months);
                          d.setDate(d.getDate() - 1);
                          return d.toISOString().split('T')[0];
                        })()
                      : null);
                  if (!expiry) return '—';
                  const d = new Date(expiry);
                  d.setDate(d.getDate() - 30);
                  return d.toISOString().split('T')[0] + ' (만료 30일 전)';
                })()
              }
              className={inputCls + ' !bg-surface-container-high/50 !text-on-surface-variant !text-xs'}
            />
          </div>
        </div>
      </div>

      {/* ═════════════════════════ Form Container ═════════════════════════ */}
      <div className="bg-surface-container-lowest rounded-2xl shadow-ambient overflow-hidden">
        <div className="bg-primary/[0.04] border-b border-outline-variant/10 px-6 py-5">
          <h2 className="text-lg font-headline font-bold text-on-surface font-korean">설정 변경</h2>
          <p className="text-xs text-on-surface-variant mt-1 font-korean">
            정산 항목과 계산 방식을 변경하고, 필요한 설정을 수정합니다.
          </p>
        </div>

        <div className="p-6 space-y-8">
          {/* ── Section 1: 기본정보 ── */}
          <div>
            <div className="flex items-center gap-2 mb-4">
              <div className="w-6 h-6 rounded-md bg-primary/10 text-primary flex items-center justify-center text-xs font-bold">1</div>
              <h3 className="text-sm font-headline font-bold text-on-surface font-korean">기본 정보</h3>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              {/* 카테고리명 */}
              <div>
                <label className={labelCls}>카테고리명</label>
                <input type="text" value={principalName} onChange={(e) => setPrincipalName(e.target.value)} className={inputCls} />
              </div>

              {/* 담당자 */}
              <div>
                <label className={labelCls}>담당자</label>
                <input type="text" placeholder="담당자 이름" value={contactName} onChange={(e) => setContactName(e.target.value)} className={inputCls} />
              </div>

              {/* 전화번호 */}
              <div>
                <label className={labelCls}>전화번호</label>
                <input type="tel" placeholder="010-0000-0000" value={contactPhone} onChange={(e) => setContactPhone(e.target.value)} className={inputCls} />
              </div>

              {/* 부가세 설정 */}
              <div>
                <label className={labelCls}>부가세 기준</label>
                <div className="flex gap-2 mt-1">
                  {VAT_MODE_OPTIONS.map((opt) => (
                    <div
                      key={opt.value}
                      role="radio"
                      aria-checked={fieldConfig.vat_mode === opt.value}
                      onClick={() => setFieldConfig((fc) => ({ ...fc, vat_mode: opt.value }))}
                      className={`flex items-center gap-2.5 flex-1 p-2.5 rounded-lg cursor-pointer transition-all border text-xs ${
                        fieldConfig.vat_mode === opt.value
                          ? 'border-primary/40 bg-primary/[0.04]'
                          : 'border-outline-variant/15 hover:bg-surface-container-low'
                      }`}
                    >
                      <div className="shrink-0">
                        <div
                          className={`w-[14px] h-[14px] rounded-full border-2 flex items-center justify-center transition-colors ${
                            fieldConfig.vat_mode === opt.value ? 'border-primary' : 'border-outline-variant'
                          }`}
                        >
                          {fieldConfig.vat_mode === opt.value && <div className="w-1.5 h-1.5 rounded-full bg-primary" />}
                        </div>
                      </div>
                      <span className="font-korean font-semibold text-on-surface">{opt.label}</span>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </div>

          {/* ── Section 2: 수입설정(좌) + 차감설정(우) ── */}
          <div>
            <div className="flex items-center gap-2 mb-2">
              <div className="w-6 h-6 rounded-md bg-primary/10 text-primary flex items-center justify-center text-xs font-bold">2</div>
              <h3 className="text-sm font-headline font-bold text-on-surface font-korean">정산 항목 설정</h3>
            </div>
            <p className="text-xs text-on-surface-variant mb-5 font-korean ml-8">
              수입/차감 항목을 설정하면 기사 등록 및 재계약 시 해당 입력란이 자동 생성됩니다.
            </p>

            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              {/* ════ 좌측: 수입설정 ════ */}
              <div className="space-y-5">
                <div className="flex items-center gap-2 pb-2 border-b border-primary/20">
                  <span className="px-2.5 py-1 rounded-lg text-[11px] font-bold bg-primary/10 text-primary">수입</span>
                  <span className="text-sm font-bold text-on-surface font-korean">수입설정</span>
                </div>

                {/* ── 수수료 방식 선택 (각 그룹 하나만 선택) ── */}
                <div className="p-4 rounded-2xl bg-primary/[0.03] border border-primary/10 space-y-4">
                  {/* 그룹 1: 수수료 방식 */}
                  <div>
                    <p className="text-[10px] font-bold text-on-surface-variant/60 uppercase tracking-wider font-korean mb-2">수수료 방식</p>
                    <div className="space-y-1">
                      <RadioOption
                        checked={fieldConfig.items.delivery.fee_same === true}
                        onChange={() =>
                          setFieldConfig((fc) => ({
                            ...fc,
                            items: {
                              delivery: { ...fc.items.delivery, fee_same: true, fee_separate: false },
                              return: { ...fc.items.return, fee_same: true, fee_separate: false },
                              pickup: { ...fc.items.pickup, fee_same: true, fee_separate: false },
                            },
                          }))
                        }
                        label="동일수수료"
                        desc="배송/반품 동일 단가 또는 요율 1개 입력"
                      />
                      <RadioOption
                        checked={fieldConfig.items.delivery.fee_separate === true}
                        onChange={() =>
                          setFieldConfig((fc) => ({
                            ...fc,
                            items: {
                              delivery: { ...fc.items.delivery, fee_same: false, fee_separate: true },
                              return: { ...fc.items.return, fee_same: false, fee_separate: true },
                              pickup: { ...fc.items.pickup, fee_same: false, fee_separate: true },
                            },
                          }))
                        }
                        label="별도 수수료"
                        desc="배송단가·반품단가를 각각 입력"
                      />
                    </div>
                  </div>

                  {/* 그룹 2: 라우트 방식 */}
                  <div className="pt-3 border-t border-primary/10">
                    <p className="text-[10px] font-bold text-on-surface-variant/60 uppercase tracking-wider font-korean mb-2">라우트 방식</p>
                    <div className="space-y-1">
                      <RadioOption
                        checked={fieldConfig.items.delivery.route_same === true}
                        onChange={() =>
                          setFieldConfig((fc) => ({
                            ...fc,
                            items: {
                              delivery: { ...fc.items.delivery, route_same: true, route_separate: false },
                              return: { ...fc.items.return, route_same: true, route_separate: false },
                              pickup: { ...fc.items.pickup, route_same: true, route_separate: false },
                            },
                          }))
                        }
                        label="동일 라우트 수수료"
                        desc="라우트별 동일 단가 1개 입력"
                      />
                      <RadioOption
                        checked={fieldConfig.items.delivery.route_separate === true}
                        onChange={() =>
                          setFieldConfig((fc) => ({
                            ...fc,
                            items: {
                              delivery: { ...fc.items.delivery, route_same: false, route_separate: true },
                              return: { ...fc.items.return, route_same: false, route_separate: true },
                              pickup: { ...fc.items.pickup, route_same: false, route_separate: true },
                            },
                          }))
                        }
                        label="별도 라우트 수수료"
                        desc="라우트별 배송단가·반품단가를 개별 입력"
                      />
                    </div>
                  </div>
                </div>

                {/* ── 배송/반품 통합 토글 ── */}
                <div className="rounded-2xl border border-outline-variant/15 overflow-hidden">
                  <SectionToggle
                    enabled={fieldConfig.items.delivery.enabled || fieldConfig.items.return.enabled}
                    onToggle={() => {
                      const next = !(fieldConfig.items.delivery.enabled || fieldConfig.items.return.enabled);
                      setFieldConfig((fc) => ({
                        ...fc,
                        items: {
                          ...fc.items,
                          delivery: { ...fc.items.delivery, enabled: next },
                          return: { ...fc.items.return, enabled: next },
                        },
                      }));
                    }}
                    label="배송/반품"
                    icon={TruckIcon}
                  />
                  {(fieldConfig.items.delivery.enabled || fieldConfig.items.return.enabled) && (
                    <div className="px-4 pb-4 pt-3 bg-surface-container-lowest space-y-4">

                      {/* ── 동일수수료: 배송/반품 동일 단가/% ── */}
                      {fieldConfig.items.delivery.fee_same && (
                        <div className="p-3 rounded-xl bg-surface-container-low/50 border border-outline-variant/10 space-y-2">
                          <p className="text-xs font-semibold text-on-surface font-korean">배송/반품 동일 수수료</p>
                          <div className="space-y-1">
                            {DELIVERY_RATE_OPTIONS.map((opt) => (
                              <RadioOption
                                key={opt.value}
                                checked={fieldConfig.items.delivery.rate_mode === opt.value}
                                onChange={() => {
                                  setRateMode('delivery', opt.value);
                                  setRateMode('return', opt.value);
                                }}
                                label={opt.label.replace('배송', '배송/반품')}
                                desc={opt.desc}
                              />
                            ))}
                          </div>
                        </div>
                      )}

                      {/* ── 별도수수료: 배송/반품 통합 (기사등록 시 배송·반품 단가 별도 입력) ── */}
                      {fieldConfig.items.delivery.fee_separate && (
                        <div className="p-3 rounded-xl bg-surface-container-low/50 border border-outline-variant/10 space-y-2">
                          <p className="text-xs font-semibold text-on-surface font-korean">배송/반품 별도 수수료</p>
                          <p className="text-[10px] text-on-surface-variant font-korean">기사 등록 시 배송·반품 단가를 각각 입력합니다</p>
                          <div className="space-y-1">
                            {DELIVERY_RATE_OPTIONS.map((opt) => (
                              <RadioOption
                                key={opt.value}
                                checked={fieldConfig.items.delivery.rate_mode === opt.value}
                                onChange={() => {
                                  setRateMode('delivery', opt.value);
                                  setRateMode('return', opt.value);
                                }}
                                label={opt.label.replace('배송', '배송/반품')}
                                desc={opt.desc}
                              />
                            ))}
                          </div>
                        </div>
                      )}

                      {/* 미선택 시 안내 */}
                      {!fieldConfig.items.delivery.fee_same && !fieldConfig.items.delivery.fee_separate &&
                       !fieldConfig.items.delivery.route_same && !fieldConfig.items.delivery.route_separate && (
                        <p className="text-xs text-on-surface-variant/50 font-korean py-2 text-center">
                          상단에서 수수료 방식을 선택하세요.
                        </p>
                      )}
                    </div>
                  )}
                </div>

                {/* ── 집하 토글 (별도 유지) ── */}
                <div className="rounded-2xl border border-outline-variant/15 overflow-hidden">
                  <SectionToggle
                    enabled={fieldConfig.items.pickup.enabled}
                    onToggle={() => toggleItem('pickup')}
                    label="집하"
                    icon={PickupIcon}
                  />
                  {fieldConfig.items.pickup.enabled && (
                    <div className="px-4 pb-4 pt-2 bg-surface-container-lowest space-y-1">
                      <p className="text-[10px] text-on-surface-variant/60 font-korean mb-2 ml-1">계산 방식 선택</p>
                      {PICKUP_RATE_OPTIONS.map((opt) => (
                        <RadioOption
                          key={opt.value}
                          checked={fieldConfig.items.pickup.rate_mode === opt.value}
                          onChange={() => setRateMode('pickup', opt.value)}
                          label={opt.label}
                          desc={opt.desc}
                        />
                      ))}
                    </div>
                  )}
                </div>

                {/* ── 부가항목 (추가 수익) ── */}
                <div className="pt-4 border-t border-outline-variant/10">
                  <div className="flex items-center gap-2 mb-3 ml-1">
                    <div className="text-tertiary">{GiftIcon}</div>
                    <p className="text-xs font-semibold text-on-surface font-korean">부가항목</p>
                  </div>
                  <div className="space-y-1">
                    {(Object.keys(ADDITIONAL_ITEM_LABELS) as AdditionalItemType[]).map((key) => (
                      <CheckboxOption
                        key={key}
                        checked={fieldConfig.additional_items[key].enabled}
                        onChange={() => toggleAdditionalItem(key)}
                        label={ADDITIONAL_ITEM_LABELS[key]}
                        desc={ADDITIONAL_ITEM_DESCS[key]}
                      />
                    ))}
                  </div>
                </div>

              </div>

              {/* ════ 우측: 차감설정 ════ */}
              <div className="space-y-5">
                <div className="flex items-center gap-2 pb-2 border-b border-error/20">
                  <span className="px-2.5 py-1 rounded-lg text-[11px] font-bold bg-error/10 text-error">차감</span>
                  <span className="text-sm font-bold text-on-surface font-korean">차감설정</span>
                </div>

                {/* ── 고용보험 ── */}
                <div className="rounded-2xl border border-outline-variant/15 overflow-hidden">
                  <SectionToggle
                    enabled={fieldConfig.deduction_section.employment_insurance.enabled}
                    onToggle={() =>
                      setFieldConfig((fc) => ({
                        ...fc,
                        deduction_section: {
                          ...fc.deduction_section,
                          employment_insurance: {
                            ...fc.deduction_section.employment_insurance,
                            enabled: !fc.deduction_section.employment_insurance.enabled,
                          },
                        },
                      }))
                    }
                    label="고용보험"
                    icon={ShieldIcon}
                  />
                  {fieldConfig.deduction_section.employment_insurance.enabled && (
                    <div className="px-4 pb-4 pt-2 bg-surface-container-lowest space-y-1">
                      <p className="text-[10px] text-on-surface-variant/60 font-korean mb-2 ml-1">부담 비율 선택</p>
                      {INSURANCE_SPLIT_OPTIONS.map((opt) => (
                        <RadioOption
                          key={opt.value}
                          checked={fieldConfig.deduction_section.employment_insurance.split_mode === opt.value}
                          onChange={() =>
                            setFieldConfig((fc) => ({
                              ...fc,
                              deduction_section: {
                                ...fc.deduction_section,
                                employment_insurance: {
                                  ...fc.deduction_section.employment_insurance,
                                  split_mode: opt.value,
                                },
                              },
                            }))
                          }
                          label={opt.label}
                          desc={opt.desc}
                        />
                      ))}
                    </div>
                  )}
                </div>

                {/* ── 산재보험 ── */}
                <div className="rounded-2xl border border-outline-variant/15 overflow-hidden">
                  <SectionToggle
                    enabled={fieldConfig.deduction_section.industrial_insurance.enabled}
                    onToggle={() =>
                      setFieldConfig((fc) => ({
                        ...fc,
                        deduction_section: {
                          ...fc.deduction_section,
                          industrial_insurance: {
                            ...fc.deduction_section.industrial_insurance,
                            enabled: !fc.deduction_section.industrial_insurance.enabled,
                          },
                        },
                      }))
                    }
                    label="산재보험"
                    icon={ShieldIcon}
                  />
                  {fieldConfig.deduction_section.industrial_insurance.enabled && (
                    <div className="px-4 pb-4 pt-2 bg-surface-container-lowest space-y-1">
                      <p className="text-[10px] text-on-surface-variant/60 font-korean mb-2 ml-1">부담 비율 선택</p>
                      {INSURANCE_SPLIT_OPTIONS.map((opt) => (
                        <RadioOption
                          key={opt.value}
                          checked={fieldConfig.deduction_section.industrial_insurance.split_mode === opt.value}
                          onChange={() =>
                            setFieldConfig((fc) => ({
                              ...fc,
                              deduction_section: {
                                ...fc.deduction_section,
                                industrial_insurance: {
                                  ...fc.deduction_section.industrial_insurance,
                                  split_mode: opt.value,
                                },
                              },
                            }))
                          }
                          label={opt.label}
                          desc={opt.desc}
                        />
                      ))}
                    </div>
                  )}
                </div>

                {/* ── 화물사고 ── */}
                <div className="rounded-2xl border border-outline-variant/15 overflow-hidden">
                  <SectionToggle
                    enabled={fieldConfig.deduction_section.cargo_accident.enabled}
                    onToggle={() =>
                      setFieldConfig((fc) => ({
                        ...fc,
                        deduction_section: {
                          ...fc.deduction_section,
                          cargo_accident: {
                            ...fc.deduction_section.cargo_accident,
                            enabled: !fc.deduction_section.cargo_accident.enabled,
                          },
                        },
                      }))
                    }
                    label="화물사고"
                    icon={AlertTriangleIcon}
                  />
                  {fieldConfig.deduction_section.cargo_accident.enabled && (
                    <div className="px-4 pb-4 pt-2 bg-surface-container-lowest space-y-2">
                      <p className="text-[10px] text-on-surface-variant/60 font-korean mb-2 ml-1">처리 방식 선택</p>
                      {CARGO_ACCIDENT_OPTIONS.map((opt) => (
                        <RadioOption
                          key={opt.value}
                          checked={fieldConfig.deduction_section.cargo_accident.mode === opt.value}
                          onChange={() =>
                            setFieldConfig((fc) => ({
                              ...fc,
                              deduction_section: {
                                ...fc.deduction_section,
                                cargo_accident: { ...fc.deduction_section.cargo_accident, mode: opt.value },
                              },
                            }))
                          }
                          label={opt.label}
                          desc={opt.desc}
                        />
                      ))}
                      {fieldConfig.deduction_section.cargo_accident.mode !== 'actual_cost' && (
                        <div className="ml-7 mt-2">
                          <input
                            type="number"
                            placeholder={fieldConfig.deduction_section.cargo_accident.mode === 'fixed_amount' ? '금액 입력 (원)' : '비율 입력 (%)'}
                            value={fieldConfig.deduction_section.cargo_accident.fixed_value || ''}
                            onChange={(e) =>
                              setFieldConfig((fc) => ({
                                ...fc,
                                deduction_section: {
                                  ...fc.deduction_section,
                                  cargo_accident: {
                                    ...fc.deduction_section.cargo_accident,
                                    fixed_value: Number(e.target.value),
                                  },
                                },
                              }))
                            }
                            className={inputCls + ' !h-9 !text-xs max-w-[200px]'}
                          />
                        </div>
                      )}
                      <div className="ml-7 mt-2">
                        <input
                          type="text"
                          placeholder="비고 (예: 파손 시 실비, 분실 50% 부담 등)"
                          value={fieldConfig.deduction_section.cargo_accident.description}
                          onChange={(e) =>
                            setFieldConfig((fc) => ({
                              ...fc,
                              deduction_section: {
                                ...fc.deduction_section,
                                cargo_accident: { ...fc.deduction_section.cargo_accident, description: e.target.value },
                              },
                            }))
                          }
                          className={inputCls + ' !h-9 !text-xs'}
                        />
                      </div>
                    </div>
                  )}
                </div>

                {/* ── 차량임대료 ── */}
                <div className="rounded-2xl border border-outline-variant/15 overflow-hidden">
                  <SectionToggle
                    enabled={fieldConfig.deduction_section.vehicle_rental.enabled}
                    onToggle={() =>
                      setFieldConfig((fc) => ({
                        ...fc,
                        deduction_section: {
                          ...fc.deduction_section,
                          vehicle_rental: {
                            ...fc.deduction_section.vehicle_rental,
                            enabled: !fc.deduction_section.vehicle_rental.enabled,
                          },
                        },
                      }))
                    }
                    label="차량임대료"
                    icon={CarIcon}
                  />
                  {fieldConfig.deduction_section.vehicle_rental.enabled && (
                    <div className="px-4 pb-4 pt-2 bg-surface-container-lowest">
                      <p className="text-xs text-on-surface-variant/70 font-korean flex items-center gap-1.5">
                        <svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor" className="text-on-surface-variant/40 shrink-0"><path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm1 15h-2v-6h2v6zm0-8h-2V7h2v2z"/></svg>
                        기사별 임대료는 기사 등록 시 개별 입력합니다.
                      </p>
                    </div>
                  )}
                </div>

                {/* ── 운송장 ── */}
                <div className="rounded-2xl border border-outline-variant/15 overflow-hidden">
                  <SectionToggle
                    enabled={fieldConfig.deduction_section.waybill.enabled}
                    onToggle={() =>
                      setFieldConfig((fc) => ({
                        ...fc,
                        deduction_section: {
                          ...fc.deduction_section,
                          waybill: { ...fc.deduction_section.waybill, enabled: !fc.deduction_section.waybill.enabled },
                        },
                      }))
                    }
                    label="운송장"
                    icon={FileTextIcon}
                  />
                  {fieldConfig.deduction_section.waybill.enabled && (
                    <div className="px-4 pb-4 pt-2 bg-surface-container-lowest space-y-1">
                      <p className="text-[10px] text-on-surface-variant/60 font-korean mb-2 ml-1">적용 항목 선택</p>
                      {WAYBILL_PRESET_OPTIONS.map((opt) => (
                        <CheckboxOption
                          key={opt.key}
                          checked={!!fieldConfig.deduction_section.waybill[opt.key]}
                          onChange={() =>
                            setFieldConfig((fc) => ({
                              ...fc,
                              deduction_section: {
                                ...fc.deduction_section,
                                waybill: {
                                  ...fc.deduction_section.waybill,
                                  [opt.key]: !fc.deduction_section.waybill[opt.key],
                                },
                              },
                            }))
                          }
                          label={opt.label}
                          desc={opt.desc}
                        />
                      ))}
                    </div>
                  )}
                </div>
              </div>
            </div>
          </div>

          {/* ── Section 3: 정산서 노출항목 설정 (좌: 설정, 우: 폰 미리보기) ── */}
          <div>
            <div className="flex items-center gap-2 mb-2">
              <div className="w-6 h-6 rounded-md bg-tertiary/10 text-tertiary flex items-center justify-center text-xs font-bold">3</div>
              <h3 className="text-sm font-headline font-bold text-on-surface font-korean">정산서 노출항목 설정</h3>
            </div>
            <p className="text-xs text-on-surface-variant mb-5 font-korean ml-8">
              기사 앱에서 정산 내역이 어떻게 표시될지 설정합니다. 우측 미리보기에서 실시간으로 확인하세요.
            </p>

            <div className="flex gap-6">
              {/* 좌측: 설정 */}
              <div className="flex-1 min-w-0 space-y-5">
                {/* 보기 모드 */}
                <div className="rounded-2xl border border-outline-variant/15 p-4 space-y-2">
                  <p className="text-xs font-semibold text-on-surface font-korean flex items-center gap-1.5">
                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="text-tertiary">
                      <rect x="3" y="3" width="18" height="18" rx="2"/><path d="M3 9h18"/><path d="M9 21V9"/>
                    </svg>
                    보기 모드
                  </p>
                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-2 mt-2">
                    {SETTLEMENT_VIEW_OPTIONS.map((opt) => (
                      <div key={opt.value} role="radio" aria-checked={fieldConfig.settlement_view_mode === opt.value}
                        onClick={() => setFieldConfig((fc) => ({ ...fc, settlement_view_mode: opt.value }))}
                        className={`flex items-center gap-2.5 p-3 rounded-xl cursor-pointer transition-all border ${
                          fieldConfig.settlement_view_mode === opt.value ? 'border-tertiary/40 bg-tertiary/[0.04]' : 'border-outline-variant/15 hover:bg-surface-container-low'
                        }`}>
                        <div className="shrink-0">
                          <div className={`w-[18px] h-[18px] rounded-full border-2 flex items-center justify-center transition-colors ${
                            fieldConfig.settlement_view_mode === opt.value ? 'border-tertiary' : 'border-outline-variant'
                          }`}>
                            {fieldConfig.settlement_view_mode === opt.value && <div className="w-2.5 h-2.5 rounded-full bg-tertiary" />}
                          </div>
                        </div>
                        <div className="flex-1 min-w-0">
                          <p className="text-sm font-semibold text-on-surface font-korean">{opt.label}</p>
                          <p className="text-[11px] text-on-surface-variant/60 mt-0.5 font-korean">{opt.desc}</p>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>

                {/* 표시항목 체크 */}
                <div className="rounded-2xl border border-outline-variant/15 p-4 space-y-4">
                  <p className="text-xs font-semibold text-on-surface font-korean flex items-center gap-1.5">
                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="text-tertiary">
                      <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/>
                    </svg>
                    표시 항목 선택
                  </p>
                  {SETTLEMENT_DISPLAY_GROUPS.map((group) => (
                    <div key={group.title}>
                      <p className="text-[10px] font-bold text-on-surface-variant/50 uppercase tracking-wider font-korean mb-2">{group.title}</p>
                      <div className="flex flex-wrap gap-2">
                        {group.keys.map((key) => {
                          const checked = fieldConfig.settlement_display[key];
                          return (
                            <button key={key} type="button"
                              onClick={() => setFieldConfig((fc) => ({ ...fc, settlement_display: { ...fc.settlement_display, [key]: !fc.settlement_display[key] } }))}
                              className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium font-korean transition-all border ${
                                checked ? 'border-tertiary/30 bg-tertiary/10 text-tertiary' : 'border-outline-variant/15 bg-surface-container-low text-on-surface-variant/60 hover:border-outline-variant/30'
                              }`}>
                              {checked ? (
                                <svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor"><path d="M9 16.17L4.83 12l-1.42 1.41L9 19 21 7l-1.41-1.41L9 16.17z"/></svg>
                              ) : (
                                <svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor" className="opacity-30"><path d="M19 13H5v-2h14v2z"/></svg>
                              )}
                              {SETTLEMENT_DISPLAY_LABELS[key]}
                            </button>
                          );
                        })}
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              {/* 우측: 폰 미리보기 (sticky) */}
              <div className="hidden lg:block w-[280px] shrink-0">
                <div className="sticky top-6">
                  <p className="text-xs font-label font-semibold text-on-surface-variant mb-3 font-korean">기사 앱 미리보기</p>
                  <div className="bg-surface rounded-3xl border-2 border-outline-variant/30 p-1">
                    <div className="bg-surface-container-lowest rounded-[20px] overflow-hidden">
                      <div className="h-6 bg-primary flex items-center justify-center">
                        <span className="text-[8px] text-white/80 font-data">정산 상세</span>
                      </div>
                      <div className="p-4 text-center border-b border-outline-variant/20">
                        <p className="text-[10px] text-on-surface-variant font-korean">2026년 3월</p>
                        <p className="text-[10px] text-on-surface-variant font-korean mt-0.5">{principalName || '카테고리'}</p>
                        <p className="text-lg font-data font-bold text-primary mt-2">₩2,840,000</p>
                        <p className="text-[8px] text-on-surface-variant font-korean mt-0.5">지급액</p>
                      </div>

                      {/* 간편 모드: 핵심 요약만 */}
                      {fieldConfig.settlement_view_mode === 'simple' && (
                        <div className="p-3 space-y-1.5">
                          <div className="flex justify-between"><span className="text-[9px] text-on-surface-variant font-korean">배송</span><span className="text-[9px] font-data text-on-surface">342건</span></div>
                          <div className="flex justify-between"><span className="text-[9px] text-on-surface-variant font-korean">총 수입</span><span className="text-[9px] font-data font-bold text-on-surface">₩3,139,000</span></div>
                          <div className="flex justify-between"><span className="text-[9px] text-on-surface-variant font-korean">총 차감</span><span className="text-[9px] font-data font-bold text-error">-₩299,000</span></div>
                          <div className="border-t border-outline-variant/20 mt-1 pt-2" />
                          <div className="flex justify-between items-center">
                            <span className="text-[9px] font-label font-bold text-on-surface font-korean">최종 지급액</span>
                            <span className="text-sm font-data font-bold text-primary">₩2,840,000</span>
                          </div>
                        </div>
                      )}

                      {/* 상세 모드: 체크된 항목별 표시 */}
                      {fieldConfig.settlement_view_mode === 'detail' && (
                        <>
                          <div className="p-3 space-y-1">
                            <p className="text-[9px] font-label font-bold text-on-surface font-korean mb-1">수입 내역</p>
                            {fieldConfig.settlement_display.delivery_count && <div className="flex justify-between"><span className="text-[9px] text-on-surface-variant font-korean">배송 건수</span><span className="text-[9px] font-data text-on-surface">342건</span></div>}
                            {fieldConfig.settlement_display.delivery_amount && <div className="flex justify-between"><span className="text-[9px] text-on-surface-variant font-korean">배송 금액</span><span className="text-[9px] font-data text-on-surface">₩2,200,000</span></div>}
                            {fieldConfig.settlement_display.return_count && <div className="flex justify-between"><span className="text-[9px] text-on-surface-variant font-korean">반품 건수</span><span className="text-[9px] font-data text-on-surface">12건</span></div>}
                            {fieldConfig.settlement_display.return_amount && <div className="flex justify-between"><span className="text-[9px] text-on-surface-variant font-korean">반품 금액</span><span className="text-[9px] font-data text-on-surface">₩84,000</span></div>}
                            {fieldConfig.settlement_display.pickup_count && <div className="flex justify-between"><span className="text-[9px] text-on-surface-variant font-korean">집하 건수</span><span className="text-[9px] font-data text-on-surface">5건</span></div>}
                            {fieldConfig.settlement_display.pickup_amount && <div className="flex justify-between"><span className="text-[9px] text-on-surface-variant font-korean">집하 금액</span><span className="text-[9px] font-data text-on-surface">₩35,000</span></div>}
                            {fieldConfig.settlement_display.incentive_amount && <div className="flex justify-between"><span className="text-[9px] text-on-surface-variant font-korean">인센티브</span><span className="text-[9px] font-data text-tertiary">+₩740,000</span></div>}
                            {fieldConfig.settlement_display.fresh_back && <div className="flex justify-between"><span className="text-[9px] text-on-surface-variant font-korean">프레쉬백</span><span className="text-[9px] font-data text-tertiary">+₩50,000</span></div>}
                            {fieldConfig.settlement_display.supply_price && <div className="flex justify-between"><span className="text-[9px] text-on-surface-variant font-korean">공급가</span><span className="text-[9px] font-data text-on-surface">₩2,854,545</span></div>}
                            {fieldConfig.settlement_display.tax_amount && <div className="flex justify-between"><span className="text-[9px] text-on-surface-variant font-korean">세액</span><span className="text-[9px] font-data text-on-surface">₩284,455</span></div>}
                            {fieldConfig.settlement_display.total_sum && (<><div className="border-t border-outline-variant/20 mt-1 pt-1" /><div className="flex justify-between"><span className="text-[9px] font-label font-bold text-on-surface font-korean">합계</span><span className="text-[9px] font-data font-bold text-on-surface">₩3,139,000</span></div></>)}
                          </div>
                          {fieldConfig.settlement_display.deduction_detail && (
                            <div className="p-3 pt-0 space-y-1">
                              <p className="text-[9px] font-label font-bold text-on-surface font-korean mb-1">차감 내역</p>
                              <div className="flex justify-between"><span className="text-[9px] text-on-surface-variant font-korean">차량사용료</span><span className="text-[9px] font-data text-error">-₩100,000</span></div>
                              <div className="flex justify-between"><span className="text-[9px] text-on-surface-variant font-korean">고용보험</span><span className="text-[9px] font-data text-error">-₩25,560</span></div>
                              <div className="border-t border-outline-variant/20 mt-1 pt-1" />
                              <div className="flex justify-between"><span className="text-[9px] font-label font-bold text-on-surface font-korean">총 차감</span><span className="text-[9px] font-data font-bold text-error">-₩175,560</span></div>
                            </div>
                          )}
                          {fieldConfig.settlement_display.payment_amount && (
                            <div className="mx-3 mb-3 p-2.5 bg-primary/5 rounded-xl border border-primary/20">
                              <div className="flex justify-between items-center">
                                <span className="text-[9px] font-label font-bold text-on-surface font-korean">최종 지급액</span>
                                <span className="text-sm font-data font-bold text-primary">₩2,840,000</span>
                              </div>
                            </div>
                          )}
                        </>
                      )}

                      {/* 간편+세부 모드: 요약 상단 + 세부내역 하단 */}
                      {fieldConfig.settlement_view_mode === 'simple_detail' && (
                        <>
                          <div className="p-3 space-y-1.5">
                            <div className="flex justify-between"><span className="text-[9px] text-on-surface-variant font-korean">배송</span><span className="text-[9px] font-data text-on-surface">342건 · ₩2,200,000</span></div>
                            <div className="flex justify-between"><span className="text-[9px] text-on-surface-variant font-korean">총 수입</span><span className="text-[9px] font-data font-bold text-on-surface">₩3,139,000</span></div>
                            <div className="flex justify-between"><span className="text-[9px] text-on-surface-variant font-korean">총 차감</span><span className="text-[9px] font-data font-bold text-error">-₩299,000</span></div>
                            <div className="mx-0 my-1 p-2 bg-primary/5 rounded-lg border border-primary/20">
                              <div className="flex justify-between items-center">
                                <span className="text-[9px] font-bold text-on-surface font-korean">지급액</span>
                                <span className="text-xs font-data font-bold text-primary">₩2,840,000</span>
                              </div>
                            </div>
                          </div>
                          <div className="p-3 pt-0 border-t border-outline-variant/10">
                            <p className="text-[8px] font-label font-semibold text-on-surface-variant font-korean mt-2 mb-1.5">세부내역</p>
                            {fieldConfig.settlement_display.delivery_count && <div className="flex justify-between"><span className="text-[8px] text-on-surface-variant/70 font-korean">배송 건수</span><span className="text-[8px] font-data text-on-surface-variant">342건</span></div>}
                            {fieldConfig.settlement_display.delivery_amount && <div className="flex justify-between"><span className="text-[8px] text-on-surface-variant/70 font-korean">배송 금액</span><span className="text-[8px] font-data text-on-surface-variant">₩2,200,000</span></div>}
                            {fieldConfig.settlement_display.return_count && <div className="flex justify-between"><span className="text-[8px] text-on-surface-variant/70 font-korean">반품</span><span className="text-[8px] font-data text-on-surface-variant">12건 · ₩84,000</span></div>}
                            {fieldConfig.settlement_display.incentive_amount && <div className="flex justify-between"><span className="text-[8px] text-on-surface-variant/70 font-korean">인센티브</span><span className="text-[8px] font-data text-tertiary/70">+₩740,000</span></div>}
                            {fieldConfig.settlement_display.supply_price && <div className="flex justify-between"><span className="text-[8px] text-on-surface-variant/70 font-korean">공급가</span><span className="text-[8px] font-data text-on-surface-variant">₩2,854,545</span></div>}
                            {fieldConfig.settlement_display.tax_amount && <div className="flex justify-between"><span className="text-[8px] text-on-surface-variant/70 font-korean">세액</span><span className="text-[8px] font-data text-on-surface-variant">₩284,455</span></div>}
                            {fieldConfig.settlement_display.deduction_detail && (
                              <>
                                <p className="text-[8px] font-label font-semibold text-on-surface-variant font-korean mt-1.5 mb-1">차감 상세</p>
                                <div className="flex justify-between"><span className="text-[8px] text-on-surface-variant/70 font-korean">차량사용료</span><span className="text-[8px] font-data text-error/70">-₩100,000</span></div>
                                <div className="flex justify-between"><span className="text-[8px] text-on-surface-variant/70 font-korean">고용보험</span><span className="text-[8px] font-data text-error/70">-₩25,560</span></div>
                              </>
                            )}
                          </div>
                        </>
                      )}
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* ── Section 4: 설정 미리보기 (요약 태그) ── */}
          <div>
            <div className="flex items-center gap-2 mb-4">
              <div className="w-6 h-6 rounded-md bg-primary/10 text-primary flex items-center justify-center text-xs font-bold">4</div>
              <h3 className="text-sm font-headline font-bold text-on-surface font-korean">설정 미리보기</h3>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="bg-surface-container-low/60 rounded-xl p-4 space-y-2">
                <p className="text-xs font-semibold text-on-surface-variant font-korean">엑셀 업로드 칼럼</p>
                <div className="flex gap-1.5 flex-wrap">
                  {previewHeaders.length > 0 ? previewHeaders.map((h) => (
                    <span key={h} className="px-2.5 py-1 rounded-lg bg-primary/10 text-primary text-[11px] font-data font-medium">{h}</span>
                  )) : (
                    <span className="text-xs text-on-surface-variant/50 font-korean">정산 항목을 선택하세요</span>
                  )}
                </div>
              </div>
              <div className="bg-surface-container-low/60 rounded-xl p-4 space-y-2">
                <p className="text-xs font-semibold text-on-surface-variant font-korean">기사 등록 시 입력 필드</p>
                <div className="flex gap-1.5 flex-wrap">
                  {getUnitPriceFields(fieldConfig).length > 0 ? getUnitPriceFields(fieldConfig).map((f) => (
                    <span key={f.key} className="px-2.5 py-1 rounded-lg bg-tertiary/10 text-tertiary text-[11px] font-data font-medium">{f.label}</span>
                  )) : (
                    <span className="text-xs text-on-surface-variant/50 font-korean">해당 없음</span>
                  )}
                </div>
              </div>
              <div className="bg-surface-container-low/60 rounded-xl p-4 space-y-2 sm:col-span-2">
                <p className="text-xs font-semibold text-on-surface-variant font-korean">차감 항목</p>
                <div className="flex gap-1.5 flex-wrap">
                  {(() => {
                    const ds = fieldConfig.deduction_section;
                    const tags: { label: string; detail: string }[] = [];
                    if (ds.employment_insurance.enabled) tags.push({ label: '고용보험', detail: ds.employment_insurance.split_mode === 'split_50_50' ? '50:50' : '사용자100%' });
                    if (ds.industrial_insurance.enabled) tags.push({ label: '산재보험', detail: ds.industrial_insurance.split_mode === 'split_50_50' ? '50:50' : '사용자100%' });
                    if (ds.cargo_accident.enabled) tags.push({ label: '화물사고', detail: ({ actual_cost: '실비', fixed_amount: '고정액', percentage: '%차감' } as Record<string,string>)[ds.cargo_accident.mode] });
                    if (ds.vehicle_rental.enabled) tags.push({ label: '차량임대료', detail: '월고정' });
                    if (ds.waybill.enabled) {
                      const parts: string[] = [];
                      if (ds.waybill.return_count_price) parts.push('반품');
                      if (ds.waybill.pickup_count_price) parts.push('집하');
                      if (ds.waybill.box_type_price) parts.push('박스별');
                      tags.push({ label: '운송장', detail: parts.join('+') || '미선택' });
                    }
                    return tags.length > 0 ? tags.map((t) => (
                      <span key={t.label} className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg bg-error/10 text-error text-[11px] font-data font-medium">
                        {t.label}<span className="text-error/50">·</span>{t.detail}
                      </span>
                    )) : (
                      <span className="text-xs text-on-surface-variant/50 font-korean">차감 항목 미설정</span>
                    );
                  })()}
                </div>
              </div>
            </div>
          </div>

          {/* ── Actions ── */}
          <div className="flex justify-end gap-3 pt-2 border-t border-outline-variant/10">
            <button
              onClick={() => router.back()}
              className="h-11 px-6 rounded-xl bg-surface-container-high text-on-surface-variant font-label text-sm hover:bg-surface-container-highest transition-colors font-korean"
            >
              취소
            </button>
            <button
              onClick={handleSave}
              disabled={saving || !principalName.trim()}
              className="h-11 px-8 rounded-xl bg-power-gradient text-white font-label font-semibold text-sm hover:shadow-lg transition-shadow disabled:opacity-50 font-korean flex items-center gap-2"
            >
              {saving ? (
                <>
                  <svg className="w-4 h-4 animate-spin" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M21 12a9 9 0 1 1-6.219-8.56"/></svg>
                  저장 중...
                </>
              ) : '설정 저장'}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
