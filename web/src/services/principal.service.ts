import { createBrowserSupabaseClient } from '@/lib/supabase'
import type { PackageType, RateType, DeductionType } from '@/types/database'

/* ── Types ── */

export interface Principal {
  id: string
  agency_id: string | null
  name: string
  delivery_area: string
  rate_type: 'percentage' | 'fixed'
  memo: string
  is_active: boolean
  created_at: string
  field_config: FieldConfig
  excel_config: ExcelConfig
}

export interface SettlementRule {
  id: string
  principal_id: string | null
  package_type: string | null
  base_unit_price: number
  rate_type: 'percentage' | 'fixed'
  is_active: boolean
  created_at: string
}

export interface DeductionItem {
  id: string
  principal_id: string | null
  name: string
  amount: number
  rate_type: 'fixed' | 'percentage' | 'per_unit'
  rate_value: number
  unit_label: string
  is_active: boolean
}

export interface IncentiveRule {
  id: string
  principal_id: string | null
  min_count: number
  max_count: number | null
  bonus_per_unit: number
}

/* ── Structured Settlement Config Types ── */

export type ItemType = 'delivery' | 'return' | 'pickup'

/* ── 부가항목 (추가 수익) ── */
export type AdditionalItemType = 'fresh_back' | 'incentive' | 'etc_income'

export interface AdditionalItemConfig {
  enabled: boolean
}

export const ADDITIONAL_ITEM_LABELS: Record<AdditionalItemType, string> = {
  fresh_back: '프레쉬백',
  incentive: '인센티브',
  etc_income: '기타',
}

export const ADDITIONAL_ITEM_DESCS: Record<AdditionalItemType, string> = {
  fresh_back: '신선·냉동 배송 인센티브 (프레쉬백)',
  incentive: '실적 달성 인센티브·추가 수당',
  etc_income: '기타 수익 항목 (자유 입력)',
}

export const DEFAULT_ADDITIONAL_ITEMS: Record<AdditionalItemType, AdditionalItemConfig> = {
  fresh_back: { enabled: false },
  incentive: { enabled: false },
  etc_income: { enabled: false },
}
export type RateMode = 'unit_price' | 'percentage' | 'fixed_salary' | 'mixed_count'
export type CalcMethod = 'fixed' | 'rate_percent'
export type DeductionCalcMethod = 'fixed' | 'per_count' | 'rate_percent'

export interface ItemConfig {
  enabled: boolean
  rate_mode: RateMode
  /* 수수료/단가 체크박스 (복수 선택 가능) — 체크 시 기사등록/재계약에 해당 입력란 생성 */
  fee_same?: boolean              // 배송/반품 동일수수료
  fee_separate?: boolean          // 배송/반품 별 수수료
  route_same?: boolean            // 배송/반품 동일 라우트 수수료
  route_separate?: boolean        // 배송/반품 별 라우트 수수료
}

/** 정산 모드별 한글 라벨 */
export const DELIVERY_RATE_OPTIONS: { value: RateMode; label: string; desc: string }[] = [
  { value: 'fixed_salary', label: '고정 급여', desc: '월 고정 금액 지급 (건수 무관)' },
  { value: 'unit_price', label: '배송수량 × 단가', desc: '배송 건수에 단가를 곱하여 계산' },
  { value: 'percentage', label: '배송매출 × 요율 (수수료% 차감)', desc: '매출액에서 수수료율을 차감' },
]

export const RETURN_RATE_OPTIONS: { value: RateMode; label: string; desc: string }[] = [
  { value: 'unit_price', label: '반품수량 × 단가', desc: '반품 건수에 단가를 곱하여 계산' },
  { value: 'percentage', label: '반품매출 × 요율 (수수료% 차감)', desc: '반품 매출액에서 수수료율을 차감' },
]

export const PICKUP_RATE_OPTIONS: { value: RateMode; label: string; desc: string }[] = [
  { value: 'unit_price', label: '집하수량 × 단가', desc: '집하 건수에 단가를 곱하여 계산' },
  { value: 'percentage', label: '집하매출 × 요율 (수수료% 차감)', desc: '집하 매출액에서 수수료율을 차감' },
]

/** 커스텀 수입 항목 (사용자 자유 추가) */
export interface CustomIncomeItem {
  id: string
  name: string            // 예: "프레쉬백", "지역할증"
  calc_method: CalcMethod // 정액 or 요율%
  default_value: number   // 기본값 (기사별 override 가능)
}

/** 커스텀 차감 항목 (사용자 자유 추가) */
export interface CustomDeductionItem {
  id: string
  name: string              // 예: "차량임대료", "반품 송장"
  calc_method: DeductionCalcMethod
  default_value: number     // 고정금액 or 건당단가 or %
  count_field?: string      // per_count일 때 참조 필드 ('return_count', 'pickup_count' 등)
}

/** 고용·산재보험 설정 */
export interface InsuranceEntry {
  enabled: boolean
  rate: number    // %
  note: string    // 법률 근거 메모
}

export interface InsuranceConfig {
  employment_insurance: InsuranceEntry  // 고용보험
  industrial_insurance: InsuranceEntry  // 산재보험
}

/* ── 차감항목 구조화 타입 ── */

/** 보험 부담비율 */
export type InsuranceSplitMode = 'split_50_50' | 'employer_100'

export interface InsuranceDeductionConfig {
  enabled: boolean
  split_mode: InsuranceSplitMode
}

/** 화물사고 처리 방식 */
export type CargoAccidentMode = 'actual_cost' | 'fixed_amount' | 'percentage'

export interface CargoAccidentConfig {
  enabled: boolean
  mode: CargoAccidentMode
  description: string      // 커스텀 설명 ("차량 파손 시 실비 청구" 등)
  fixed_value: number      // fixed_amount일 때 금액, percentage일 때 %
}

/** 차량임대료 */
export interface VehicleRentalConfig {
  enabled: boolean
  // 기사별 월 고정금액 — 기사 등록 시 개별 입력
}

/** 운송장 차감 */
export interface WaybillConfig {
  enabled: boolean
  return_count_price: boolean   // 반품수 × 단가
  pickup_count_price: boolean   // 집하수 × 단가
  box_type_price: boolean       // 박스별 가격 (소/중/대)
}

/** 차감항목 전체 설정 */
export interface DeductionSectionConfig {
  employment_insurance: InsuranceDeductionConfig
  industrial_insurance: InsuranceDeductionConfig
  cargo_accident: CargoAccidentConfig
  vehicle_rental: VehicleRentalConfig
  waybill: WaybillConfig
  custom_deductions: CustomDeductionItem[]
}

/* ── 차감항목 상수 ── */

export const INSURANCE_SPLIT_OPTIONS: { value: InsuranceSplitMode; label: string; desc: string }[] = [
  { value: 'split_50_50', label: '기사 50% : 사용자 50%', desc: '쿠팡 대리점 등 — 기사와 사업주가 반반 부담' },
  { value: 'employer_100', label: '기사 0% : 사용자 100%', desc: '일반 택배 대리점 — 사회적합의금 지원으로 기사 부담 없음' },
]

export const CARGO_ACCIDENT_OPTIONS: { value: CargoAccidentMode; label: string; desc: string }[] = [
  { value: 'actual_cost', label: '실비 청구', desc: '화물사고 발생 시 실제 비용을 차감' },
  { value: 'fixed_amount', label: '고정 금액', desc: '사고 건당 고정 금액 차감 (예: 50,000원)' },
  { value: 'percentage', label: '비율 차감 (%)', desc: '사고 금액의 일정 비율을 차감' },
]

export const WAYBILL_PRESET_OPTIONS: { key: keyof Pick<WaybillConfig, 'return_count_price' | 'pickup_count_price' | 'box_type_price'>; label: string; desc: string }[] = [
  { key: 'return_count_price', label: '반품수 × 단가', desc: '반품 건수에 운송장 단가를 곱하여 차감' },
  { key: 'pickup_count_price', label: '집하수 × 단가', desc: '집하 건수에 운송장 단가를 곱하여 차감' },
  { key: 'box_type_price', label: '박스별 가격', desc: '소/중/대 박스 규격별 운송장 단가 차감' },
]

export const DEFAULT_DEDUCTION_SECTION: DeductionSectionConfig = {
  employment_insurance: { enabled: false, split_mode: 'employer_100' },
  industrial_insurance: { enabled: false, split_mode: 'employer_100' },
  cargo_accident: { enabled: false, mode: 'actual_cost', description: '', fixed_value: 0 },
  vehicle_rental: { enabled: false },
  waybill: { enabled: false, return_count_price: false, pickup_count_price: false, box_type_price: false },
  custom_deductions: [],
}

/* ── 부가세 설정 ── */

export type VatMode = 'vat_included' | 'vat_excluded'

export const VAT_MODE_OPTIONS: { value: VatMode; label: string; desc: string }[] = [
  { value: 'vat_included', label: '부가세 포함가', desc: '단가·매출에 부가세(10%)가 이미 포함된 금액' },
  { value: 'vat_excluded', label: '부가세 별도가', desc: '단가·매출에 부가세가 포함되지 않은 금액 (별도 계산)' },
]

/* ── 정산서 보기 모드 ── */

export type SettlementViewMode = 'simple' | 'detail' | 'simple_detail'

export const SETTLEMENT_VIEW_OPTIONS: { value: SettlementViewMode; label: string; desc: string }[] = [
  { value: 'simple', label: '간편 내역', desc: '배송수·지급액 등 핵심 정보만 표시' },
  { value: 'detail', label: '상세 내역', desc: '매출·수수료·차감 등 전체 항목 표시' },
  { value: 'simple_detail', label: '간편 + 세부내역', desc: '간편 요약 상단 + 세부내역 하단으로 구성' },
]

export interface FieldConfig {
  items: Record<ItemType, ItemConfig>
  additional_items: Record<AdditionalItemType, AdditionalItemConfig>  // 부가항목
  rate_direction: 'deduction'           // 차감 기준 고정: 10% = 매출의 10% 차감
  vat_mode: VatMode                     // 부가세 포함/별도
  settlement_view_mode: SettlementViewMode  // 정산서 보기 모드
  custom_income_items: CustomIncomeItem[]
  custom_deduction_items: CustomDeductionItem[]
  insurance_config: InsuranceConfig
  deduction_section: DeductionSectionConfig
  excel_mode: 'auto_filter' | 'manual_upload'
  settlement_display: SettlementDisplayConfig
  /* 재계약 설정 */
  contract_renewal_date?: string        // 계약 시작일 (ISO date string, e.g. '2026-07-01')
  contract_duration_months?: number     // 계약 기간 (개월)
  contract_expiry_date?: string         // 만료일 (직접 입력 또는 자동 계산, ISO date string)
  /* 라우트 코드 목록 (카테고리 단위 설정) */
  route_codes?: string[]                // e.g. ['A', 'B', 'C']
}

/** 기사 정산서 노출항목 설정 */
export interface SettlementDisplayConfig {
  delivery_count: boolean      // 배송 건수
  delivery_amount: boolean     // 배송 금액 (매출)
  delivery_fee: boolean        // 배송 수수료
  return_count: boolean        // 반품 건수
  return_amount: boolean       // 반품 금액
  return_fee: boolean          // 반품 수수료
  pickup_count: boolean        // 집하 건수
  pickup_amount: boolean       // 집하 금액
  pickup_fee: boolean          // 집하 수수료
  fresh_back: boolean          // 프레쉬백
  incentive_amount: boolean    // 인센티브
  etc_income: boolean          // 기타 수익
  employment_insurance: boolean // 고용보험
  industrial_insurance: boolean // 산재보험
  cargo_accident: boolean      // 화물사고
  cargo_accident_detail: boolean // 화물사고 상세내역
  vehicle_lease: boolean       // 차량임대료
  waybill: boolean             // 운송장
  deduction_detail: boolean    // 차감 상세내역
  supply_price: boolean        // 공급가
  tax_amount: boolean          // 세액
  total_sum: boolean           // 합계
  payment_amount: boolean      // 지급액
}

export const SETTLEMENT_DISPLAY_LABELS: Record<keyof SettlementDisplayConfig, string> = {
  delivery_count: '배송 건수',
  delivery_amount: '배송 매출',
  delivery_fee: '배송 수수료',
  return_count: '반품 건수',
  return_amount: '반품 매출',
  return_fee: '반품 수수료',
  pickup_count: '집하 건수',
  pickup_amount: '집하 매출',
  pickup_fee: '집하 수수료',
  fresh_back: '프레쉬백',
  incentive_amount: '인센티브',
  etc_income: '기타 수익',
  employment_insurance: '고용보험',
  industrial_insurance: '산재보험',
  cargo_accident: '화물사고',
  cargo_accident_detail: '화물사고 상세내역',
  vehicle_lease: '차량임대료',
  waybill: '운송장',
  deduction_detail: '차감 상세내역',
  supply_price: '공급가',
  tax_amount: '세액',
  total_sum: '합계',
  payment_amount: '지급액',
}

/** 정산서 표시항목 카테고리 그룹 */
export const SETTLEMENT_DISPLAY_GROUPS: { title: string; keys: (keyof SettlementDisplayConfig)[] }[] = [
  { title: '배송', keys: ['delivery_count', 'delivery_amount', 'delivery_fee'] },
  { title: '반품', keys: ['return_count', 'return_amount', 'return_fee'] },
  { title: '집하', keys: ['pickup_count', 'pickup_amount', 'pickup_fee'] },
  { title: '부가항목', keys: ['fresh_back', 'incentive_amount', 'etc_income'] },
  { title: '차감', keys: ['employment_insurance', 'industrial_insurance', 'cargo_accident', 'cargo_accident_detail', 'vehicle_lease', 'waybill', 'deduction_detail'] },
  { title: '정산', keys: ['supply_price', 'tax_amount', 'total_sum', 'payment_amount'] },
]

export const DEFAULT_SETTLEMENT_DISPLAY: SettlementDisplayConfig = {
  delivery_count: true,
  delivery_amount: true,
  delivery_fee: true,
  return_count: true,
  return_amount: true,
  return_fee: true,
  pickup_count: true,
  pickup_amount: true,
  pickup_fee: true,
  fresh_back: true,
  incentive_amount: true,
  etc_income: true,
  employment_insurance: true,
  industrial_insurance: true,
  cargo_accident: true,
  cargo_accident_detail: true,
  vehicle_lease: true,
  waybill: true,
  deduction_detail: true,
  supply_price: true,
  tax_amount: true,
  total_sum: true,
  payment_amount: true,
}

export const ITEM_LABELS: Record<ItemType, string> = {
  delivery: '배송',
  return: '반품',
  pickup: '집하',
}

/** 차감 항목 계산 방식 옵션 */
export const DEDUCTION_CALC_OPTIONS: { value: DeductionCalcMethod; label: string }[] = [
  { value: 'fixed', label: '고정 금액 (원)' },
  { value: 'per_count', label: '건당 단가 (수량 × 단가)' },
  { value: 'rate_percent', label: '비율 (%)' },
]

/** per_count 차감 시 참조 가능한 수량 필드 */
export const COUNT_FIELD_OPTIONS: { value: string; label: string }[] = [
  { value: 'delivery_count', label: '배송 수량' },
  { value: 'return_count', label: '반품 수량' },
  { value: 'pickup_count', label: '집하 수량' },
]

export const COMPANY_OPTIONS = [
  'CJ대한통운',
  '롯데글로벌로지스',
  '한진택배',
  '로젠택배',
  '쿠팡퀵플렉스',
  '쿠팡 더원',
] as const

/** 회사명 → 엑셀 타입 자동 감지 */
export function detectExcelTypeFromName(name: string): ExcelType {
  if (/쿠팡/i.test(name)) return 'coupang'
  if (/CJ|대한통운/i.test(name)) return 'cj'
  if (/한진/i.test(name)) return 'hanjin'
  if (/롯데/i.test(name)) return 'lotte'
  if (/로젠/i.test(name)) return 'logen'
  return 'generic'
}

/* ── 고용·산재보험 법정 요율 프리셋 ── */

export const INSURANCE_PRESETS = {
  employment: {
    name: '고용보험료 (근로자부담분)',
    rate: 0.9,
    legal_basis: '고용보험법 시행령 제12조 — 특수형태근로종사자 고용보험 적용 (2022.1.1 시행)',
    description: '근로자부담 0.9%, 사업주부담 0.9% (총 1.8%)',
  },
  industrial: {
    name: '산재보험료',
    rate: 1.8,
    legal_basis: '산업재해보상보험법 시행령 — 업종별 보험료율 고시',
    description: '운수업(택배배달) 기준 약 1.8% (매년 고시에 따라 변동)',
  },
} as const

export const DEFAULT_INSURANCE_CONFIG: InsuranceConfig = {
  employment_insurance: { enabled: false, rate: 0.9, note: '' },
  industrial_insurance: { enabled: false, rate: 1.8, note: '' },
}

export const DEFAULT_FIELD_CONFIG: FieldConfig = {
  items: {
    delivery: { enabled: false, rate_mode: 'unit_price', fee_same: false, fee_separate: false, route_same: false, route_separate: false },
    return: { enabled: false, rate_mode: 'unit_price', fee_same: false, fee_separate: false, route_same: false, route_separate: false },
    pickup: { enabled: false, rate_mode: 'unit_price', fee_same: false, fee_separate: false, route_same: false, route_separate: false },
  },
  additional_items: { ...DEFAULT_ADDITIONAL_ITEMS },
  rate_direction: 'deduction',
  vat_mode: 'vat_included',
  settlement_view_mode: 'simple',
  custom_income_items: [],
  custom_deduction_items: [],
  insurance_config: { ...DEFAULT_INSURANCE_CONFIG },
  deduction_section: { ...DEFAULT_DEDUCTION_SECTION },
  excel_mode: 'auto_filter',
  settlement_display: { ...DEFAULT_SETTLEMENT_DISPLAY },
}

/** Normalize old or missing field_config into new structured format */
export function normalizeFieldConfig(raw: unknown): FieldConfig {
  const base = { ...DEFAULT_FIELD_CONFIG }
  if (!raw || typeof raw !== 'object') return base

  const obj = raw as Record<string, unknown>
  if ('items' in obj) {
    base.items = obj.items as Record<ItemType, ItemConfig>
  }
  if ('additional_items' in obj && typeof obj.additional_items === 'object') {
    base.additional_items = {
      ...DEFAULT_ADDITIONAL_ITEMS,
      ...(obj.additional_items as Partial<Record<AdditionalItemType, AdditionalItemConfig>>),
    }
  }
  if ('rate_direction' in obj) {
    base.rate_direction = obj.rate_direction as 'deduction'
  }
  if ('vat_mode' in obj) {
    base.vat_mode = obj.vat_mode as VatMode
  }
  if ('settlement_view_mode' in obj) {
    base.settlement_view_mode = obj.settlement_view_mode as SettlementViewMode
  }
  if ('custom_income_items' in obj && Array.isArray(obj.custom_income_items)) {
    base.custom_income_items = obj.custom_income_items as CustomIncomeItem[]
  }
  if ('custom_deduction_items' in obj && Array.isArray(obj.custom_deduction_items)) {
    base.custom_deduction_items = obj.custom_deduction_items as CustomDeductionItem[]
  }
  if ('insurance_config' in obj && typeof obj.insurance_config === 'object') {
    base.insurance_config = {
      ...DEFAULT_INSURANCE_CONFIG,
      ...(obj.insurance_config as Partial<InsuranceConfig>),
    }
  }
  if ('deduction_section' in obj && typeof obj.deduction_section === 'object') {
    base.deduction_section = {
      ...DEFAULT_DEDUCTION_SECTION,
      ...(obj.deduction_section as Partial<DeductionSectionConfig>),
    }
  }
  if ('excel_mode' in obj) {
    base.excel_mode = obj.excel_mode as 'auto_filter' | 'manual_upload'
  }
  if ('settlement_display' in obj && typeof obj.settlement_display === 'object') {
    base.settlement_display = {
      ...DEFAULT_SETTLEMENT_DISPLAY,
      ...(obj.settlement_display as Partial<SettlementDisplayConfig>),
    }
  }
  return base
}

/** Generate a unique ID for custom items */
export function generateItemId(): string {
  return `item_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`
}

/** Build Excel column headers from structured field config */
export function buildExcelHeaders(fc: FieldConfig): string[] {
  const headers = ['기사명', '사번']
  const types: ItemType[] = ['delivery', 'return', 'pickup']
  for (const t of types) {
    const cfg = fc.items[t]
    if (!cfg?.enabled) continue
    const label = ITEM_LABELS[t]
    if (cfg.rate_mode === 'fixed_salary') {
      // 고정급여는 엑셀 칼럼 불필요 (기사별 고정값)
    } else if (cfg.rate_mode === 'unit_price') {
      headers.push(`${label}_수량`)
    } else if (cfg.rate_mode === 'mixed_count') {
      headers.push('배송_수량', '반품_수량')
    } else {
      headers.push(`${label}_수량`, `${label}_금액`, `${label}_수수료%`)
    }
  }
  // 부가항목 (프레쉬백, 인센티브, 기타)
  if (fc.additional_items?.fresh_back?.enabled) {
    headers.push('프레쉬백_금액')
  }
  if (fc.additional_items?.incentive?.enabled) {
    headers.push('인센티브_금액')
  }
  if (fc.additional_items?.etc_income?.enabled) {
    headers.push('기타수입_금액')
  }
  // 커스텀 수입 항목
  for (const item of fc.custom_income_items ?? []) {
    if (item.calc_method === 'fixed') {
      headers.push(`${item.name}_금액`)
    } else {
      headers.push(`${item.name}_금액`, `${item.name}_수수료%`)
    }
  }
  // 커스텀 차감 항목
  for (const item of fc.custom_deduction_items ?? []) {
    if (item.calc_method === 'fixed') {
      headers.push(`[차감]${item.name}`)
    } else if (item.calc_method === 'per_count') {
      headers.push(`[차감]${item.name}_수량`)
    } else {
      headers.push(`[차감]${item.name}_%`)
    }
  }
  return headers
}

/** Get unit price field keys that drivers need to fill */
export function getUnitPriceFields(fc: FieldConfig): { key: string; label: string }[] {
  const fields: { key: string; label: string }[] = []
  const types: ItemType[] = ['delivery', 'return', 'pickup']
  for (const t of types) {
    const cfg = fc.items[t]
    if (!cfg?.enabled) continue
    if (cfg.rate_mode === 'unit_price' || cfg.rate_mode === 'mixed_count') {
      fields.push({ key: `${t}_unit_price`, label: `${ITEM_LABELS[t]} 단가` })
    } else if (cfg.rate_mode === 'fixed_salary') {
      fields.push({ key: `${t}_fixed_salary`, label: '고정 급여액' })
    }
  }
  return fields
}

/** Get percentage (요율%) items for display */
export function getPercentageFields(fc: FieldConfig): { type: ItemType; label: string }[] {
  const fields: { type: ItemType; label: string }[] = []
  const types: ItemType[] = ['delivery', 'return', 'pickup']
  for (const t of types) {
    const cfg = fc.items[t]
    if (cfg?.enabled && cfg.rate_mode === 'percentage') {
      fields.push({ type: t, label: ITEM_LABELS[t] })
    }
  }
  return fields
}

export interface ExcelColumnConfig {
  key: string
  label: string
  excel_col: string
}

export interface ExcelConfig {
  columns: ExcelColumnConfig[]
}

export interface PrincipalWithConfig extends Principal {
  field_config: FieldConfig
  excel_config: ExcelConfig
}

export interface PrincipalFull extends PrincipalWithConfig {
  settlement_rules: SettlementRule[]
  deduction_items: DeductionItem[]
  incentive_rules: IncentiveRule[]
}

/* ── Queries ── */

export async function getPrincipals(agencyId: string): Promise<{
  data: Principal[] | null
  error: string | null
}> {
  const supabase = createBrowserSupabaseClient()
  try {
    const { data, error } = await supabase
      .from('principals')
      .select('*')
      .eq('agency_id', agencyId)
      .order('created_at', { ascending: true })
    if (error) throw error
    return { data: data as Principal[], error: null }
  } catch (err) {
    return { data: null, error: err instanceof Error ? err.message : 'Failed to fetch principals' }
  }
}

export async function getPrincipalFull(principalId: string): Promise<{
  data: PrincipalFull | null
  error: string | null
}> {
  const supabase = createBrowserSupabaseClient()
  try {
    const { data: principal, error: pErr } = await supabase
      .from('principals')
      .select('*')
      .eq('id', principalId)
      .single()
    if (pErr) throw pErr

    const [rulesRes, deductionsRes, incentivesRes] = await Promise.all([
      supabase.from('settlement_rules').select('*').eq('principal_id', principalId).order('created_at'),
      supabase.from('deduction_items').select('*').eq('principal_id', principalId).order('created_at'),
      supabase.from('incentive_rules').select('*').eq('principal_id', principalId),
    ])

    return {
      data: {
        ...(principal as Principal),
        settlement_rules: (rulesRes.data ?? []) as SettlementRule[],
        deduction_items: (deductionsRes.data ?? []) as DeductionItem[],
        incentive_rules: (incentivesRes.data ?? []) as IncentiveRule[],
      },
      error: null,
    }
  } catch (err) {
    return { data: null, error: err instanceof Error ? err.message : 'Failed to fetch principal' }
  }
}

/* ── Mutations ── */

export async function createPrincipal(data: {
  agency_id: string
  name: string
  delivery_area?: string
  rate_type: 'percentage' | 'fixed'
  memo?: string
  field_config?: FieldConfig
  excel_config?: ExcelConfig
}): Promise<{ data: Principal | null; error: string | null }> {
  const supabase = createBrowserSupabaseClient()
  try {
    // 기본 필드만 INSERT (실 DB에 없는 컬럼 제외)
    const { field_config, excel_config, ...basicData } = data
    const excelType = detectExcelTypeFromName(data.name)

    const { data: row, error } = await supabase
      .from('principals')
      .insert(basicData as never)
      .select('*')
      .single()
    if (error) throw new Error(`${error.message} [code: ${error.code}]`)

    // 추가 컬럼 업데이트 (컬럼이 없어도 무시)
    if (row) {
      const id = (row as { id: string }).id
      const extras: Record<string, unknown> = {}
      if (field_config) extras.field_config = field_config
      if (excel_config) extras.excel_config = excel_config
      extras.excel_type = excelType
      extras.upload_column_mapping = UPLOAD_MAPPING_PRESETS[excelType]

      // 각각 시도 — 컬럼 없으면 실패해도 무시
      for (const [key, value] of Object.entries(extras)) {
        await supabase.from('principals').update({ [key]: value } as never).eq('id', id).then(() => {})
      }
    }

    return { data: row as Principal, error: null }
  } catch (err) {
    return { data: null, error: err instanceof Error ? err.message : 'Failed to create principal' }
  }
}

export async function updatePrincipal(
  id: string,
  data: Partial<Pick<Principal, 'name' | 'delivery_area' | 'rate_type' | 'memo' | 'is_active'>>
): Promise<{ error: string | null }> {
  const supabase = createBrowserSupabaseClient()
  try {
    const { error } = await supabase.from('principals').update(data).eq('id', id)
    if (error) throw error
    return { error: null }
  } catch (err) {
    return { error: err instanceof Error ? err.message : 'Failed to update principal' }
  }
}

export async function deletePrincipal(id: string): Promise<{ error: string | null }> {
  const supabase = createBrowserSupabaseClient()
  try {
    const { error } = await supabase.from('principals').delete().eq('id', id)
    if (error) throw error
    return { error: null }
  } catch (err) {
    return { error: err instanceof Error ? err.message : 'Failed to delete principal' }
  }
}

/* ── Settlement Rules ── */

export async function upsertSettlementRule(data: {
  id?: string
  principal_id: string
  package_type: PackageType
  base_unit_price: number
  rate_type: RateType
}): Promise<{ error: string | null }> {
  const supabase = createBrowserSupabaseClient()
  try {
    if (data.id) {
      const { error } = await supabase.from('settlement_rules').update({
        package_type: data.package_type,
        base_unit_price: data.base_unit_price,
        rate_type: data.rate_type,
      }).eq('id', data.id)
      if (error) throw error
    } else {
      const { error } = await supabase.from('settlement_rules').insert(data)
      if (error) throw error
    }
    return { error: null }
  } catch (err) {
    return { error: err instanceof Error ? err.message : 'Failed to save rule' }
  }
}

export async function deleteSettlementRule(id: string): Promise<{ error: string | null }> {
  const supabase = createBrowserSupabaseClient()
  try {
    const { error } = await supabase.from('settlement_rules').delete().eq('id', id)
    if (error) throw error
    return { error: null }
  } catch (err) {
    return { error: err instanceof Error ? err.message : 'Failed to delete rule' }
  }
}

/* ── Deduction Items ── */

export async function upsertDeductionItem(data: {
  id?: string
  principal_id: string
  name: string
  amount: number
  rate_type: DeductionType
  rate_value: number
  unit_label?: string
}): Promise<{ error: string | null }> {
  const supabase = createBrowserSupabaseClient()
  try {
    if (data.id) {
      const { error } = await supabase.from('deduction_items').update({
        name: data.name,
        amount: data.amount,
        rate_type: data.rate_type,
        rate_value: data.rate_value,
        unit_label: data.unit_label ?? '',
      }).eq('id', data.id)
      if (error) throw error
    } else {
      const { error } = await supabase.from('deduction_items').insert(data)
      if (error) throw error
    }
    return { error: null }
  } catch (err) {
    return { error: err instanceof Error ? err.message : 'Failed to save deduction' }
  }
}

export async function deleteDeductionItem(id: string): Promise<{ error: string | null }> {
  const supabase = createBrowserSupabaseClient()
  try {
    const { error } = await supabase.from('deduction_items').delete().eq('id', id)
    if (error) throw error
    return { error: null }
  } catch (err) {
    return { error: err instanceof Error ? err.message : 'Failed to delete deduction' }
  }
}

/* ── Incentive Rules ── */

export async function upsertIncentiveRule(data: {
  id?: string
  principal_id: string
  min_count: number
  max_count: number | null
  bonus_per_unit: number
}): Promise<{ error: string | null }> {
  const supabase = createBrowserSupabaseClient()
  try {
    if (data.id) {
      const { error } = await supabase.from('incentive_rules').update({
        min_count: data.min_count,
        max_count: data.max_count,
        bonus_per_unit: data.bonus_per_unit,
      }).eq('id', data.id)
      if (error) throw error
    } else {
      const { error } = await supabase.from('incentive_rules').insert(data)
      if (error) throw error
    }
    return { error: null }
  } catch (err) {
    return { error: err instanceof Error ? err.message : 'Failed to save incentive' }
  }
}

export async function deleteIncentiveRule(id: string): Promise<{ error: string | null }> {
  const supabase = createBrowserSupabaseClient()
  try {
    const { error } = await supabase.from('incentive_rules').delete().eq('id', id)
    if (error) throw error
    return { error: null }
  } catch (err) {
    return { error: err instanceof Error ? err.message : 'Failed to delete incentive' }
  }
}

/* ── Field Config ── */

export async function updateFieldConfig(
  principalId: string,
  fieldConfig: FieldConfig
): Promise<{ error: string | null }> {
  const supabase = createBrowserSupabaseClient()
  try {
    const { error } = await supabase
      .from('principals')
      .update({ field_config: fieldConfig } as never)
      .eq('id', principalId)
    if (error) throw error
    return { error: null }
  } catch (err) {
    return { error: err instanceof Error ? err.message : 'Failed to update field config' }
  }
}

export async function updateExcelConfig(
  principalId: string,
  excelConfig: ExcelConfig
): Promise<{ error: string | null }> {
  const supabase = createBrowserSupabaseClient()
  try {
    const { error } = await supabase
      .from('principals')
      .update({ excel_config: excelConfig } as never)
      .eq('id', principalId)
    if (error) throw error
    return { error: null }
  } catch (err) {
    return { error: err instanceof Error ? err.message : 'Failed to update excel config' }
  }
}

/* ── 엑셀 업로드 컬럼 매핑 (정산 업로드 시 자동 적용) ── */

export type ExcelType = 'generic' | 'coupang' | 'cj' | 'hanjin' | 'lotte' | 'logen' | 'custom'

export interface UploadColumnMapping {
  employee_code_col: string
  delivery_count_col: string
  return_count_col: string
  collect_count_col: string
  fresh_count_col: string
  etc_count_col: string
}

export async function getUploadMapping(
  principalId: string
): Promise<{ mapping: UploadColumnMapping | null; excelType: ExcelType }> {
  const supabase = createBrowserSupabaseClient()
  const { data } = await supabase
    .from('principals')
    .select('upload_column_mapping, excel_type')
    .eq('id', principalId)
    .single()

  if (!data) return { mapping: null, excelType: 'generic' }
  const row = data as unknown as { upload_column_mapping: UploadColumnMapping | null; excel_type: ExcelType | null }
  return {
    mapping: row.upload_column_mapping,
    excelType: row.excel_type ?? 'generic',
  }
}

export async function saveUploadMapping(
  principalId: string,
  mapping: UploadColumnMapping,
  excelType: ExcelType
): Promise<{ error: string | null }> {
  const supabase = createBrowserSupabaseClient()
  try {
    const { error } = await supabase
      .from('principals')
      .update({
        upload_column_mapping: mapping,
        excel_type: excelType,
      } as never)
      .eq('id', principalId)
    if (error) throw error
    return { error: null }
  } catch (err) {
    return { error: err instanceof Error ? err.message : 'Failed to save upload mapping' }
  }
}

/** 운송사별 기본 매핑 프리셋 */
export const UPLOAD_MAPPING_PRESETS: Record<ExcelType, UploadColumnMapping | null> = {
  generic: null,
  coupang: { employee_code_col: '기사코드', delivery_count_col: '배송건수', return_count_col: '반품건수', collect_count_col: '', fresh_count_col: '', etc_count_col: '' },
  cj: { employee_code_col: '사번', delivery_count_col: '배송', return_count_col: '반품', collect_count_col: '집하', fresh_count_col: '', etc_count_col: '' },
  hanjin: { employee_code_col: '사번', delivery_count_col: '배송건수', return_count_col: '반품건수', collect_count_col: '집하건수', fresh_count_col: '', etc_count_col: '' },
  lotte: { employee_code_col: '사번', delivery_count_col: '배송', return_count_col: '반품', collect_count_col: '', fresh_count_col: '', etc_count_col: '' },
  logen: { employee_code_col: '사번', delivery_count_col: '배달', return_count_col: '반품', collect_count_col: '집화', fresh_count_col: '', etc_count_col: '' },
  custom: null,
}

export const EXCEL_TYPE_LABELS: Record<ExcelType, string> = {
  generic: '일반 (수동 매핑)',
  coupang: '쿠팡',
  cj: 'CJ대한통운',
  hanjin: '한진택배',
  lotte: '롯데택배',
  logen: '로젠택배',
  custom: '직접 설정',
}
