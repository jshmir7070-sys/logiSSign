'use client';

import { type Dispatch, type SetStateAction, useCallback, useEffect, useMemo, useState } from 'react';
import Badge from '@/components/shared/Badge';
import { toastError, toastSuccess } from '@/components/shared/Toast';
import { createBrowserSupabaseClient } from '@/lib/supabase';
import {
  getContracts,
  getContractTemplates,
  type ContractTemplate,
  type ContractWithDriver,
} from '@/services/contract.service';
import {
  getDocumentDeliveries,
  sendDocuments,
  DELIVERY_STATUS_COLORS,
  DELIVERY_STATUS_LABELS,
  SEND_METHOD_LABELS,
  SEND_TYPE_LABELS,
  type DocumentDelivery,
  type SendMethod,
} from '@/services/document-send.service';
import { getPrincipals, normalizeFieldConfig, type Principal } from '@/services/principal.service';

interface DriverItem {
  id: string;
  name: string;
  phone: string;
  employee_code: string | null;
  address: string | null;
  business_reg_number: string | null;
  representative_name: string | null;
  business_address: string | null;
  is_business_owner: boolean;
  vat_included: boolean;
  delivery_area: string | null;
  vehicle_number: string | null;
  principal_id: string | null;
}

interface DocumentFileItem {
  id: string;
  title: string;
  status: string;
  field_count: number;
  created_at: string;
}

interface UnifiedHistoryItem {
  id: string;
  kind: 'contract' | 'document';
  driverId: string | null;
  driverName: string;
  title: string;
  subLabel: string;
  status: string;
  sentAt: string | null;
  completedAt: string | null;
}

type HistoryTab = 'all' | 'contract' | 'document';

const contractStatusLabel: Record<string, string> = {
  draft: '작성중',
  sent: '서명대기',
  viewed: '열람중',
  signed: '서명완료',
  expired: '만료',
};

const contractStatusVariant: Record<string, 'success' | 'warning' | 'error' | 'info' | 'default'> = {
  draft: 'default',
  sent: 'warning',
  viewed: 'info',
  signed: 'success',
  expired: 'error',
};

const docStatusClass: Record<string, string> = {
  blue: 'bg-blue-50 text-blue-700',
  cyan: 'bg-cyan-50 text-cyan-700',
  orange: 'bg-orange-50 text-orange-700',
  green: 'bg-green-50 text-green-700',
  red: 'bg-red-50 text-red-700',
  gray: 'bg-slate-100 text-slate-600',
};

const SEND_METHODS: SendMethod[] = ['push', 'sms', 'both'];

export default function DocumentSendCenterPage() {
  const [agencyId, setAgencyId] = useState<string | null>(null);
  const [agencyName, setAgencyName] = useState('');
  const [agencyBizNumber, setAgencyBizNumber] = useState('');
  const [agencyAddress, setAgencyAddress] = useState('');

  const [principals, setPrincipals] = useState<Principal[]>([]);
  const [principalId, setPrincipalId] = useState('');
  const [templates, setTemplates] = useState<ContractTemplate[]>([]);
  const [documents, setDocuments] = useState<DocumentFileItem[]>([]);
  const [drivers, setDrivers] = useState<DriverItem[]>([]);
  const [contracts, setContracts] = useState<ContractWithDriver[]>([]);
  const [deliveries, setDeliveries] = useState<DocumentDelivery[]>([]);

  const [loading, setLoading] = useState(true);
  const [sending, setSending] = useState(false);
  const [historyLoading, setHistoryLoading] = useState(true);

  const [search, setSearch] = useState('');
  const [selectedDriverIds, setSelectedDriverIds] = useState<Set<string>>(new Set());
  const [selectedTemplateIds, setSelectedTemplateIds] = useState<Set<string>>(new Set());
  const [selectedDocIds, setSelectedDocIds] = useState<Set<string>>(new Set());
  const [sendMethod, setSendMethod] = useState<SendMethod>('both');
  const [sendMessage, setSendMessage] = useState('');
  const [contractStartDate, setContractStartDate] = useState(new Date().toISOString().slice(0, 10));
  const [contractEndDate, setContractEndDate] = useState('');
  const [historyTab, setHistoryTab] = useState<HistoryTab>('all');
  const [sendSummary, setSendSummary] = useState<{ contracts: number; documents: number; failed: number } | null>(null);

  const loadSelectableData = useCallback(async (aid: string, selectedPrincipalId: string) => {
    const supabase = createBrowserSupabaseClient();

    const [templatesRes, documentFilesRes, driversRes] = await Promise.all([
      getContractTemplates(aid, selectedPrincipalId || undefined),
      supabase
        .from('document_files')
        .select('id, title, status, created_at')
        .eq('agency_id', aid)
        .order('created_at', { ascending: false }),
      supabase
        .from('drivers')
        .select('id, name, phone, employee_code, address, business_reg_number, representative_name, business_address, is_business_owner, vat_included, delivery_area, vehicle_number, principal_id')
        .eq('agency_id', aid)
        .eq('status', 'active')
        .order('name'),
    ]);

    if (templatesRes.data) {
      setTemplates(templatesRes.data);
    }

    if (documentFilesRes.data) {
      const docs: DocumentFileItem[] = [];
      for (const doc of documentFilesRes.data) {
        const { count } = await supabase
          .from('document_sign_fields')
          .select('id', { count: 'exact', head: true })
          .eq('document_file_id', doc.id);
        const fieldCount = count ?? 0;
        const normalizedStatus = doc.status === 'draft' && fieldCount > 0 ? 'ready' : doc.status;
        docs.push({
          id: doc.id,
          title: doc.title,
          status: normalizedStatus,
          field_count: fieldCount,
          created_at: doc.created_at,
        });
      }
      setDocuments(docs);
    }

    if (driversRes.data) {
      const allDrivers = driversRes.data as DriverItem[];
      const filteredDrivers = selectedPrincipalId
        ? allDrivers.filter((driver) => driver.principal_id === selectedPrincipalId || !driver.principal_id)
        : allDrivers;
      setDrivers(filteredDrivers);
      setSelectedDriverIds((prev) => {
        const next = new Set<string>();
        for (const driver of filteredDrivers) {
          if (prev.has(driver.id)) next.add(driver.id);
        }
        return next;
      });
    }
  }, []);

  const loadHistory = useCallback(async (aid: string) => {
    setHistoryLoading(true);
    const [contractsRes, deliveriesRes] = await Promise.all([
      getContracts(aid),
      getDocumentDeliveries(aid),
    ]);

    setContracts(contractsRes.data ?? []);
    setDeliveries(deliveriesRes.data ?? []);
    setHistoryLoading(false);
  }, []);

  useEffect(() => {
    async function init() {
      const supabase = createBrowserSupabaseClient();
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) {
        setLoading(false);
        return;
      }

      const aid = user.app_metadata?.agency_id as string | undefined;
      if (!aid) {
        setLoading(false);
        return;
      }

      setAgencyId(aid);

      const [principalRes, agencyRes] = await Promise.all([
        getPrincipals(aid),
        supabase.from('agencies').select('name, business_number, address').eq('id', aid).single(),
      ]);

      if (principalRes.data) setPrincipals(principalRes.data);
      if (agencyRes.data) {
        setAgencyName(agencyRes.data.name ?? '');
        setAgencyBizNumber(agencyRes.data.business_number ?? '');
        setAgencyAddress(agencyRes.data.address ?? '');
      }

      await Promise.all([
        loadSelectableData(aid, ''),
        loadHistory(aid),
      ]);

      setLoading(false);
    }

    init();
  }, [loadHistory, loadSelectableData]);

  useEffect(() => {
    if (!agencyId) return;
    loadSelectableData(agencyId, principalId);
  }, [agencyId, principalId, loadSelectableData]);

  const filteredDrivers = useMemo(() => {
    return drivers.filter((driver) => {
      if (!search) return true;
      return (
        driver.name.includes(search) ||
        (driver.phone ?? '').includes(search) ||
        (driver.employee_code ?? '').includes(search) ||
        (driver.delivery_area ?? '').includes(search)
      );
    });
  }, [drivers, search]);

  const previewDriver = useMemo(() => {
    const firstSelected = Array.from(selectedDriverIds)[0];
    return drivers.find((driver) => driver.id === firstSelected) ?? null;
  }, [drivers, selectedDriverIds]);

  const previewRows = useMemo(() => {
    if (!previewDriver) return [];
    const selectedPrincipal = principals.find((principal) => principal.id === principalId);
    return [
      ['기사명', previewDriver.name],
      ['전화번호', previewDriver.phone || '-'],
      ['주소', previewDriver.address || '-'],
      ['기사번호', previewDriver.employee_code || '-'],
      ['배송구역', previewDriver.delivery_area || '-'],
      ['대리점명', agencyName || '-'],
      ['거래처', selectedPrincipal?.name || '미지정'],
    ];
  }, [agencyName, previewDriver, principalId, principals]);

  const unifiedHistory = useMemo(() => {
    const hasDriverFilter = selectedDriverIds.size > 0;
    const selectedDrivers = selectedDriverIds;

    const contractItems: UnifiedHistoryItem[] = contracts
      .filter((contract) => !hasDriverFilter || (contract.driver_id ? selectedDrivers.has(contract.driver_id) : false))
      .map((contract) => ({
        id: `contract-${contract.id}`,
        kind: 'contract',
        driverId: contract.driver_id,
        driverName: contract.drivers?.name ?? '기사',
        title: contract.title,
        subLabel: '자동입력 계약서',
        status: contract.status,
        sentAt: contract.sent_at,
        completedAt: contract.signed_at,
      }));

    const deliveryItems: UnifiedHistoryItem[] = deliveries
      .filter((delivery) => !hasDriverFilter || selectedDrivers.has(delivery.driver_id))
      .map((delivery) => {
        const driverInfo = (delivery as unknown as { drivers?: { name: string } }).drivers;
        return {
          id: `delivery-${delivery.id}`,
          kind: 'document',
          driverId: delivery.driver_id,
          driverName: driverInfo?.name ?? '기사',
          title: delivery.title,
          subLabel: SEND_TYPE_LABELS[delivery.send_type] ?? '일반 문서',
          status: delivery.status,
          sentAt: delivery.sent_at,
          completedAt: delivery.signed_at ?? delivery.viewed_at,
        };
      });

    return [...contractItems, ...deliveryItems]
      .filter((item) => historyTab === 'all' || item.kind === historyTab)
      .sort((a, b) => new Date(b.sentAt ?? 0).getTime() - new Date(a.sentAt ?? 0).getTime());
  }, [contracts, deliveries, historyTab, selectedDriverIds]);

  const historyCounts = useMemo(() => {
    const total = unifiedHistory.length;
    const pending = unifiedHistory.filter((item) => ['sent', 'delivered', 'viewed'].includes(item.status)).length;
    const completed = unifiedHistory.filter((item) => item.status === 'signed').length;
    const rejected = unifiedHistory.filter((item) => item.status === 'rejected' || item.status === 'expired').length;
    return { total, pending, completed, rejected };
  }, [unifiedHistory]);

  const toggleSetItem = (setter: Dispatch<SetStateAction<Set<string>>>, id: string) => {
    setter((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const toggleAllDrivers = () => {
    setSelectedDriverIds((prev) => {
      if (prev.size === filteredDrivers.length) return new Set();
      return new Set(filteredDrivers.map((driver) => driver.id));
    });
  };

  const buildBindingDataMap = () => {
    const selectedPrincipal = principals.find((principal) => principal.id === principalId);
    const fieldConfig = selectedPrincipal ? normalizeFieldConfig(selectedPrincipal.field_config) : null;
    const employmentInsurance = fieldConfig?.deduction_section?.employment_insurance;
    const industrialInsurance = fieldConfig?.deduction_section?.industrial_insurance;

    const map: Record<string, Record<string, string>> = {};

    for (const driverId of Array.from(selectedDriverIds)) {
      const driver = drivers.find((item) => item.id === driverId);
      if (!driver) continue;

      map[driverId] = {
        기사명: driver.name,
        전화번호: driver.phone,
        주소: driver.address ?? '',
        기사번호: driver.employee_code ?? '',
        거래처명: selectedPrincipal?.name ?? '',
        배송지구: driver.delivery_area ?? '',
        배송단가: '-',
        반품단가: '-',
        집하단가: '-',
        노선별단가: '-',
        계약시작일: contractStartDate ? new Date(contractStartDate).toLocaleDateString('ko-KR') : '',
        계약종료일: contractEndDate ? new Date(contractEndDate).toLocaleDateString('ko-KR') : '',
        계약일: new Date().toLocaleDateString('ko-KR'),
        대리점명: agencyName,
        대리점사업자번호: agencyBizNumber,
        대리점주소: agencyAddress,
        사업자번호: driver.business_reg_number ?? '',
        대표자명: driver.representative_name ?? '',
        사업장주소: driver.business_address ?? '',
        부가세구분: driver.is_business_owner ? (driver.vat_included ? '포함가' : '별도가') : '해당없음',
        세금처리: driver.is_business_owner ? '세금계산서' : '3.3% 원천징수',
        차종: '',
        연식: '',
        차량번호: driver.vehicle_number ?? '',
        차대번호: '',
        연도별주행거리: '',
        리스잔존가치: '',
        보증금: '',
        보험부담: '본인',
        고용보험_기사부담: employmentInsurance?.enabled ? (employmentInsurance.split_mode === 'split_50_50' ? '50%' : '0%') : '-',
        고용보험_사업주부담: employmentInsurance?.enabled ? (employmentInsurance.split_mode === 'split_50_50' ? '50%' : '100%') : '-',
        산재보험_기사부담: industrialInsurance?.enabled ? (industrialInsurance.split_mode === 'split_50_50' ? '50%' : '0%') : '-',
        산재보험_사업주부담: industrialInsurance?.enabled ? (industrialInsurance.split_mode === 'split_50_50' ? '50%' : '100%') : '-',
      };
    }

    return map;
  };

  const handleSend = async () => {
    if (!agencyId) return;
    if (selectedDriverIds.size === 0) {
      toastError('기사를 1명 이상 선택해 주세요.');
      return;
    }
    if (selectedTemplateIds.size === 0 && selectedDocIds.size === 0) {
      toastError('보낼 계약서나 문서를 선택해 주세요.');
      return;
    }

    setSending(true);
    setSendSummary(null);

    let sentContracts = 0;
    let sentDocuments = 0;
    let failed = 0;

    if (selectedTemplateIds.size > 0) {
      try {
        const response = await fetch('/api/contracts/send', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            driverIds: Array.from(selectedDriverIds),
            templateIds: Array.from(selectedTemplateIds),
            bindingDataMap: buildBindingDataMap(),
          }),
        });

        const result = await response.json();
        if (response.ok) {
          sentContracts = result.created ?? 0;
        } else {
          failed += selectedDriverIds.size * selectedTemplateIds.size;
          toastError(result.error ?? '계약 발송에 실패했습니다.');
        }
      } catch {
        failed += selectedDriverIds.size * selectedTemplateIds.size;
        toastError('계약 발송 중 오류가 발생했습니다.');
      }
    }

    if (selectedDocIds.size > 0) {
      for (const docId of Array.from(selectedDocIds)) {
        const selectedDoc = documents.find((doc) => doc.id === docId);
        const result = await sendDocuments({
          agencyId,
          driverIds: Array.from(selectedDriverIds),
          sendType: 'general',
          sendMethod,
          title: selectedDoc?.title ?? '문서',
          message: sendMessage || undefined,
          documentFileId: docId,
        });

        if (result.error) {
          failed += selectedDriverIds.size;
        } else {
          sentDocuments += result.total;
          failed += result.failed;
        }
      }
    }

    setSendSummary({ contracts: sentContracts, documents: sentDocuments, failed });
    await loadHistory(agencyId);
    setSending(false);
    toastSuccess('전송 이력을 새로 불러왔습니다.');
  };

  const inputCls =
    'w-full h-10 px-3 rounded-xl bg-surface-container-low text-on-surface text-sm font-korean focus:outline-none focus:ring-2 focus:ring-primary/30';

  if (loading) {
    return (
      <div className="bg-surface-container-lowest rounded-2xl shadow-ambient p-12 text-center">
        <p className="text-sm text-on-surface-variant font-korean">전송 화면을 준비하는 중입니다.</p>
      </div>
    );
  }

  return (
    <div className="space-y-8 pb-12">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-headline font-bold text-on-surface font-korean">문서/서류전송</h1>
          <p className="mt-1 text-sm text-on-surface-variant font-korean">
            기사 선택, 자동입력 계약 전송, 일반 문서 발송, 완료 확인을 한 화면에서 처리합니다.
          </p>
        </div>
      </div>

      <div className="grid grid-cols-1 xl:grid-cols-[1.2fr_0.8fr] gap-6">
        <section className="bg-surface-container-lowest rounded-2xl shadow-ambient p-6 space-y-5">
          <div className="flex items-center justify-between gap-4">
            <div>
              <h2 className="text-base font-headline font-semibold text-on-surface font-korean">1. 기사 선택</h2>
              <p className="text-xs text-on-surface-variant font-korean mt-1">
                선택한 기사 정보는 계약 템플릿 전송 시 자동으로 채워집니다.
              </p>
            </div>
            <select value={principalId} onChange={(e) => setPrincipalId(e.target.value)} className="min-w-[180px] h-10 px-3 rounded-xl bg-surface-container-low text-sm text-on-surface font-korean focus:outline-none focus:ring-2 focus:ring-primary/30">
              <option value="">전체 거래처</option>
              {principals.map((principal) => (
                <option key={principal.id} value={principal.id}>
                  {principal.name}
                </option>
              ))}
            </select>
          </div>

          <div className="flex items-center gap-3">
            <div className="relative flex-1">
              <input
                type="text"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="기사명, 전화번호, 기사번호, 배송구역 검색"
                className="w-full pl-4 pr-4 py-2.5 rounded-xl bg-surface-container-low text-sm text-on-surface placeholder:text-on-surface-variant/50 font-korean focus:outline-none focus:ring-2 focus:ring-primary/30"
              />
            </div>
            <button
              onClick={toggleAllDrivers}
              className="h-10 px-4 rounded-xl bg-primary/10 text-primary text-sm font-semibold font-korean hover:bg-primary/20 transition-colors"
            >
              {selectedDriverIds.size === filteredDrivers.length && filteredDrivers.length > 0 ? '전체 해제' : '전체 선택'}
            </button>
          </div>

          <div className="rounded-2xl border border-outline-variant/15 overflow-hidden">
            <div className="grid grid-cols-[52px_1.2fr_1fr_0.9fr_0.9fr] gap-3 px-4 py-3 bg-surface-container-low text-xs font-semibold text-on-surface-variant font-korean">
              <span>선택</span>
              <span>기사명</span>
              <span>전화번호</span>
              <span>기사번호</span>
              <span>배송구역</span>
            </div>
            <div className="max-h-[320px] overflow-y-auto divide-y divide-outline-variant/10">
              {filteredDrivers.length === 0 ? (
                <div className="px-4 py-10 text-center text-sm text-on-surface-variant font-korean">조건에 맞는 기사가 없습니다.</div>
              ) : (
                filteredDrivers.map((driver) => {
                  const checked = selectedDriverIds.has(driver.id);
                  return (
                    <label key={driver.id} className="grid grid-cols-[52px_1.2fr_1fr_0.9fr_0.9fr] gap-3 px-4 py-3 text-sm hover:bg-surface-container-low/50 cursor-pointer">
                      <span className="flex items-center">
                        <input
                          type="checkbox"
                          checked={checked}
                          onChange={() => toggleSetItem(setSelectedDriverIds, driver.id)}
                          className="w-4 h-4 rounded accent-primary"
                        />
                      </span>
                      <span className="font-semibold text-on-surface font-korean">{driver.name}</span>
                      <span className="text-on-surface-variant font-data">{driver.phone || '-'}</span>
                      <span className="text-on-surface-variant font-data">{driver.employee_code || '-'}</span>
                      <span className="text-on-surface-variant font-korean">{driver.delivery_area || '-'}</span>
                    </label>
                  );
                })
              )}
            </div>
          </div>
        </section>

        <section className="bg-surface-container-lowest rounded-2xl shadow-ambient p-6 space-y-5">
          <div>
            <h2 className="text-base font-headline font-semibold text-on-surface font-korean">자동입력 미리보기</h2>
            <p className="text-xs text-on-surface-variant font-korean mt-1">
              계약 템플릿은 선택 기사 정보를 자동으로 넣어 발송합니다.
            </p>
          </div>

          {previewDriver ? (
            <>
              <div className="rounded-xl bg-primary/5 border border-primary/10 px-4 py-3">
                <p className="text-sm font-semibold text-primary font-korean">
                  {previewDriver.name}
                  {selectedDriverIds.size > 1 ? ` 외 ${selectedDriverIds.size - 1}명` : ''} 기준 미리보기
                </p>
              </div>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                {previewRows.map(([label, value]) => (
                  <div key={label} className="rounded-xl bg-surface-container-low p-4">
                    <p className="text-[11px] text-on-surface-variant font-korean mb-1">{label}</p>
                    <p className="text-sm text-on-surface font-korean break-all">{value}</p>
                  </div>
                ))}
              </div>
            </>
          ) : (
            <div className="rounded-xl bg-surface-container-low px-4 py-8 text-center text-sm text-on-surface-variant font-korean">
              기사 한 명 이상을 선택하면 자동입력 미리보기가 표시됩니다.
            </div>
          )}

          <div className="rounded-xl bg-surface-container-low p-4 space-y-2">
            <p className="text-sm font-semibold text-on-surface font-korean">전송 가이드</p>
            <p className="text-xs text-on-surface-variant font-korean">템플릿 계약서: 기사정보 자동입력 + 앱 알림 전송 + 서명 상태 추적</p>
            <p className="text-xs text-on-surface-variant font-korean">일반 문서: 업로드 원본 그대로 전송 + 선택한 방식으로 알림 + 열람/서명 이력 추적</p>
          </div>
        </section>
      </div>

      <div className="grid grid-cols-1 xl:grid-cols-[1fr_1fr] gap-6">
        <section className="bg-surface-container-lowest rounded-2xl shadow-ambient p-6 space-y-5">
          <div>
            <h2 className="text-base font-headline font-semibold text-on-surface font-korean">2. 자동입력 계약서 선택</h2>
            <p className="text-xs text-on-surface-variant font-korean mt-1">
              선택한 계약 템플릿은 기사별 자동입력값을 채워 전송됩니다.
            </p>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            {templates.length === 0 ? (
              <div className="rounded-xl bg-surface-container-low px-4 py-8 text-center text-sm text-on-surface-variant font-korean md:col-span-2">
                선택 가능한 계약 템플릿이 없습니다.
              </div>
            ) : (
              templates.map((template) => {
                const checked = selectedTemplateIds.has(template.id);
                return (
                  <button
                    key={template.id}
                    type="button"
                    onClick={() => toggleSetItem(setSelectedTemplateIds, template.id)}
                    className={`text-left rounded-2xl border p-4 transition-colors ${checked ? 'border-primary bg-primary/5' : 'border-outline-variant/15 hover:bg-surface-container-low'}`}
                  >
                    <div className="flex items-center justify-between gap-3">
                      <p className="text-sm font-semibold text-on-surface font-korean">{template.title}</p>
                      <input type="checkbox" readOnly checked={checked} className="w-4 h-4 accent-primary pointer-events-none" />
                    </div>
                    <p className="mt-2 text-xs text-on-surface-variant font-korean">
                      {template.principals?.name ?? '공통 템플릿'}
                    </p>
                  </button>
                );
              })
            )}
          </div>
        </section>

        <section className="bg-surface-container-lowest rounded-2xl shadow-ambient p-6 space-y-5">
          <div>
            <h2 className="text-base font-headline font-semibold text-on-surface font-korean">3. 일반 문서 선택</h2>
            <p className="text-xs text-on-surface-variant font-korean mt-1">
              업로드한 서류를 선택 기사에게 그대로 전송합니다.
            </p>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            {documents.length === 0 ? (
              <div className="rounded-xl bg-surface-container-low px-4 py-8 text-center text-sm text-on-surface-variant font-korean md:col-span-2">
                전송 가능한 일반 문서가 없습니다.
              </div>
            ) : (
              documents.map((doc) => {
                const checked = selectedDocIds.has(doc.id);
                return (
                  <button
                    key={doc.id}
                    type="button"
                    onClick={() => toggleSetItem(setSelectedDocIds, doc.id)}
                    className={`text-left rounded-2xl border p-4 transition-colors ${checked ? 'border-primary bg-primary/5' : 'border-outline-variant/15 hover:bg-surface-container-low'}`}
                  >
                    <div className="flex items-center justify-between gap-3">
                      <p className="text-sm font-semibold text-on-surface font-korean">{doc.title}</p>
                      <input type="checkbox" readOnly checked={checked} className="w-4 h-4 accent-primary pointer-events-none" />
                    </div>
                    <div className="mt-2 flex items-center gap-2 text-xs text-on-surface-variant font-korean">
                      <Badge label={doc.status} variant={doc.status === 'ready' ? 'success' : doc.status === 'sent' ? 'info' : 'warning'} />
                      <span>필드 {doc.field_count}개</span>
                    </div>
                  </button>
                );
              })
            )}
          </div>
        </section>
      </div>

      <section className="bg-surface-container-lowest rounded-2xl shadow-ambient p-6 space-y-5">
        <div>
          <h2 className="text-base font-headline font-semibold text-on-surface font-korean">4. 전송 설정</h2>
          <p className="text-xs text-on-surface-variant font-korean mt-1">
            계약 시작일과 안내 메시지를 함께 설정할 수 있습니다.
          </p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-4">
          <div>
            <label className="block text-xs font-medium text-on-surface-variant mb-1.5 font-korean">계약 시작일</label>
            <input type="date" value={contractStartDate} onChange={(e) => setContractStartDate(e.target.value)} className={inputCls} />
          </div>
          <div>
            <label className="block text-xs font-medium text-on-surface-variant mb-1.5 font-korean">계약 종료일</label>
            <input type="date" value={contractEndDate} onChange={(e) => setContractEndDate(e.target.value)} className={inputCls} />
          </div>
          <div className="md:col-span-2">
            <label className="block text-xs font-medium text-on-surface-variant mb-1.5 font-korean">일반 문서 전송 방식</label>
            <div className="flex flex-wrap gap-2">
              {SEND_METHODS.map((method) => (
                <button
                  key={method}
                  type="button"
                  onClick={() => setSendMethod(method)}
                  className={`h-10 px-4 rounded-xl text-sm font-semibold font-korean transition-colors ${sendMethod === method ? 'bg-primary text-white' : 'bg-surface-container-low text-on-surface-variant hover:bg-surface-container-high'}`}
                >
                  {SEND_METHOD_LABELS[method]}
                </button>
              ))}
            </div>
          </div>
        </div>

        <div>
          <label className="block text-xs font-medium text-on-surface-variant mb-1.5 font-korean">안내 메시지</label>
          <textarea
            value={sendMessage}
            onChange={(e) => setSendMessage(e.target.value)}
            rows={3}
            placeholder="기사에게 같이 보낼 안내 메시지를 입력해 주세요."
            className="w-full px-4 py-3 rounded-xl bg-surface-container-low text-sm text-on-surface placeholder:text-on-surface-variant/50 resize-none font-korean focus:outline-none focus:ring-2 focus:ring-primary/30"
          />
        </div>

        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          <div className="rounded-xl bg-surface-container-low px-4 py-4">
            <p className="text-[11px] text-on-surface-variant font-korean mb-1">선택 기사</p>
            <p className="text-lg font-bold text-on-surface font-data">{selectedDriverIds.size}</p>
          </div>
          <div className="rounded-xl bg-surface-container-low px-4 py-4">
            <p className="text-[11px] text-on-surface-variant font-korean mb-1">계약 템플릿</p>
            <p className="text-lg font-bold text-on-surface font-data">{selectedTemplateIds.size}</p>
          </div>
          <div className="rounded-xl bg-surface-container-low px-4 py-4">
            <p className="text-[11px] text-on-surface-variant font-korean mb-1">일반 문서</p>
            <p className="text-lg font-bold text-on-surface font-data">{selectedDocIds.size}</p>
          </div>
          <div className="rounded-xl bg-primary/5 border border-primary/10 px-4 py-4">
            <p className="text-[11px] text-primary font-korean mb-1">예상 전송 단위</p>
            <p className="text-lg font-bold text-primary font-data">
              {selectedDriverIds.size * selectedTemplateIds.size + selectedDriverIds.size * selectedDocIds.size}
            </p>
          </div>
        </div>

        {sendSummary && (
          <div className="rounded-xl bg-primary/5 border border-primary/10 px-4 py-4">
            <p className="text-sm font-semibold text-primary font-korean">최근 전송 결과</p>
            <p className="mt-1 text-sm text-on-surface font-korean">
              계약 {sendSummary.contracts}건, 일반 문서 {sendSummary.documents}건 전송 처리
              {sendSummary.failed > 0 ? ` / 실패 ${sendSummary.failed}건` : ''}
            </p>
          </div>
        )}

        <div className="flex justify-end">
          <button
            type="button"
            onClick={handleSend}
            disabled={sending}
            className="h-11 px-8 rounded-xl bg-power-gradient text-white font-semibold text-sm font-korean shadow-ambient hover:shadow-card transition-shadow disabled:opacity-50"
          >
            {sending ? '전송 중...' : '선택 기사에게 바로 전송'}
          </button>
        </div>
      </section>

      <section className="bg-surface-container-lowest rounded-2xl shadow-ambient p-6 space-y-5">
        <div className="flex items-center justify-between gap-4 flex-wrap">
          <div>
            <h2 className="text-base font-headline font-semibold text-on-surface font-korean">5. 완료 확인</h2>
            <p className="text-xs text-on-surface-variant font-korean mt-1">
              계약 서명 상태와 일반 문서 열람/서명 상태를 한 화면에서 확인합니다.
            </p>
          </div>
          <div className="flex gap-2 flex-wrap">
            {(['all', 'contract', 'document'] as HistoryTab[]).map((tab) => (
              <button
                key={tab}
                type="button"
                onClick={() => setHistoryTab(tab)}
                className={`h-9 px-4 rounded-xl text-sm font-semibold font-korean transition-colors ${historyTab === tab ? 'bg-primary text-white' : 'bg-surface-container-low text-on-surface-variant hover:bg-surface-container-high'}`}
              >
                {tab === 'all' ? '전체' : tab === 'contract' ? '계약' : '문서'}
              </button>
            ))}
            <button
              type="button"
              onClick={() => agencyId && loadHistory(agencyId)}
              className="h-9 px-4 rounded-xl bg-surface-container-low text-on-surface-variant text-sm font-semibold font-korean hover:bg-surface-container-high transition-colors"
            >
              새로고침
            </button>
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          <div className="rounded-xl bg-surface-container-low px-4 py-4">
            <p className="text-[11px] text-on-surface-variant font-korean mb-1">전체</p>
            <p className="text-lg font-bold text-on-surface font-data">{historyCounts.total}</p>
          </div>
          <div className="rounded-xl bg-amber-50 px-4 py-4">
            <p className="text-[11px] text-amber-700 font-korean mb-1">진행중</p>
            <p className="text-lg font-bold text-amber-700 font-data">{historyCounts.pending}</p>
          </div>
          <div className="rounded-xl bg-green-50 px-4 py-4">
            <p className="text-[11px] text-green-700 font-korean mb-1">완료</p>
            <p className="text-lg font-bold text-green-700 font-data">{historyCounts.completed}</p>
          </div>
          <div className="rounded-xl bg-red-50 px-4 py-4">
            <p className="text-[11px] text-red-700 font-korean mb-1">반려/만료</p>
            <p className="text-lg font-bold text-red-700 font-data">{historyCounts.rejected}</p>
          </div>
        </div>

        {historyLoading ? (
          <div className="rounded-xl bg-surface-container-low px-4 py-10 text-center text-sm text-on-surface-variant font-korean">
            이력을 불러오는 중입니다.
          </div>
        ) : unifiedHistory.length === 0 ? (
          <div className="rounded-xl bg-surface-container-low px-4 py-10 text-center text-sm text-on-surface-variant font-korean">
            표시할 전송 이력이 없습니다.
          </div>
        ) : (
          <div className="rounded-2xl border border-outline-variant/15 overflow-hidden">
            <div className="grid grid-cols-[0.9fr_0.9fr_1.6fr_0.8fr_0.9fr_0.9fr] gap-3 px-4 py-3 bg-surface-container-low text-xs font-semibold text-on-surface-variant font-korean">
              <span>구분</span>
              <span>기사</span>
              <span>문서명</span>
              <span>상태</span>
              <span>전송일</span>
              <span>완료일</span>
            </div>
            <div className="divide-y divide-outline-variant/10">
              {unifiedHistory.slice(0, 40).map((item) => (
                <div key={item.id} className="grid grid-cols-[0.9fr_0.9fr_1.6fr_0.8fr_0.9fr_0.9fr] gap-3 px-4 py-3 text-sm items-center">
                  <div>
                    <p className="font-semibold text-on-surface font-korean">{item.kind === 'contract' ? '계약' : '문서'}</p>
                    <p className="text-[11px] text-on-surface-variant font-korean">{item.subLabel}</p>
                  </div>
                  <p className="text-on-surface font-korean">{item.driverName}</p>
                  <p className="text-on-surface font-korean truncate" title={item.title}>{item.title}</p>
                  <div>
                    {item.kind === 'contract' ? (
                      <Badge label={contractStatusLabel[item.status] ?? item.status} variant={contractStatusVariant[item.status] ?? 'default'} />
                    ) : (
                      <span className={`inline-flex px-2.5 py-1 rounded-lg text-[11px] font-semibold font-korean ${docStatusClass[DELIVERY_STATUS_COLORS[item.status as keyof typeof DELIVERY_STATUS_COLORS] ?? 'gray']}`}>
                        {DELIVERY_STATUS_LABELS[item.status as keyof typeof DELIVERY_STATUS_LABELS] ?? item.status}
                      </span>
                    )}
                  </div>
                  <p className="text-on-surface-variant font-data text-xs">
                    {item.sentAt ? new Date(item.sentAt).toLocaleDateString('ko-KR') : '-'}
                  </p>
                  <p className="text-on-surface-variant font-data text-xs">
                    {item.completedAt ? new Date(item.completedAt).toLocaleDateString('ko-KR') : '-'}
                  </p>
                </div>
              ))}
            </div>
          </div>
        )}
      </section>
    </div>
  );
}
