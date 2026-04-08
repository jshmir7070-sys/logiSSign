/**
 * settlement-calculator.service tests
 *
 * Pure function tests for tax deductions, rate calculations,
 * contract deductions, and insurance deductions.
 */
import { describe, it, expect, vi } from 'vitest'

// Mock the browser supabase client (imported at module level by the service)
vi.mock('@/lib/supabase', () => ({
  createBrowserSupabaseClient: vi.fn(() => ({})),
}))

import {
  calculateTaxDeductions,
  calculateRateAmount,
  appendContractDeductions,
  appendInsuranceDeductions,
} from '@/services/settlement-calculator.service'
import type { FieldConfig } from '@/services/principal.service'

/* ── calculateTaxDeductions ── */

describe('calculateTaxDeductions', () => {
  it('business owner with VAT included: applies 10% reverse calculation', () => {
    // 1,100,000 includes VAT -> supply = 1,000,000 -> VAT = 100,000
    const result = calculateTaxDeductions(1_100_000, true, true)

    expect(result.vatAmount).toBe(100_000)
    expect(result.withholdingAmount).toBe(0)
    expect(result.finalAmount).toBe(1_000_000)
  })

  it('business owner with VAT excluded: no deduction', () => {
    // Supply price already excludes VAT, so nothing to deduct
    const result = calculateTaxDeductions(1_000_000, true, false)

    expect(result.vatAmount).toBe(0)
    expect(result.withholdingAmount).toBe(0)
    expect(result.finalAmount).toBe(1_000_000)
  })

  it('non-business owner: applies 3.3% withholding tax', () => {
    const netAmount = 1_000_000
    const result = calculateTaxDeductions(netAmount, false, false)

    // 3.3% of 1,000,000 = 33,000
    expect(result.vatAmount).toBe(0)
    expect(result.withholdingAmount).toBe(Math.round(netAmount * 0.033))
    expect(result.finalAmount).toBe(netAmount - result.withholdingAmount)
  })

  it('non-business owner: vatIncluded flag is irrelevant', () => {
    const netAmount = 500_000
    const resultA = calculateTaxDeductions(netAmount, false, true)
    const resultB = calculateTaxDeductions(netAmount, false, false)

    // Both should produce the same withholding since is_business_owner is false
    expect(resultA.withholdingAmount).toBe(resultB.withholdingAmount)
    expect(resultA.vatAmount).toBe(0)
    expect(resultB.vatAmount).toBe(0)
  })

  it('handles zero amount', () => {
    const result = calculateTaxDeductions(0, true, true)
    expect(result.vatAmount).toBe(0)
    expect(result.withholdingAmount).toBe(0)
    expect(result.finalAmount).toBe(0)
  })
})

/* ── calculateRateAmount ── */

describe('calculateRateAmount', () => {
  it('fixed rate type: count * unitPrice', () => {
    const result = calculateRateAmount('fixed', 150, 3500)
    expect(result).toBe(150 * 3500) // 525,000
  })

  it('percentage rate type with gross amount: grossAmount * (1 - unitPrice/100)', () => {
    // e.g. 10% deduction rate on 1,000,000 gross
    const result = calculateRateAmount('percentage', 100, 10, 1_000_000)
    // 1,000,000 * (1 - 10/100) = 900,000
    expect(result).toBe(900_000)
  })

  it('percentage rate type without gross amount: falls back to count * unitPrice', () => {
    const result = calculateRateAmount('percentage', 100, 3500, 0)
    expect(result).toBe(100 * 3500)
  })

  it('fixed rate with zero count returns 0', () => {
    const result = calculateRateAmount('fixed', 0, 3500)
    expect(result).toBe(0)
  })
})

/* ── appendContractDeductions ── */

describe('appendContractDeductions', () => {
  it('calculates fixed deductions correctly', () => {
    const details: { name: string; deduction_type: string; amount: number; calculated: number }[] = []
    const total = appendContractDeductions(1_000_000, 100, [
      { id: '1', driver_id: 'd1', principal_id: 'p1', name: '차량렌탈', deduction_type: 'fixed', amount: 500_000, unit_label: '월', is_active: true },
    ], details)

    expect(total).toBe(500_000)
    expect(details).toHaveLength(1)
    expect(details[0].calculated).toBe(500_000)
  })

  it('calculates percentage deductions correctly', () => {
    const details: { name: string; deduction_type: string; amount: number; calculated: number }[] = []
    const total = appendContractDeductions(1_000_000, 100, [
      { id: '2', driver_id: 'd1', principal_id: 'p1', name: '수수료', deduction_type: 'percentage', amount: 5, unit_label: '%', is_active: true },
    ], details)

    // 5% of 1,000,000 = 50,000
    expect(total).toBe(50_000)
    expect(details[0].calculated).toBe(50_000)
  })

  it('calculates per_unit deductions correctly', () => {
    const details: { name: string; deduction_type: string; amount: number; calculated: number }[] = []
    const total = appendContractDeductions(1_000_000, 200, [
      { id: '3', driver_id: 'd1', principal_id: 'p1', name: '운송장', deduction_type: 'per_unit', amount: 100, unit_label: '건', is_active: true },
    ], details)

    // 200 units * 100 per unit = 20,000
    expect(total).toBe(20_000)
    expect(details[0].calculated).toBe(20_000)
  })

  it('accumulates multiple deduction types', () => {
    const details: { name: string; deduction_type: string; amount: number; calculated: number }[] = []
    const total = appendContractDeductions(1_000_000, 100, [
      { id: '1', driver_id: 'd1', principal_id: 'p1', name: '렌탈', deduction_type: 'fixed', amount: 300_000, unit_label: '월', is_active: true },
      { id: '2', driver_id: 'd1', principal_id: 'p1', name: '수수료', deduction_type: 'percentage', amount: 10, unit_label: '%', is_active: true },
      { id: '3', driver_id: 'd1', principal_id: 'p1', name: '운송장', deduction_type: 'per_unit', amount: 50, unit_label: '건', is_active: true },
    ], details)

    // 300,000 + 100,000 + 5,000 = 405,000
    expect(total).toBe(405_000)
    expect(details).toHaveLength(3)
  })
})

/* ── appendInsuranceDeductions ── */

describe('appendInsuranceDeductions', () => {
  it('calculates employment insurance 50/50 split', () => {
    const details: { name: string; deduction_type: string; amount: number; calculated: number }[] = []

    const fieldConfig = {
      insurance_config: {
        employment_insurance: { enabled: true, rate: 1.8, note: '' },
        industrial_insurance: { enabled: false, rate: 0, note: '' },
      },
      deduction_section: {
        employment_insurance: { enabled: true, split_mode: 'split_50_50' as const },
        industrial_insurance: { enabled: false, split_mode: 'employer_100' as const },
        cargo_accident: { enabled: false, mode: 'actual_cost' as const },
        vehicle_rental: { enabled: false, monthly_amount: 0 },
        waybill: { enabled: false, unit_price: 0 },
        custom_deductions: [],
      },
    } as unknown as FieldConfig

    const total = appendInsuranceDeductions(2_000_000, fieldConfig, details)

    // 2,000,000 * 1.8% * 50% = 18,000
    expect(total).toBe(18_000)
    expect(details).toHaveLength(1)
    expect(details[0].name).toContain('고용보험')
    expect(details[0].name).toContain('1.8%')
    expect(details[0].calculated).toBe(18_000)
  })

  it('returns 0 when fieldConfig is undefined', () => {
    const details: { name: string; deduction_type: string; amount: number; calculated: number }[] = []
    const total = appendInsuranceDeductions(2_000_000, undefined, details)
    expect(total).toBe(0)
    expect(details).toHaveLength(0)
  })

  it('returns 0 when insurance is employer_100 (driver share 0)', () => {
    const details: { name: string; deduction_type: string; amount: number; calculated: number }[] = []

    const fieldConfig = {
      insurance_config: {
        employment_insurance: { enabled: true, rate: 1.8, note: '' },
        industrial_insurance: { enabled: false, rate: 0, note: '' },
      },
      deduction_section: {
        employment_insurance: { enabled: true, split_mode: 'employer_100' as const },
        industrial_insurance: { enabled: false, split_mode: 'employer_100' as const },
        cargo_accident: { enabled: false, mode: 'actual_cost' as const },
        vehicle_rental: { enabled: false, monthly_amount: 0 },
        waybill: { enabled: false, unit_price: 0 },
        custom_deductions: [],
      },
    } as unknown as FieldConfig

    const total = appendInsuranceDeductions(2_000_000, fieldConfig, details)
    expect(total).toBe(0)
    expect(details).toHaveLength(0)
  })

  it('calculates both employment and industrial insurance when both enabled', () => {
    const details: { name: string; deduction_type: string; amount: number; calculated: number }[] = []

    const fieldConfig = {
      insurance_config: {
        employment_insurance: { enabled: true, rate: 1.8, note: '' },
        industrial_insurance: { enabled: true, rate: 3.5, note: '' },
      },
      deduction_section: {
        employment_insurance: { enabled: true, split_mode: 'split_50_50' as const },
        industrial_insurance: { enabled: true, split_mode: 'split_50_50' as const },
        cargo_accident: { enabled: false, mode: 'actual_cost' as const },
        vehicle_rental: { enabled: false, monthly_amount: 0 },
        waybill: { enabled: false, unit_price: 0 },
        custom_deductions: [],
      },
    } as unknown as FieldConfig

    const grossAmount = 2_000_000
    const total = appendInsuranceDeductions(grossAmount, fieldConfig, details)

    // Employment: 2,000,000 * 1.8% * 50% = 18,000
    // Industrial: 2,000,000 * 3.5% * 50% = 35,000
    expect(total).toBe(18_000 + 35_000)
    expect(details).toHaveLength(2)
    expect(details[0].name).toContain('고용보험')
    expect(details[1].name).toContain('산재보험')
  })
})
