import {
  DEFAULT_TEMPLATE,
  type SettlementDriverData,
  type SettlementItem,
  type SettlementTemplate,
} from '@/types/settlement-template'

export interface SettlementPdfSource {
  driverName: string
  employeeCode?: string | null
  phone?: string | null
  region?: string | null
  companyName?: string | null
  vehicleNumber?: string | null
  yearMonth: string
  deliveryCount: number
  deliveryAmount: number
  returnCount: number
  returnAmount: number
  pickupCount: number
  pickupAmount: number
  freshIncentive: number
  extraIncentive: number
  totalAmount: number
  totalDeduction: number
  vatAmount: number
  netAmount: number
  deductionDetail?: Record<string, number> | null
}

interface SectionEntry {
  label: string
  field: string
  value: number
  detail?: string
}

function cloneTemplate(template: SettlementTemplate): SettlementTemplate {
  return JSON.parse(JSON.stringify(template)) as SettlementTemplate
}

function normalizeText(value: string): string {
  return value.replace(/\s+/g, '').toLowerCase()
}

function slugify(value: string): string {
  return value
    .trim()
    .replace(/[^\w\uAC00-\uD7A3]+/g, '_')
    .replace(/_+/g, '_')
    .replace(/^_+|_+$/g, '')
    .toLowerCase()
}

function includesAny(target: string, keywords: string[]): boolean {
  return keywords.some((keyword) => target.includes(keyword))
}

function addAliases(target: Record<string, number>, value: number, keys: string[]) {
  for (const key of keys) {
    if (!key) continue
    target[key] = value
  }
}

function buildPeriod(yearMonth: string): string {
  const [year, month] = yearMonth.split('-')
  if (!year || !month) return yearMonth
  return `${year}년 ${Number(month)}월 정산`
}

function buildPrimaryIncomeEntries(source: SettlementPdfSource): SectionEntry[] {
  return [
    {
      label: '배송매출',
      field: 'delivery_amount',
      value: source.deliveryAmount,
      detail: source.deliveryCount > 0 ? `${source.deliveryCount.toLocaleString('ko-KR')}건` : undefined,
    },
    {
      label: '반품매출',
      field: 'return_amount',
      value: source.returnAmount,
      detail: source.returnCount > 0 ? `${source.returnCount.toLocaleString('ko-KR')}건` : undefined,
    },
    {
      label: '집하매출',
      field: 'pickup_amount',
      value: source.pickupAmount,
      detail: source.pickupCount > 0 ? `${source.pickupCount.toLocaleString('ko-KR')}건` : undefined,
    },
    {
      label: '프레시백',
      field: 'fresh_incentive',
      value: source.freshIncentive,
    },
    {
      label: '인센티브',
      field: 'extra_incentive',
      value: source.extraIncentive,
    },
    {
      label: '부가세',
      field: 'vat_amount',
      value: source.vatAmount,
    },
  ]
}

function buildPrimaryDeductionEntries(source: SettlementPdfSource): SectionEntry[] {
  const detailEntries = Object.entries(source.deductionDetail ?? {})
    .filter(([, value]) => Number(value) !== 0)
    .map(([label, value]) => ({
      label,
      field: slugify(label) || label,
      value: Number(value),
    }))

  if (detailEntries.length > 0) {
    return detailEntries
  }

  if (source.totalDeduction > 0) {
    return [
      {
        label: '기타 차감',
        field: 'other_deduction',
        value: source.totalDeduction,
      },
    ]
  }

  return []
}

function resolveIncomeTemplateValue(text: string, source: SettlementPdfSource): number | null {
  const normalized = normalizeText(text)

  if (normalized === 'delivery_amount' || includesAny(normalized, ['배송매출', '배송금액', '배송수수료', '배송운임'])) {
    return source.deliveryAmount
  }
  if (normalized === 'return_amount' || includesAny(normalized, ['반품매출', '반품금액', '반품수수료', '리턴'])) {
    return source.returnAmount
  }
  if (normalized === 'pickup_amount' || includesAny(normalized, ['집하매출', '집하금액', '집하수수료', '픽업', '회수'])) {
    return source.pickupAmount
  }
  if (normalized === 'fresh_incentive' || includesAny(normalized, ['프레시', 'fresh'])) {
    return source.freshIncentive
  }
  if (normalized === 'extra_incentive' || includesAny(normalized, ['인센티브', '추가수당', '성과급'])) {
    return source.extraIncentive
  }
  if (normalized === 'vat_amount' || includesAny(normalized, ['부가세', 'vat'])) {
    return source.vatAmount
  }
  if (includesAny(normalized, ['총수입', '총매출', '총금액', '총액', 'gross'])) {
    return source.totalAmount
  }
  if (includesAny(normalized, ['기본금액', '기본매출', '기본운임'])) {
    return source.deliveryAmount + source.returnAmount + source.pickupAmount
  }

  return null
}

function resolveDeductionTemplateValue(
  text: string,
  source: SettlementPdfSource,
  entries: SectionEntry[]
): number | null {
  const normalized = normalizeText(text)

  const exactEntry = entries.find((entry) => normalizeText(entry.label) === normalized || normalizeText(entry.field) === normalized)
  if (exactEntry) return exactEntry.value

  if (includesAny(normalized, ['총차감', '총공제'])) {
    return source.totalDeduction
  }

  if (includesAny(normalized, ['보험'])) {
    return entries
      .filter((entry) => normalizeText(entry.label).includes('보험'))
      .reduce((sum, entry) => sum + entry.value, 0)
  }

  if (includesAny(normalized, ['원천', '3.3', 'withholding'])) {
    return entries
      .filter((entry) => includesAny(normalizeText(entry.label), ['원천', '3.3']))
      .reduce((sum, entry) => sum + entry.value, 0)
  }

  if (includesAny(normalized, ['부가세', 'vat'])) {
    return entries
      .filter((entry) => includesAny(normalizeText(entry.label), ['부가세', 'vat']))
      .reduce((sum, entry) => sum + entry.value, 0)
  }

  if (includesAny(normalized, ['화물사고', '분실', '파손'])) {
    return entries
      .filter((entry) => includesAny(normalizeText(entry.label), ['화물사고', '분실', '파손']))
      .reduce((sum, entry) => sum + entry.value, 0)
  }

  return null
}

function createTemplateItems(entries: SectionEntry[]): SettlementItem[] {
  return entries.map((entry, index) => ({
    id: `${entry.field}_${index}`,
    label: entry.label,
    field: entry.field,
    detail: entry.detail,
    enabled: true,
    numberFormat: 'currency',
  }))
}

export function buildSettlementDriverData(
  source: SettlementPdfSource,
  template: SettlementTemplate = DEFAULT_TEMPLATE
): SettlementDriverData {
  const incomeEntries = buildPrimaryIncomeEntries(source)
  const deductionEntries = buildPrimaryDeductionEntries(source)
  const incomeItems: Record<string, number> = {}
  const deductionItems: Record<string, number> = {}

  for (const entry of incomeEntries) {
    addAliases(incomeItems, entry.value, [
      entry.field,
      entry.label,
      normalizeText(entry.label),
      slugify(entry.label),
    ])
  }

  for (const entry of deductionEntries) {
    addAliases(deductionItems, entry.value, [
      entry.field,
      entry.label,
      normalizeText(entry.label),
      slugify(entry.label),
    ])
  }

  for (const item of template.incomeSection.items) {
    const value = resolveIncomeTemplateValue(item.field || item.label, source)
    if (value === null) continue
    addAliases(incomeItems, value, [item.field, item.label, normalizeText(item.label), slugify(item.label)])
  }

  for (const item of template.deductionSection.items) {
    const value = resolveDeductionTemplateValue(item.field || item.label, source, deductionEntries)
    if (value === null) continue
    addAliases(deductionItems, value, [item.field, item.label, normalizeText(item.label), slugify(item.label)])
  }

  return {
    name: source.driverName,
    id: source.employeeCode ?? undefined,
    phone: source.phone ?? undefined,
    region: source.region ?? undefined,
    period: buildPeriod(source.yearMonth),
    deliveryCount: source.deliveryCount,
    companyName: source.companyName ?? undefined,
    vehicleNumber: source.vehicleNumber ?? undefined,
    incomeItems,
    deductionItems,
    incomeTotal: source.totalAmount,
    deductionTotal: source.totalDeduction,
    netAmount: source.netAmount,
  }
}

export function buildRenderableSettlementTemplate(
  template: SettlementTemplate,
  source: SettlementPdfSource
): SettlementTemplate {
  const cloned = cloneTemplate(template)
  const incomeEntries = buildPrimaryIncomeEntries(source).filter(
    (entry) => entry.value > 0 || entry.detail
  )
  const deductionEntries = buildPrimaryDeductionEntries(source).filter((entry) => entry.value > 0)

  cloned.incomeSection.items = cloned.incomeSection.items.length > 0
    ? cloned.incomeSection.items.map((item) => ({
        ...item,
        field: item.field || slugify(item.label) || item.label,
      }))
    : createTemplateItems(incomeEntries)

  cloned.deductionSection.items = cloned.deductionSection.items.length > 0
    ? cloned.deductionSection.items.map((item) => ({
        ...item,
        field: item.field || slugify(item.label) || item.label,
      }))
    : createTemplateItems(deductionEntries)

  return cloned
}
