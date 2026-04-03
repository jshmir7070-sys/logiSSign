import { describe, it, expect } from 'vitest'
import { isPaidPlan, getPlanLimits, PLAN_LIMITS, PLAN_LABELS, type PlanType } from '@/lib/plan-limits'

describe('plan-limits', () => {
  describe('isPaidPlan', () => {
    it('free → false', () => {
      expect(isPaidPlan('free')).toBe(false)
    })

    it('basic → true', () => {
      expect(isPaidPlan('basic')).toBe(true)
    })

    it('standard → true', () => {
      expect(isPaidPlan('standard')).toBe(true)
    })

    it('enterprise → true', () => {
      expect(isPaidPlan('enterprise')).toBe(true)
    })
  })

  describe('getPlanLimits', () => {
    it('유효한 플랜 → 해당 제한 반환', () => {
      const limits = getPlanLimits('standard')
      expect(limits.maxDrivers).toBe(100)
      expect(limits.maxAdminAccounts).toBe(3)
      expect(limits.maxDefaultTemplates).toBe(6)
    })

    it('undefined → free 제한 반환', () => {
      const limits = getPlanLimits(undefined)
      expect(limits.maxDrivers).toBe(10)
      expect(limits.maxUploadTemplates).toBe(0)
    })

    it('잘못된 값 → free 제한 반환', () => {
      const limits = getPlanLimits('invalid_plan')
      expect(limits.maxDrivers).toBe(10)
    })

    it('enterprise → maxDrivers null (무제한)', () => {
      const limits = getPlanLimits('enterprise')
      expect(limits.maxDrivers).toBeNull()
    })
  })

  describe('PLAN_LIMITS 구조', () => {
    it('4개 플랜 존재', () => {
      const plans: PlanType[] = ['free', 'basic', 'standard', 'enterprise']
      for (const plan of plans) {
        expect(PLAN_LIMITS[plan]).toBeDefined()
        expect(PLAN_LIMITS[plan].maxAdminAccounts).toBeTypeOf('number')
      }
    })

    it('free 플랜 가장 제한적', () => {
      expect(PLAN_LIMITS.free.maxDrivers).toBeLessThan(PLAN_LIMITS.basic.maxDrivers!)
      expect(PLAN_LIMITS.free.maxDefaultTemplates).toBe(0)
      expect(PLAN_LIMITS.free.maxUploadTemplates).toBe(0)
    })

    it('enterprise 플랜 가장 관대', () => {
      expect(PLAN_LIMITS.enterprise.maxDrivers).toBeNull()
      expect(PLAN_LIMITS.enterprise.maxDefaultTemplates).toBeGreaterThan(PLAN_LIMITS.standard.maxDefaultTemplates)
    })
  })

  describe('PLAN_LABELS', () => {
    it('4개 라벨 존재', () => {
      expect(PLAN_LABELS.free).toBe('Free')
      expect(PLAN_LABELS.basic).toBe('Basic')
      expect(PLAN_LABELS.standard).toBe('Standard')
      expect(PLAN_LABELS.enterprise).toBe('Enterprise')
    })
  })
})
