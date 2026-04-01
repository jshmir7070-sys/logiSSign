import { describe, it, expect } from 'vitest'
import { calculateTaxDeductions } from '@/services/excel-settlement.service'
import { getPlanLimits, isPaidPlan } from '@/lib/plan-limits'
import { getSubscriptionAmount } from '@/services/payment.service'

describe('정산 세금 계산', () => {
  it('사업자 + 포함가 → VAT 10% 역산', () => {
    const result = calculateTaxDeductions(1100000, true, true)
    expect(result.vatAmount).toBe(100000) // 1,100,000 - 1,000,000
    expect(result.withholdingAmount).toBe(0)
    expect(result.finalAmount).toBe(1000000)
  })

  it('사업자 + 별도 → 공제 없음', () => {
    const result = calculateTaxDeductions(1000000, true, false)
    expect(result.vatAmount).toBe(0)
    expect(result.withholdingAmount).toBe(0)
    expect(result.finalAmount).toBe(1000000)
  })

  it('비사업자 → 3.3% 원천징수', () => {
    const result = calculateTaxDeductions(1000000, false, false)
    expect(result.vatAmount).toBe(0)
    expect(result.withholdingAmount).toBe(33000)
    expect(result.finalAmount).toBe(967000)
  })

  it('금액 0 → 모든 공제 0', () => {
    const result = calculateTaxDeductions(0, true, true)
    expect(result.vatAmount).toBe(0)
    expect(result.finalAmount).toBe(0)
  })
})

describe('플랜 제한', () => {
  it('free 플랜 기본값', () => {
    const limits = getPlanLimits('free')
    expect(limits.maxDrivers).toBe(10)
    expect(limits.maxDefaultTemplates).toBe(0)
    expect(limits.maxUploadTemplates).toBe(0)
  })

  it('basic 플랜', () => {
    const limits = getPlanLimits('basic')
    expect(limits.maxDrivers).toBe(50)
    expect(limits.maxDefaultTemplates).toBe(3)
    expect(limits.maxUploadTemplates).toBe(3)
  })

  it('standard 플랜', () => {
    const limits = getPlanLimits('standard')
    expect(limits.maxDrivers).toBe(100)
    expect(limits.maxDefaultTemplates).toBe(6)
  })

  it('enterprise 플랜 — 기사 무제한', () => {
    const limits = getPlanLimits('enterprise')
    expect(limits.maxDrivers).toBeNull()
  })

  it('잘못된 플랜 → free 반환', () => {
    const limits = getPlanLimits('invalid')
    expect(limits.maxDrivers).toBe(10)
  })

  it('유료 플랜 판별', () => {
    expect(isPaidPlan('free')).toBe(false)
    expect(isPaidPlan('basic')).toBe(true)
    expect(isPaidPlan('standard')).toBe(true)
    expect(isPaidPlan('enterprise')).toBe(true)
  })
})

describe('구독 금액 계산', () => {
  it('free → 0원', () => {
    expect(getSubscriptionAmount('free', 'monthly')).toBe(0)
  })

  it('basic 월결제 → 49,900원', () => {
    expect(getSubscriptionAmount('basic', 'monthly')).toBe(49900)
  })

  it('basic 1년 → 20% 할인', () => {
    const amount = getSubscriptionAmount('basic', '1year')
    expect(amount).toBe(Math.round(49900 * 0.8 * 12))
  })

  it('basic 3년 → 40% 할인', () => {
    const amount = getSubscriptionAmount('basic', '3year')
    expect(amount).toBe(Math.round(49900 * 0.6 * 36))
  })

  it('standard 월결제 → 99,000원', () => {
    expect(getSubscriptionAmount('standard', 'monthly')).toBe(99000)
  })
})
