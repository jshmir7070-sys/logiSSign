import { createBrowserSupabaseClient } from '@/lib/supabase'
import { calcWithholding, WITHHOLDING_TAX_RATE } from '@/config/constants'
import type { DriverRate, DriverDeduction } from './driver-rate.service'
import type { DriverRouteRate } from './driver-route-rate.service'
import type { FieldConfig } from './principal.service'

/* ── Types ── */

export interface ExcelColumnMapping {
  employee_code_col: string   // 사번 열 이름
  delivery_count_col: string  // 배송건수 열 이름
  return_count_col?: string   // 반품건수 열 이름
  collect_count_col?: string  // 집하건수 열 이름
  fresh_count_col?: string    // 프레쉬백 건수 열 이름
  etc_count_col?: string      // 기타 건수 열 이름
  fresh_back_amount_col?: string    // 프레쉬백 금액 열 이름
  incentive_amount_col?: string     // 인센티브 금액 열 이름
  etc_income_amount_col?: string    // 기타수입 금액 열 이름
}

export interface ParsedExcelRow {
  employee_code: string
  delivery_count: number
  return_count: number
  collect_count: number
  fresh_count: number
  etc_count: number
  fresh_back_amount: number   // 프레쉬백 금액
  incentive_amount: number    // 인센티브 금액
  etc_income_amount: number   // 기타수입 금액
  raw_data: Record<string, unknown>
}

/** Coupang 정산총괄 시트에서 파싱한 기사별 요약 행 */
export interface CoupangSummaryRow {
  employee_code: string
  delivery_count: number
  return_count: number
  total_count: number
  coupang_base_amount: number       // 쿠팡 기준 금액(소계)
  fresh_incentive: number           // 프레쉬백 회수 인센티브
  extra_incentive: number           // 추가 인센티브 가중요인
  damage_deduction: number          // 분실파손 차감
  coupang_total: number             // 쿠팡 기준 총합계
}

/** 정산Raw 시트에서 파싱한 일별 배송 행 */
export interface CoupangRawRow {
  type: string              // 구분: 배송, 수기반영
  employee_code: string     // ID
  route_code: string        // Route: 505A, 505B 등
  delivery_date: number     // 배송일자 (Excel serial)
  camp: string              // 캠프명
  shift: string             // 배송유형 (주간/심야)
  vendor: string            // 업체명
  delivery_count: number    // 배송건수
  return_count: number      // 반품
  coupang_rate: number      // 쿠팡 단가 (반품동일)
  extra_incentive_unit: number // 추가 인센티브 (건당)
  base_amount: number       // 기본 배송단가 금액
  extra_amount: number      // 추가 인센티브 가중요인 금액
  total_amount: number      // 총금액
  fresh_incentive: number   // 프레시백 회수 인센티브
}

/** 라우트별 정산 상세 */
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

export interface DriverMatch {
  driver_id: string
  driver_name: string
  employee_code: string
  principal_name: string | null
  delivery_area: string | null
  is_business_owner: boolean
  vat_included: boolean
}

/**
 * 세금 공제 계산 (모든 정산 경로에서 공통 사용)
 *
 * 규칙:
 *  - 사업자 + 부가세 포함가 → 10% 역산 공제 (총액 ÷ 1.1 해서 차이만큼 공제)
 *  - 사업자 + 부가세 별도   → 계산 없음 (단가 자체가 공급가이므로 추가 공제 없음)
 *  - 비사업자              → 3.3% 원천징수 공제
 */
export function calculateTaxDeductions(
  netAmount: number,
  isBusinessOwner: boolean,
  vatIncluded: boolean
): { vatAmount: number; withholdingAmount: number; finalAmount: number } {
  let vatAmount = 0
  let withholdingAmount = 0

  if (isBusinessOwner) {
    if (vatIncluded) {
      // 포함가: 정산금액에서 부가세 역산 공제 (÷1.1)
      vatAmount = netAmount - Math.round(netAmount / 1.1)
    }
    // 별도: 계산 없음 — 단가가 이미 공급가
  } else {
    // 비사업자: 3.3% 원천징수
    withholdingAmount = calcWithholding(netAmount)
  }

  const finalAmount = netAmount - vatAmount - withholdingAmount
  return { vatAmount, withholdingAmount, finalAmount }
}

export interface SettlementCalcResult {
  driver_id: string
  driver_name: string
  employee_code: string
  principal_name: string | null
  /* 건수 */
  delivery_count: number
  return_count: number
  collect_count: number
  fresh_count: number
  etc_count: number
  total_count: number
  /* 금액 */
  base_amount: number
  total_deduction: number
  net_amount: number
  /* pass-through amounts (Coupang direct import) */
  fresh_incentive: number
  extra_incentive: number
  damage_deduction: number
  /* VAT */
  vat_amount: number
  withholding_amount: number     // 3.3% 원천징수 (비사업자)
  final_amount: number          // net_amount - vat_amount - withholding_amount
  is_business_owner: boolean
  vat_included: boolean
  /* 내역 */
  rate_details: { package_type: string; count: number; rate_value: number; rate_type: string; amount: number }[]
  route_details: RouteSettlementDetail[]
  deduction_details: { name: string; deduction_type: string; amount: number; calculated: number }[]
  matched: boolean
}

/** 엑셀 파일의 시트 정보 */
export interface SheetInfo {
  name: string
  rowCount: number
  detected: 'coupang_summary' | 'coupang_raw' | 'damage_list' | 'generic'
}

export interface UnmatchedRow {
  employee_code: string
  row_index: number
  raw_data: Record<string, unknown>
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

/* ── Parse Excel file ── */

export function parseExcelData(
  rows: Record<string, unknown>[],
  mapping: ExcelColumnMapping
): { parsed: ParsedExcelRow[]; errors: string[] } {
  const parsed: ParsedExcelRow[] = []
  const errors: string[] = []

  for (let i = 0; i < rows.length; i++) {
    const row = rows[i]
    const code = String(row[mapping.employee_code_col] ?? '').trim()
    if (!code) {
      continue // skip rows without employee code
    }

    const delivery = Number(row[mapping.delivery_count_col] ?? 0) || 0
    const ret = mapping.return_count_col ? (Number(row[mapping.return_count_col] ?? 0) || 0) : 0
    const collect = mapping.collect_count_col ? (Number(row[mapping.collect_count_col] ?? 0) || 0) : 0
    const fresh = mapping.fresh_count_col ? (Number(row[mapping.fresh_count_col] ?? 0) || 0) : 0
    const etc = mapping.etc_count_col ? (Number(row[mapping.etc_count_col] ?? 0) || 0) : 0
    const freshBackAmt = mapping.fresh_back_amount_col ? (Number(row[mapping.fresh_back_amount_col] ?? 0) || 0) : 0
    const incentiveAmt = mapping.incentive_amount_col ? (Number(row[mapping.incentive_amount_col] ?? 0) || 0) : 0
    const etcIncomeAmt = mapping.etc_income_amount_col ? (Number(row[mapping.etc_income_amount_col] ?? 0) || 0) : 0

    parsed.push({
      employee_code: code,
      delivery_count: delivery,
      return_count: ret,
      collect_count: collect,
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

    // Check for 정산총괄 pattern: row 4 has headers with ID, 배송, 반품
    if (/정산총괄/.test(name)) {
      detected = 'coupang_summary'
    } else if (/정산Raw/.test(name)) {
      detected = 'coupang_raw'
    } else if (/분실파손/.test(name)) {
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

  // Data starts at row 5 (index 5), headers at row 4
  for (let i = 5; i < rows.length; i++) {
    const row = rows[i]
    if (!row || !Array.isArray(row)) continue

    const id = String(row[3] ?? '').trim()
    if (!id) continue

    // Skip special entries (에코백 회수 인센티브 etc.) - no @ in ID
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

  // Row 0 is headers, data from row 1
  for (let i = 1; i < rows.length; i++) {
    const row = rows[i]
    if (!row || !Array.isArray(row)) continue

    const id = String(row[1] ?? '').trim()
    if (!id || !id.includes('@')) continue  // skip non-driver rows

    const type = String(row[0] ?? '').trim()
    const deliveryCount = Number(row[7]) || 0
    const returnCount = Number(row[8]) || 0

    // Skip rows with 0 deliveries and 0 returns (unless 수기반영)
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

/* ── Calculate Coupang settlements using 정산Raw + route rates ── */

export async function calculateCoupangRouteSettlements(
  agencyId: string,
  rawRows: CoupangRawRow[],
  summaryRows: CoupangSummaryRow[]
): Promise<{
  results: SettlementCalcResult[]
  unmatched: UnmatchedRow[]
  unmatchedRoutes: { employee_code: string; route_code: string }[]
}> {
  const supabase = createBrowserSupabaseClient()

  interface DriverQueryRow {
    id: string
    name: string
    employee_code: string | null
    delivery_area: string | null
    is_business_owner: boolean
    vat_included: boolean
    fresh_incentive_pct: number
    extra_incentive_pct: number
    principals: { name: string } | null
  }

  const codes = Array.from(new Set(rawRows.map((r) => r.employee_code)))
  const { data } = await supabase
    .from('drivers')
    .select('id, name, employee_code, delivery_area, is_business_owner, vat_included, fresh_incentive_pct, extra_incentive_pct, principals(name)')
    .eq('agency_id', agencyId)
    .in('employee_code', codes)

  const drivers = (data ?? []) as unknown as DriverQueryRow[]
  const driverMap = new Map<string, DriverQueryRow>()
  for (const d of drivers) {
    if (d.employee_code) driverMap.set(d.employee_code, d)
  }

  // Fetch route rates for matched drivers
  const driverIds = drivers.map((d) => d.id)
  const { data: routeRatesData } = await supabase
    .from('driver_route_rates')
    .select('*')
    .in('driver_id', driverIds)
    .eq('is_active', true)

  // Map: driver_id -> route_code -> DriverRouteRate
  const routeRateMap = new Map<string, Map<string, DriverRouteRate>>()
  for (const rr of (routeRatesData ?? []) as DriverRouteRate[]) {
    if (!rr.driver_id) continue
    let driverRoutes = routeRateMap.get(rr.driver_id)
    if (!driverRoutes) {
      driverRoutes = new Map()
      routeRateMap.set(rr.driver_id, driverRoutes)
    }
    driverRoutes.set(rr.route_code, rr)
  }

  // Build summary map for pass-through amounts
  const summaryMap = new Map<string, CoupangSummaryRow>()
  for (const s of summaryRows) {
    summaryMap.set(s.employee_code, s)
  }

  // Group raw rows by driver
  const driverRawMap = new Map<string, CoupangRawRow[]>()
  for (const row of rawRows) {
    const list = driverRawMap.get(row.employee_code) ?? []
    list.push(row)
    driverRawMap.set(row.employee_code, list)
  }

  const results: SettlementCalcResult[] = []
  const unmatched: UnmatchedRow[] = []
  const unmatchedRoutes: { employee_code: string; route_code: string }[] = []

  let idx = 0
  for (const [employeeCode, rows] of Array.from(driverRawMap.entries())) {
    idx++
    const driver = driverMap.get(employeeCode)
    if (!driver) {
      unmatched.push({
        employee_code: employeeCode,
        row_index: idx,
        raw_data: { delivery_rows: rows.length },
      })
      continue
    }

    const driverRoutes = routeRateMap.get(driver.id) ?? new Map()
    const summary = summaryMap.get(employeeCode)

    // Calculate per-route
    const routeGroups = new Map<string, { delivery: number; return: number; coupangRate: number }>()
    for (const row of rows) {
      const existing = routeGroups.get(row.route_code) ?? { delivery: 0, return: 0, coupangRate: row.coupang_rate }
      existing.delivery += row.delivery_count
      existing.return += row.return_count
      routeGroups.set(row.route_code, existing)
    }

    let baseAmount = 0
    let totalDelivery = 0
    let totalReturn = 0
    const routeDetails: RouteSettlementDetail[] = []
    const rateDetails: SettlementCalcResult['rate_details'] = []

    for (const [routeCode, counts] of Array.from(routeGroups.entries())) {
      const routeRate = driverRoutes.get(routeCode)

      let deliveryRate = 0
      let returnRate = 0

      if (routeRate) {
        deliveryRate = Number(routeRate.delivery_rate)
        returnRate = Number(routeRate.return_rate)
      } else {
        unmatchedRoutes.push({ employee_code: employeeCode, route_code: routeCode })
      }

      const deliveryAmount = counts.delivery * deliveryRate
      const returnAmount = counts.return * returnRate
      const routeTotal = deliveryAmount + returnAmount

      baseAmount += routeTotal
      totalDelivery += counts.delivery
      totalReturn += counts.return

      routeDetails.push({
        route_code: routeCode,
        delivery_count: counts.delivery,
        return_count: counts.return,
        driver_delivery_rate: deliveryRate,
        driver_return_rate: returnRate,
        coupang_rate: counts.coupangRate,
        delivery_amount: deliveryAmount,
        return_amount: returnAmount,
        total_amount: routeTotal,
      })

      if (counts.delivery > 0) {
        rateDetails.push({
          package_type: `${routeCode} 배송`,
          count: counts.delivery,
          rate_value: deliveryRate,
          rate_type: 'fixed',
          amount: deliveryAmount,
        })
      }
      if (counts.return > 0) {
        rateDetails.push({
          package_type: `${routeCode} 반품`,
          count: counts.return,
          rate_value: returnRate,
          rate_type: 'fixed',
          amount: returnAmount,
        })
      }
    }

    // Pass-through from summary
    const freshIncentive = summary
      ? Math.round(summary.fresh_incentive * (driver.fresh_incentive_pct / 100))
      : 0
    const extraIncentive = summary
      ? Math.round(summary.extra_incentive * (driver.extra_incentive_pct / 100))
      : 0
    const damageDeduction = summary?.damage_deduction ?? 0

    const deductionDetails: SettlementCalcResult['deduction_details'] = []
    if (damageDeduction > 0) {
      deductionDetails.push({
        name: '분실파손 (운송사 차감)',
        deduction_type: 'fixed',
        amount: damageDeduction,
        calculated: damageDeduction,
      })
    }

    const totalDeduction = damageDeduction
    const netAmount = baseAmount + freshIncentive + extraIncentive - totalDeduction

    // Tax deductions from driver settings
    const tax = calculateTaxDeductions(netAmount, driver.is_business_owner, driver.vat_included)

    if (tax.vatAmount > 0) {
      deductionDetails.push({
        name: '부가세 (포함가 역산 10%)',
        deduction_type: 'fixed',
        amount: tax.vatAmount,
        calculated: tax.vatAmount,
      })
    }
    if (tax.withholdingAmount > 0) {
      deductionDetails.push({
        name: `원천징수 (${(WITHHOLDING_TAX_RATE * 100).toFixed(1)}%)`,
        deduction_type: 'fixed',
        amount: tax.withholdingAmount,
        calculated: tax.withholdingAmount,
      })
    }

    const totalCount = totalDelivery + totalReturn

    results.push({
      driver_id: driver.id,
      driver_name: driver.name,
      employee_code: employeeCode,
      principal_name: driver.principals?.name ?? null,
      delivery_count: totalDelivery,
      return_count: totalReturn,
      collect_count: 0,
      fresh_count: 0,
      etc_count: 0,
      total_count: totalCount,
      base_amount: baseAmount,
      total_deduction: totalDeduction + tax.vatAmount + tax.withholdingAmount,
      net_amount: netAmount,
      fresh_incentive: freshIncentive,
      extra_incentive: extraIncentive,
      damage_deduction: damageDeduction,
      vat_amount: tax.vatAmount,
      withholding_amount: tax.withholdingAmount,
      final_amount: tax.finalAmount,
      is_business_owner: driver.is_business_owner,
      vat_included: driver.vat_included,
      rate_details: rateDetails,
      route_details: routeDetails,
      deduction_details: deductionDetails,
      matched: true,
    })
  }

  return { results, unmatched, unmatchedRoutes }
}

/* ── Calculate Coupang settlements with driver rate + pass-through (legacy summary mode) ── */

export async function calculateCoupangSettlements(
  agencyId: string,
  summaryRows: CoupangSummaryRow[]
): Promise<{
  results: SettlementCalcResult[]
  unmatched: UnmatchedRow[]
}> {
  const supabase = createBrowserSupabaseClient()

  interface DriverQueryRow {
    id: string
    name: string
    employee_code: string | null
    delivery_area: string | null
    is_business_owner: boolean
    vat_included: boolean
    principals: { name: string } | null
  }

  // Match drivers by employee_code
  const codes = summaryRows.map((r) => r.employee_code)
  const { data } = await supabase
    .from('drivers')
    .select('id, name, employee_code, delivery_area, is_business_owner, vat_included, principals(name)')
    .eq('agency_id', agencyId)
    .in('employee_code', codes)

  const drivers = (data ?? []) as unknown as DriverQueryRow[]
  const driverMap = new Map<string, DriverMatch>()
  for (const d of drivers) {
    if (d.employee_code) {
      driverMap.set(d.employee_code, {
        driver_id: d.id,
        driver_name: d.name,
        employee_code: d.employee_code,
        principal_name: d.principals?.name ?? null,
        delivery_area: d.delivery_area,
        is_business_owner: d.is_business_owner,
        vat_included: d.vat_included,
      })
    }
  }

  // Fetch driver rates for matched drivers
  const matchedDriverIds = Array.from(driverMap.values()).map((d) => d.driver_id)

  const [ratesRes, deductionsRes] = await Promise.all([
    supabase.from('driver_rates').select('*').in('driver_id', matchedDriverIds).eq('is_active', true),
    supabase.from('driver_deductions').select('*').in('driver_id', matchedDriverIds).eq('is_active', true),
  ])

  const ratesByDriver = new Map<string, DriverRate[]>()
  for (const r of (ratesRes.data ?? []) as DriverRate[]) {
    if (!r.driver_id) continue
    const list = ratesByDriver.get(r.driver_id) ?? []
    list.push(r)
    ratesByDriver.set(r.driver_id, list)
  }

  const deductionsByDriver = new Map<string, DriverDeduction[]>()
  for (const d of (deductionsRes.data ?? []) as DriverDeduction[]) {
    if (!d.driver_id) continue
    const list = deductionsByDriver.get(d.driver_id) ?? []
    list.push(d)
    deductionsByDriver.set(d.driver_id, list)
  }

  const results: SettlementCalcResult[] = []
  const unmatched: UnmatchedRow[] = []

  summaryRows.forEach((row, idx) => {
    const driver = driverMap.get(row.employee_code)
    if (!driver) {
      unmatched.push({
        employee_code: row.employee_code,
        row_index: idx + 1,
        raw_data: { ...row },
      })
      return
    }

    const rates = ratesByDriver.get(driver.driver_id) ?? []
    const deductions = deductionsByDriver.get(driver.driver_id) ?? []

    // Calculate base amount from driver's contracted rates
    const countMap: Record<string, number> = {
      '배송': row.delivery_count,
      '반품': row.return_count,
    }
    const totalCount = row.delivery_count + row.return_count

    let baseAmount = 0
    const rateDetails: SettlementCalcResult['rate_details'] = []

    for (const rate of rates) {
      const count = countMap[rate.package_type] ?? 0
      if (count === 0) continue
      const amount = rate.rate_type === 'fixed'
        ? count * rate.unit_price
        : count * rate.unit_price
      baseAmount += amount
      rateDetails.push({
        package_type: rate.package_type,
        count,
        rate_value: rate.unit_price,
        rate_type: rate.rate_type,
        amount,
      })
    }

    // If no rates configured, fallback: skip (base stays 0)

    // Pass-through amounts from Coupang Excel
    const freshIncentive = row.fresh_incentive  // 프레쉬백 100% 지급
    const extraIncentive = row.extra_incentive   // 추가 인센티브
    const damageDeduction = row.damage_deduction // 분실파손 차감

    // Calculate contract-based deductions
    let contractDeductions = 0
    const deductionDetails: SettlementCalcResult['deduction_details'] = []
    for (const ded of deductions) {
      let calculated = 0
      if (ded.deduction_type === 'fixed') {
        calculated = ded.amount
      } else if (ded.deduction_type === 'percentage') {
        calculated = Math.round(baseAmount * (ded.amount / 100))
      } else if (ded.deduction_type === 'per_unit') {
        calculated = totalCount * ded.amount
      }
      contractDeductions += calculated
      deductionDetails.push({
        name: ded.name,
        deduction_type: ded.deduction_type,
        amount: ded.amount,
        calculated,
      })
    }

    // Add damage deduction from Excel as a line item
    if (damageDeduction > 0) {
      deductionDetails.push({
        name: '분실파손 (운송사 차감)',
        deduction_type: 'fixed',
        amount: damageDeduction,
        calculated: damageDeduction,
      })
    }

    const totalDeduction = contractDeductions + damageDeduction
    const netAmount = baseAmount + freshIncentive + extraIncentive - totalDeduction

    // Tax deductions from driver settings
    const tax = calculateTaxDeductions(netAmount, driver.is_business_owner, driver.vat_included)

    if (tax.vatAmount > 0) {
      deductionDetails.push({
        name: '부가세 (포함가 역산 10%)',
        deduction_type: 'fixed',
        amount: tax.vatAmount,
        calculated: tax.vatAmount,
      })
    }
    if (tax.withholdingAmount > 0) {
      deductionDetails.push({
        name: `원천징수 (${(WITHHOLDING_TAX_RATE * 100).toFixed(1)}%)`,
        deduction_type: 'fixed',
        amount: tax.withholdingAmount,
        calculated: tax.withholdingAmount,
      })
    }

    results.push({
      driver_id: driver.driver_id,
      driver_name: driver.driver_name,
      employee_code: driver.employee_code,
      principal_name: driver.principal_name,
      delivery_count: row.delivery_count,
      return_count: row.return_count,
      collect_count: 0,
      fresh_count: 0,
      etc_count: 0,
      total_count: totalCount,
      base_amount: baseAmount,
      total_deduction: totalDeduction + tax.vatAmount + tax.withholdingAmount,
      net_amount: netAmount,
      fresh_incentive: freshIncentive,
      extra_incentive: extraIncentive,
      damage_deduction: damageDeduction,
      vat_amount: tax.vatAmount,
      withholding_amount: tax.withholdingAmount,
      final_amount: tax.finalAmount,
      is_business_owner: driver.is_business_owner,
      vat_included: driver.vat_included,
      rate_details: rateDetails,
      route_details: [],
      deduction_details: deductionDetails,
      matched: true,
    })
  })

  return { results, unmatched }
}

/* ── Match parsed rows to drivers ── */

export async function matchDrivers(
  agencyId: string,
  parsedRows: ParsedExcelRow[]
): Promise<{
  matched: Map<string, { driver: DriverMatch; row: ParsedExcelRow }>
  unmatched: UnmatchedRow[]
}> {
  const supabase = createBrowserSupabaseClient()

  interface DriverQueryRow {
    id: string
    name: string
    employee_code: string | null
    delivery_area: string | null
    is_business_owner: boolean
    vat_included: boolean
    principals: { name: string } | null
  }

  const codes = parsedRows.map((r) => r.employee_code)
  const { data } = await supabase
    .from('drivers')
    .select('id, name, employee_code, delivery_area, is_business_owner, vat_included, principals(name)')
    .eq('agency_id', agencyId)
    .in('employee_code', codes)

  const drivers = (data ?? []) as unknown as DriverQueryRow[]

  const driverMap = new Map<string, DriverMatch>()
  for (const d of drivers) {
    if (d.employee_code) {
      driverMap.set(d.employee_code, {
        driver_id: d.id,
        driver_name: d.name,
        employee_code: d.employee_code,
        principal_name: d.principals?.name ?? null,
        delivery_area: d.delivery_area,
        is_business_owner: d.is_business_owner,
        vat_included: d.vat_included,
      })
    }
  }

  const matched = new Map<string, { driver: DriverMatch; row: ParsedExcelRow }>()
  const unmatched: UnmatchedRow[] = []

  parsedRows.forEach((row, idx) => {
    const driver = driverMap.get(row.employee_code)
    if (driver) {
      matched.set(row.employee_code, { driver, row })
    } else {
      unmatched.push({ employee_code: row.employee_code, row_index: idx + 1, raw_data: row.raw_data })
    }
  })

  return { matched, unmatched }
}

/* ── Calculate settlements using driver individual rates ── */

export async function calculateSettlements(
  matchedData: Map<string, { driver: DriverMatch; row: ParsedExcelRow }>,
  fieldConfig?: FieldConfig
): Promise<SettlementCalcResult[]> {
  const supabase = createBrowserSupabaseClient()
  const results: SettlementCalcResult[] = []

  const driverIds = Array.from(matchedData.values()).map((m) => m.driver.driver_id)

  // Batch fetch all rates and deductions
  const [ratesRes, deductionsRes] = await Promise.all([
    supabase.from('driver_rates').select('*').in('driver_id', driverIds).eq('is_active', true),
    supabase.from('driver_deductions').select('*').in('driver_id', driverIds).eq('is_active', true),
  ])

  const ratesByDriver = new Map<string, DriverRate[]>()
  for (const r of (ratesRes.data ?? []) as DriverRate[]) {
    if (!r.driver_id) continue
    const list = ratesByDriver.get(r.driver_id) ?? []
    list.push(r)
    ratesByDriver.set(r.driver_id, list)
  }

  const deductionsByDriver = new Map<string, DriverDeduction[]>()
  for (const d of (deductionsRes.data ?? []) as DriverDeduction[]) {
    if (!d.driver_id) continue
    const list = deductionsByDriver.get(d.driver_id) ?? []
    list.push(d)
    deductionsByDriver.set(d.driver_id, list)
  }

  const entries = Array.from(matchedData.values())
  for (const { driver, row } of entries) {
    const rates = ratesByDriver.get(driver.driver_id) ?? []
    const deductions = deductionsByDriver.get(driver.driver_id) ?? []

    const countMap: Record<string, number> = {
      '배송': row.delivery_count,
      '반품': row.return_count,
      '집하': row.collect_count,
      '프레쉬백': row.fresh_count,
      '기타': row.etc_count,
    }

    const totalCount = row.delivery_count + row.return_count + row.collect_count + row.fresh_count + row.etc_count

    // Calculate base amount from rates
    let baseAmount = 0
    const rateDetails: SettlementCalcResult['rate_details'] = []

    for (const rate of rates) {
      const count = countMap[rate.package_type] ?? 0
      if (count === 0) continue

      let amount = 0
      if (rate.rate_type === 'fixed') {
        amount = count * rate.unit_price
      } else {
        // percentage: unit_price is the % the driver gets of base price
        // For percentage mode, unit_price IS the per-unit amount (as entered)
        amount = count * rate.unit_price
      }

      baseAmount += amount
      rateDetails.push({
        package_type: rate.package_type,
        count,
        rate_value: rate.unit_price,
        rate_type: rate.rate_type,
        amount,
      })
    }

    // 부가항목 (프레쉬백, 인센티브, 기타수입) — 엑셀에서 직접 입력
    const freshBackAmount = row.fresh_back_amount ?? 0
    const incentiveAmount = row.incentive_amount ?? 0
    const etcIncomeAmount = row.etc_income_amount ?? 0
    const additionalIncome = freshBackAmount + incentiveAmount + etcIncomeAmount

    if (freshBackAmount > 0) {
      rateDetails.push({ package_type: '프레쉬백', count: 1, rate_value: freshBackAmount, rate_type: 'fixed', amount: freshBackAmount })
    }
    if (incentiveAmount > 0) {
      rateDetails.push({ package_type: '인센티브', count: 1, rate_value: incentiveAmount, rate_type: 'fixed', amount: incentiveAmount })
    }
    if (etcIncomeAmount > 0) {
      rateDetails.push({ package_type: '기타수입', count: 1, rate_value: etcIncomeAmount, rate_type: 'fixed', amount: etcIncomeAmount })
    }

    baseAmount += additionalIncome

    // Calculate deductions
    let totalDeduction = 0
    const deductionDetails: SettlementCalcResult['deduction_details'] = []

    for (const ded of deductions) {
      let calculated = 0
      if (ded.deduction_type === 'fixed') {
        calculated = ded.amount
      } else if (ded.deduction_type === 'percentage') {
        calculated = Math.round(baseAmount * (ded.amount / 100))
      } else if (ded.deduction_type === 'per_unit') {
        calculated = totalCount * ded.amount
      }

      totalDeduction += calculated
      deductionDetails.push({
        name: ded.name,
        deduction_type: ded.deduction_type,
        amount: ded.amount,
        calculated,
      })
    }

    // 고용보험 / 산재보험 자동 계산 (카테고리 설정값 기반)
    if (fieldConfig) {
      const ic = fieldConfig.insurance_config
      const ds = fieldConfig.deduction_section

      // 고용보험: 설정에서 enabled + rate(%)
      if (ic?.employment_insurance?.enabled && ds?.employment_insurance?.enabled) {
        const rate = ic.employment_insurance.rate  // e.g. 0.9 = 0.9%
        const calcBase = baseAmount
        // split_mode에 따라 기사 부담분 계산
        const splitMode = ds.employment_insurance.split_mode
        const driverShare = splitMode === 'split_50_50' ? 0.5 : 0  // employer_100 → 기사부담 0
        if (driverShare > 0) {
          const insuranceAmount = Math.round(calcBase * (rate / 100) * driverShare)
          if (insuranceAmount > 0) {
            totalDeduction += insuranceAmount
            deductionDetails.push({
              name: `고용보험 (${rate}% × ${splitMode === 'split_50_50' ? '50%' : '100%'})`,
              deduction_type: 'percentage',
              amount: rate,
              calculated: insuranceAmount,
            })
          }
        }
      }

      // 산재보험: 설정에서 enabled + rate(%)
      if (ic?.industrial_insurance?.enabled && ds?.industrial_insurance?.enabled) {
        const rate = ic.industrial_insurance.rate  // e.g. 1.8 = 1.8%
        const calcBase = baseAmount
        const splitMode = ds.industrial_insurance.split_mode
        const driverShare = splitMode === 'split_50_50' ? 0.5 : 0
        if (driverShare > 0) {
          const insuranceAmount = Math.round(calcBase * (rate / 100) * driverShare)
          if (insuranceAmount > 0) {
            totalDeduction += insuranceAmount
            deductionDetails.push({
              name: `산재보험 (${rate}% × ${splitMode === 'split_50_50' ? '50%' : '100%'})`,
              deduction_type: 'percentage',
              amount: rate,
              calculated: insuranceAmount,
            })
          }
        }
      }
    }

    const netAmount = baseAmount - totalDeduction

    // Tax deductions from driver settings
    const tax = calculateTaxDeductions(netAmount, driver.is_business_owner, driver.vat_included)

    if (tax.vatAmount > 0) {
      deductionDetails.push({
        name: '부가세 (포함가 역산 10%)',
        deduction_type: 'fixed',
        amount: tax.vatAmount,
        calculated: tax.vatAmount,
      })
    }
    if (tax.withholdingAmount > 0) {
      deductionDetails.push({
        name: `원천징수 (${(WITHHOLDING_TAX_RATE * 100).toFixed(1)}%)`,
        deduction_type: 'fixed',
        amount: tax.withholdingAmount,
        calculated: tax.withholdingAmount,
      })
    }

    results.push({
      driver_id: driver.driver_id,
      driver_name: driver.driver_name,
      employee_code: driver.employee_code,
      principal_name: driver.principal_name,
      delivery_count: row.delivery_count,
      return_count: row.return_count,
      collect_count: row.collect_count,
      fresh_count: row.fresh_count,
      etc_count: row.etc_count,
      total_count: totalCount,
      base_amount: baseAmount,
      total_deduction: totalDeduction + tax.vatAmount + tax.withholdingAmount,
      net_amount: netAmount,
      fresh_incentive: freshBackAmount,
      extra_incentive: incentiveAmount,
      damage_deduction: 0,
      vat_amount: tax.vatAmount,
      withholding_amount: tax.withholdingAmount,
      final_amount: tax.finalAmount,
      is_business_owner: driver.is_business_owner,
      vat_included: driver.vat_included,
      rate_details: rateDetails,
      route_details: [],
      deduction_details: deductionDetails,
      matched: true,
    })
  }

  return results
}

/* ── Save settlements to DB ── */

export async function saveSettlements(
  agencyId: string,
  yearMonth: string,
  principalId: string | null,
  results: SettlementCalcResult[]
): Promise<{ error: string | null }> {
  const supabase = createBrowserSupabaseClient()

  try {
    // Delete existing settlements for this month/agency/principal to avoid duplicates
    let deleteQuery = supabase
      .from('settlements')
      .delete()
      .eq('agency_id', agencyId)
      .eq('year_month', yearMonth)
    if (principalId) {
      deleteQuery = deleteQuery.eq('principal_id', principalId)
    } else {
      deleteQuery = deleteQuery.is('principal_id', null)
    }
    await deleteQuery

    const rows = results.map((r) => ({
      agency_id: agencyId,
      driver_id: r.driver_id,
      principal_id: principalId,
      year_month: yearMonth,
      delivery_count: r.delivery_count,
      delivery_amount: r.base_amount,
      return_count: r.return_count,
      return_amount: 0,
      pickup_count: r.collect_count,
      pickup_amount: 0,
      base_amount: r.base_amount,
      fresh_incentive: r.fresh_incentive ?? 0,
      extra_incentive: r.extra_incentive ?? 0,
      incentive_amount: (r.fresh_incentive ?? 0) + (r.extra_incentive ?? 0),
      gross_total: r.base_amount + (r.fresh_incentive ?? 0) + (r.extra_incentive ?? 0),
      total_amount: r.base_amount + (r.fresh_incentive ?? 0) + (r.extra_incentive ?? 0),
      total_deduction: r.total_deduction,
      vat_amount: r.vat_amount,
      net_amount: r.final_amount,
      is_business_owner: r.is_business_owner,
      vat_included: r.vat_included,
      deduction_detail: Object.fromEntries(
        r.deduction_details.map((d) => [d.name, d.calculated])
      ),
      route_details: r.route_details.length > 0 ? r.route_details : null,
      status: 'draft' as const,
    }))

    const { error } = await supabase.from('settlements').insert(rows)

    if (error) {
      console.error('Failed to save settlements:', error)
      return { error: error.message }
    }

    return { error: null }
  } catch (e) {
    console.error('saveSettlements exception:', e)
    return { error: e instanceof Error ? e.message : 'Unknown error' }
  }
}