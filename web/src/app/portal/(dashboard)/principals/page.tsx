'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { toastError, toastWarning } from '@/components/shared/Toast';
import { formatPhoneNumber } from '@/lib/formatters';
import { createBrowserSupabaseClient } from '@/lib/supabase';
import {
  getPrincipals,
  createPrincipal,
  deletePrincipal,
  type Principal,
  type FieldConfig,
  type ItemType,
  type RateMode,
  type AdditionalItemType,
  type SettlementDisplayConfig,
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
export default function PrincipalsPage() {
  const [principals, setPrincipals] = useState<Principal[]>([]);
  const [loading, setLoading] = useState(true);
  const [agencyId, setAgencyId] = useState<string | null>(null);
  const [showForm, setShowForm] = useState(false);
  const [saving, setSaving] = useState(false);

  /* ── Form state ── */
  const [companyName, setCompanyName] = useState(COMPANY_OPTIONS[0] as string);
  const [isCustomCompany, setIsCustomCompany] = useState(false);
  const [branchName, setBranchName] = useState('');
  const [contactName, setContactName] = useState('');
  const [contactPhone, setContactPhone] = useState('');
  const [fieldConfig, setFieldConfig] = useState<FieldConfig>({ ...DEFAULT_FIELD_CONFIG });

  useEffect(() => {
    async function load() {
      const supabase = createBrowserSupabaseClient();
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;
      const aid = user.app_metadata?.agency_id as string | undefined;
      if (!aid) return;
      setAgencyId(aid);
      const result = await getPrincipals(aid);
      if (result.data) setPrincipals(result.data);
      setLoading(false);
    }
    load();
  }, []);

  function resetForm() {
    setCompanyName(COMPANY_OPTIONS[0] as string);
    setIsCustomCompany(false);
    setBranchName('');
    setContactName('');
    setContactPhone('');
    setFieldConfig({ ...DEFAULT_FIELD_CONFIG });
    setShowForm(false);
  }

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

  async function handleCreate() {
    if (!agencyId || !companyName.trim() || !branchName.trim()) {
      toastWarning('본사(카테고리)와 대리점명은 필수입니다.');
      return;
    }
    setSaving(true);
    try {
      const name = `${companyName.trim()} ${branchName.trim()}`;
      const headers = buildExcelHeaders(fieldConfig);
      const excelConfig = {
        columns: headers.map((h, i) => ({
          key: h.replace(/[^a-zA-Z0-9가-힣]/g, '_').toLowerCase(),
          label: h,
          excel_col: String.fromCharCode(65 + i),
        })),
      };

      const memoWithContact = [
        contactName && `담당: ${contactName}`,
        contactPhone && `연락처: ${contactPhone}`,
      ].filter(Boolean).join(' | ');

      const result = await createPrincipal({
        agency_id: agencyId,
        name,
        rate_type: 'fixed',
        memo: memoWithContact || undefined,
        field_config: fieldConfig,
        excel_config: excelConfig,
      });

      if (result.data) {
        setPrincipals((prev) => [...prev, result.data!]);
        resetForm();
      } else {
        const refreshed = await getPrincipals(agencyId);
        if (refreshed.data) setPrincipals(refreshed.data);
        resetForm();
      }
    } catch (e) {
      toastError('카테고리 생성 오류: ' + (e instanceof Error ? e.message : String(e)));
    }
    setSaving(false);
  }

  async function handleDelete(id: string, name: string) {
    if (!confirm(`"${name}" 카테고리를 삭제하시겠습니까?\n배송단가, 차감항목 등 모든 설정이 함께 삭제됩니다.`)) return;
    const result = await deletePrincipal(id);
    if (!result.error) {
      setPrincipals((prev) => prev.filter((p) => p.id !== id));
    }
  }

  const inputCls = 'w-full h-11 px-4 rounded-xl bg-surface-container-low text-on-surface text-sm font-korean focus:outline-none focus:ring-2 focus:ring-primary/30 placeholder:text-on-surface-variant/40';
  const labelCls = 'block text-xs font-label font-medium text-on-surface-variant mb-1.5 font-korean';

  function itemSummary(fc: FieldConfig): string {
    const parts: string[] = [];
    const types: ItemType[] = ['delivery', 'return', 'pickup'];
    const modeLabels: Record<RateMode, string> = {
      unit_price: '단가',
      percentage: '요율%',
      fixed_salary: '고정급여',
      mixed_count: '배송+반품 단가',
    };
    for (const t of types) {
      const cfg = fc.items[t];
      if (cfg?.enabled) {
        parts.push(`${ITEM_LABELS[t]}(${modeLabels[cfg.rate_mode] ?? cfg.rate_mode})`);
      }
    }
    return parts.join(' · ') || '항목 미설정';
  }

  const previewHeaders = buildExcelHeaders(fieldConfig);

  return (
    <div className="space-y-8">
      {/* ═══ Header ═══ */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-headline font-bold text-on-surface font-korean">카테고리 설정</h1>
          <p className="mt-1 text-sm text-on-surface-variant font-korean">
            거래처(본사)별 정산 항목과 계산 방식을 설정합니다
          </p>
        </div>
        <button
          onClick={() => setShowForm(true)}
          className="bg-power-gradient text-white px-5 py-2.5 rounded-xl font-label font-semibold text-sm hover:shadow-lg transition-shadow flex items-center gap-2"
        >
          <svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor">
            <path d="M19 13h-6v6h-2v-6H5v-2h6V5h2v6h6v2z" />
          </svg>
          <span className="font-korean">카테고리 추가</span>
        </button>
      </div>

      {/* ═══════════════════════ Creation Form ═══════════════════════ */}
      {showForm && (
        <div className="bg-surface-container-lowest rounded-2xl shadow-ambient overflow-hidden">
          {/* Form Header */}
          <div className="bg-primary/[0.04] border-b border-outline-variant/10 px-6 py-5">
            <h2 className="text-lg font-headline font-bold text-on-surface font-korean">새 카테고리 등록</h2>
            <p className="text-xs text-on-surface-variant mt-1 font-korean">
              본사를 선택하고 정산 방식을 설정하면, 기사 등록과 엑셀 양식이 자동 생성됩니다.
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
                {/* 본사 선택 */}
                <div>
                  <label className={labelCls}>본사 (카테고리) *</label>
                  {isCustomCompany ? (
                    <div className="flex gap-2">
                      <input
                        type="text"
                        placeholder="본사명 직접 입력"
                        value={companyName}
                        onChange={(e) => setCompanyName(e.target.value)}
                        className={inputCls}
                      />
                      <button
                        onClick={() => { setIsCustomCompany(false); setCompanyName(COMPANY_OPTIONS[0] as string); }}
                        className="shrink-0 h-11 px-3 rounded-xl bg-surface-container-high text-on-surface-variant text-xs hover:bg-surface-container-highest transition-colors font-korean"
                      >
                        목록
                      </button>
                    </div>
                  ) : (
                    <div className="flex gap-2">
                      <select
                        value={companyName}
                        onChange={(e) => setCompanyName(e.target.value)}
                        className={inputCls}
                      >
                        {COMPANY_OPTIONS.map((c) => (
                          <option key={c} value={c}>{c}</option>
                        ))}
                      </select>
                      <button
                        onClick={() => { setIsCustomCompany(true); setCompanyName(''); }}
                        className="shrink-0 h-11 px-3 rounded-xl bg-surface-container-high text-on-surface-variant text-xs hover:bg-surface-container-highest transition-colors font-korean"
                      >
                        직접입력
                      </button>
                    </div>
                  )}
                </div>

                {/* 대리점명 */}
                <div>
                  <label className={labelCls}>대리점명 *</label>
                  <input type="text" placeholder="예) 안산일동대리점" value={branchName} onChange={(e) => setBranchName(e.target.value)} className={inputCls} />
                </div>

                {/* 담당자 */}
                <div>
                  <label className={labelCls}>담당자</label>
                  <input type="text" placeholder="담당자 이름" value={contactName} onChange={(e) => setContactName(e.target.value)} className={inputCls} />
                </div>

                {/* 전화번호 */}
                <div>
                  <label className={labelCls}>전화번호</label>
                  <input type="tel" placeholder="010-0000-0000" value={contactPhone} onChange={(e) => setContactPhone(formatPhoneNumber(e.target.value))} maxLength={13} className={inputCls} />
                </div>

              </div>

              {/* 부가세 설정 */}
              <div className="mt-5">
                <label className={labelCls}>부가세 기준</label>
                <div className="flex gap-3 mt-1">
                  {VAT_MODE_OPTIONS.map((opt) => (
                    <div
                      key={opt.value}
                      role="radio"
                      aria-checked={fieldConfig.vat_mode === opt.value}
                      onClick={() => setFieldConfig((fc) => ({ ...fc, vat_mode: opt.value }))}
                      className={`flex items-center gap-2.5 flex-1 p-3 rounded-xl cursor-pointer transition-all border ${
                        fieldConfig.vat_mode === opt.value
                          ? 'border-primary/40 bg-primary/[0.04]'
                          : 'border-outline-variant/15 hover:bg-surface-container-low'
                      }`}
                    >
                      <div className="shrink-0">
                        <div
                          className={`w-[18px] h-[18px] rounded-full border-2 flex items-center justify-center transition-colors ${
                            fieldConfig.vat_mode === opt.value ? 'border-primary' : 'border-outline-variant'
                          }`}
                        >
                          {fieldConfig.vat_mode === opt.value && <div className="w-2.5 h-2.5 rounded-full bg-primary" />}
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
            </div>

            {/* ── Section 2: 정산 항목 설정 ── */}
            <div>
              <div className="flex items-center gap-2 mb-2">
                <div className="w-6 h-6 rounded-md bg-primary/10 text-primary flex items-center justify-center text-xs font-bold">2</div>
                <h3 className="text-sm font-headline font-bold text-on-surface font-korean">정산 항목 설정</h3>
              </div>
              <p className="text-xs text-on-surface-variant mb-5 font-korean ml-8">
                수익 항목별로 사용 여부를 켜고, 계산 방식을 선택하세요. 기사별 단가는 기사 등록 시 개별 입력합니다.
              </p>

              <div className="space-y-5">
                {/* ── 배송 ── */}
                <div className="rounded-2xl border border-outline-variant/15 overflow-hidden">
                  <SectionToggle
                    enabled={fieldConfig.items.delivery.enabled}
                    onToggle={() => toggleItem('delivery')}
                    label="배송"
                    icon={TruckIcon}
                  />
                  {fieldConfig.items.delivery.enabled && (
                    <div className="px-4 pb-4 pt-2 bg-surface-container-lowest space-y-1">
                      <p className="text-[10px] text-on-surface-variant/60 font-korean mb-2 ml-1">계산 방식 선택</p>
                      {DELIVERY_RATE_OPTIONS.map((opt) => (
                        <RadioOption
                          key={opt.value}
                          checked={fieldConfig.items.delivery.rate_mode === opt.value}
                          onChange={() => setRateMode('delivery', opt.value)}
                          label={opt.label}
                          desc={opt.desc}
                        />
                      ))}
                    </div>
                  )}
                </div>

                {/* ── 반품 ── */}
                <div className="rounded-2xl border border-outline-variant/15 overflow-hidden">
                  <SectionToggle
                    enabled={fieldConfig.items.return.enabled}
                    onToggle={() => toggleItem('return')}
                    label="반품"
                    icon={ReturnIcon}
                  />
                  {fieldConfig.items.return.enabled && (
                    <div className="px-4 pb-4 pt-2 bg-surface-container-lowest space-y-1">
                      <p className="text-[10px] text-on-surface-variant/60 font-korean mb-2 ml-1">계산 방식 선택</p>
                      {RETURN_RATE_OPTIONS.map((opt) => (
                        <RadioOption
                          key={opt.value}
                          checked={fieldConfig.items.return.rate_mode === opt.value}
                          onChange={() => setRateMode('return', opt.value)}
                          label={opt.label}
                          desc={opt.desc}
                        />
                      ))}
                    </div>
                  )}
                </div>

                {/* ── 집하 ── */}
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
                <div className="mt-4 pt-4 border-t border-outline-variant/10">
                  <div className="flex items-center gap-2 mb-3 ml-1">
                    <div className="text-tertiary">{GiftIcon}</div>
                    <p className="text-xs font-semibold text-on-surface font-korean">부가항목 (추가 수익)</p>
                    <p className="text-[10px] text-on-surface-variant/50 font-korean">— 해당되는 항목을 선택하세요</p>
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
            </div>

            {/* ── Section 3: 차감 항목 설정 ── */}
            <div>
              <div className="flex items-center gap-2 mb-2">
                <div className="w-6 h-6 rounded-md bg-error/10 text-error flex items-center justify-center text-xs font-bold">3</div>
                <h3 className="text-sm font-headline font-bold text-on-surface font-korean">차감 항목 설정</h3>
              </div>
              <p className="text-xs text-on-surface-variant mb-5 font-korean ml-8">
                기사 정산 시 차감되는 항목을 설정합니다. 기사별 세부 금액은 기사 등록 시 개별 입력합니다.
              </p>

              <div className="space-y-5">
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
                        월 고정금액으로 차감됩니다. 기사별 임대료는 기사 등록 시 개별 입력합니다.
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
                      <p className="text-[10px] text-on-surface-variant/60 font-korean mb-2 ml-1">적용 항목 선택 (복수 선택 가능)</p>
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

                {/* ── 커스텀 차감항목 안내 ── */}
                <div className="rounded-2xl border border-dashed border-outline-variant/25 p-4 text-center">
                  <p className="text-xs text-on-surface-variant/60 font-korean">
                    추가 차감항목 (공제금, 유류비 등)은 카테고리 생성 후
                    <span className="text-error font-semibold"> 변경</span> 메뉴에서 자유롭게 추가할 수 있습니다.
                  </p>
                </div>
              </div>
            </div>

            {/* ── Section 4: 정산서 노출항목 설정 ── */}
            <div>
              <div className="flex items-center gap-2 mb-2">
                <div className="w-6 h-6 rounded-md bg-tertiary/10 text-tertiary flex items-center justify-center text-xs font-bold">4</div>
                <h3 className="text-sm font-headline font-bold text-on-surface font-korean">정산서 노출항목 설정</h3>
              </div>
              <p className="text-xs text-on-surface-variant mb-5 font-korean ml-8">
                기사 앱에서 정산 내역이 어떻게 표시될지 설정합니다.
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
                        <div
                          key={opt.value}
                          role="radio"
                          aria-checked={fieldConfig.settlement_view_mode === opt.value}
                          onClick={() => setFieldConfig((fc) => ({ ...fc, settlement_view_mode: opt.value }))}
                          className={`flex items-center gap-2.5 p-3 rounded-xl cursor-pointer transition-all border ${
                            fieldConfig.settlement_view_mode === opt.value
                              ? 'border-tertiary/40 bg-tertiary/[0.04]'
                              : 'border-outline-variant/15 hover:bg-surface-container-low'
                          }`}
                        >
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
                    <p className="text-[11px] text-on-surface-variant/60 font-korean -mt-2">
                      기사에게 보여질 정산서 항목을 선택하세요.
                    </p>

                    {SETTLEMENT_DISPLAY_GROUPS.map((group) => (
                      <div key={group.title}>
                        <p className="text-[10px] font-bold text-on-surface-variant/50 uppercase tracking-wider font-korean mb-2">{group.title}</p>
                        <div className="flex flex-wrap gap-2">
                          {group.keys.map((key) => {
                            const checked = fieldConfig.settlement_display[key];
                            return (
                              <button
                                key={key}
                                type="button"
                                onClick={() =>
                                  setFieldConfig((fc) => ({
                                    ...fc,
                                    settlement_display: { ...fc.settlement_display, [key]: !fc.settlement_display[key] },
                                  }))
                                }
                                className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium font-korean transition-all border ${
                                  checked
                                    ? 'border-tertiary/30 bg-tertiary/10 text-tertiary'
                                    : 'border-outline-variant/15 bg-surface-container-low text-on-surface-variant/60 hover:border-outline-variant/30'
                                }`}
                              >
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
                          <p className="text-[10px] text-on-surface-variant font-korean mt-0.5">{companyName} {branchName || '카테고리'}</p>
                          <p className="text-lg font-data font-bold text-primary mt-2">₩2,840,000</p>
                          <p className="text-[8px] text-on-surface-variant font-korean mt-0.5">지급액</p>
                        </div>

                        {/* 간편 모드 */}
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

                        {/* 상세 모드 */}
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

                        {/* 간편+세부 모드 */}
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

            {/* ── 요율 방향 안내 ── */}
            {(['delivery', 'return', 'pickup'] as ItemType[]).some(
              (t) => fieldConfig.items[t]?.enabled && fieldConfig.items[t]?.rate_mode === 'percentage'
            ) && (
              <div className="bg-secondary/[0.06] rounded-xl p-4 border border-secondary/15">
                <div className="flex items-start gap-2">
                  <svg className="w-4 h-4 text-secondary shrink-0 mt-0.5" viewBox="0 0 24 24" fill="currentColor"><path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm1 15h-2v-6h2v6zm0-8h-2V7h2v2z"/></svg>
                  <div>
                    <p className="text-xs font-bold text-secondary font-korean">요율 방향: 차감 기준</p>
                    <p className="text-[11px] text-on-surface-variant font-korean mt-0.5">
                      수수료 10% = 본사가 매출의 10%를 차감, 기사는 90%를 수령합니다.
                    </p>
                  </div>
                </div>
              </div>
            )}

            {/* ── Section 5: 미리보기 ── */}
            <div>
              <div className="flex items-center gap-2 mb-4">
                <div className="w-6 h-6 rounded-md bg-primary/10 text-primary flex items-center justify-center text-xs font-bold">5</div>
                <h3 className="text-sm font-headline font-bold text-on-surface font-korean">설정 미리보기</h3>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                {/* 엑셀 양식 */}
                <div className="bg-surface-container-low/60 rounded-xl p-4 space-y-2">
                  <p className="text-xs font-semibold text-on-surface-variant font-korean flex items-center gap-1.5">
                    <svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor" className="text-tertiary"><path d="M19 3H5c-1.1 0-2 .9-2 2v14c0 1.1.9 2 2 2h14c1.1 0 2-.9 2-2V5c0-1.1-.9-2-2-2zm-2.5 7.5h-3v3h-3v-3h-3V8h3V5h3v3h3v2.5z"/></svg>
                    엑셀 업로드 칼럼
                  </p>
                  <div className="flex gap-1.5 flex-wrap">
                    {previewHeaders.length > 0 ? previewHeaders.map((h) => (
                      <span key={h} className="px-2.5 py-1 rounded-lg bg-primary/10 text-primary text-[11px] font-data font-medium">{h}</span>
                    )) : (
                      <span className="text-xs text-on-surface-variant/50 font-korean">정산 항목을 선택하세요</span>
                    )}
                  </div>
                </div>

                {/* 기사 단가 입력 필드 */}
                <div className="bg-surface-container-low/60 rounded-xl p-4 space-y-2">
                  <p className="text-xs font-semibold text-on-surface-variant font-korean flex items-center gap-1.5">
                    <svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor" className="text-tertiary"><path d="M12 12c2.21 0 4-1.79 4-4s-1.79-4-4-4-4 1.79-4 4 1.79 4 4 4zm0 2c-2.67 0-8 1.34-8 4v2h16v-2c0-2.66-5.33-4-8-4z"/></svg>
                    기사 등록 시 입력 필드
                  </p>
                  <div className="flex gap-1.5 flex-wrap">
                    {getUnitPriceFields(fieldConfig).length > 0 ? getUnitPriceFields(fieldConfig).map((f) => (
                      <span key={f.key} className="px-2.5 py-1 rounded-lg bg-tertiary/10 text-tertiary text-[11px] font-data font-medium">{f.label}</span>
                    )) : (
                      <span className="text-xs text-on-surface-variant/50 font-korean">해당 없음</span>
                    )}
                  </div>
                </div>

                {/* 부가항목 요약 */}
                <div className="bg-surface-container-low/60 rounded-xl p-4 space-y-2">
                  <p className="text-xs font-semibold text-on-surface-variant font-korean flex items-center gap-1.5">
                    <svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor" className="text-tertiary/70"><path d="M20 12v10H4V12h16m2-2H2v14h20V10zM12 7h4.5a2.5 2.5 0 0 0 0-5C13 2 12 7 12 7zm0 0H7.5a2.5 2.5 0 0 1 0-5C11 2 12 7 12 7z"/></svg>
                    부가항목
                  </p>
                  <div className="flex gap-1.5 flex-wrap">
                    {(() => {
                      const ai = fieldConfig.additional_items;
                      const enabled = (Object.keys(ai) as AdditionalItemType[]).filter((k) => ai[k].enabled);
                      return enabled.length > 0 ? enabled.map((k) => (
                        <span key={k} className="px-2.5 py-1 rounded-lg bg-tertiary/10 text-tertiary text-[11px] font-data font-medium">
                          {ADDITIONAL_ITEM_LABELS[k]}
                        </span>
                      )) : (
                        <span className="text-xs text-on-surface-variant/50 font-korean">부가항목 미설정</span>
                      );
                    })()}
                  </div>
                </div>

                {/* 차감항목 요약 */}
                <div className="bg-surface-container-low/60 rounded-xl p-4 space-y-2 sm:col-span-2">
                  <p className="text-xs font-semibold text-on-surface-variant font-korean flex items-center gap-1.5">
                    <svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor" className="text-error/70"><path d="M19 13H5v-2h14v2z"/></svg>
                    차감 항목
                  </p>
                  <div className="flex gap-1.5 flex-wrap">
                    {(() => {
                      const ds = fieldConfig.deduction_section;
                      const tags: { label: string; detail: string }[] = [];
                      if (ds.employment_insurance.enabled) {
                        tags.push({
                          label: '고용보험',
                          detail: ds.employment_insurance.split_mode === 'split_50_50' ? '50:50' : '사용자100%',
                        });
                      }
                      if (ds.industrial_insurance.enabled) {
                        tags.push({
                          label: '산재보험',
                          detail: ds.industrial_insurance.split_mode === 'split_50_50' ? '50:50' : '사용자100%',
                        });
                      }
                      if (ds.cargo_accident.enabled) {
                        const modeLabel = { actual_cost: '실비', fixed_amount: '고정액', percentage: '%차감' }[ds.cargo_accident.mode];
                        tags.push({ label: '화물사고', detail: modeLabel });
                      }
                      if (ds.vehicle_rental.enabled) {
                        tags.push({ label: '차량임대료', detail: '월고정' });
                      }
                      if (ds.waybill.enabled) {
                        const parts: string[] = [];
                        if (ds.waybill.return_count_price) parts.push('반품');
                        if (ds.waybill.pickup_count_price) parts.push('집하');
                        if (ds.waybill.box_type_price) parts.push('박스별');
                        tags.push({ label: '운송장', detail: parts.join('+') || '미선택' });
                      }
                      return tags.length > 0 ? tags.map((t) => (
                        <span key={t.label} className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg bg-error/10 text-error text-[11px] font-data font-medium">
                          {t.label}
                          <span className="text-error/50">·</span>
                          {t.detail}
                        </span>
                      )) : (
                        <span className="text-xs text-on-surface-variant/50 font-korean">차감 항목 미설정</span>
                      );
                    })()}
                  </div>
                </div>
                {/* 정산서 보기 요약 */}
                <div className="bg-surface-container-low/60 rounded-xl p-4 space-y-2 sm:col-span-2">
                  <p className="text-xs font-semibold text-on-surface-variant font-korean flex items-center gap-1.5">
                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" className="text-tertiary"><rect x="3" y="3" width="18" height="18" rx="2"/><path d="M3 9h18"/><path d="M9 21V9"/></svg>
                    정산서 보기 설정
                  </p>
                  <div className="flex gap-1.5 flex-wrap">
                    <span className="px-2.5 py-1 rounded-lg bg-secondary/10 text-secondary text-[11px] font-data font-medium">
                      {VAT_MODE_OPTIONS.find((o) => o.value === fieldConfig.vat_mode)?.label ?? '부가세 포함'}
                    </span>
                    <span className="px-2.5 py-1 rounded-lg bg-tertiary/10 text-tertiary text-[11px] font-data font-medium">
                      표시항목 전체 선택
                    </span>
                    <span className="px-2 py-1 rounded-lg bg-surface-container-high text-on-surface-variant text-[10px] font-data font-korean">
                      상세 설정에서 변경 가능
                    </span>
                  </div>
                </div>
              </div>
            </div>

            {/* ── Actions ── */}
            <div className="flex justify-end gap-3 pt-2 border-t border-outline-variant/10">
              <button
                onClick={resetForm}
                className="h-11 px-6 rounded-xl bg-surface-container-high text-on-surface-variant font-label text-sm hover:bg-surface-container-highest transition-colors font-korean"
              >
                취소
              </button>
              <button
                onClick={handleCreate}
                disabled={saving || !companyName.trim() || !branchName.trim()}
                className="h-11 px-8 rounded-xl bg-power-gradient text-white font-label font-semibold text-sm hover:shadow-lg transition-shadow disabled:opacity-50 font-korean flex items-center gap-2"
              >
                {saving ? (
                  <>
                    <svg className="w-4 h-4 animate-spin" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M21 12a9 9 0 1 1-6.219-8.56"/></svg>
                    생성 중...
                  </>
                ) : '카테고리 생성'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ═══════════════════════ Principal Cards ═══════════════════════ */}
      {loading ? (
        <div className="bg-surface-container-lowest rounded-2xl shadow-ambient p-12 text-center">
          <span className="text-sm text-on-surface-variant font-korean">불러오는 중...</span>
        </div>
      ) : principals.length === 0 ? (
        <div className="bg-surface-container-lowest rounded-2xl shadow-ambient p-12 text-center space-y-3">
          <div className="w-16 h-16 rounded-2xl bg-primary/[0.06] flex items-center justify-center mx-auto mb-4">
            <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" className="text-primary">
              <path d="M21 8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16Z" strokeLinecap="round" strokeLinejoin="round" />
              <path d="m3.3 7 8.7 5 8.7-5" strokeLinecap="round" strokeLinejoin="round" /><path d="M12 22V12" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
          </div>
          <p className="text-base font-semibold text-on-surface font-korean">등록된 카테고리가 없습니다</p>
          <p className="text-sm text-on-surface-variant font-korean">
            &quot;카테고리 추가&quot;를 눌러 거래처별 정산 설정을 시작하세요.
          </p>
          <button
            onClick={() => setShowForm(true)}
            className="mt-2 inline-flex items-center gap-2 h-10 px-5 rounded-xl bg-primary/10 text-primary text-sm font-semibold hover:bg-primary/20 transition-colors font-korean"
          >
            <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor"><path d="M19 13h-6v6h-2v-6H5v-2h6V5h2v6h6v2z"/></svg>
            첫 카테고리 만들기
          </button>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
          {principals.map((p) => {
            const fc = normalizeFieldConfig(p.field_config);
            return (
              <div key={p.id} className="bg-surface-container-lowest rounded-2xl shadow-ambient p-6 hover:shadow-float transition-shadow">
                <div className="flex items-start justify-between">
                  <div className="flex-1 min-w-0">
                    <h3 className="text-base font-headline font-bold text-on-surface font-korean truncate">{p.name}</h3>
                    {p.delivery_area && (
                      <p className="mt-1.5 text-sm text-on-surface-variant font-korean flex items-center gap-1.5">
                        <svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor" className="shrink-0 text-on-surface-variant/50">
                          <path d="M12 2C8.13 2 5 5.13 5 9c0 5.25 7 13 7 13s7-7.75 7-13c0-3.87-3.13-7-7-7zm0 9.5c-1.38 0-2.5-1.12-2.5-2.5s1.12-2.5 2.5-2.5 2.5 1.12 2.5 2.5-1.12 2.5-2.5 2.5z" />
                        </svg>
                        {p.delivery_area}
                      </p>
                    )}
                    <div className="flex flex-wrap gap-1.5 mt-2.5">
                      {(['delivery', 'return', 'pickup'] as ItemType[]).map((t) => {
                        const cfg = fc.items[t];
                        if (!cfg?.enabled) return null;
                        const modeLabels: Record<string, string> = {
                          unit_price: '단가',
                          percentage: '요율%',
                          fixed_salary: '고정급여',
                          mixed_count: '배송+반품',
                        };
                        return (
                          <span key={t} className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md bg-primary/[0.08] text-primary text-[11px] font-medium font-korean">
                            {ITEM_LABELS[t]}
                            <span className="text-primary/60">·</span>
                            {modeLabels[cfg.rate_mode] ?? cfg.rate_mode}
                          </span>
                        );
                      })}
                    </div>
                    {/* 차감 배지 */}
                    {(() => {
                      const ds = fc.deduction_section;
                      if (!ds) return null;
                      const deductLabels: string[] = [];
                      if (ds.employment_insurance?.enabled) deductLabels.push('고용보험');
                      if (ds.industrial_insurance?.enabled) deductLabels.push('산재보험');
                      if (ds.cargo_accident?.enabled) deductLabels.push('화물사고');
                      if (ds.vehicle_rental?.enabled) deductLabels.push('차량임대');
                      if (ds.waybill?.enabled) deductLabels.push('운송장');
                      if (deductLabels.length === 0) return null;
                      return (
                        <div className="flex flex-wrap gap-1.5 mt-1.5">
                          {deductLabels.map((dl) => (
                            <span key={dl} className="inline-flex items-center px-2 py-0.5 rounded-md bg-error/[0.08] text-error text-[11px] font-medium font-korean">
                              {dl}
                            </span>
                          ))}
                        </div>
                      );
                    })()}
                    {p.memo && <p className="mt-2 text-xs text-on-surface-variant/60 font-korean">{p.memo}</p>}
                  </div>
                </div>

                <div className="flex items-center justify-between mt-5 pt-4 border-t border-outline-variant/15">
                  <span className="text-xs text-on-surface-variant/40 font-data">
                    {new Date(p.created_at).toLocaleDateString('ko-KR')}
                  </span>
                  <div className="flex items-center gap-2">
                    <button
                      onClick={() => handleDelete(p.id, p.name)}
                      className="h-8 px-3 rounded-lg text-xs font-label text-error hover:bg-error/10 transition-colors font-korean"
                    >
                      삭제
                    </button>
                    <Link
                      href={`/portal/principals/${p.id}`}
                      className="h-8 px-4 rounded-lg bg-primary/10 text-primary text-xs font-label font-semibold hover:bg-primary/20 transition-colors flex items-center gap-1 font-korean"
                    >
                      변경
                      <svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor"><path d="M10 6L8.59 7.41 13.17 12l-4.58 4.59L10 18l6-6z"/></svg>
                    </Link>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
