/**
 * 정산 계산 서비스
 *
 * 세금, 공제, 단가 계산 + 일반(비쿠팡) 정산 계산 + DB 저장
 */

import { createBrowserSupabaseClient } from '@/lib/supabase'
import { calcWithholding, WITHHOLDING_TAX_RATE } from '@/config/constants'
import type { DriverRate, DriverDeduction } from './driver-rate.service'
import type { FieldConfig } from './principal.service'
import type { ParsedExcelRow, DriverMatch, RouteSettlementDetail } from './excel-parser.service'

/* ── Types ── */

export interface SettlementCalcResult {
  driver_id: string
  driver_name: string
  employee_code: string
  principal_name: string | null
  delivery_count: number
  return_count: number
  collect_count: number
  delivery_amount: number
  return_amount: number
  collect_amount: number
  fresh_count: number
  etc_count: number
  total_count: number
  base_amount: number
  total_deduction: number
  net_amount: number
  fresh_incentive: number
  extra_incentive: number
  damage_deduction: number
  vat_amount: number
  withholding_amount: number
  final_amount: number
  is_business_owner: boolean
  vat_included: boolean
  rate_details: { package_type: string; count: number; rate_value: number; rate_type: string; amount: number }[]
  route_details: RouteSettlementDetail[]
  deduction_details: { name: string; deduction_type: string; amount: number; calculated: number }[]
  matched: boolean
}

/* ── Tax Deductions ── */

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
      vatAmount = netAmount - Math.round(netAmount / 1.1)
    }
  } else {
    withholdingAmount = calcWithholding(netAmount)
  }

  const finalAmount = netAmount - vatAmount - withholdingAmount
  return { vatAmount, withholdingAmount, finalAmount }
}

/* ── Rate Calculation ── */

export function calculateRateAmount(
  rateType: DriverRate['rate_type'],
  count: number,
  unitPrice: number,
  grossAmount = 0
): number {
  if (rateType === 'percentage') {
    if (grossAmount > 0) {
      return Math.round(grossAmount * (1 - (unitPrice / 100)))
    }
    return count * unitPrice
  }
  return count * unitPrice
}

/* ── Deduction Helpers ── */

export function appendContractDeductions(
  grossAmount: number,
  totalCount: number,
  deductions: DriverDeduction[],
  deductionDetails: SettlementCalcResult['deduction_details']
): number {
  let totalDeduction = 0

  for (const ded of deductions) {
    let calculated = 0

    if (ded.deduction_type === 'fixed') {
      calculated = ded.amount
    } else if (ded.deduction_type === 'percentage') {
      calculated = Math.round(grossAmount * (ded.amount / 100))
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

  return totalDeduction
}

export function appendInsuranceDeductions(
  grossAmount: number,
  fieldConfig: FieldConfig | undefined,
  deductionDetails: SettlementCalcResult['deduction_details']
): number {
  if (!fieldConfig) return 0

  let totalDeduction = 0
  const insuranceConfig = fieldConfig.insurance_config
  const deductionSection = fieldConfig.deduction_section

  if (insuranceConfig?.employment_insurance?.enabled && deductionSection?.employment_insurance?.enabled) {
    const rate = insuranceConfig.employment_insurance.rate
    const splitMode = deductionSection.employment_insurance.split_mode
    const driverShare = splitMode === 'split_50_50' ? 0.5 : 0
    if (driverShare > 0) {
      const calculated = Math.round(grossAmount * (rate / 100) * driverShare)
      if (calculated > 0) {
        totalDeduction += calculated
        deductionDetails.push({
          name: `고용보험 (${rate}% x ${splitMode === 'split_50_50' ? '50%' : '100%'})`,
          deduction_type: 'percentage',
          amount: rate,
          calculated,
        })
      }
    }
  }

  if (insuranceConfig?.industrial_insurance?.enabled && deductionSection?.industrial_insurance?.enabled) {
    const rate = insuranceConfig.industrial_insurance.rate
    const splitMode = deductionSection.industrial_insurance.split_mode
    const driverShare = splitMode === 'split_50_50' ? 0.5 : 0
    if (driverShare > 0) {
      const calculated = Math.round(grossAmount * (rate / 100) * driverShare)
      if (calculated > 0) {
        totalDeduction += calculated
        deductionDetails.push({
          name: `산재보험 (${rate}% x ${splitMode === 'split_50_50' ? '50%' : '100%'})`,
          deduction_type: 'percentage',
          amount: rate,
          calculated,
        })
      }
    }
  }

  return totalDeduction
}

/* ── Calculate settlements using driver individual rates (일반 정산) ── */

export async function calculateSettlements(
  matchedData: Map<string, { driver: DriverMatch; row: ParsedExcelRow }>,
  fieldConfig?: FieldConfig
): Promise<SettlementCalcResult[]> {
  const supabase = createBrowserSupabaseClient()
  const results: SettlementCalcResult[] = []

  const driverIds = Array.from(matchedData.values()).map((m) => m.driver.driver_id)

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

    let baseAmount = 0
    let deliveryAmount = 0
    let returnAmount = 0
    let collectAmount = 0
    const rateDetails: SettlementCalcResult['rate_details'] = []
    const grossAmountMap: Record<string, number> = {
      '배송': row.delivery_amount,
      '반품': row.return_amount,
      '집하': row.collect_amount,
    }

    for (const rate of rates) {
      const count = countMap[rate.package_type] ?? 0
      if (count === 0) continue

      const amount = calculateRateAmount(
        rate.rate_type,
        count,
        rate.unit_price,
        grossAmountMap[rate.package_type] ?? 0
      )

      baseAmount += amount
      if (rate.package_type === '배송') deliveryAmount += amount
      if (rate.package_type === '반품') returnAmount += amount
      if (rate.package_type === '집하') collectAmount += amount
      rateDetails.push({
        package_type: rate.package_type,
        count,
        rate_value: rate.unit_price,
        rate_type: rate.rate_type,
        amount,
      })
    }

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

    if (fieldConfig) {
      const ic = fieldConfig.insurance_config
      const ds = fieldConfig.deduction_section

      if (ic?.employment_insurance?.enabled && ds?.employment_insurance?.enabled) {
        const rate = ic.employment_insurance.rate
        const calcBase = baseAmount
        const splitMode = ds.employment_insurance.split_mode
        const driverShare = splitMode === 'split_50_50' ? 0.5 : 0
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

      if (ic?.industrial_insurance?.enabled && ds?.industrial_insurance?.enabled) {
        const rate = ic.industrial_insurance.rate
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

    const settlementBaseAmount = deliveryAmount + returnAmount + collectAmount

    results.push({
      driver_id: driver.driver_id,
      driver_name: driver.driver_name,
      employee_code: driver.employee_code,
      principal_name: driver.principal_name,
      delivery_count: row.delivery_count,
      return_count: row.return_count,
      collect_count: row.collect_count,
      delivery_amount: deliveryAmount,
      return_amount: returnAmount,
      collect_amount: collectAmount,
      fresh_count: row.fresh_count,
      etc_count: row.etc_count,
      total_count: totalCount,
      base_amount: settlementBaseAmount,
      total_deduction: totalDeduction + tax.vatAmount + tax.withholdingAmount,
      net_amount: netAmount,
      fresh_incentive: freshBackAmount,
      extra_incentive: incentiveAmount + etcIncomeAmount,
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
    let existingQuery = supabase
      .from('settlements')
      .select('id, driver_id')
      .eq('agency_id', agencyId)
      .eq('year_month', yearMonth)
    if (principalId) {
      existingQuery = existingQuery.eq('principal_id', principalId)
    } else {
      existingQuery = existingQuery.is('principal_id', null)
    }

    const { data: existingRows, error: existingError } = await existingQuery
    if (existingError) {
      return { error: existingError.message }
    }

    const existingByDriver = new Map<string, string[]>()
    for (const row of (existingRows ?? []) as { id: string; driver_id: string | null }[]) {
      if (!row.driver_id) continue
      const list = existingByDriver.get(row.driver_id) ?? []
      list.push(row.id)
      existingByDriver.set(row.driver_id, list)
    }

    const rows = results.map((r) => {
      const existingIds = existingByDriver.get(r.driver_id) ?? []
      const rowId = existingIds.shift()
      const grossTotal = r.base_amount + (r.fresh_incentive ?? 0) + (r.extra_incentive ?? 0)

      return {
        ...(rowId ? { id: rowId } : {}),
        agency_id: agencyId,
        driver_id: r.driver_id,
        principal_id: principalId,
        year_month: yearMonth,
        delivery_count: r.delivery_count,
        delivery_amount: r.delivery_amount,
        return_count: r.return_count,
        return_amount: r.return_amount,
        pickup_count: r.collect_count,
        pickup_amount: r.collect_amount,
        base_amount: r.base_amount,
        fresh_incentive: r.fresh_incentive ?? 0,
        extra_incentive: r.extra_incentive ?? 0,
        incentive_amount: (r.fresh_incentive ?? 0) + (r.extra_incentive ?? 0),
        gross_total: grossTotal,
        total_amount: grossTotal,
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
      }
    })

    const updateRows = rows.filter((row) => 'id' in row)
    const insertRows = rows.filter((row) => !('id' in row))

    if (updateRows.length > 0) {
      const { error: updateError } = await supabase
        .from('settlements')
        .upsert(updateRows, { onConflict: 'id' })
      if (updateError) return { error: updateError.message }
    }

    if (insertRows.length > 0) {
      const { error: insertError } = await supabase
        .from('settlements')
        .insert(insertRows)
      if (insertError) return { error: insertError.message }
    }

    const staleIds = Array.from(existingByDriver.values()).flat()
    if (staleIds.length > 0) {
      const { error: deleteError } = await supabase
        .from('settlements')
        .delete()
        .in('id', staleIds)
      if (deleteError) return { error: deleteError.message }
    }

    return { error: null }
  } catch (e) {
    return { error: e instanceof Error ? e.message : 'Unknown error' }
  }
}
