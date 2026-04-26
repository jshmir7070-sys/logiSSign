/**
 * Excel 파싱 서비스
 *
 * 엑셀 파일 파싱, 컬럼 매핑, 행 집계, 시트 감지, 기사 매칭
 */

import { createBrowserSupabaseClient } from '@/lib/supabase'

/* ── Types ── */

export interface ExcelColumnMapping {
  employee_code_col: string
  delivery_count_col: string
  return_count_col?: string
  collect_count_col?: string
  fresh_count_col?: string
  etc_count_col?: string
  delivery_amount_col?: string
  return_amount_col?: string
  collect_amount_col?: string
  driver_name_col?: string
  fresh_back_amount_col?: string
  incentive_amount_col?: string
  etc_income_amount_col?: string
}

export interface ParsedExcelRow {
  employee_code: string
  driver_name?: string
  delivery_count: number
  return_count: number
  collect_count: number
  delivery_amount: number
  return_amount: number
  collect_amount: number
  fresh_count: number
  etc_count: number
  fresh_back_amount: number
  incentive_amount: number
  etc_income_amount: number
  raw_data: Record<string, unknown>
}

export interface SheetInfo {
  name: string
  rowCount: number
  detected: 'coupang_summary' | 'coupang_raw' | 'damage_list' | 'generic'
}

export interface UnmatchedRow {
  employee_code: string
  row_index: number
  raw_data: Record<string, unknown>
  reason?: string
  driver_name?: string | null
}

export interface DriverMatch {
  driver_id: string
  driver_name: string
  employee_code: string
  principal_name: string | null
  delivery_area: string | null
  is_business_owner: boolean
  vat_included: boolean
}

/** Coupang 정산총괄 시트에서 파싱한 기사별 요약 행 */
export interface CoupangSummaryRow {
  employee_code: string
  delivery_count: number
  return_count: number
  total_count: number
  coupang_base_amount: number
  fresh_incentive: number
  extra_incentive: number
  damage_deduction: number
  coupang_total: number
}

/** 정산Raw 시트에서 파싱한 일별 배송 행 */
export interface CoupangRawRow {
  type: string
  employee_code: string
  route_code: string
  delivery_date: number
  camp: string
  shift: string
  vendor: string
  delivery_count: number
  return_count: number
  coupang_rate: number
  extra_incentive_unit: number
  base_amount: number
  extra_amount: number
  total_amount: number
  fresh_incentive: number
}

export interface RouteSettlementDetail {
  route_code: string
  delivery_count: number
  return_count: number
  driver_delivery_rate: number
  driver_return_rate: number
  coupang_rate: number
  delivery_amount: number
  return_amount: number
  total_amount: number
}

/* ── Default column mappings per principal ── */

export const DEFAULT_COLUMN_MAPPINGS: Record<string, ExcelColumnMapping> = {
  'CJ대한통운': {
    employee_code_col: '사번',
    delivery_count_col: '배송',
    return_count_col: '반품',
    collect_count_col: '집하',
  },
  '쿠팡 더원': {
    employee_code_col: '기사코드',
    delivery_count_col: '배송건수',
    return_count_col: '반품건수',
  },
}

/* ── Utility ── */

function normalizeMatchingText(value: string | null | undefined): string {
  return String(value ?? '')
    .trim()
    .replace(/\s+/g, '')
    .toLowerCase()
}

/* ── Parse Excel file ── */

export function parseExcelData(
  rows: Record<string, unknown>[],
  mapping: ExcelColumnMapping
): { parsed: ParsedExcelRow[]; errors: string[] } {
  const parsed: ParsedExcelRow[] = []
  const errors: string[] = []
  const codeToNameMap = new Map<string, string>()

  for (let i = 0; i < rows.length; i++) {
    const row = rows[i]
    const code = String(row[mapping.employee_code_col] ?? '').trim()
    if (!code) continue

    const driverName = mapping.driver_name_col
      ? String(row[mapping.driver_name_col] ?? '').trim()
      : ''

    if (driverName) {
      const normalizedName = normalizeMatchingText(driverName)
      const existingName = codeToNameMap.get(code)
      if (existingName && existingName !== normalizedName) {
        errors.push(`${i + 1}행: 사번 "${code}" 에 서로 다른 기사명이 섞여 있습니다. 파일을 확인해주세요.`)
        continue
      }
      codeToNameMap.set(code, normalizedName)
    }

    const delivery = Number(row[mapping.delivery_count_col] ?? 0) || 0
    const ret = mapping.return_count_col ? (Number(row[mapping.return_count_col] ?? 0) || 0) : 0
    const collect = mapping.collect_count_col ? (Number(row[mapping.collect_count_col] ?? 0) || 0) : 0
    const deliveryAmount = mapping.delivery_amount_col ? (Number(row[mapping.delivery_amount_col] ?? 0) || 0) : 0
    const returnAmount = mapping.return_amount_col ? (Number(row[mapping.return_amount_col] ?? 0) || 0) : 0
    const collectAmount = mapping.collect_amount_col ? (Number(row[mapping.collect_amount_col] ?? 0) || 0) : 0
    const fresh = mapping.fresh_count_col ? (Number(row[mapping.fresh_count_col] ?? 0) || 0) : 0
    const etc = mapping.etc_count_col ? (Number(row[mapping.etc_count_col] ?? 0) || 0) : 0
    const freshBackAmt = mapping.fresh_back_amount_col ? (Number(row[mapping.fresh_back_amount_col] ?? 0) || 0) : 0
    const incentiveAmt = mapping.incentive_amount_col ? (Number(row[mapping.incentive_amount_col] ?? 0) || 0) : 0
    const etcIncomeAmt = mapping.etc_income_amount_col ? (Number(row[mapping.etc_income_amount_col] ?? 0) || 0) : 0

    parsed.push({
      employee_code: code,
      driver_name: driverName || undefined,
      delivery_count: delivery,
      return_count: ret,
      collect_count: collect,
      delivery_amount: deliveryAmount,
      return_amount: returnAmount,
      collect_amount: collectAmount,
      fresh_count: fresh,
      etc_count: etc,
      fresh_back_amount: freshBackAmt,
      incentive_amount: incentiveAmt,
      etc_income_amount: etcIncomeAmt,
      raw_data: row,
    })
  }

  return { parsed, errors }
}

/* ── Detect sheet types from multi-sheet workbook ── */

export function detectSheetTypes(
  sheetNames: string[],
  getSheetRows: (name: string) => unknown[][]
): SheetInfo[] {
  return sheetNames.map((name) => {
    const rows = getSheetRows(name)
    let detected: SheetInfo['detected'] = 'generic'

    if (/정산총괄|summary/i.test(name)) {
      detected = 'coupang_summary'
    } else if (/정산Raw|raw/i.test(name)) {
      detected = 'coupang_raw'
    } else if (/분실파손|화물사고\s*상세내역|상세내역/i.test(name)) {
      detected = 'damage_list'
    } else if (rows.length >= 5) {
      const row4 = rows[4] as string[] | undefined
      if (row4 && row4.some((c) => typeof c === 'string' && /ID/.test(c)) &&
          row4.some((c) => typeof c === 'string' && /배송/.test(c))) {
        detected = 'coupang_summary'
      }
    }

    return { name, rowCount: rows.length, detected }
  })
}

/* ── Parse Coupang 정산총괄 sheet ── */

export function parseCoupangSummary(
  rows: unknown[][]
): { parsed: CoupangSummaryRow[]; skipped: string[] } {
  const parsed: CoupangSummaryRow[] = []
  const skipped: string[] = []

  for (let i = 5; i < rows.length; i++) {
    const row = rows[i]
    if (!row || !Array.isArray(row)) continue

    const id = String(row[3] ?? '').trim()
    if (!id) continue

    if (!id.includes('@')) {
      skipped.push(id)
      continue
    }

    parsed.push({
      employee_code: id,
      delivery_count: Number(row[4]) || 0,
      return_count: Number(row[5]) || 0,
      total_count: Number(row[6]) || 0,
      coupang_base_amount: Number(row[7]) || 0,
      fresh_incentive: Number(row[8]) || 0,
      extra_incentive: Number(row[9]) || 0,
      damage_deduction: Number(row[10]) || 0,
      coupang_total: Number(row[11]) || 0,
    })
  }

  return { parsed, skipped }
}

/* ── Parse Coupang 정산Raw sheet ── */

export function parseCoupangRaw(
  rows: unknown[][]
): { parsed: CoupangRawRow[]; errors: string[] } {
  const parsed: CoupangRawRow[] = []
  const errors: string[] = []

  for (let i = 1; i < rows.length; i++) {
    const row = rows[i]
    if (!row || !Array.isArray(row)) continue

    const id = String(row[1] ?? '').trim()
    if (!id || !id.includes('@')) continue

    const type = String(row[0] ?? '').trim()
    const deliveryCount = Number(row[7]) || 0
    const returnCount = Number(row[8]) || 0

    if (deliveryCount === 0 && returnCount === 0 && type !== '수기반영') continue

    parsed.push({
      type,
      employee_code: id,
      route_code: String(row[2] ?? '').trim(),
      delivery_date: Number(row[3]) || 0,
      camp: String(row[4] ?? ''),
      shift: String(row[5] ?? ''),
      vendor: String(row[6] ?? ''),
      delivery_count: deliveryCount,
      return_count: returnCount,
      coupang_rate: Number(row[9]) || 0,
      extra_incentive_unit: Number(row[10]) || 0,
      base_amount: Number(row[11]) || 0,
      extra_amount: Number(row[12]) || 0,
      total_amount: Number(row[13]) || 0,
      fresh_incentive: Number(row[14]) || 0,
    })
  }

  return { parsed, errors }
}

/* ── Aggregate rows by employee_code ── */

export function aggregateParsedRows(parsedRows: ParsedExcelRow[]): ParsedExcelRow[] {
  const aggregated = new Map<string, ParsedExcelRow>()

  for (const row of parsedRows) {
    const existing = aggregated.get(row.employee_code)
    if (!existing) {
      aggregated.set(row.employee_code, { ...row })
      continue
    }

    if (!existing.driver_name && row.driver_name) {
      existing.driver_name = row.driver_name
    }

    existing.delivery_count += row.delivery_count
    existing.return_count += row.return_count
    existing.collect_count += row.collect_count
    existing.delivery_amount += row.delivery_amount
    existing.return_amount += row.return_amount
    existing.collect_amount += row.collect_amount
    existing.fresh_count += row.fresh_count
    existing.etc_count += row.etc_count
    existing.fresh_back_amount += row.fresh_back_amount
    existing.incentive_amount += row.incentive_amount
    existing.etc_income_amount += row.etc_income_amount
    existing.raw_data = {
      ...existing.raw_data,
      ...row.raw_data,
      _merged_rows: Number(existing.raw_data._merged_rows ?? 1) + 1,
    }
  }

  return Array.from(aggregated.values())
}

export function aggregateCoupangSummaryRows(rows: CoupangSummaryRow[]): CoupangSummaryRow[] {
  const aggregated = new Map<string, CoupangSummaryRow>()

  for (const row of rows) {
    const existing = aggregated.get(row.employee_code)
    if (!existing) {
      aggregated.set(row.employee_code, { ...row })
      continue
    }

    existing.delivery_count += row.delivery_count
    existing.return_count += row.return_count
    existing.total_count += row.total_count
    existing.coupang_base_amount += row.coupang_base_amount
    existing.fresh_incentive += row.fresh_incentive
    existing.extra_incentive += row.extra_incentive
    existing.damage_deduction += row.damage_deduction
    existing.coupang_total += row.coupang_total
  }

  return Array.from(aggregated.values())
}

/* ── Match parsed rows to drivers ── */

export async function matchDrivers(
  agencyId: string,
  parsedRows: ParsedExcelRow[],
  principalId?: string | null
): Promise<{
  matched: Map<string, { driver: DriverMatch; row: ParsedExcelRow }>
  unmatched: UnmatchedRow[]
}> {
  const supabase = createBrowserSupabaseClient()
  const aggregatedRows = aggregateParsedRows(parsedRows)

  interface DriverQueryRow {
    id: string
    name: string
    employee_code: string | null
    delivery_area: string | null
    is_business_owner: boolean
    vat_included: boolean
    principals: { name: string } | null
  }

  const codes = aggregatedRows.map((r) => r.employee_code)
  let linkedDriverIds: string[] | null = null

  if (principalId) {
    const { data: links } = await supabase
      .from('driver_principals')
      .select('driver_id')
      .eq('principal_id', principalId)
      .eq('status', 'active')
    linkedDriverIds = (links ?? []).map((link: { driver_id: string }) => link.driver_id)
  }

  let query = supabase
    .from('drivers')
    .select('id, name, employee_code, delivery_area, is_business_owner, vat_included, principals(name)')
    .eq('agency_id', agencyId)
    .eq('status', 'active')
    .in('employee_code', codes)

  if (linkedDriverIds) {
    query = linkedDriverIds.length > 0
      ? query.in('id', linkedDriverIds)
      : query.in('id', ['__no_active_driver_for_principal__'])
  }

  const { data } = await query

  const drivers = (data ?? []) as unknown as DriverQueryRow[]

  const driverMap = new Map<string, DriverMatch>()
  const duplicateCodeSet = new Set<string>()
  for (const d of drivers) {
    if (!d.employee_code) continue

    const driverMatch: DriverMatch = {
      driver_id: d.id,
      driver_name: d.name,
      employee_code: d.employee_code,
      principal_name: d.principals?.name ?? null,
      delivery_area: d.delivery_area,
      is_business_owner: d.is_business_owner,
      vat_included: d.vat_included,
    }

    if (driverMap.has(d.employee_code)) {
      duplicateCodeSet.add(d.employee_code)
      continue
    }

    driverMap.set(d.employee_code, driverMatch)
  }

  const matched = new Map<string, { driver: DriverMatch; row: ParsedExcelRow }>()
  const unmatched: UnmatchedRow[] = []

  aggregatedRows.forEach((row, idx) => {
    if (duplicateCodeSet.has(row.employee_code)) {
      unmatched.push({
        employee_code: row.employee_code,
        row_index: idx + 1,
        raw_data: row.raw_data,
        driver_name: row.driver_name ?? null,
        reason: '같은 사번으로 등록된 기사가 2명 이상입니다.',
      })
      return
    }

    const driver = driverMap.get(row.employee_code)
    if (!driver) {
      unmatched.push({
        employee_code: row.employee_code,
        row_index: idx + 1,
        raw_data: row.raw_data,
        driver_name: row.driver_name ?? null,
        reason: '등록된 기사 없음',
      })
      return
    }

    const normalizedRowName = normalizeMatchingText(row.driver_name)
    const normalizedDriverName = normalizeMatchingText(driver.driver_name)
    if (normalizedRowName && normalizedDriverName && normalizedRowName !== normalizedDriverName) {
      unmatched.push({
        employee_code: row.employee_code,
        row_index: idx + 1,
        raw_data: row.raw_data,
        driver_name: row.driver_name ?? null,
        reason: `기사명 불일치 (엑셀: ${row.driver_name} / 등록: ${driver.driver_name})`,
      })
      return
    }

    matched.set(row.employee_code, { driver, row })
  })

  return { matched, unmatched }
}
