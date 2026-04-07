import { describe, expect, it } from 'vitest'

import { getPlanLimits, isPaidPlan } from '@/lib/plan-limits'
import { getSubscriptionAmount } from '@/services/payment.service'
import { calculateTaxDeductions } from '@/services/excel-settlement.service'

describe('tax deductions', () => {
  it('extracts VAT from VAT-inclusive business income', () => {
    const result = calculateTaxDeductions(1_100_000, true, true)

    expect(result.vatAmount).toBe(100_000)
    expect(result.withholdingAmount).toBe(0)
    expect(result.finalAmount).toBe(1_000_000)
  })

  it('leaves business income unchanged when VAT is not included', () => {
    const result = calculateTaxDeductions(1_000_000, true, false)

    expect(result.vatAmount).toBe(0)
    expect(result.withholdingAmount).toBe(0)
    expect(result.finalAmount).toBe(1_000_000)
  })

  it('applies 3.3% withholding for non-business income', () => {
    const result = calculateTaxDeductions(1_000_000, false, false)

    expect(result.vatAmount).toBe(0)
    expect(result.withholdingAmount).toBe(33_000)
    expect(result.finalAmount).toBe(967_000)
  })

  it('returns zero deductions for zero amount', () => {
    const result = calculateTaxDeductions(0, true, true)

    expect(result.vatAmount).toBe(0)
    expect(result.finalAmount).toBe(0)
  })
})

describe('plan limits', () => {
  it('uses the current free defaults', () => {
    const limits = getPlanLimits('free')

    expect(limits.maxDrivers).toBe(5)
    expect(limits.maxDefaultTemplates).toBe(999)
    expect(limits.maxUploadTemplates).toBe(999)
    expect(limits.monthlyFreeContracts).toBe(0)
  })

  it('uses the current basic plan defaults', () => {
    const limits = getPlanLimits('basic')

    expect(limits.maxDrivers).toBe(30)
    expect(limits.maxDefaultTemplates).toBe(999)
    expect(limits.maxUploadTemplates).toBe(999)
    expect(limits.monthlyFreeContracts).toBe(60)
  })

  it('uses the current standard plan defaults', () => {
    const limits = getPlanLimits('standard')

    expect(limits.maxDrivers).toBe(80)
    expect(limits.maxDefaultTemplates).toBe(999)
    expect(limits.monthlyFreeContracts).toBe(160)
  })

  it('keeps enterprise unlimited for drivers', () => {
    const limits = getPlanLimits('enterprise')

    expect(limits.maxDrivers).toBeNull()
  })

  it('falls back to free for invalid plans', () => {
    const limits = getPlanLimits('invalid')

    expect(limits.maxDrivers).toBe(5)
    expect(limits.monthlyFreeContracts).toBe(0)
  })

  it('marks paid plans correctly', () => {
    expect(isPaidPlan('free')).toBe(false)
    expect(isPaidPlan('basic')).toBe(true)
    expect(isPaidPlan('standard')).toBe(true)
    expect(isPaidPlan('enterprise')).toBe(true)
  })
})

describe('subscription amount', () => {
  it('returns zero for free', () => {
    expect(getSubscriptionAmount('free', 'monthly')).toBe(0)
  })

  it('returns the monthly basic price', () => {
    expect(getSubscriptionAmount('basic', 'monthly')).toBe(49_900)
  })

  it('applies the one-year discount to basic', () => {
    const amount = getSubscriptionAmount('basic', '1year')

    expect(amount).toBe(Math.round(49_900 * 0.8 * 12))
  })

  it('applies the three-year discount to basic', () => {
    const amount = getSubscriptionAmount('basic', '3year')

    expect(amount).toBe(Math.round(49_900 * 0.6 * 36))
  })

  it('returns the monthly standard price', () => {
    expect(getSubscriptionAmount('standard', 'monthly')).toBe(99_000)
  })
})
