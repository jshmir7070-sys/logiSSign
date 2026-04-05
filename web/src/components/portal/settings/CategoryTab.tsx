'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import {
  getPrincipals,
  createPrincipal,
  updatePrincipal,
  deletePrincipal,
  type Principal,
  type FieldConfig,
  type ItemType,
  type RateMode,
  type AdditionalItemType,
  ADDITIONAL_ITEM_LABELS,
  ADDITIONAL_ITEM_DESCS,
  DEFAULT_FIELD_CONFIG,
  normalizeFieldConfig,
  DELIVERY_RATE_OPTIONS,
  PICKUP_RATE_OPTIONS,
  INSURANCE_SPLIT_OPTIONS,
  CARGO_ACCIDENT_OPTIONS,
  WAYBILL_PRESET_OPTIONS,
  VAT_MODE_OPTIONS,
} from '@/services/principal.service';
import { createBrowserSupabaseClient } from '@/lib/supabase';

import {
  RadioOption,
  SectionToggle,
  CheckboxOption,
  TruckIcon,
  PickupIcon,
  GiftIcon,
  ShieldIcon,
  AlertTriangleIcon,
  CarIcon,
  FileTextIcon,
} from '@/components/portal/principals/FormControls';

export default function CategoryTab({ agencyId }: { agencyId: string }) {
  const [principals, setPrincipals] = useState<Principal[]>([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [saving, setSaving] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editName, setEditName] = useState('');

  /* ── 신규 생성 폼 state ── */
  const [formName, setFormName] = useState('');
  const [fieldConfig, setFieldConfig] = useState<FieldConfig>({ ...DEFAULT_FIELD_CONFIG });

  useEffect(() => {
    async function load() {
      const result = await getPrincipals(agencyId);
      if (result.data) setPrincipals(result.data);
      setLoading(false);
    }
    load();
  }, [agencyId]);

  function resetForm() {
    setFormName('');
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
    if (!formName.trim()) return;
    setSaving(true);

    const result = await createPrincipal({
      agency_id: agencyId,
      name: formName.trim(),
      delivery_area: '',
      rate_type: 'fixed' as const,
    });

    if (result.data) {
      // field_config 저장
      const supabase = createBrowserSupabaseClient();
      await supabase
        .from('principals')
        .update({ field_config: fieldConfig })
        .eq('id', result.data.id);

      setPrincipals((prev) => [...prev, { ...result.data!, field_config: fieldConfig as unknown as Principal['field_config'] }]);
      resetForm();
    }
    setSaving(false);
  }

  async function handleUpdate(id: string) {
    setSaving(true);
    await updatePrincipal(id, { name: editName });
    setPrincipals((prev) => prev.map((p) => p.id === id ? { ...p, name: editName } : p));
    setEditingId(null);
    setSaving(false);
  }

  async function handleDelete(id: string, name: string) {
    if (!confirm(`"${name}" 카테고리를 삭제하시겠습니까?`)) return;
    const result = await deletePrincipal(id);
    if (!result.error) setPrincipals((prev) => prev.filter((p) => p.id !== id));
  }

  const inputCls = 'w-full h-11 px-4 rounded-xl bg-surface-container-low text-on-surface text-sm font-korean focus:outline-none focus:ring-2 focus:ring-primary/30 placeholder:text-on-surface-variant/40';
  const labelCls = 'block text-xs font-label font-medium text-on-surface-variant mb-1.5 font-korean';

  return (
    <div className="space-y-6">
      <div className="bg-surface-container-lowest rounded-2xl shadow-ambient p-6">
        <div className="flex items-center justify-between mb-4">
          <div>
            <h2 className="text-lg font-headline font-bold text-on-surface font-korean">카테고리 관리</h2>
            <p className="text-xs text-on-surface-variant font-korean mt-1">
              거래처(본사)를 등록하고 단가/정산 방식을 설정합니다.
            </p>
          </div>
          {!showForm && (
            <button
              onClick={() => setShowForm(true)}
              className="h-9 px-4 rounded-lg bg-primary text-white text-sm font-label font-semibold hover:bg-primary/90 transition-colors flex items-center gap-1.5 font-korean"
            >
              <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor">
                <path d="M19 13h-6v6h-2v-6H5v-2h6V5h2v6h6v2z" />
              </svg>
              추가
            </button>
          )}
        </div>

        {/* ══════════════════ 신규 생성 폼 ══════════════════ */}
        {showForm && (
          <div className="mb-4 rounded-2xl bg-surface-container-low overflow-hidden">
            <div className="bg-primary/[0.04] border-b border-outline-variant/10 px-6 py-5">
              <h2 className="text-lg font-headline font-bold text-on-surface font-korean">새 카테고리 등록</h2>
              <p className="text-xs text-on-surface-variant mt-1 font-korean">
                정산 항목과 계산 방식을 설정하세요. 기사 등록 시 해당 입력란이 자동 생성됩니다.
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
                  <div>
                    <label className={labelCls}>카테고리명</label>
                    <input
                      type="text"
                      placeholder="예: CJ대한통운 / 롯데글로벌로지스"
                      value={formName}
                      onChange={(e) => setFormName(e.target.value)}
                      className={inputCls}
                      autoFocus
                    />
                  </div>
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
                            <div className={`w-[14px] h-[14px] rounded-full border-2 flex items-center justify-center transition-colors ${
                              fieldConfig.vat_mode === opt.value ? 'border-primary' : 'border-outline-variant'
                            }`}>
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

                    {/* ── 단가 설정 (체크박스 조합) ── */}
                    <div className="p-4 rounded-2xl bg-primary/[0.03] border border-primary/10 space-y-4">
                      <p className="text-[10px] font-bold text-on-surface-variant/60 uppercase tracking-wider font-korean mb-1">단가 설정 (복수 선택 가능)</p>

                      {/* 배송/반품 동일단가 */}
                      <label className="flex items-start gap-3 p-3 rounded-xl hover:bg-primary/[0.03] cursor-pointer transition-colors">
                        <input type="checkbox"
                          checked={fieldConfig.items.delivery.fee_same === true}
                          onChange={(e) => {
                            const checked = e.target.checked;
                            setFieldConfig((fc) => ({
                              ...fc,
                              items: {
                                delivery: { ...fc.items.delivery, fee_same: checked, fee_separate: checked ? false : fc.items.delivery.fee_separate },
                                return: { ...fc.items.return, fee_same: checked, fee_separate: checked ? false : fc.items.return.fee_separate },
                                pickup: { ...fc.items.pickup, fee_same: checked, fee_separate: checked ? false : fc.items.pickup.fee_separate },
                              },
                            }));
                          }}
                          className="w-4 h-4 mt-0.5 accent-primary shrink-0" />
                        <div>
                          <p className="text-sm font-semibold text-on-surface font-korean">배송/반품 동일 단가</p>
                          <p className="text-xs text-on-surface-variant font-korean">배송·반품에 같은 단가 1개 적용</p>
                        </div>
                      </label>

                      {/* 배송/반품 별도단가 */}
                      <label className="flex items-start gap-3 p-3 rounded-xl hover:bg-primary/[0.03] cursor-pointer transition-colors">
                        <input type="checkbox"
                          checked={fieldConfig.items.delivery.fee_separate === true}
                          onChange={(e) => {
                            const checked = e.target.checked;
                            setFieldConfig((fc) => ({
                              ...fc,
                              items: {
                                delivery: { ...fc.items.delivery, fee_separate: checked, fee_same: checked ? false : fc.items.delivery.fee_same },
                                return: { ...fc.items.return, fee_separate: checked, fee_same: checked ? false : fc.items.return.fee_same },
                                pickup: { ...fc.items.pickup, fee_separate: checked, fee_same: checked ? false : fc.items.pickup.fee_same },
                              },
                            }));
                          }}
                          className="w-4 h-4 mt-0.5 accent-primary shrink-0" />
                        <div>
                          <p className="text-sm font-semibold text-on-surface font-korean">배송/반품 별도 단가</p>
                          <p className="text-xs text-on-surface-variant font-korean">배송단가·반품단가를 각각 입력</p>
                        </div>
                      </label>

                      <div className="border-t border-primary/10 pt-3">
                        <p className="text-[10px] font-bold text-on-surface-variant/60 uppercase tracking-wider font-korean mb-2">배송지역 설정</p>

                        {/* 배송지역별 동일단가 */}
                        <label className="flex items-start gap-3 p-3 rounded-xl hover:bg-primary/[0.03] cursor-pointer transition-colors">
                          <input type="checkbox"
                            checked={fieldConfig.items.delivery.route_same === true}
                            onChange={(e) => {
                              const checked = e.target.checked;
                              setFieldConfig((fc) => ({
                                ...fc,
                                items: {
                                  delivery: { ...fc.items.delivery, route_same: checked, route_separate: checked ? false : fc.items.delivery.route_separate },
                                  return: { ...fc.items.return, route_same: checked, route_separate: checked ? false : fc.items.return.route_separate },
                                  pickup: { ...fc.items.pickup, route_same: checked, route_separate: checked ? false : fc.items.pickup.route_separate },
                                },
                              }));
                            }}
                            className="w-4 h-4 mt-0.5 accent-primary shrink-0" />
                          <div>
                            <p className="text-sm font-semibold text-on-surface font-korean">배송지역별 동일 단가</p>
                            <p className="text-xs text-on-surface-variant font-korean">A구역 ₩5,000 / B구역 ₩4,500 — 구역별 동일 단가 1개</p>
                          </div>
                        </label>

                        {/* 배송지역별 별도단가 */}
                        <label className="flex items-start gap-3 p-3 rounded-xl hover:bg-primary/[0.03] cursor-pointer transition-colors">
                          <input type="checkbox"
                            checked={fieldConfig.items.delivery.route_separate === true}
                            onChange={(e) => {
                              const checked = e.target.checked;
                              setFieldConfig((fc) => ({
                                ...fc,
                                items: {
                                  delivery: { ...fc.items.delivery, route_separate: checked, route_same: checked ? false : fc.items.delivery.route_same },
                                  return: { ...fc.items.return, route_separate: checked, route_same: checked ? false : fc.items.return.route_same },
                                  pickup: { ...fc.items.pickup, route_separate: checked, route_same: checked ? false : fc.items.pickup.route_same },
                                },
                              }));
                            }}
                            className="w-4 h-4 mt-0.5 accent-primary shrink-0" />
                          <div>
                            <p className="text-sm font-semibold text-on-surface font-korean">배송지역별 별도 단가</p>
                            <p className="text-xs text-on-surface-variant font-korean">구역별 배송단가·반품단가를 각각 입력</p>
                          </div>
                        </label>
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
                          {/* 동일수수료 */}
                          {fieldConfig.items.delivery.fee_same && (
                            <div className="p-3 rounded-xl bg-surface-container-low/50 border border-outline-variant/10 space-y-2">
                              <p className="text-xs font-semibold text-on-surface font-korean">배송/반품 동일 수수료</p>
                              <div className="space-y-1">
                                {DELIVERY_RATE_OPTIONS.map((opt) => (
                                  <RadioOption
                                    key={opt.value}
                                    checked={fieldConfig.items.delivery.rate_mode === opt.value}
                                    onChange={() => { setRateMode('delivery', opt.value); setRateMode('return', opt.value); }}
                                    label={opt.label.replace('배송', '배송/반품')}
                                    desc={opt.desc}
                                  />
                                ))}
                              </div>
                            </div>
                          )}
                          {/* 별도수수료 */}
                          {fieldConfig.items.delivery.fee_separate && (
                            <div className="p-3 rounded-xl bg-surface-container-low/50 border border-outline-variant/10 space-y-2">
                              <p className="text-xs font-semibold text-on-surface font-korean">배송/반품 별도 수수료</p>
                              <p className="text-[10px] text-on-surface-variant font-korean">기사 등록 시 배송·반품 단가를 각각 입력합니다</p>
                              <div className="space-y-1">
                                {DELIVERY_RATE_OPTIONS.map((opt) => (
                                  <RadioOption
                                    key={opt.value}
                                    checked={fieldConfig.items.delivery.rate_mode === opt.value}
                                    onChange={() => { setRateMode('delivery', opt.value); setRateMode('return', opt.value); }}
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

                    {/* ── 집하 토글 ── */}
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

              {/* ── 버튼 ── */}
              <div className="flex justify-end gap-3 pt-2 border-t border-outline-variant/10">
                <button onClick={resetForm}
                  className="h-11 px-6 rounded-xl bg-surface-container-high text-on-surface-variant font-label text-sm hover:bg-surface-container-highest transition-colors font-korean">
                  취소
                </button>
                <button onClick={handleCreate} disabled={saving || !formName.trim()}
                  className="h-11 px-8 rounded-xl bg-power-gradient text-white font-label font-semibold text-sm hover:shadow-lg transition-shadow disabled:opacity-50 font-korean flex items-center gap-2">
                  {saving ? (
                    <>
                      <svg className="w-4 h-4 animate-spin" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M21 12a9 9 0 1 1-6.219-8.56"/></svg>
                      저장 중...
                    </>
                  ) : '등록'}
                </button>
              </div>
            </div>
          </div>
        )}

        {/* ── 기존 카테고리 목록 ── */}
        {loading ? (
          <p className="text-sm text-on-surface-variant text-center py-6 font-korean">불러오는 중...</p>
        ) : principals.length === 0 ? (
          <p className="text-sm text-on-surface-variant text-center py-6 font-korean">
            등록된 카테고리가 없습니다. &quot;추가&quot; 버튼으로 거래처를 등록하세요.
          </p>
        ) : (
          <div className="divide-y divide-outline-variant/20">
            {principals.map((p) => (
              <div key={p.id} className="py-3 flex items-center gap-4">
                {editingId === p.id ? (
                  <input
                    type="text" value={editName}
                    onChange={(e) => setEditName(e.target.value)}
                    onKeyDown={(e) => e.key === 'Enter' && handleUpdate(p.id)}
                    className="flex-1 h-9 px-3 rounded-lg bg-surface-container-low text-sm font-korean focus:outline-none focus:ring-2 focus:ring-primary/30"
                    autoFocus
                  />
                ) : (
                  <span className="flex-1 text-sm font-body font-semibold text-on-surface font-korean">{p.name}</span>
                )}
                <div className="flex items-center gap-1 shrink-0">
                  {editingId === p.id ? (
                    <>
                      <button onClick={() => setEditingId(null)} className="h-8 px-3 rounded-lg text-xs text-on-surface-variant hover:bg-surface-container-high font-korean">취소</button>
                      <button onClick={() => handleUpdate(p.id)} disabled={saving} className="h-8 px-3 rounded-lg text-xs bg-primary text-white font-korean disabled:opacity-50">저장</button>
                    </>
                  ) : (
                    <>
                      <Link href={`/portal/principals/${p.id}`}
                        className="h-8 px-3 rounded-lg text-xs text-white bg-primary hover:bg-primary/90 font-korean flex items-center font-semibold">
                        단가/정산 설정
                      </Link>
                      <button onClick={() => { setEditingId(p.id); setEditName(p.name); }} className="h-8 px-3 rounded-lg text-xs text-primary hover:bg-primary/10 font-korean">이름변경</button>
                      <button onClick={() => handleDelete(p.id, p.name)} className="h-8 px-3 rounded-lg text-xs text-error hover:bg-error/10 font-korean">삭제</button>
                    </>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      <div className="bg-surface-container-lowest rounded-2xl shadow-ambient p-6">
        <h3 className="text-sm font-headline font-semibold text-on-surface font-korean mb-2">사용 안내</h3>
        <ul className="space-y-1.5 text-xs text-on-surface-variant font-korean">
          <li>• 카테고리 추가 시 정산 방식과 단가 설정을 함께 선택하세요.</li>
          <li>• <strong>「단가/정산 설정」</strong> 버튼으로 보험, 차감항목 등 상세 설정을 추가할 수 있습니다.</li>
          <li>• 설정 완료 후 기사 등록 시 해당 카테고리에 맞는 입력 필드가 자동 생성됩니다.</li>
        </ul>
      </div>
    </div>
  );
}
