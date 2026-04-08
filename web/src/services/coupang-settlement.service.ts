/**
 * 쿠팡 정산 서비스
 *
 * 쿠팡 정산총괄/정산Raw 시트 기반 라우트별 + 요약 모드 정산
 */

import { createBrowserSupabaseClient } from '@/lib/supabase'
import { WITHHOLDING_TAX_RATE } from '@/config/constants'
import type { DriverDeduction } from './driver-rate.service'
import type { DriverRouteRate } from './driver-route-rate.service'
import type { FieldConfig } from './principal.service'
import type { CoupangSummaryRow, CoupangRawRow, DriverMatch, RouteSettlementDetail } from './excel-parser.service'
import { aggregateCoupangSummaryRows } from './excel-parser.service'
import type { SettlementCalcResult } from './settlement-calculator.service'
import {
  calculateTaxDeductions,
  calculateRateAmount,
  appendContractDeductions,
  appendInsuranceDeductions,
} from './settlement-calculator.service'
import type { DriverRate } from './driver-rate.service'
import type { UnmatchedRow } from './excel-parser.service'

/* ── Calculate Coupang settlements using 정산Raw + route rates ── */

export async function calculateCoupangRouteSettlements(
  agencyId: string,
  rawRows: CoupangRawRow[],
  summaryRows: CoupangSummaryRow[],
  fieldConfig?: FieldConfig
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

  const driverIds = drivers.map((d) => d.id)
  const [routeRatesRes, deductionsRes] = await Promise.all([
    supabase.from('driver_route_rates').select('*').in('driver_id', driverIds).eq('is_active', true),
    supabase.from('driver_deductions').select('*').in('driver_id', driverIds).eq('is_active', true),
  ])

  const routeRateMap = new Map<string, Map<string, DriverRouteRate>>()
  for (const rr of (routeRatesRes.data ?? []) as DriverRouteRate[]) {
    if (!rr.driver_id) continue
    let driverRoutes = routeRateMap.get(rr.driver_id)
    if (!driverRoutes) {
      driverRoutes = new Map()
      routeRateMap.set(rr.driver_id, driverRoutes)
    }
    driverRoutes.set(rr.route_code, rr)
  }

  const deductionsByDriver = new Map<string, DriverDeduction[]>()
  for (const deduction of (deductionsRes.data ?? []) as DriverDeduction[]) {
    if (!deduction.driver_id) continue
    const list = deductionsByDriver.get(deduction.driver_id) ?? []
    list.push(deduction)
    deductionsByDriver.set(deduction.driver_id, list)
  }

  const summaryMap = new Map<string, CoupangSummaryRow>()
  for (const s of aggregateCoupangSummaryRows(summaryRows)) {
    summaryMap.set(s.employee_code, s)
  }

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
    const deductions = deductionsByDriver.get(driver.id) ?? []
    const summary = summaryMap.get(employeeCode)

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
    let deliveryAmountTotal = 0
    let returnAmountTotal = 0
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
      deliveryAmountTotal += deliveryAmount
      returnAmountTotal += returnAmount

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
        rateDetails.push({ package_type: `${routeCode} 배송`, count: counts.delivery, rate_value: deliveryRate, rate_type: 'fixed', amount: deliveryAmount })
      }
      if (counts.return > 0) {
        rateDetails.push({ package_type: `${routeCode} 반품`, count: counts.return, rate_value: returnRate, rate_type: 'fixed', amount: returnAmount })
      }
    }

    const freshIncentive = summary ? Math.round(summary.fresh_incentive * (driver.fresh_incentive_pct / 100)) : 0
    const extraIncentive = summary ? Math.round(summary.extra_incentive * (driver.extra_incentive_pct / 100)) : 0
    const damageDeduction = summary?.damage_deduction ?? 0

    const deductionDetails: SettlementCalcResult['deduction_details'] = []
    if (damageDeduction > 0) {
      deductionDetails.push({ name: '분실파손 (운송사 차감)', deduction_type: 'fixed', amount: damageDeduction, calculated: damageDeduction })
    }

    const grossAmount = baseAmount + freshIncentive + extraIncentive
    const contractDeduction = appendContractDeductions(grossAmount, totalDelivery + totalReturn, deductions, deductionDetails)
    const insuranceDeduction = appendInsuranceDeductions(grossAmount, fieldConfig, deductionDetails)
    const totalDeduction = damageDeduction + contractDeduction + insuranceDeduction
    const netAmount = grossAmount - totalDeduction

    const tax = calculateTaxDeductions(netAmount, driver.is_business_owner, driver.vat_included)

    if (tax.vatAmount > 0) {
      deductionDetails.push({ name: '부가세 (포함가 역산 10%)', deduction_type: 'fixed', amount: tax.vatAmount, calculated: tax.vatAmount })
    }
    if (tax.withholdingAmount > 0) {
      deductionDetails.push({ name: `원천징수 (${(WITHHOLDING_TAX_RATE * 100).toFixed(1)}%)`, deduction_type: 'fixed', amount: tax.withholdingAmount, calculated: tax.withholdingAmount })
    }

    const totalCount = totalDelivery + totalReturn

    results.push({
      driver_id: driver.id, driver_name: driver.name, employee_code: employeeCode,
      principal_name: driver.principals?.name ?? null,
      delivery_count: totalDelivery, return_count: totalReturn, collect_count: 0,
      delivery_amount: deliveryAmountTotal, return_amount: returnAmountTotal, collect_amount: 0,
      fresh_count: 0, etc_count: 0, total_count: totalCount,
      base_amount: baseAmount, total_deduction: totalDeduction + tax.vatAmount + tax.withholdingAmount,
      net_amount: netAmount, fresh_incentive: freshIncentive, extra_incentive: extraIncentive,
      damage_deduction: damageDeduction, vat_amount: tax.vatAmount,
      withholding_amount: tax.withholdingAmount, final_amount: tax.finalAmount,
      is_business_owner: driver.is_business_owner, vat_included: driver.vat_included,
      rate_details: rateDetails, route_details: routeDetails, deduction_details: deductionDetails,
      matched: true,
    })
  }

  return { results, unmatched, unmatchedRoutes }
}

/* ── Calculate Coupang settlements with driver rate + pass-through (legacy summary mode) ── */

export async function calculateCoupangSettlements(
  agencyId: string,
  summaryRows: CoupangSummaryRow[],
  fieldConfig?: FieldConfig
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

  const codes = summaryRows.map((r) => r.employee_code)
  const { data } = await supabase
    .from('drivers')
    .select('id, name, employee_code, delivery_area, is_business_owner, vat_included, principals(name)')
    .eq('agency_id', agencyId)
    .in('employee_code', codes)

  const drivers = (data ?? []) as unknown as DriverQueryRow[]
  const driverMatchMap = new Map<string, DriverMatch>()
  for (const d of drivers) {
    if (d.employee_code) {
      driverMatchMap.set(d.employee_code, {
        driver_id: d.id, driver_name: d.name, employee_code: d.employee_code,
        principal_name: d.principals?.name ?? null, delivery_area: d.delivery_area,
        is_business_owner: d.is_business_owner, vat_included: d.vat_included,
      })
    }
  }

  const matchedDriverIds = Array.from(driverMatchMap.values()).map((d) => d.driver_id)
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

  aggregateCoupangSummaryRows(summaryRows).forEach((row, idx) => {
    const driver = driverMatchMap.get(row.employee_code)
    if (!driver) {
      unmatched.push({ employee_code: row.employee_code, row_index: idx + 1, raw_data: { ...row } })
      return
    }

    const rates = ratesByDriver.get(driver.driver_id) ?? []
    const deductions = deductionsByDriver.get(driver.driver_id) ?? []

    const countMap: Record<string, number> = { '배송': row.delivery_count, '반품': row.return_count }
    const totalCount = row.delivery_count + row.return_count

    let baseAmount = 0
    let deliveryAmount = 0
    let returnAmount = 0
    const rateDetails: SettlementCalcResult['rate_details'] = []

    for (const rate of rates) {
      const count = countMap[rate.package_type] ?? 0
      if (count === 0) continue
      const packageGrossAmount = totalCount > 0 ? Math.round(row.coupang_base_amount * (count / totalCount)) : 0
      const amount = calculateRateAmount(rate.rate_type, count, rate.unit_price, packageGrossAmount)
      baseAmount += amount
      if (rate.package_type === '배송') deliveryAmount += amount
      if (rate.package_type === '반품') returnAmount += amount
      rateDetails.push({ package_type: rate.package_type, count, rate_value: rate.unit_price, rate_type: rate.rate_type, amount })
    }

    const freshIncentive = row.fresh_incentive
    const extraIncentive = row.extra_incentive
    const damageDeduction = row.damage_deduction

    const deductionDetails: SettlementCalcResult['deduction_details'] = []
    if (damageDeduction > 0) {
      deductionDetails.push({ name: '분실파손 (운송사 차감)', deduction_type: 'fixed', amount: damageDeduction, calculated: damageDeduction })
    }

    const grossAmount = baseAmount + freshIncentive + extraIncentive
    const contractDeductions = appendContractDeductions(grossAmount, totalCount, deductions, deductionDetails)
    const insuranceDeduction = appendInsuranceDeductions(grossAmount, fieldConfig, deductionDetails)
    const totalDeduction = contractDeductions + insuranceDeduction + damageDeduction
    const netAmount = grossAmount - totalDeduction

    const tax = calculateTaxDeductions(netAmount, driver.is_business_owner, driver.vat_included)

    if (tax.vatAmount > 0) {
      deductionDetails.push({ name: '부가세 (포함가 역산 10%)', deduction_type: 'fixed', amount: tax.vatAmount, calculated: tax.vatAmount })
    }
    if (tax.withholdingAmount > 0) {
      deductionDetails.push({ name: `원천징수 (${(WITHHOLDING_TAX_RATE * 100).toFixed(1)}%)`, deduction_type: 'fixed', amount: tax.withholdingAmount, calculated: tax.withholdingAmount })
    }

    results.push({
      driver_id: driver.driver_id, driver_name: driver.driver_name, employee_code: driver.employee_code,
      principal_name: driver.principal_name,
      delivery_count: row.delivery_count, return_count: row.return_count, collect_count: 0,
      delivery_amount: deliveryAmount, return_amount: returnAmount, collect_amount: 0,
      fresh_count: 0, etc_count: 0, total_count: totalCount,
      base_amount: baseAmount, total_deduction: totalDeduction + tax.vatAmount + tax.withholdingAmount,
      net_amount: netAmount, fresh_incentive: freshIncentive, extra_incentive: extraIncentive,
      damage_deduction: damageDeduction, vat_amount: tax.vatAmount,
      withholding_amount: tax.withholdingAmount, final_amount: tax.finalAmount,
      is_business_owner: driver.is_business_owner, vat_included: driver.vat_included,
      rate_details: rateDetails, route_details: [], deduction_details: deductionDetails,
      matched: true,
    })
  })

  return { results, unmatched }
}
