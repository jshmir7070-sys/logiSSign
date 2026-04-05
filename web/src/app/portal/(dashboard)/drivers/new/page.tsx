'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { createBrowserSupabaseClient } from '@/lib/supabase';
import { getPrincipals, type Principal, normalizeFieldConfig, type CustomIncomeItem } from '@/services/principal.service';
import { createDriver } from '@/services/driver.service';
import { bulkUpsertDriverRouteRates } from '@/services/driver-route-rate.service';
import { bulkUpsertDriverDeductions } from '@/services/driver-deduction.service';
import { bulkCreateDriverRates } from '@/services/driver-rate.service';
import { getContractTemplates, createAndSendContracts, type ContractTemplate } from '@/services/contract.service';
import { createContractPeriod, type RateConfig } from '@/services/contractPeriod.service';
import AddressSearch, { type AddressValue } from '@/components/shared/AddressSearch';
import { formatPhoneNumber, formatBusinessNumber } from '@/lib/formatters';
import type { PackageType, RateType, DeductionType } from '@/types/database';

interface RouteRow { route_code: string; delivery_rate: string; return_rate: string }
interface DeductionRow { name: string; deduction_type: DeductionType; amount: string }

export default function NewDriverPage() {
  const router = useRouter();
  const [agencyId, setAgencyId] = useState<string | null>(null);
  const [agencyName, setAgencyName] = useState('');
  const [agencyBusinessNumber, setAgencyBusinessNumber] = useState('');
  const [agencyAddress, setAgencyAddress] = useState('');
  const [agencyOwnerName, setAgencyOwnerName] = useState('');
  const [agencyPhone, setAgencyPhone] = useState('');
  const [principals, setPrincipals] = useState<Principal[]>([]);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  /* ── 기본 정보 ── */
  const [principalId, setPrincipalId] = useState('');
  const [name, setName] = useState('');
  const [phone, setPhone] = useState('');
  const [address, setAddress] = useState('');
  const [addressDetail, setAddressDetail] = useState('');
  const [zonecode, setZonecode] = useState('');
  const [employeeCode, setEmployeeCode] = useState('');
  const [email, setEmail] = useState('');

  /* ── 정산 입금 계좌 ── */
  const [bankName, setBankName] = useState('');
  const [bankAccount, setBankAccount] = useState('');
  const [bankHolder, setBankHolder] = useState('');

  /* ── 사업자 정보 ── */
  const [isBusinessOwner, setIsBusinessOwner] = useState(true);
  const [businessRegNumber, setBusinessRegNumber] = useState('');
  const [representativeName, setRepresentativeName] = useState('');
  const [businessAddress, setBusinessAddress] = useState('');
  const [businessAddressDetail, setBusinessAddressDetail] = useState('');
  const [businessZonecode, setBusinessZonecode] = useState('');
  const [businessType, setBusinessType] = useState('');
  const [businessCategory, setBusinessCategory] = useState('');
  const [vatIncluded, setVatIncluded] = useState(true);
  const [taxType, setTaxType] = useState<'none' | 'withholding_3_3' | 'vat_invoice' | 'manual_reverse'>('vat_invoice');

  /* ── 초대코드 SMS ── */
  const [inviteSending, setInviteSending] = useState(false);
  const [inviteSentResult, setInviteSentResult] = useState<'success' | 'fail' | null>(null);

  async function handleSendInvite() {
    if (!agencyId || !name.trim() || !phone.trim()) return;
    setInviteSending(true);
    setInviteSentResult(null);
    try {
      const res = await fetch('/api/sms/invite', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          driverPhone: phone.trim(),
          driverName: name.trim(),
          agencyId,
        }),
      });
      if (res.ok) {
        setInviteSentResult('success');
      } else {
        const errData = await res.json().catch(() => ({}));
        console.error('[초대코드 전송 실패]', res.status, errData);
        setInviteSentResult('fail');
      }
    } catch (err) {
      console.error('[초대코드 전송 에러]', err);
      setInviteSentResult('fail');
    }
    setInviteSending(false);
  }

  /* ── 계약 / 단가 설정 ── */
  const [campName, setCampName] = useState('');
  const [deliveryArea, setDeliveryArea] = useState('');
  const [routeRates, setRouteRates] = useState<RouteRow[]>([{ route_code: '', delivery_rate: '', return_rate: '' }]);
  const [freshPct, setFreshPct] = useState('100');
  const [incentivePct, setIncentivePct] = useState('100');

  /* ── 카테고리 커스텀 필드 값 ── */
  const [customValues, setCustomValues] = useState<Record<string, string>>({});

  const selectedPrincipal = principals.find((p) => p.id === principalId);
  const fieldConfig = selectedPrincipal ? normalizeFieldConfig(selectedPrincipal.field_config) : null;

  function handlePrincipalChange(pid: string) {
    setPrincipalId(pid);
    setCustomValues({});
    setCampName('');
    setDeliveryArea('');
    setRouteRates([{ route_code: '', delivery_rate: '', return_rate: '' }]);
    setFreshPct('100');
    setIncentivePct('100');

    // 카테고리의 전체 차감항목을 기사 공제항목에 프리필
    const principal = principals.find((p) => p.id === pid);
    if (principal) {
      const fc = normalizeFieldConfig(principal.field_config);
      const prefilledDeductions: DeductionRow[] = [];
      const ds = fc.deduction_section;

      // 1) 고용보험 — deduction_section 또는 insurance_config에서 읽기
      const empDs = ds?.employment_insurance;
      const empIc = fc.insurance_config?.employment_insurance;
      if (empDs?.enabled || empIc?.enabled) {
        const rate = empIc?.rate ?? 0.9;
        const mode = empDs?.split_mode;
        prefilledDeductions.push({
          name: '고용보험',
          deduction_type: 'percentage' as DeductionType,
          amount: mode === 'split_50_50' ? String(rate) : mode === 'employer_100' ? '0' : String(rate),
        });
      }

      // 2) 산재보험 — deduction_section 또는 insurance_config에서 읽기
      const indDs = ds?.industrial_insurance;
      const indIc = fc.insurance_config?.industrial_insurance;
      if (indDs?.enabled || indIc?.enabled) {
        const rate = indIc?.rate ?? 1.8;
        const mode = indDs?.split_mode;
        prefilledDeductions.push({
          name: '산재보험',
          deduction_type: 'percentage' as DeductionType,
          amount: mode === 'split_50_50' ? String(rate) : mode === 'employer_100' ? '0' : String(rate),
        });
      }

      // 3) 화물사고
      if (ds?.cargo_accident?.enabled) {
        const ca = ds.cargo_accident;
        prefilledDeductions.push({
          name: '화물사고',
          deduction_type: ca.mode === 'fixed_amount' ? 'fixed' : ca.mode === 'percentage' ? 'percentage' : 'fixed',
          amount: ca.mode === 'actual_cost' ? '0' : String(ca.fixed_value || '0'),
        });
      }

      // 4) 차량임대료
      if (ds?.vehicle_rental?.enabled) {
        prefilledDeductions.push({
          name: '차량임대료',
          deduction_type: 'fixed' as DeductionType,
          amount: '0',  // 기사별 개별 입력
        });
      }

      // 5) 운송장 차감
      if (ds?.waybill?.enabled) {
        if (ds.waybill.return_count_price) {
          prefilledDeductions.push({
            name: '운송장 (반품)',
            deduction_type: 'per_unit' as DeductionType,
            amount: '0',
          });
        }
        if (ds.waybill.pickup_count_price) {
          prefilledDeductions.push({
            name: '운송장 (집하)',
            deduction_type: 'per_unit' as DeductionType,
            amount: '0',
          });
        }
      }

      // 6) 커스텀 차감항목 (보험 항목과 중복 방지)
      for (const d of fc.custom_deduction_items ?? []) {
        const alreadyAdded = prefilledDeductions.some((p) => p.name === d.name);
        if (!alreadyAdded) {
          prefilledDeductions.push({
            name: d.name,
            deduction_type: d.calc_method === 'fixed' ? 'fixed' : d.calc_method === 'per_count' ? 'per_unit' : 'percentage',
            amount: String(d.default_value || ''),
          });
        }
      }

      // 7) deduction_section 내 custom_deductions (별도 저장 경로)
      for (const d of ds?.custom_deductions ?? []) {
        // 위에서 이미 추가한 항목과 중복 방지
        const alreadyAdded = prefilledDeductions.some((p) => p.name === d.name);
        if (!alreadyAdded) {
          prefilledDeductions.push({
            name: d.name,
            deduction_type: d.calc_method === 'fixed' ? 'fixed' : d.calc_method === 'per_count' ? 'per_unit' : 'percentage',
            amount: String(d.default_value || ''),
          });
        }
      }

      setDeductions(prefilledDeductions);

      // 계약서 템플릿 로드
      if (agencyId) {
        getContractTemplates(agencyId, pid).then((res) => {
          if (res.data) {
            setContractTemplates(res.data);
            // 기본: 전체 선택
            setSelectedTemplateIds(new Set(res.data.map((t) => t.id)));
          }
        });
      }
    } else {
      setDeductions([]);
      setContractTemplates([]);
      setSelectedTemplateIds(new Set());
    }
  }

  /* ── 계약서 템플릿 ── */
  const [contractTemplates, setContractTemplates] = useState<ContractTemplate[]>([]);
  const [selectedTemplateIds, setSelectedTemplateIds] = useState<Set<string>>(new Set());
  const [contractStartDate, setContractStartDate] = useState(new Date().toISOString().slice(0, 10));
  const [contractEndDate, setContractEndDate] = useState('');

  /* ── 차량 임대 ── */
  const [vehicleOwner, setVehicleOwner] = useState<'self' | 'company'>('self');
  const [vehicleType, setVehicleType] = useState('');
  const [vehicleNumber, setVehicleNumber] = useState('');
  const [vehicleYear, setVehicleYear] = useState('');
  const [vehicleVin, setVehicleVin] = useState('');
  const [vehicleMileage, setVehicleMileage] = useState('');
  const [vehicleRentMonthly, setVehicleRentMonthly] = useState('');
  const [vehicleDeposit, setVehicleDeposit] = useState('');
  const [vehicleInsuranceBy, setVehicleInsuranceBy] = useState<'lessor' | 'lessee'>('lessor');

  /* ── 공제 항목 ── */
  const [deductions, setDeductions] = useState<DeductionRow[]>([]);

  function addDeductionRow() {
    setDeductions((prev) => [...prev, { name: '', deduction_type: 'fixed', amount: '' }]);
  }

  function removeDeductionRow(idx: number) {
    setDeductions((prev) => prev.filter((_, i) => i !== idx));
  }

  function updateDeduction(idx: number, field: string, value: string) {
    setDeductions((prev) => prev.map((d, i) => i === idx ? { ...d, [field]: value } : d));
  }

  useEffect(() => {
    async function load() {
      const supabase = createBrowserSupabaseClient();
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;
      const aid = user.app_metadata?.agency_id as string | undefined;
      if (!aid) return;
      setAgencyId(aid);
      const [principalResult, agencyResult] = await Promise.all([
        getPrincipals(aid),
        supabase.from('agencies').select('name, business_number, address, address_detail, owner_name, phone').eq('id', aid).single(),
      ]);
      if (principalResult.data) setPrincipals(principalResult.data);
      if (agencyResult.data) {
        const agency = agencyResult.data as { name: string; business_number: string | null; address: string | null; address_detail: string | null; owner_name: string | null; phone: string | null };
        setAgencyName(agency.name);
        setAgencyBusinessNumber(agency.business_number ?? '');
        setAgencyAddress(agency.address ? (agency.address + (agency.address_detail ? ' ' + agency.address_detail : '')) : '');
        setAgencyOwnerName(agency.owner_name ?? '');
        setAgencyPhone(agency.phone ?? '');
      }
    }
    load();
  }, []);

  function addRouteRow() {
    setRouteRates((prev) => [...prev, { route_code: '', delivery_rate: '', return_rate: '' }]);
  }

  function removeRouteRow(idx: number) {
    setRouteRates((prev) => prev.filter((_, i) => i !== idx));
  }

  function updateRoute(idx: number, field: string, value: string) {
    setRouteRates((prev) => prev.map((r, i) => i === idx ? { ...r, [field]: value } : r));
  }

  async function handleSubmit() {
    if (!agencyId || !name.trim() || !phone.trim() || !principalId) {
      setError('필수 항목을 모두 입력하세요 (카테고리, 이름, 전화번호)');
      return;
    }

    // 플랜별 기사 수 제한 체크
    const supabaseCheck = createBrowserSupabaseClient();
    const { data: { user: currentUser } } = await supabaseCheck.auth.getUser();
    const currentPlan = currentUser?.app_metadata?.plan as string ?? 'free';
    const { getPlanLimits } = await import('@/lib/plan-limits');
    const limits = getPlanLimits(currentPlan);
    if (limits.maxDrivers !== null) {
      const { count } = await supabaseCheck.from('drivers').select('id', { count: 'exact', head: true }).eq('agency_id', agencyId).eq('status', 'active');
      if ((count ?? 0) >= limits.maxDrivers) {
        setError(`현재 ${currentPlan.toUpperCase()} 플랜에서는 기사를 최대 ${limits.maxDrivers}명까지 등록할 수 있습니다. 더 많은 기사를 등록하려면 플랜을 업그레이드하세요.`);
        return;
      }
    }

    setSaving(true);
    setError('');

    // 1. Create driver + 원청사 연결 (초대코드 SMS는 상단에서 별도 전송)
    const result = await createDriver({
      agency_id: agencyId,
      name: name.trim(),
      phone: phone.trim(),
      principalIds: [principalId],
      sendInviteSms: false,   // SMS는 상단 버튼에서 이미 전송
    });

    if (result.error || !result.data) {
      setError(result.error ?? '기사 등록 실패');
      setSaving(false);
      return;
    }

    const driverId = result.data.id;
    const supabase = createBrowserSupabaseClient();

    // 2. Update all fields — service_role API를 거쳐 RLS 우회
    const updatePayload = {
      employee_code: employeeCode.trim() || null,
      address: (addressDetail ? `${address} ${addressDetail}` : address).trim() || null,
      email: email.trim() || null,
      delivery_area: deliveryArea.trim() || null,
      camp_name: campName.trim() || null,
      is_business_owner: isBusinessOwner,
      business_reg_number: businessRegNumber.trim() || null,
      representative_name: representativeName.trim() || null,
      business_address: (businessAddressDetail ? `${businessAddress} ${businessAddressDetail}` : businessAddress).trim() || null,
      business_type: businessType.trim() || null,
      business_category: businessCategory.trim() || null,
      vat_included: vatIncluded,
      tax_type: isBusinessOwner ? taxType : 'withholding_3_3',
      fresh_incentive_pct: Number(freshPct) || 100,
      extra_incentive_pct: Number(incentivePct) || 100,
      rate_mode: fieldConfig?.items?.delivery?.rate_mode === 'unit_price' ? 'route' : fieldConfig?.items?.delivery?.rate_mode === 'percentage' ? 'percentage' : 'flat',
      flat_rate: Number(customValues['delivery_fee_same'] || customValues['delivery_delivery_price'] || customValues['delivery_unit_price'] || 0),
      rate_percentage: Number(customValues['delivery_rate_pct'] || 0),
      vehicle_number: vehicleNumber.trim() || null,
      vehicle_type: vehicleType.trim() || null,
      vehicle_year: vehicleYear.trim() || null,
      vehicle_vin: vehicleVin.trim() || null,
      vehicle_mileage: Number(vehicleMileage) || null,
      vehicle_owner: vehicleOwner,
      vehicle_rent_monthly: Number(vehicleRentMonthly) || 0,
      vehicle_deposit: Number(vehicleDeposit) || 0,
      bank_name: bankName || null,
      bank_account: bankAccount.replace(/[^0-9-]/g, '') || null,
      bank_holder: bankHolder.trim() || null,
      vehicle_insurance_by: vehicleInsuranceBy,
      custom_values: Object.keys(customValues).length > 0 ? customValues : null,
    };

    // ✅ 서버 API 경유 → service_role로 RLS 우회
    // 기사 기본 정보 + 단가 + 노선단가 + 공제 일괄 전송
    const driverRatesPayload: { package_type: string; unit_price: number; rate_type: string }[] = [];
    if (fieldConfig) {
      const deliveryCfg = fieldConfig.items.delivery;
      const feeSame = deliveryCfg?.fee_same;
      const feeSeparate = deliveryCfg?.fee_separate;
      const typeLabels: Record<string, string> = { delivery: '배송', return: '반품', pickup: '집하' };
      const rateType = deliveryCfg?.rate_mode === 'percentage' ? 'percentage' : 'fixed';

      if (feeSame) {
        // 동일수수료: 배송/반품에 같은 단가 적용
        const sameValue = Number(customValues['delivery_fee_same'] ?? customValues['delivery_unit_price'] ?? 0);
        if (sameValue > 0) {
          driverRatesPayload.push({ package_type: '배송', unit_price: sameValue, rate_type: rateType });
          if (fieldConfig.items.return?.enabled) {
            driverRatesPayload.push({ package_type: '반품', unit_price: sameValue, rate_type: rateType });
          }
        }
      } else if (feeSeparate) {
        // 별도수수료: 배송/반품 각각
        const delVal = Number(customValues['delivery_delivery_price'] ?? 0);
        const retVal = Number(customValues['delivery_return_price'] ?? 0);
        if (delVal > 0) driverRatesPayload.push({ package_type: '배송', unit_price: delVal, rate_type: rateType });
        if (retVal > 0) driverRatesPayload.push({ package_type: '반품', unit_price: retVal, rate_type: rateType });
      } else {
        // 기본: 타입별 개별 입력
        const types: ('delivery' | 'return' | 'pickup')[] = ['delivery', 'return', 'pickup'];
        for (const t of types) {
          const cfg = fieldConfig.items[t];
          if (!cfg?.enabled) continue;
          const value = Number(customValues[`${t}_unit_price`] ?? 0);
          if (value > 0) {
            driverRatesPayload.push({
              package_type: typeLabels[t],
              unit_price: value,
              rate_type: cfg.rate_mode === 'percentage' ? 'percentage' : 'fixed',
            });
          }
        }
      }

      // 집하 (pickup) 별도 처리
      if (fieldConfig.items.pickup?.enabled) {
        const pickupVal = Number(customValues['pickup_unit_price'] ?? 0);
        if (pickupVal > 0 && !driverRatesPayload.some(r => r.package_type === '집하')) {
          driverRatesPayload.push({ package_type: '집하', unit_price: pickupVal, rate_type: rateType });
        }
      }
      for (const item of fieldConfig.custom_income_items ?? []) {
        const value = Number(customValues[`income_${item.id}`] ?? item.default_value ?? 0);
        if (value > 0) {
          driverRatesPayload.push({
            package_type: item.name,
            unit_price: value,
            rate_type: item.calc_method === 'rate_percent' ? 'percentage' : 'fixed',
          });
        }
      }
    }

    const routeRatesPayload = fieldConfig?.items?.delivery?.rate_mode === 'unit_price'
      ? routeRates
          .filter((r) => r.route_code.trim() && (Number(r.delivery_rate) > 0))
          .map((r) => ({
            route_code: r.route_code.trim().toUpperCase(),
            delivery_rate: Number(r.delivery_rate) || 0,
            return_rate: Number(r.return_rate) || Number(r.delivery_rate) || 0,
          }))
      : [];

    const deductionsPayload = deductions
      .filter((d) => d.name.trim() && Number(d.amount) > 0)
      .map((d) => ({
        name: d.name.trim(),
        deduction_type: d.deduction_type,
        amount: Number(d.amount),
      }));

    // 차량 임대료 자동 공제 추가
    if (vehicleOwner === 'company' && Number(vehicleRentMonthly) > 0) {
      const alreadyHasRent = deductionsPayload.some((d) => d.name === '차량 임대료');
      if (!alreadyHasRent) {
        deductionsPayload.push({
          name: '차량 임대료',
          deduction_type: 'fixed' as const,
          amount: Number(vehicleRentMonthly),
        });
      }
    }

    try {
      const updateRes = await fetch('/api/drivers/update', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          driverId,
          ...updatePayload,
          driverRates: driverRatesPayload,
          routeRates: routeRatesPayload,
          deductions: deductionsPayload,
        }),
      });
      if (!updateRes.ok) {
        const errData = await updateRes.json().catch(() => ({}));
        console.error('[Driver Update] API 실패:', errData);
      }
    } catch (err) {
      console.error('[Driver Update] 요청 에러:', err);
    }

    // 3. 선택된 계약서 자동 생성 + 전송 — bind API로 자동 바인딩
    if (selectedTemplateIds.size > 0 && agencyId) {
      try {
        // bind API: DB에서 68개 필드 자동 조회
        const bindRes = await fetch('/api/contracts/bind', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            driverId,
            agencyId,
            principalId: principalId || undefined,
            periodStart: contractStartDate || undefined,
            periodEnd: contractEndDate || undefined,
          }),
        });
        const bindResult = await bindRes.json();

        if (bindRes.ok && bindResult.bindingData) {
          await createAndSendContracts(agencyId, driverId, Array.from(selectedTemplateIds), bindResult.bindingData);
          console.log('[계약서] 바인딩 meta:', bindResult.meta);
        } else {
          console.error('[계약서] bind API 실패:', bindResult.error);
          // fallback: 바인딩 없이 원본 발송
          await createAndSendContracts(agencyId, driverId, Array.from(selectedTemplateIds), {});
        }
      } catch (err) {
        console.error('[계약서] bind 에러:', err);
        await createAndSendContracts(agencyId, driverId, Array.from(selectedTemplateIds), {});
      }
    }

    // 7. 계약 기간 (정산 적용 기간) 자동 생성
    if (agencyId && contractStartDate && contractEndDate) {
      const empIns = fieldConfig?.deduction_section?.employment_insurance;
      const indIns = fieldConfig?.deduction_section?.industrial_insurance;
      const periodRateConfig: RateConfig = {
        delivery_unit_price: Number(customValues['delivery_unit_price'] || 0),
        return_unit_price: Number(customValues['return_unit_price'] || 0),
        pickup_unit_price: Number(customValues['pickup_unit_price'] || 0),
        delivery_rate_mode: fieldConfig?.items?.delivery?.rate_mode ?? 'unit_price',
        return_rate_mode: fieldConfig?.items?.return?.rate_mode,
        pickup_rate_mode: fieldConfig?.items?.pickup?.rate_mode,
        route_rates: (fieldConfig?.items?.delivery?.rate_mode ?? 'unit_price') === 'unit_price'
          ? routeRates.filter((r) => r.route_code.trim()).map((r) => ({
              route_code: r.route_code.trim(),
              delivery_rate: Number(r.delivery_rate),
              return_rate: Number(r.return_rate || r.delivery_rate),
            }))
          : undefined,
        insurance: {
          employment_driver: empIns?.enabled ? (empIns.split_mode === 'split_50_50' ? '50%' : '0%') : '-',
          employment_employer: empIns?.enabled ? (empIns.split_mode === 'split_50_50' ? '50%' : '100%') : '-',
          industrial_driver: indIns?.enabled ? (indIns.split_mode === 'split_50_50' ? '50%' : '0%') : '-',
          industrial_employer: indIns?.enabled ? (indIns.split_mode === 'split_50_50' ? '50%' : '100%') : '-',
        },
      };

      await createContractPeriod({
        agencyId,
        driverId,
        principalId: principalId || undefined,
        periodStart: contractStartDate,
        periodEnd: contractEndDate,
        rateConfig: periodRateConfig,
        memo: '최초 계약',
      });
    }

    setSaving(false);

    // ✅ 등록 완료 팝업
    alert(`✅ ${name.trim()}님이 기사로 등록되었습니다.`);
    router.push(`/portal/drivers/${driverId}`);
  }

  /* ── 은행별 계좌번호 자동 포맷 ── */
  const BANK_OPTIONS = [
    '국민은행', '신한은행', '우리은행', '하나은행', 'SC제일은행',
    '기업은행', '농협은행', '수협은행', '산업은행', '카카오뱅크',
    '토스뱅크', '케이뱅크', '대구은행', '부산은행', '경남은행',
    '광주은행', '전북은행', '제주은행', '새마을금고', '신협',
    '우체국', '기타',
  ];

  const BANK_ACCOUNT_FORMATS: Record<string, number[]> = {
    '국민은행': [3, 2, 4, 3],      // 000-00-0000-000
    '신한은행': [3, 3, 6],          // 000-000-000000
    '우리은행': [4, 3, 6],          // 0000-000-000000
    '하나은행': [3, 6, 5],          // 000-000000-00000
    'SC제일은행': [3, 2, 6],        // 000-00-000000
    '기업은행': [3, 6, 2, 3],       // 000-000000-00-000
    '농협은행': [3, 4, 4, 2],       // 000-0000-0000-00
    '수협은행': [3, 2, 6, 2],       // 000-00-000000-0
    '산업은행': [3, 6, 3, 2],       // 000-000000-000-00
    '카카오뱅크': [4, 2, 7],         // 0000-00-0000000
    '토스뱅크': [4, 4, 4],          // 0000-0000-0000
    '케이뱅크': [3, 3, 7],          // 000-000-0000000
    '대구은행': [3, 2, 6, 1],       // 000-00-000000-0
    '부산은행': [3, 4, 4, 2],       // 000-0000-0000-00
  };

  function formatBankAccount(value: string, bank: string): string {
    const digits = value.replace(/[^0-9]/g, '');
    const format = BANK_ACCOUNT_FORMATS[bank];
    if (!format) return digits;

    let result = '';
    let pos = 0;
    for (let i = 0; i < format.length; i++) {
      const chunk = digits.slice(pos, pos + format[i]);
      if (!chunk) break;
      if (i > 0) result += '-';
      result += chunk;
      pos += format[i];
    }
    // 남은 자릿수
    if (pos < digits.length) {
      result += digits.slice(pos);
    }
    return result;
  }

  const inputCls = 'w-full h-11 px-4 rounded-xl bg-surface-container-low text-on-surface text-sm focus:outline-none focus:ring-2 focus:ring-primary/30 placeholder:text-on-surface-variant/40';
  const labelCls = 'block text-xs font-label font-medium text-on-surface-variant mb-1.5 font-korean';

  return (
    <div className="space-y-8 pb-12">
      {/* Header */}
      <div className="flex items-center gap-4">
        <button
          onClick={() => router.push('/portal/drivers')}
          className="w-10 h-10 rounded-xl bg-surface-container-low flex items-center justify-center hover:bg-surface-container-high transition-colors"
        >
          <svg width="20" height="20" viewBox="0 0 24 24" fill="currentColor" className="text-on-surface-variant">
            <path d="M20 11H7.83l5.59-5.59L12 4l-8 8 8 8 1.41-1.41L7.83 13H20v-2z" />
          </svg>
        </button>
        <div>
          <h1 className="text-2xl font-headline font-bold text-on-surface font-korean">신규 기사 등록</h1>
          <p className="mt-1 text-sm text-on-surface-variant font-korean">기사 정보, 사업자 정보, 계약 단가를 설정합니다</p>
        </div>
      </div>

      {error && <div className="bg-error/10 text-error rounded-xl px-4 py-3 text-sm font-korean">{error}</div>}

      {/* ═══ 1. 기본 정보 ═══ */}
      <section className="bg-surface-container-lowest rounded-2xl shadow-ambient p-6 space-y-4">
        <h2 className="text-base font-headline font-semibold text-on-surface font-korean">기본 정보</h2>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          <div>
            <label className={labelCls}>카테고리 (거래처) *</label>
            <select value={principalId} onChange={(e) => handlePrincipalChange(e.target.value)}
              className={`${inputCls} font-korean`}>
              <option value="">선택하세요</option>
              {principals.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}
            </select>
          </div>
          <div>
            <label className={labelCls}>이름 *</label>
            <input type="text" value={name} onChange={(e) => setName(e.target.value)}
              placeholder="홍길동" className={`${inputCls} font-korean`} />
          </div>
          <div>
            <label className={labelCls}>전화번호 *</label>
            <input type="text" value={phone} onChange={(e) => setPhone(formatPhoneNumber(e.target.value))}
              placeholder="010-1234-5678" maxLength={13} className={`${inputCls} font-data`} />
          </div>
          <div className="sm:col-span-2 lg:col-span-3">
            <AddressSearch
              value={address}
              detailValue={addressDetail}
              zonecodeValue={zonecode}
              label="주소"
              inline
              onChange={(addr: AddressValue) => {
                setAddress(addr.address);
                setAddressDetail(addr.addressDetail);
                setZonecode(addr.zonecode);
              }}
            />
          </div>
          <div>
            <label className={labelCls}>사번 / 아이디 *</label>
            <input type="text" value={employeeCode} onChange={(e) => setEmployeeCode(e.target.value)}
              placeholder="사번 입력" className={`${inputCls} font-data`} />
            <p className="text-[11px] text-on-surface-variant/60 mt-1 font-korean">엑셀 정산 시 자동 매칭 키</p>
          </div>
          <div>
            <label className={labelCls}>이메일</label>
            <input type="email" value={email} onChange={(e) => setEmail(e.target.value)}
              placeholder="driver@email.com" className={`${inputCls} font-data`} />
          </div>
        </div>

        {/* 정산 입금 계좌 */}
        <div className="pt-5 mt-5 border-t border-outline-variant/20">
          <p className="text-xs font-semibold text-on-surface font-korean mb-3 flex items-center gap-1.5">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect x="2" y="5" width="20" height="14" rx="2"/><line x1="2" y1="10" x2="22" y2="10"/></svg>
            정산 입금 계좌
          </p>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <div>
              <label className={labelCls}>은행</label>
              <select
                value={bankName}
                onChange={(e) => {
                  setBankName(e.target.value);
                  // 은행 변경 시 계좌번호 재포맷
                  if (bankAccount) {
                    setBankAccount(formatBankAccount(bankAccount, e.target.value));
                  }
                }}
                className={`${inputCls} font-korean`}
              >
                <option value="">선택하세요</option>
                {BANK_OPTIONS.map((b) => (
                  <option key={b} value={b}>{b}</option>
                ))}
              </select>
            </div>
            <div>
              <label className={labelCls}>계좌번호</label>
              <input
                type="text"
                value={bankAccount}
                onChange={(e) => setBankAccount(formatBankAccount(e.target.value, bankName))}
                placeholder={bankName ? (BANK_ACCOUNT_FORMATS[bankName] ? BANK_ACCOUNT_FORMATS[bankName].map(n => '0'.repeat(n)).join('-') : '계좌번호') : '은행을 먼저 선택하세요'}
                className={`${inputCls} font-data`}
                maxLength={25}
              />
            </div>
            <div>
              <label className={labelCls}>예금주</label>
              <input type="text" value={bankHolder} onChange={(e) => setBankHolder(e.target.value)}
                placeholder="예금주명" className={`${inputCls} font-korean`} />
            </div>
          </div>
        </div>

        {/* 초대코드 SMS 즉시 전송 */}
        <div className="pt-4 border-t border-outline-variant/20">
          <div className="flex items-center gap-3">
            <div className="flex-1">
              <p className="text-sm font-body font-semibold text-on-surface font-korean">초대코드 SMS 전송</p>
              <p className="text-[11px] text-on-surface-variant/60 font-korean mt-0.5">
                이름, 전화번호 입력 후 초대코드 + 앱 다운로드 링크를 즉시 발송합니다
              </p>
            </div>
            <button
              type="button"
              onClick={handleSendInvite}
              disabled={inviteSending || !name.trim() || !phone.trim() || !agencyId || inviteSentResult === 'success'}
              className={`h-10 px-5 rounded-xl text-sm font-label font-semibold transition-all flex items-center gap-2 shrink-0 font-korean ${
                inviteSentResult === 'success'
                  ? 'bg-primary/10 text-primary cursor-default'
                  : 'bg-primary text-white hover:bg-primary/90 disabled:opacity-40 disabled:cursor-not-allowed'
              }`}
            >
              {inviteSending ? (
                <>
                  <svg className="animate-spin w-4 h-4" viewBox="0 0 24 24" fill="none"><circle cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="3" className="opacity-25"/><path d="M4 12a8 8 0 018-8" stroke="currentColor" strokeWidth="3" strokeLinecap="round"/></svg>
                  전송 중...
                </>
              ) : inviteSentResult === 'success' ? (
                <>
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor"><path d="M9 16.17L4.83 12l-1.42 1.41L9 19 21 7l-1.41-1.41z"/></svg>
                  전송 완료
                </>
              ) : (
                <>
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor"><path d="M20 2H4c-1.1 0-2 .9-2 2v18l4-4h14c1.1 0 2-.9 2-2V4c0-1.1-.9-2-2-2zm0 14H5.17L4 17.17V4h16v12z"/><path d="M12 15l1.57-3.43L17 10l-3.43-1.57L12 5l-1.57 3.43L7 10l3.43 1.57z"/></svg>
                  초대코드 전송
                </>
              )}
            </button>
          </div>
          {inviteSentResult === 'success' && (
            <div className="mt-2.5 px-3 py-2 rounded-lg bg-primary/[0.06] border border-primary/15 text-xs font-korean flex items-start gap-2">
              <svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor" className="text-primary shrink-0 mt-0.5"><path d="M9 16.17L4.83 12l-1.42 1.41L9 19 21 7l-1.41-1.41z"/></svg>
              <div>
                <p className="text-primary font-semibold">초대코드 SMS 전송 완료</p>
                <p className="text-on-surface-variant/70 mt-0.5">{phone} 으로 초대코드 + 앱 설치 링크가 발송되었습니다</p>
              </div>
            </div>
          )}
          {inviteSentResult === 'fail' && (
            <div className="mt-2.5 px-3 py-2 rounded-lg bg-error/[0.06] border border-error/15 text-xs font-korean flex items-start gap-2">
              <svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor" className="text-error shrink-0 mt-0.5"><path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm1 15h-2v-2h2v2zm0-4h-2V7h2v6z"/></svg>
              <div>
                <p className="text-error font-semibold">전송 실패</p>
                <p className="text-on-surface-variant/70 mt-0.5">대리점 초대코드가 설정되지 않았거나 SMS 발송에 실패했습니다</p>
                <button onClick={() => setInviteSentResult(null)} className="text-primary font-semibold mt-1 hover:underline">다시 시도</button>
              </div>
            </div>
          )}
          {!name.trim() || !phone.trim() ? (
            <p className="mt-2 text-[11px] text-on-surface-variant/40 font-korean">
              이름과 전화번호를 입력하면 전송 버튼이 활성화됩니다
            </p>
          ) : null}
        </div>
      </section>

      {/* ═══ 2. 사업자 / 세금 처리 ═══ */}
      <section className="bg-surface-container-lowest rounded-2xl shadow-ambient p-6 space-y-5">
        <div className="flex items-center justify-between">
          <h2 className="text-base font-headline font-semibold text-on-surface font-korean">사업자 / 세금 처리</h2>
          <select value={isBusinessOwner ? 'true' : 'false'}
            onChange={(e) => {
              const biz = e.target.value === 'true';
              setIsBusinessOwner(biz);
              setTaxType(biz ? 'vat_invoice' : 'withholding_3_3');
            }}
            className="h-9 px-3 rounded-lg bg-surface-container-low text-sm font-korean focus:outline-none focus:ring-2 focus:ring-primary/30">
            <option value="true">사업자 유</option>
            <option value="false">사업자 무</option>
          </select>
        </div>

        {/* 세금 처리 방식 */}
        <div>
          <label className={labelCls}>세금 처리 방식</label>
          {isBusinessOwner ? (
            <div className="flex gap-3">
              <button type="button" onClick={() => setTaxType('vat_invoice')}
                className={`flex-1 p-3 rounded-xl border-2 text-left transition-all ${taxType === 'vat_invoice' ? 'border-primary bg-primary/5' : 'border-outline-variant/20 hover:border-outline-variant/40'}`}>
                <p className="text-sm font-body font-semibold text-on-surface font-korean">세금계산서 발행요청</p>
                <p className="text-xs text-on-surface-variant mt-0.5 font-korean">기사에게 세금계산서 발행 요청</p>
              </button>
              <button type="button" onClick={() => setTaxType('manual_reverse')}
                className={`flex-1 p-3 rounded-xl border-2 text-left transition-all ${taxType === 'manual_reverse' ? 'border-primary bg-primary/5' : 'border-outline-variant/20 hover:border-outline-variant/40'}`}>
                <p className="text-sm font-body font-semibold text-on-surface font-korean">수기 역발행</p>
                <p className="text-xs text-on-surface-variant mt-0.5 font-korean">대리점에서 직접 역발행 처리</p>
              </button>
            </div>
          ) : (
            <div className="p-3 rounded-xl border-2 border-primary bg-primary/5">
              <p className="text-sm font-body font-semibold text-on-surface font-korean">3.3% 원천징수</p>
              <p className="text-xs text-on-surface-variant mt-0.5 font-korean">사업자 미등록 시 정산금액에서 3.3% 원천징수 후 지급</p>
            </div>
          )}
        </div>

        {isBusinessOwner && (
          <>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
              <div>
                <label className={labelCls}>사업자등록번호</label>
                <input type="text" value={businessRegNumber} onChange={(e) => setBusinessRegNumber(formatBusinessNumber(e.target.value))}
                  placeholder="123-45-67890" maxLength={12} className={`${inputCls} font-data`} />
              </div>
              <div>
                <label className={labelCls}>대표자</label>
                <input type="text" value={representativeName} onChange={(e) => setRepresentativeName(e.target.value)}
                  placeholder="대표자명" className={`${inputCls} font-korean`} />
              </div>
              <div className="sm:col-span-2 lg:col-span-3">
                <AddressSearch
                  value={businessAddress}
                  detailValue={businessAddressDetail}
                  zonecodeValue={businessZonecode}
                  label="사업장주소"
                  inline
                  onChange={(addr: AddressValue) => {
                    setBusinessAddress(addr.address);
                    setBusinessAddressDetail(addr.addressDetail);
                    setBusinessZonecode(addr.zonecode);
                  }}
                />
              </div>
              <div>
                <label className={labelCls}>업종</label>
                <input type="text" value={businessType} onChange={(e) => setBusinessType(e.target.value)}
                  placeholder="운수업" className={`${inputCls} font-korean`} />
              </div>
              <div>
                <label className={labelCls}>업태</label>
                <input type="text" value={businessCategory} onChange={(e) => setBusinessCategory(e.target.value)}
                  placeholder="화물운송" className={`${inputCls} font-korean`} />
              </div>
              <div>
                <label className={labelCls}>부가세</label>
                <select value={vatIncluded ? 'included' : 'excluded'}
                  onChange={(e) => setVatIncluded(e.target.value === 'included')}
                  className={`${inputCls} font-korean`}>
                  <option value="included">포함가 (VAT 포함 단가)</option>
                  <option value="excluded">별도 (VAT 별도 청구)</option>
                </select>
                {vatIncluded && (
                  <p className="text-[11px] text-on-surface-variant/60 mt-1 font-korean">포함가 선택 시 정산금액에서 부가세(÷1.1) 역산 공제</p>
                )}
              </div>
            </div>
          </>
        )}
      </section>

      {/* ═══ 3. 계약 배송구역 및 지급액 (카테고리 설정값 기반) ═══ */}
      {principalId && fieldConfig ? (
      <section className="bg-surface-container-lowest rounded-2xl shadow-ambient p-6 space-y-5">
        <div>
          <h2 className="text-base font-headline font-semibold text-on-surface font-korean">
            계약 배송구역 및 지급액 ({selectedPrincipal?.name})
          </h2>
          <p className="text-xs text-on-surface-variant/60 mt-0.5 font-korean">
            카테고리 설정에 따라 활성화된 항목만 표시됩니다
          </p>
        </div>

        {/* 캠프명 + 배송구역 */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div>
            <label className={labelCls}>캠프명</label>
            <input type="text" value={campName} onChange={(e) => setCampName(e.target.value)}
              placeholder="캠프명 입력" className={`${inputCls} font-korean`} />
          </div>
          <div>
            <label className={labelCls}>배송구역</label>
            <input type="text" value={deliveryArea} onChange={(e) => setDeliveryArea(e.target.value)}
              placeholder="배송구역 입력" className={`${inputCls} font-data`} />
          </div>
        </div>

        {/* ── 배송/반품 통합 카드 ── */}
        {(fieldConfig.items.delivery?.enabled || fieldConfig.items.return?.enabled) && (() => {
          const cfg = fieldConfig.items.delivery;
          const rateMode = cfg.rate_mode;
          const feeSame = cfg.fee_same;
          const feeSeparate = cfg.fee_separate;
          // 카테고리 설정 그대로 반영 (독립 체크박스)
          const routeSame = cfg.route_same;
          const routeSeparate = cfg.route_separate;
          const hasAnyFeeMode = feeSame || feeSeparate || routeSame || routeSeparate;
          return (
            <div className="p-4 rounded-xl bg-surface-container-low/50 border border-outline-variant/10 space-y-4">
              <div className="flex items-center gap-2">
                <span className="px-2.5 py-1 rounded-lg text-[11px] font-semibold bg-primary/10 text-primary">배송/반품</span>
                <span className="text-xs text-on-surface-variant font-korean">
                  {rateMode === 'unit_price' ? '수량 × 단가' :
                   rateMode === 'percentage' ? '매출 × 요율 (수수료% 차감)' :
                   rateMode === 'fixed_salary' ? '고정 급여' : '—'}
                  {feeSame ? ' · 동일수수료' : feeSeparate ? ' · 별도수수료' : ''}
                </span>
              </div>

              {/* ═══ unit_price 모드 ═══ */}
              {(rateMode === 'unit_price' || rateMode === 'mixed_count') && (
                <>
                  {!hasAnyFeeMode && (
                    <div className="grid grid-cols-2 gap-4">
                      <div>
                        <label className={labelCls}>배송/반품 단가 (원/건)</label>
                        <input type="number"
                          value={customValues['delivery_unit_price'] ?? ''}
                          onChange={(e) => setCustomValues((prev) => ({ ...prev, delivery_unit_price: e.target.value }))}
                          placeholder="0" className={`${inputCls} font-data`} />
                      </div>
                    </div>
                  )}

                  {/* 동일수수료: 단가 1개 */}
                  {feeSame && (
                    <div className="grid grid-cols-2 gap-4">
                      <div>
                        <label className={labelCls}>배송/반품 동일 단가 (원/건)</label>
                        <input type="number"
                          value={customValues['delivery_fee_same'] ?? ''}
                          onChange={(e) => setCustomValues((prev) => ({ ...prev, delivery_fee_same: e.target.value }))}
                          placeholder="0" className={`${inputCls} font-data`} />
                      </div>
                    </div>
                  )}

                  {/* 별도수수료: 배송/반품 각각 단가 */}
                  {feeSeparate && (
                    <div className="grid grid-cols-2 gap-4">
                      <div>
                        <label className={labelCls}>배송 단가 (원/건)</label>
                        <input type="number"
                          value={customValues['delivery_delivery_price'] ?? ''}
                          onChange={(e) => setCustomValues((prev) => ({ ...prev, delivery_delivery_price: e.target.value }))}
                          placeholder="0" className={`${inputCls} font-data`} />
                      </div>
                      <div>
                        <label className={labelCls}>반품 단가 (원/건)</label>
                        <input type="number"
                          value={customValues['delivery_return_price'] ?? ''}
                          onChange={(e) => setCustomValues((prev) => ({ ...prev, delivery_return_price: e.target.value }))}
                          placeholder="0" className={`${inputCls} font-data`} />
                      </div>
                    </div>
                  )}

                  {/* 동일 라우트 수수료 */}
                  {routeSame && (
                    <div className="space-y-2">
                      <div className="flex items-center justify-between">
                        <p className="text-xs font-label font-medium text-on-surface font-korean">라우트별 동일 단가</p>
                        <button onClick={addRouteRow}
                          className="h-7 px-2.5 rounded-lg bg-surface-container-high text-on-surface-variant font-label text-[11px] hover:bg-surface-container-highest transition-colors font-korean flex items-center gap-1">
                          <svg width="12" height="12" viewBox="0 0 24 24" fill="currentColor"><path d="M19 13h-6v6h-2v-6H5v-2h6V5h2v6h6v2z"/></svg>
                          추가
                        </button>
                      </div>
                      <div className="rounded-xl border border-outline-variant/10 overflow-hidden">
                        <div className="grid grid-cols-[1fr_1fr_32px] gap-0 bg-surface-container-high/50 px-3 py-1.5 text-[10px] text-on-surface-variant/60 font-korean font-semibold">
                          <span>라우트</span>
                          <span>단가</span>
                          <span></span>
                        </div>
                        {routeRates.map((rr, idx) => (
                          <div key={idx} className="grid grid-cols-[1fr_1fr_32px] gap-0 border-t border-outline-variant/10 items-center">
                            <input type="text" placeholder="코드" value={rr.route_code}
                              onChange={(e) => updateRoute(idx, 'route_code', e.target.value)}
                              className="h-10 px-3 bg-transparent text-on-surface text-sm font-data uppercase focus:outline-none focus:bg-primary/[0.03]" />
                            <input type="number" placeholder="0" value={rr.delivery_rate}
                              onChange={(e) => updateRoute(idx, 'delivery_rate', e.target.value)}
                              className="h-10 px-3 bg-transparent text-on-surface text-sm font-data focus:outline-none focus:bg-primary/[0.03] border-l border-outline-variant/10" />
                            <div className="flex items-center justify-center border-l border-outline-variant/10">
                              {routeRates.length > 1 && (
                                <button onClick={() => removeRouteRow(idx)}
                                  className="w-7 h-7 rounded text-on-surface-variant/30 hover:bg-error/10 hover:text-error flex items-center justify-center transition-colors">
                                  <svg width="12" height="12" viewBox="0 0 24 24" fill="currentColor"><path d="M19 6.41L17.59 5 12 10.59 6.41 5 5 6.41 10.59 12 5 17.59 6.41 19 12 13.41 17.59 19 19 17.59 13.41 12z"/></svg>
                                </button>
                              )}
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}

                  {/* 별 라우트 수수료 */}
                  {routeSeparate && (
                    <div className="space-y-2">
                      <div className="flex items-center justify-between">
                        <p className="text-xs font-label font-medium text-on-surface font-korean">라우트별 배송/반품 단가</p>
                        <button onClick={addRouteRow}
                          className="h-7 px-2.5 rounded-lg bg-surface-container-high text-on-surface-variant font-label text-[11px] hover:bg-surface-container-highest transition-colors font-korean flex items-center gap-1">
                          <svg width="12" height="12" viewBox="0 0 24 24" fill="currentColor"><path d="M19 13h-6v6h-2v-6H5v-2h6V5h2v6h6v2z"/></svg>
                          추가
                        </button>
                      </div>
                      <div className="rounded-xl border border-outline-variant/10 overflow-hidden">
                        <div className="grid grid-cols-[1fr_1fr_1fr_32px] gap-0 bg-surface-container-high/50 px-3 py-1.5 text-[10px] text-on-surface-variant/60 font-korean font-semibold">
                          <span>라우트</span>
                          <span>배송단가</span>
                          <span>반품단가</span>
                          <span></span>
                        </div>
                        {routeRates.map((rr, idx) => (
                          <div key={idx} className="grid grid-cols-[1fr_1fr_1fr_32px] gap-0 border-t border-outline-variant/10 items-center">
                            <input type="text" placeholder="코드" value={rr.route_code}
                              onChange={(e) => updateRoute(idx, 'route_code', e.target.value)}
                              className="h-10 px-3 bg-transparent text-on-surface text-sm font-data uppercase focus:outline-none focus:bg-primary/[0.03]" />
                            <input type="number" placeholder="0" value={rr.delivery_rate}
                              onChange={(e) => updateRoute(idx, 'delivery_rate', e.target.value)}
                              className="h-10 px-3 bg-transparent text-on-surface text-sm font-data focus:outline-none focus:bg-primary/[0.03] border-l border-outline-variant/10" />
                            <input type="number" placeholder="0" value={rr.return_rate}
                              onChange={(e) => updateRoute(idx, 'return_rate', e.target.value)}
                              className="h-10 px-3 bg-transparent text-on-surface text-sm font-data focus:outline-none focus:bg-primary/[0.03] border-l border-outline-variant/10" />
                            <div className="flex items-center justify-center border-l border-outline-variant/10">
                              {routeRates.length > 1 && (
                                <button onClick={() => removeRouteRow(idx)}
                                  className="w-7 h-7 rounded text-on-surface-variant/30 hover:bg-error/10 hover:text-error flex items-center justify-center transition-colors">
                                  <svg width="12" height="12" viewBox="0 0 24 24" fill="currentColor"><path d="M19 6.41L17.59 5 12 10.59 6.41 5 5 6.41 10.59 12 5 17.59 6.41 19 12 13.41 17.59 19 19 17.59 13.41 12z"/></svg>
                                </button>
                              )}
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                </>
              )}

              {/* ═══ 요율 입력 (percentage) ═══ */}
              {rateMode === 'percentage' && (
                <>
                  {feeSame && (
                    <div className="grid grid-cols-2 gap-4">
                      <div>
                        <label className={labelCls}>배송/반품 동일 수수료율 (%)</label>
                        <input type="number"
                          value={customValues['delivery_rate_pct'] ?? ''}
                          onChange={(e) => setCustomValues((prev) => ({ ...prev, delivery_rate_pct: e.target.value }))}
                          placeholder="0" className={`${inputCls} font-data`} />
                        <p className="text-[11px] text-on-surface-variant/60 mt-1 font-korean">매출액에서 해당 %를 수수료로 차감</p>
                      </div>
                    </div>
                  )}
                  {feeSeparate && (
                    <div className="grid grid-cols-2 gap-4">
                      <div>
                        <label className={labelCls}>배송 수수료율 (%)</label>
                        <input type="number"
                          value={customValues['delivery_rate_pct'] ?? ''}
                          onChange={(e) => setCustomValues((prev) => ({ ...prev, delivery_rate_pct: e.target.value }))}
                          placeholder="0" className={`${inputCls} font-data`} />
                      </div>
                      <div>
                        <label className={labelCls}>반품 수수료율 (%)</label>
                        <input type="number"
                          value={customValues['return_rate_pct'] ?? ''}
                          onChange={(e) => setCustomValues((prev) => ({ ...prev, return_rate_pct: e.target.value }))}
                          placeholder="0" className={`${inputCls} font-data`} />
                      </div>
                    </div>
                  )}
                  {!feeSame && !feeSeparate && (
                    <div className="grid grid-cols-2 gap-4">
                      <div>
                        <label className={labelCls}>배송/반품 수수료율 (%)</label>
                        <input type="number"
                          value={customValues['delivery_rate_pct'] ?? ''}
                          onChange={(e) => setCustomValues((prev) => ({ ...prev, delivery_rate_pct: e.target.value }))}
                          placeholder="0" className={`${inputCls} font-data`} />
                        <p className="text-[11px] text-on-surface-variant/60 mt-1 font-korean">매출액에서 해당 %를 수수료로 차감</p>
                      </div>
                    </div>
                  )}
                </>
              )}

              {/* ═══ 고정급여 입력 (fixed_salary) ═══ */}
              {rateMode === 'fixed_salary' && (
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className={labelCls}>배송/반품 월 고정 금액 (원)</label>
                    <input type="number"
                      value={customValues['delivery_fixed_salary'] ?? ''}
                      onChange={(e) => setCustomValues((prev) => ({ ...prev, delivery_fixed_salary: e.target.value }))}
                      placeholder="0" className={`${inputCls} font-data`} />
                  </div>
                </div>
              )}
            </div>
          );
        })()}

        {/* ── 집하 카드 (별도 유지) ── */}
        {fieldConfig.items.pickup?.enabled && (() => {
          const cfg = fieldConfig.items.pickup;
          const rateMode = cfg.rate_mode;
          return (
            <div className="p-4 rounded-xl bg-surface-container-low/50 border border-outline-variant/10 space-y-4">
              <div className="flex items-center gap-2">
                <span className="px-2.5 py-1 rounded-lg text-[11px] font-semibold bg-secondary/10 text-secondary">집하</span>
                <span className="text-xs text-on-surface-variant font-korean">
                  {rateMode === 'unit_price' ? '수량 × 단가' :
                   rateMode === 'percentage' ? '매출 × 요율 (수수료% 차감)' :
                   rateMode === 'fixed_salary' ? '고정 급여' : '—'}
                </span>
              </div>

              {rateMode === 'unit_price' && (
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className={labelCls}>집하 단가 (원/건)</label>
                    <input type="number"
                      value={customValues['pickup_unit_price'] ?? ''}
                      onChange={(e) => setCustomValues((prev) => ({ ...prev, pickup_unit_price: e.target.value }))}
                      placeholder="0" className={`${inputCls} font-data`} />
                  </div>
                </div>
              )}

              {rateMode === 'percentage' && (
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className={labelCls}>집하 수수료율 (%)</label>
                    <input type="number"
                      value={customValues['pickup_rate_pct'] ?? ''}
                      onChange={(e) => setCustomValues((prev) => ({ ...prev, pickup_rate_pct: e.target.value }))}
                      placeholder="0" className={`${inputCls} font-data`} />
                    <p className="text-[11px] text-on-surface-variant/60 mt-1 font-korean">매출액에서 해당 %를 수수료로 차감</p>
                  </div>
                </div>
              )}

              {rateMode === 'fixed_salary' && (
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className={labelCls}>집하 월 고정 금액 (원)</label>
                    <input type="number"
                      value={customValues['pickup_fixed_salary'] ?? ''}
                      onChange={(e) => setCustomValues((prev) => ({ ...prev, pickup_fixed_salary: e.target.value }))}
                      placeholder="0" className={`${inputCls} font-data`} />
                  </div>
                </div>
              )}
            </div>
          );
        })()}

        {/* 활성화된 항목 없을 때 안내 */}
        {!fieldConfig.items.delivery?.enabled && !fieldConfig.items.return?.enabled && !fieldConfig.items.pickup?.enabled && (
          <div className="text-center py-4">
            <p className="text-sm text-on-surface-variant/60 font-korean">
              카테고리 설정에서 배송/반품/집하 항목을 활성화해주세요
            </p>
            <button onClick={() => window.open(`/portal/principals/${principalId}`, '_blank')}
              className="mt-2 text-xs text-primary font-semibold hover:underline font-korean">
              카테고리 설정 바로가기 →
            </button>
          </div>
        )}

        {/* ═══ 수익항목(좌) + 차감항목(우) 나란히 배치 ═══ */}
        <div className="pt-4 border-t border-outline-variant/20">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {/* ── 좌측: 수익 항목 ── */}
            <div className="space-y-4">
              <div className="flex items-center gap-2 pb-2 border-b border-primary/20">
                <span className="px-2.5 py-1 rounded-lg text-[11px] font-bold bg-primary/10 text-primary">수입</span>
                <span className="text-sm font-bold text-on-surface font-korean">수입설정</span>
              </div>

              {/* 커스텀 수입 항목 */}
              {fieldConfig && (fieldConfig.custom_income_items ?? []).length > 0 && (
                <div className="space-y-2">
                  <p className="text-xs text-on-surface-variant/60 font-korean">카테고리에 설정된 항목입니다. 기사별 값을 입력하세요.</p>
                  <div className="grid grid-cols-2 gap-3">
                    {(fieldConfig.custom_income_items ?? []).map((item: CustomIncomeItem) => (
                      <div key={item.id}>
                        <label className={labelCls}>
                          {item.name} ({item.calc_method === 'fixed' ? '원' : '%'})
                        </label>
                        <input
                          type="number"
                          value={customValues[`income_${item.id}`] ?? String(item.default_value || '')}
                          onChange={(e) => setCustomValues((prev) => ({ ...prev, [`income_${item.id}`]: e.target.value }))}
                          placeholder={String(item.default_value || 0)}
                          className={`${inputCls} font-data`}
                        />
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* 인센티브 지급 설정 — 카테고리에서 활성화된 항목만 표시 */}
              {(fieldConfig?.additional_items?.fresh_back?.enabled || fieldConfig?.additional_items?.incentive?.enabled) && (
              <div className="space-y-2">
                <p className="text-xs font-label font-medium text-on-surface-variant font-korean">인센티브 지급 설정</p>
                <div className="grid grid-cols-2 gap-3">
                  {fieldConfig?.additional_items?.fresh_back?.enabled && (
                  <div>
                    <label className={labelCls}>프레쉬백</label>
                    <div className="flex items-center gap-1">
                      <input type="number" value={freshPct} onChange={(e) => setFreshPct(e.target.value)}
                        className="w-full h-10 px-3 rounded-xl bg-surface-container-low text-on-surface text-sm font-data focus:outline-none focus:ring-2 focus:ring-primary/30" />
                      <span className="text-sm text-on-surface-variant">%</span>
                    </div>
                  </div>
                  )}
                  {fieldConfig?.additional_items?.incentive?.enabled && (
                  <div>
                    <label className={labelCls}>인센티브</label>
                    <div className="flex items-center gap-1">
                      <input type="number" value={incentivePct} onChange={(e) => setIncentivePct(e.target.value)}
                        className="w-full h-10 px-3 rounded-xl bg-surface-container-low text-on-surface text-sm font-data focus:outline-none focus:ring-2 focus:ring-primary/30" />
                      <span className="text-sm text-on-surface-variant">%</span>
                    </div>
                  </div>
                  )}
                </div>
              </div>
              )}

              {/* 수입항목 없을 때 안내 */}
              {(!fieldConfig || (fieldConfig.custom_income_items ?? []).length === 0) && (
                <p className="text-sm text-on-surface-variant/40 font-korean py-2">카테고리 설정에서 추가 수입 항목을 등록하세요.</p>
              )}
            </div>

            {/* ── 우측: 차감(공제) 항목 ── */}
            <div className="space-y-4">
              <div className="flex items-center justify-between pb-2 border-b border-error/20">
                <div className="flex items-center gap-2">
                  <span className="px-2.5 py-1 rounded-lg text-[11px] font-bold bg-error/10 text-error">차감</span>
                  <span className="text-sm font-bold text-on-surface font-korean">차감설정</span>
                </div>
                <button onClick={addDeductionRow}
                  className="h-7 px-3 rounded-lg bg-surface-container-high text-on-surface-variant font-label text-[11px] hover:bg-surface-container-highest transition-colors font-korean">
                  + 추가
                </button>
              </div>

              {deductions.length === 0 ? (
                <p className="text-sm text-on-surface-variant/40 font-korean py-2">
                  등록된 공제 항목이 없습니다. 필요 시 추가하세요.
                </p>
              ) : (
                <div className="space-y-2">
                  {deductions.map((ded, idx) => (
                    <div key={idx} className="grid grid-cols-[1fr_auto_auto_24px] gap-2 items-center">
                      <input type="text" placeholder="항목명" value={ded.name}
                        onChange={(e) => updateDeduction(idx, 'name', e.target.value)}
                        className="h-10 px-3 rounded-xl bg-surface-container-low text-on-surface text-sm font-korean focus:outline-none focus:ring-2 focus:ring-primary/30" />
                      <select value={ded.deduction_type}
                        onChange={(e) => updateDeduction(idx, 'deduction_type', e.target.value)}
                        className="h-10 px-3 rounded-xl bg-surface-container-low text-on-surface text-sm font-korean focus:outline-none focus:ring-2 focus:ring-primary/30">
                        <option value="fixed">고정</option>
                        <option value="per_unit">건당</option>
                        <option value="percentage">%</option>
                      </select>
                      <div className="flex items-center gap-1">
                        <input type="number" placeholder="0" value={ded.amount}
                          onChange={(e) => updateDeduction(idx, 'amount', e.target.value)}
                          className="w-24 h-10 px-3 rounded-xl bg-surface-container-low text-on-surface text-sm font-data focus:outline-none focus:ring-2 focus:ring-primary/30" />
                        <span className="text-[11px] text-on-surface-variant shrink-0">
                          {ded.deduction_type === 'percentage' ? '%' : '원'}
                        </span>
                      </div>
                      <button onClick={() => removeDeductionRow(idx)}
                        className="w-6 h-6 rounded text-on-surface-variant/30 hover:bg-error/10 hover:text-error flex items-center justify-center transition-colors">
                        <svg width="12" height="12" viewBox="0 0 24 24" fill="currentColor"><path d="M19 6.41L17.59 5 12 10.59 6.41 5 5 6.41 10.59 12 5 17.59 6.41 19 12 13.41 17.59 19 19 17.59 13.41 12z"/></svg>
                      </button>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>
      </section>
      ) : null}

      {/* ═══ 5. 차량 정보 ═══ */}
      <section className="bg-surface-container-lowest rounded-2xl shadow-ambient p-6 space-y-4">
        <div className="flex items-center justify-between">
          <h2 className="text-base font-headline font-semibold text-on-surface font-korean">차량 정보</h2>
          <select
            value={vehicleOwner}
            onChange={(e) => setVehicleOwner(e.target.value as 'self' | 'company')}
            className="h-9 px-3 rounded-lg bg-surface-container-low text-sm font-korean focus:outline-none focus:ring-2 focus:ring-primary/30"
          >
            <option value="self">자차 (본인 소유)</option>
            <option value="company">회사차 (임대)</option>
          </select>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          <div>
            <label className={labelCls}>차종</label>
            <input type="text" value={vehicleType} onChange={(e) => setVehicleType(e.target.value)}
              placeholder="차량 종류" className={`${inputCls} font-korean`} />
          </div>
          <div>
            <label className={labelCls}>차량번호</label>
            <input type="text" value={vehicleNumber} onChange={(e) => setVehicleNumber(e.target.value)}
              placeholder="차량번호" className={`${inputCls} font-data`} />
          </div>
          <div>
            <label className={labelCls}>연식</label>
            <input type="text" value={vehicleYear} onChange={(e) => setVehicleYear(e.target.value)}
              placeholder="2024" className={`${inputCls} font-data`} />
          </div>
        </div>

        {vehicleOwner === 'company' && (
          <>
            <div className="pt-3 border-t border-outline-variant/20">
              <p className="text-xs font-medium text-on-surface-variant mb-3 font-korean">임대 조건</p>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
              <div>
                <label className={labelCls}>차대번호</label>
                <input type="text" value={vehicleVin} onChange={(e) => setVehicleVin(e.target.value)}
                  placeholder="차대번호" className={`${inputCls} font-data`} />
              </div>
              <div>
                <label className={labelCls}>인도 시 주행거리 (km)</label>
                <input type="number" value={vehicleMileage} onChange={(e) => setVehicleMileage(e.target.value)}
                  placeholder="주행거리 (km)" className={`${inputCls} font-data`} />
              </div>
              <div>
                <label className={labelCls}>월 임대료 (원)</label>
                <input type="number" value={vehicleRentMonthly} onChange={(e) => setVehicleRentMonthly(e.target.value)}
                  placeholder="월 임대료" className={`${inputCls} font-data`} />
                <p className="text-[11px] text-on-surface-variant/60 mt-1 font-korean">정산 시 수수료에서 자동 공제됩니다</p>
              </div>
              <div>
                <label className={labelCls}>보증금 (원)</label>
                <input type="number" value={vehicleDeposit} onChange={(e) => setVehicleDeposit(e.target.value)}
                  placeholder="보증금" className={`${inputCls} font-data`} />
              </div>
              <div>
                <label className={labelCls}>보험료 부담</label>
                <select value={vehicleInsuranceBy} onChange={(e) => setVehicleInsuranceBy(e.target.value as 'lessor' | 'lessee')}
                  className={`${inputCls} font-korean`}>
                  <option value="lessor">임대인 (영업점) 부담</option>
                  <option value="lessee">임차인 (기사) 부담</option>
                </select>
              </div>
            </div>
          </>
        )}
      </section>

      {/* ═══ 7. 계약서 전송 ═══ */}
      {principalId && contractTemplates.length > 0 ? (
      <section className="bg-surface-container-lowest rounded-2xl shadow-ambient p-6 space-y-4">
        <div>
          <h2 className="text-base font-headline font-semibold text-on-surface font-korean">계약서 전송</h2>
          <p className="text-xs text-on-surface-variant/60 mt-0.5 font-korean">
            등록 완료 시 선택된 계약서가 기사 앱으로 즉시 전송됩니다
          </p>
        </div>

        {/* 계약 기간 */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div>
            <label className={labelCls}>계약 시작일 *</label>
            <input type="date" value={contractStartDate}
              onChange={(e) => setContractStartDate(e.target.value)}
              className={`${inputCls} font-data`} />
          </div>
          <div>
            <label className={labelCls}>계약 종료일 *</label>
            <input type="date" value={contractEndDate}
              onChange={(e) => setContractEndDate(e.target.value)}
              className={`${inputCls} font-data`} />
          </div>
        </div>

        {/* 계약서 선택 */}
        <div className="space-y-2">
          <p className="text-xs font-label font-medium text-on-surface font-korean">전송할 계약서 선택</p>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
            {contractTemplates.map((t) => (
              <label key={t.id} className={`flex items-center gap-3 p-3 rounded-xl border-2 cursor-pointer transition-all ${
                selectedTemplateIds.has(t.id) ? 'border-primary bg-primary/5' : 'border-outline-variant/20 hover:border-outline-variant/40'
              }`}>
                <input type="checkbox" checked={selectedTemplateIds.has(t.id)}
                  onChange={() => {
                    setSelectedTemplateIds((prev) => {
                      const next = new Set(prev);
                      if (next.has(t.id)) next.delete(t.id); else next.add(t.id);
                      return next;
                    });
                  }}
                  className="w-4 h-4 rounded border-outline-variant text-primary focus:ring-primary/30" />
                <span className="text-sm text-on-surface font-korean">{t.title}</span>
              </label>
            ))}
          </div>
        </div>
      </section>
      ) : null}

      {/* ═══ 저장 버튼 ═══ */}
      <div className="flex justify-end gap-3 pt-2">
        <button type="button" onClick={() => router.back()}
          className="h-11 px-6 rounded-xl border border-outline-variant/30 text-on-surface-variant text-sm font-label font-semibold hover:bg-surface-container-high transition-colors font-korean">
          취소
        </button>
        <button type="button" onClick={handleSubmit} disabled={saving}
          className="h-11 px-8 rounded-xl bg-primary text-white text-sm font-label font-semibold hover:bg-primary/90 disabled:opacity-40 disabled:cursor-not-allowed transition-colors font-korean flex items-center gap-2">
          {saving ? (
            <>
              <svg className="animate-spin w-4 h-4" viewBox="0 0 24 24" fill="none"><circle cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="3" className="opacity-25"/><path d="M4 12a8 8 0 018-8" stroke="currentColor" strokeWidth="3" strokeLinecap="round"/></svg>
              저장 중...
            </>
          ) : '기사 등록'}
        </button>
      </div>

    </div>
  );
}