import { describe, expect, it } from 'vitest'

import {
  PLAN_LABELS,
  PLAN_LIMITS,
  getPlanLimits,
  isPaidPlan,
  type PlanType,
} from '@/lib/plan-limits'

describe('plan-limits', () => {
  describe('isPaidPlan', () => {
    it('treats free as unpaid', () => {
      expect(isPaidPlan('free')).toBe(false)
    })

    it('treats subscription plans as paid', () => {
      expect(isPaidPlan('basic')).toBe(true)
      expect(isPaidPlan('standard')).toBe(true)
      expect(isPaidPlan('pro')).toBe(true)
      expect(isPaidPlan('enterprise')).toBe(true)
    })
  })

  describe('getPlanLimits', () => {
    it('returns the configured limits for a valid plan', () => {
      const limits = getPlanLimits('standard')

      expect(limits.maxDrivers).toBe(80)
      expect(limits.maxAdminAccounts).toBe(5)
      expect(limits.maxDefaultTemplates).toBe(999)
      expect(limits.maxUploadTemplates).toBe(999)
      expect(limits.monthlyFreeContracts).toBe(160)
    })

    it('falls back to free limits for undefined', () => {
      const limits = getPlanLimits(undefined)

      expect(limits.maxDrivers).toBe(5)
      expect(limits.maxDefaultTemplates).toBe(999)
      expect(limits.maxUploadTemplates).toBe(999)
      expect(limits.monthlyFreeContracts).toBe(0)
    })

    it('falls back to free limits for an invalid value', () => {
      const limits = getPlanLimits('invalid_plan')

      expect(limits.maxDrivers).toBe(5)
      expect(limits.maxDefaultTemplates).toBe(999)
    })

    it('keeps enterprise unlimited where expected', () => {
      const limits = getPlanLimits('enterprise')

      expect(limits.maxDrivers).toBeNull()
      expect(limits.monthlyFreeContracts).toBeNull()
    })
  })

  describe('PLAN_LIMITS shape', () => {
    it('defines all supported plans', () => {
      const plans: PlanType[] = ['free', 'basic', 'standard', 'pro', 'enterprise']

      for (const plan of plans) {
        expect(PLAN_LIMITS[plan]).toBeDefined()
        expect(PLAN_LIMITS[plan].maxAdminAccounts).toBeTypeOf('number')
      }
    })

    it('keeps free as the most restrictive driver tier', () => {
      expect(PLAN_LIMITS.free.maxDrivers).toBe(5)
      expect(PLAN_LIMITS.free.maxDrivers).toBeLessThan(PLAN_LIMITS.basic.maxDrivers!)
      expect(PLAN_LIMITS.free.monthlyFreeContracts).toBe(0)
    })

    it('keeps enterprise as the most permissive driver tier', () => {
      expect(PLAN_LIMITS.enterprise.maxDrivers).toBeNull()
      expect(PLAN_LIMITS.enterprise.maxAdminAccounts).toBeGreaterThan(
        PLAN_LIMITS.standard.maxAdminAccounts,
      )
    })
  })

  describe('PLAN_LABELS', () => {
    it('includes labels for all public plans', () => {
      expect(PLAN_LABELS.free).toBe('Free')
      expect(PLAN_LABELS.basic).toBe('Basic')
      expect(PLAN_LABELS.standard).toBe('Standard')
      expect(PLAN_LABELS.pro).toBe('Pro')
      expect(PLAN_LABELS.enterprise).toBe('Enterprise')
    })
  })
})
