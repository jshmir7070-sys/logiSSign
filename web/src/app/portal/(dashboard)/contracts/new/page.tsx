'use client';

import { useEffect, useMemo, useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import Badge from '@/components/shared/Badge';
import { createBrowserSupabaseClient } from '@/lib/supabase';
import {
  getContractTemplates,
  type ContractTemplate,
} from '@/services/contract.service';
import { getPrincipals, normalizeFieldConfig, type Principal } from '@/services/principal.service';

interface DriverItem {
  id: string;
  name: string;
  phone: string;
  employee_code: string | null;
  driver_code: string | null;
  address: string | null;
  business_reg_number: string | null;
  representative_name: string | null;
  business_address: string | null;
  is_business_owner: boolean;
  vat_included: boolean;
  delivery_area: string | null;
  vehicle_number: string | null;
}

function isSendableContractTemplate(template: ContractTemplate, agencyId: string) {
  if (template.agency_id === agencyId) return true;
  if (template.agency_id === null && template.template_type !== 'pdf') return true;
  return false;
}

export default function NewContractPage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const preselectedDocId = searchParams.get('docId') ?? searchParams.get('documentId');
  const [agencyId, setAgencyId] = useState<string | null>(null);
  const [agencyName, setAgencyName] = useState('');
  const [agencyBizNumber, setAgencyBizNumber] = useState('');
  const [agencyAddress, setAgencyAddress] = useState('');

  const [principals, setPrincipals] = useState<Principal[]>([]);
  const [principalId, setPrincipalId] = useState('');
  const [templates, setTemplates] = useState<ContractTemplate[]>([]);
  const [drivers, setDrivers] = useState<DriverItem[]>([]);

  const [selectedDriverIds, setSelectedDriverIds] = useState<Set<string>>(new Set());
  const [selectedTemplateIds, setSelectedTemplateIds] = useState<Set<string>>(new Set());
  const [selectedDocIds, setSelectedDocIds] = useState<Set<string>>(new Set());
  const [documents, setDocuments] = useState<{ id: string; title: string; field_count: number }[]>([]);
  const [contractStartDate, setContractStartDate] = useState(new Date().toISOString().slice(0, 10));
  const [contractEndDate, setContractEndDate] = useState('');
  const [documentTypeFilter, setDocumentTypeFilter] = useState<'all' | 'template' | 'document'>(
    preselectedDocId ? 'document' : 'all',
  );

  const [previewTemplate, setPreviewTemplate] = useState<ContractTemplate | null>(null);
  const [sending, setSending] = useState(false);
  const [result, setResult] = useState<{ sent: number; failed: number } | null>(null);
  const [sendConfirmed, setSendConfirmed] = useState(false);

  useEffect(() => {
    async function init() {
      const supabase = createBrowserSupabaseClient();
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;
      const aid = user.app_metadata?.agency_id as string;
      if (!aid) return;
      setAgencyId(aid);

      const [principalRes, agencyRes] = await Promise.all([
        getPrincipals(aid),
        supabase.from('agencies').select('name, business_number, address').eq('id', aid).single(),
      ]);
      if (principalRes.data) setPrincipals(principalRes.data);
      if (agencyRes.data) {
        const a = agencyRes.data as { name: string; business_number: string | null; address: string | null };
        setAgencyName(a.name);
        setAgencyBizNumber(a.business_number ?? '');
        setAgencyAddress(a.address ?? '');
      }
    }
    init();
  }, []);

  // 원청사 변경 시 → 템플릿 + 기사 로드
  useEffect(() => {
    if (!agencyId || !principalId) return;

    const supabase = createBrowserSupabaseClient();

    getContractTemplates(agencyId, principalId).then((res) => {
      if (res.data) {
        const availableTemplates = res.data.filter((template) => isSendableContractTemplate(template, agencyId));
        setTemplates(availableTemplates);
        setSelectedTemplateIds(preselectedDocId ? new Set<string>() : new Set(availableTemplates.map((t) => t.id)));
      }
    });

    // 문서함 조회
    supabase
      .from('document_files')
      .select('id, title, status')
      .eq('agency_id', agencyId)
      .eq('status', 'ready')
      .order('created_at', { ascending: false })
      .then(async ({ data: docFiles }) => {
        const docs: { id: string; title: string; field_count: number }[] = [];
        for (const doc of (docFiles ?? [])) {
          const { count } = await supabase
            .from('document_sign_fields')
            .select('id', { count: 'exact', head: true })
            .eq('document_file_id', doc.id);
          const fieldCount = count ?? 0;
          if (fieldCount === 0) continue;
          docs.push({ id: doc.id, title: doc.title, field_count: fieldCount });
        }
        setDocuments(docs);
        if (preselectedDocId && docs.some((doc) => doc.id === preselectedDocId)) {
          setSelectedDocIds(new Set([preselectedDocId]));
          setDocumentTypeFilter('document');
        }
      });

    // 기사 조회 — driver_principals 기준의 해당 카테고리 활성 기사만
    supabase
      .from('driver_principals')
      .select('driver_id')
      .eq('principal_id', principalId)
      .eq('status', 'active')
      .then(async ({ data: links, error }) => {
        if (error) {
          setDrivers([]);
          setSelectedDriverIds(new Set());
          return;
        }

        const driverIds = (links ?? []).map((link) => link.driver_id);
        if (driverIds.length === 0) {
          setDrivers([]);
          setSelectedDriverIds(new Set());
          return;
        }

        const { data } = await supabase
          .from('drivers')
          .select('id, name, phone, employee_code, driver_code, address, business_reg_number, representative_name, business_address, is_business_owner, vat_included, delivery_area, vehicle_number')
          .eq('agency_id', agencyId)
          .eq('status', 'active')
          .in('id', driverIds)
          .order('name');

        setDrivers((data ?? []) as unknown as DriverItem[]);
        setSelectedDriverIds(new Set());
      });
  }, [agencyId, preselectedDocId, principalId]);

  const toggleDriver = (id: string) => {
    setSelectedDriverIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id); else next.add(id);
      return next;
    });
  };

  const toggleAllDrivers = () => {
    if (selectedDriverIds.size === drivers.length) {
      setSelectedDriverIds(new Set());
    } else {
      setSelectedDriverIds(new Set(drivers.map((d) => d.id)));
    }
  };

  useEffect(() => {
    setSendConfirmed(false);
  }, [selectedDriverIds, selectedTemplateIds, selectedDocIds, contractStartDate, contractEndDate]);

  const selectedDrivers = useMemo(
    () => drivers.filter((driver) => selectedDriverIds.has(driver.id)),
    [drivers, selectedDriverIds],
  );

  const visibleTemplates = documentTypeFilter === 'document' ? [] : templates;
  const visibleDocuments = documentTypeFilter === 'template' ? [] : documents;

  const formatPhoneLastFour = (phone: string | null) => {
    const digits = String(phone ?? '').replace(/\D/g, '');
    return digits.length >= 4 ? digits.slice(-4) : '없음';
  };

  const handleSend = async () => {
    if (!agencyId || selectedDriverIds.size === 0 || (selectedTemplateIds.size === 0 && selectedDocIds.size === 0)) return;
    if (!sendConfirmed) {
      alert('발송 전 기사코드, 사번, 이름, 전화번호 뒤 4자리를 확인해 주세요.');
      return;
    }
    setSending(true);

    let totalSent = 0;
    let totalFailed = 0;

    // 계약서 템플릿 — 배치 API 1회 호출 (기사 × 템플릿 일괄 생성)
    if (selectedTemplateIds.size > 0) {
      const bindingDataMap: Record<string, Record<string, string>> = {};
      const principal = principals.find((p) => p.id === principalId);
      const fc = principal ? normalizeFieldConfig(principal.field_config) : null;
      const empIns = fc?.deduction_section?.employment_insurance;
      const indIns = fc?.deduction_section?.industrial_insurance;

      for (const driverId of Array.from(selectedDriverIds)) {
        const driver = drivers.find((d) => d.id === driverId);
        if (!driver) continue;

        bindingDataMap[driverId] = {
          기사명: driver.name,
          전화번호: driver.phone,
          주소: driver.address ?? '',
          사번: driver.employee_code ?? '',
          카테고리명: principal?.name ?? '',
          배송지역: driver.delivery_area ?? '',
          배송단가: '-', 반품단가: '-', 집하단가: '-', 노선별단가: '-',
          계약시작일: contractStartDate ? new Date(contractStartDate).toLocaleDateString('ko-KR') : '',
          계약종료일: contractEndDate ? new Date(contractEndDate).toLocaleDateString('ko-KR') : '',
          계약일: new Date().toLocaleDateString('ko-KR'),
          대리점명: agencyName,
          대리점사업자번호: agencyBizNumber,
          대리점주소: agencyAddress,
          사업자번호: driver.business_reg_number ?? '',
          대표자명: driver.representative_name ?? '',
          사업장주소: driver.business_address ?? '',
          부가세구분: driver.is_business_owner ? (driver.vat_included ? '포함가' : '별도') : '해당없음',
          세금처리: driver.is_business_owner ? '세금계산서' : '3.3% 원천징수',
          차종: '', 연식: '', 차량번호: driver.vehicle_number ?? '',
          차대번호: '', 인도시주행거리: '', 월임대료: '', 보증금: '', 보험부담: '임대인',
          고용보험_기사부담: empIns?.enabled ? (empIns.split_mode === 'split_50_50' ? '50%' : '0%') : '-',
          고용보험_사업주부담: empIns?.enabled ? (empIns.split_mode === 'split_50_50' ? '50%' : '100%') : '-',
          산재보험_기사부담: indIns?.enabled ? (indIns.split_mode === 'split_50_50' ? '50%' : '0%') : '-',
          산재보험_사업주부담: indIns?.enabled ? (indIns.split_mode === 'split_50_50' ? '50%' : '100%') : '-',
        };
      }

      try {
        const response = await fetch('/api/contracts/send', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            driverIds: Array.from(selectedDriverIds),
            principalId,
            templateIds: Array.from(selectedTemplateIds),
            bindingDataMap,
          }),
        });
        const result = await response.json();
        const requested = selectedDriverIds.size * selectedTemplateIds.size;
        if (response.ok) {
          const created = result.created ?? 0;
          totalSent += created;
          totalFailed += Math.max(0, requested - created);
        } else {
          totalFailed += requested;
        }
      } catch {
        totalFailed += selectedDriverIds.size * selectedTemplateIds.size;
      }
    }

    // 문서함 전송 — 푸시만 (SMS 없음)
    if (selectedDocIds.size > 0) {
      const { sendDocuments } = await import('@/services/document-send.service');
      for (const docId of Array.from(selectedDocIds)) {
        const res = await sendDocuments({
          agencyId,
          driverIds: Array.from(selectedDriverIds),
          sendType: 'general',
          sendMethod: 'push',
          title: documents.find(d => d.id === docId)?.title ?? '문서',
          documentFileId: docId,
        });
        if (res.error) {
          totalFailed += selectedDriverIds.size;
        } else {
          totalSent += Math.max(0, res.total - res.failed);
          totalFailed += res.failed;
        }
      }
    }

    setResult({ sent: totalSent, failed: totalFailed });
    setSending(false);
  };

  const inputCls = 'w-full h-10 px-3 rounded-xl bg-surface-container-low text-on-surface text-sm font-korean focus:outline-none focus:ring-2 focus:ring-primary/30';
  const labelCls = 'block text-xs font-label font-medium text-on-surface-variant mb-1.5 font-korean';

  if (result) {
    return (
      <div className="py-20 text-center space-y-6">
        <div className="text-5xl">📨</div>
        <h1 className="text-2xl font-headline font-bold text-on-surface font-korean">계약·문서 전송 완료</h1>
        <p className="text-on-surface-variant font-korean">
          {result.sent}건 발송 완료{result.failed > 0 ? ` / ${result.failed}건 실패` : ''}
        </p>
        <button
          onClick={() => router.push('/portal/contracts')}
          className="h-11 px-8 rounded-xl bg-primary text-white font-label font-semibold text-sm font-korean"
        >
          계약서 목록으로
        </button>
      </div>
    );
  }

  return (
    <div className="space-y-8 pb-12">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-headline font-bold text-on-surface font-korean">계약·문서 전송</h1>
          <p className="mt-1 text-sm text-on-surface-variant font-korean">
            등록된 카테고리와 기사 기준으로 계약서 템플릿 또는 저장 완료된 문서함 PDF를 선택해 전송합니다
          </p>
        </div>
        <button
          onClick={() => router.back()}
          className="h-10 px-5 rounded-xl bg-surface-container-high text-on-surface-variant font-label text-sm font-korean"
        >
          취소
        </button>
      </div>

      {/* 1. 원청사 선택 */}
      <section className="bg-surface-container-lowest rounded-2xl shadow-ambient p-6 space-y-4">
        <h2 className="text-base font-headline font-semibold text-on-surface font-korean">1. 카테고리 선택</h2>
        <select
          value={principalId}
          onChange={(e) => setPrincipalId(e.target.value)}
          className={inputCls}
        >
          <option value="">카테고리를 선택하세요</option>
          {principals.map((p) => (
            <option key={p.id} value={p.id}>{p.name}</option>
          ))}
        </select>
      </section>

      {/* 2. 기사 선택 */}
      {principalId && (
        <section className="bg-surface-container-lowest rounded-2xl shadow-ambient p-6 space-y-4">
          <div className="flex items-center justify-between">
            <h2 className="text-base font-headline font-semibold text-on-surface font-korean">
              2. 기사 선택 ({selectedDriverIds.size}/{drivers.length})
            </h2>
            <button
              onClick={toggleAllDrivers}
              className="text-xs text-primary font-label font-semibold hover:underline font-korean"
            >
              {selectedDriverIds.size === drivers.length ? '전체 해제' : '전체 선택'}
            </button>
          </div>

          {drivers.length === 0 ? (
            <p className="text-sm text-on-surface-variant font-korean">등록된 기사가 없습니다</p>
          ) : (
            <div className="space-y-2 max-h-80 overflow-y-auto">
              {drivers.map((d) => {
                const checked = selectedDriverIds.has(d.id);
                return (
                  <label
                    key={d.id}
                    className={`flex items-center gap-3 p-3 rounded-xl border-2 cursor-pointer transition-all ${
                      checked ? 'border-primary/40 bg-primary/5' : 'border-outline-variant/15 hover:border-outline-variant/30'
                    }`}
                  >
                    <input
                      type="checkbox"
                      checked={checked}
                      onChange={() => toggleDriver(d.id)}
                      className="w-4 h-4 rounded accent-primary"
                    />
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-body font-semibold text-on-surface font-korean">{d.name}</p>
                      <p className="text-xs text-on-surface-variant font-data">
                        {d.driver_code ?? '-'} · {d.employee_code ?? '-'} · {d.phone}
                      </p>
                    </div>
                    <Badge
                      label={d.is_business_owner ? '사업자' : '개인'}
                      variant={d.is_business_owner ? 'info' : 'default'}
                    />
                  </label>
                );
              })}
            </div>
          )}
        </section>
      )}

      {/* 3. 계약/문서 선택 */}
      {principalId && (
        <section className="bg-surface-container-lowest rounded-2xl shadow-ambient p-6 space-y-4">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <h2 className="text-base font-headline font-semibold text-on-surface font-korean">
                3. 계약서/문서 선택
              </h2>
              <p className="mt-1 text-xs text-on-surface-variant font-korean">
                텍스트 계약서 템플릿과 저장 완료된 문서함 PDF를 한 화면에서 선택합니다.
              </p>
            </div>
            <div className="flex rounded-xl bg-surface-container-low p-1">
              {[
                { key: 'all', label: '전체' },
                { key: 'template', label: '계약서' },
                { key: 'document', label: '문서함' },
              ].map((item) => (
                <button
                  key={item.key}
                  type="button"
                  onClick={() => setDocumentTypeFilter(item.key as 'all' | 'template' | 'document')}
                  className={`h-8 rounded-lg px-3 text-xs font-semibold font-korean transition-colors ${
                    documentTypeFilter === item.key
                      ? 'bg-primary text-white'
                      : 'text-on-surface-variant hover:text-on-surface'
                  }`}
                >
                  {item.label}
                </button>
              ))}
            </div>
          </div>

          {visibleTemplates.length === 0 && visibleDocuments.length === 0 ? (
            <p className="rounded-xl bg-surface-container-low px-4 py-5 text-sm text-on-surface-variant font-korean">
              선택 가능한 계약서나 저장 완료된 문서함 PDF가 없습니다. 템플릿 만들기 또는 내 문서함에서 먼저 저장해 주세요.
            </p>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-3">
              {visibleTemplates.map((tmpl) => {
                const checked = selectedTemplateIds.has(tmpl.id);
                return (
                  <label
                    key={tmpl.id}
                    className={`min-h-[132px] rounded-xl border-2 p-4 cursor-pointer transition-all ${
                      checked ? 'border-primary/40 bg-primary/5' : 'border-outline-variant/15 hover:border-outline-variant/30'
                    }`}
                  >
                    <div className="flex items-start gap-3">
                      <input
                        type="checkbox"
                        checked={checked}
                        onChange={() => {
                          setSelectedTemplateIds((prev) => {
                            const next = new Set(prev);
                            if (next.has(tmpl.id)) next.delete(tmpl.id); else next.add(tmpl.id);
                            return next;
                          });
                        }}
                        className="mt-1 w-4 h-4 rounded accent-primary"
                      />
                      <div className="min-w-0 flex-1">
                        <div className="mb-2 flex items-center gap-2">
                          <Badge label="계약서" variant="info" />
                          <span className="text-[11px] text-on-surface-variant font-korean">
                            {tmpl.agency_id === agencyId ? '등록 템플릿' : '기본 템플릿'}
                          </span>
                        </div>
                        <p className="text-sm font-body font-semibold text-on-surface font-korean line-clamp-2">{tmpl.title}</p>
                        <p className="mt-2 text-xs text-on-surface-variant font-korean line-clamp-2">
                          {tmpl.content.replace(/\s+/g, ' ').substring(0, 84)}...
                        </p>
                      </div>
                    </div>
                    <button
                      type="button"
                      onClick={(e) => { e.preventDefault(); e.stopPropagation(); setPreviewTemplate(tmpl); }}
                      className="mt-3 text-xs text-primary font-label font-semibold hover:underline font-korean"
                    >
                      미리보기
                    </button>
                  </label>
                );
              })}

              {visibleDocuments.map((doc) => {
                const checked = selectedDocIds.has(doc.id);
                return (
                  <label
                    key={doc.id}
                    className={`min-h-[132px] rounded-xl border-2 p-4 cursor-pointer transition-all ${
                      checked ? 'border-tertiary/40 bg-tertiary/5' : 'border-outline-variant/15 hover:border-outline-variant/30'
                    }`}
                  >
                    <div className="flex items-start gap-3">
                      <input
                        type="checkbox"
                        checked={checked}
                        onChange={() => {
                          setSelectedDocIds((prev) => {
                            const next = new Set(prev);
                            if (next.has(doc.id)) next.delete(doc.id); else next.add(doc.id);
                            return next;
                          });
                        }}
                        className="mt-1 w-4 h-4 rounded accent-tertiary"
                      />
                      <div className="min-w-0 flex-1">
                        <div className="mb-2 flex items-center gap-2">
                          <Badge label="문서함 PDF" variant="warning" />
                          <span className="text-[11px] text-on-surface-variant font-korean">저장 완료</span>
                        </div>
                        <p className="text-sm font-body font-semibold text-on-surface font-korean line-clamp-2">{doc.title}</p>
                        <p className="mt-2 text-xs text-on-surface-variant font-korean">
                          서명/입력 필드 {doc.field_count}개 배치됨
                        </p>
                      </div>
                    </div>
                  </label>
                );
              })}
            </div>
          )}
        </section>
      )}

      {/* 4. 계약 기간 */}
      {principalId && selectedDriverIds.size > 0 && selectedTemplateIds.size > 0 && (
        <section className="bg-surface-container-lowest rounded-2xl shadow-ambient p-6 space-y-4">
          <h2 className="text-base font-headline font-semibold text-on-surface font-korean">4. 계약 기간</h2>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className={labelCls}>계약 시작일</label>
              <input type="date" value={contractStartDate}
                onChange={(e) => setContractStartDate(e.target.value)}
                className={`${inputCls} font-data`} />
            </div>
            <div>
              <label className={labelCls}>계약 종료일</label>
              <input type="date" value={contractEndDate}
                onChange={(e) => setContractEndDate(e.target.value)}
                className={`${inputCls} font-data`} />
            </div>
          </div>
        </section>
      )}

      {selectedDrivers.length > 0 && (selectedTemplateIds.size > 0 || selectedDocIds.size > 0) && (
        <section className="bg-surface-container-lowest rounded-2xl shadow-ambient p-6 space-y-4">
          <div>
            <h2 className="text-base font-headline font-semibold text-on-surface font-korean">
              {selectedTemplateIds.size > 0 ? '5. 발송 대상 최종 확인' : '4. 발송 대상 최종 확인'}
            </h2>
            <p className="mt-1 text-xs text-on-surface-variant font-korean">
              기사고유코드, 사번, 이름, 전화번호 끝 4자리를 확인한 뒤 발송해 주세요.
            </p>
          </div>
          <div className="max-h-64 overflow-y-auto rounded-xl border border-outline-variant/15">
            {selectedDrivers.map((driver) => (
              <div
                key={driver.id}
                className="px-4 py-3 border-b border-outline-variant/5 last:border-b-0"
              >
                <p className="text-sm font-semibold text-on-surface font-korean">{driver.name}</p>
                <p className="text-[11px] text-on-surface-variant font-data mt-1">
                  기사고유코드 {driver.driver_code ?? '-'} · 사번 {driver.employee_code ?? '-'} · 전화번호 끝 4자리 {formatPhoneLastFour(driver.phone)}
                </p>
              </div>
            ))}
          </div>
          <label className="flex items-start gap-2 rounded-xl bg-primary/5 border border-primary/10 px-4 py-3 cursor-pointer">
            <input
              type="checkbox"
              checked={sendConfirmed}
              onChange={(e) => setSendConfirmed(e.target.checked)}
              className="mt-0.5 w-4 h-4 rounded accent-primary"
            />
            <span className="text-xs text-on-surface-variant font-korean leading-5">
              선택한 기사들의 기사고유코드, 사번, 이름, 전화번호 끝 4자리를 모두 확인했고 이 대상으로만 계약/문서를 전송합니다.
            </span>
          </label>
        </section>
      )}

      {/* 발송 요약 + 버튼 */}
      {selectedDriverIds.size > 0 && (selectedTemplateIds.size > 0 || selectedDocIds.size > 0) && (
        <div className="bg-tertiary/5 rounded-2xl border border-tertiary/10 p-6 space-y-4">
          <div className="flex items-center gap-4 text-sm font-korean flex-wrap">
            <span className="text-on-surface-variant">발송 대상: <strong className="text-on-surface">{selectedDriverIds.size}명</strong></span>
            {selectedTemplateIds.size > 0 && (
              <span className="text-on-surface-variant">계약서: <strong className="text-on-surface">{selectedTemplateIds.size}건</strong></span>
            )}
            {selectedDocIds.size > 0 && (
              <span className="text-on-surface-variant">문서함: <strong className="text-tertiary">{selectedDocIds.size}건</strong></span>
            )}
            <span className="text-on-surface-variant">총: <strong className="text-primary">{selectedDriverIds.size * (selectedTemplateIds.size + selectedDocIds.size)}건 발송</strong></span>
          </div>
          <p className="text-xs text-on-surface-variant font-korean">
            계약서는 기사 정보가 자동 입력되어 전송됩니다. 문서함은 설정된 서명/입력 필드 그대로 전송됩니다.
          </p>
          <button
            onClick={handleSend}
            disabled={sending || !sendConfirmed}
            className="w-full h-12 rounded-xl bg-power-gradient text-white font-label font-semibold text-sm hover:shadow-lg transition-shadow disabled:opacity-50 font-korean"
          >
            {sending ? '발송 중...' : `${selectedDriverIds.size * (selectedTemplateIds.size + selectedDocIds.size)}건 일괄 발송`}
          </button>
        </div>
      )}

      {/* Preview Modal */}
      {previewTemplate && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4" onClick={() => setPreviewTemplate(null)}>
          <div className="bg-surface-container-lowest rounded-2xl shadow-float w-full max-w-3xl max-h-[85vh] flex flex-col" onClick={(e) => e.stopPropagation()}>
            <div className="flex items-center justify-between p-6 border-b border-outline-variant/20">
              <h2 className="text-lg font-headline font-bold text-on-surface font-korean">{previewTemplate.title}</h2>
              <button onClick={() => setPreviewTemplate(null)} className="w-8 h-8 rounded-lg bg-surface-container-high flex items-center justify-center hover:bg-surface-container-highest">✕</button>
            </div>
            <div className="flex-1 overflow-y-auto p-6">
              <div className="bg-surface-container-low rounded-xl p-5 text-sm font-korean leading-relaxed whitespace-pre-wrap">
                {previewTemplate.content.split(/(\{\{[^}]+\}\})/).map((part, i) =>
                  /^\{\{.+\}\}$/.test(part) ? (
                    <span key={i} className="inline-block bg-primary/15 text-primary font-semibold px-1 rounded text-xs mx-0.5">{part}</span>
                  ) : (
                    <span key={i}>{part}</span>
                  )
                )}
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
