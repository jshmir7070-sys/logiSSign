import { describe, it, expect } from 'vitest'
import {
  validateInput,
  paymentSchema,
  smsSendSchema,
  smsInviteSchema,
  signedPdfSchema,
  aiGenerateTemplateSchema,
  contractListQuerySchema,
  createAmendmentSchema,
  sendContractSchema,
  verifyContractSchema,
  businessNumberSchema,
  bankAccountSchema,
  phoneSchema,
} from '@/lib/api-schemas'

describe('API 입력 검증 스키마', () => {
  // ── Payment ──
  describe('paymentSchema', () => {
    it('save-billing-key 유효한 입력', () => {
      const { data, error } = validateInput(paymentSchema, {
        action: 'save-billing-key',
        billingKey: 'bk_test_123',
        cardName: '신한카드',
      })
      expect(error).toBeNull()
      expect(data?.action).toBe('save-billing-key')
    })

    it('save-billing-key billingKey 누락 → 에러', () => {
      const { error } = validateInput(paymentSchema, {
        action: 'save-billing-key',
      })
      expect(error).toBeTruthy()
    })

    it('charge 유효한 입력', () => {
      const { data, error } = validateInput(paymentSchema, {
        action: 'charge',
        plan: 'standard',
        billing: 'monthly',
      })
      expect(error).toBeNull()
      expect(data?.action).toBe('charge')
    })

    it('charge 잘못된 plan → 에러', () => {
      const { error } = validateInput(paymentSchema, {
        action: 'charge',
        plan: 'ultra',
        billing: 'monthly',
      })
      expect(error).toBeTruthy()
    })

    it('알 수 없는 action → 에러', () => {
      const { error } = validateInput(paymentSchema, {
        action: 'unknown',
      })
      expect(error).toBeTruthy()
    })
  })

  // ── SMS ──
  describe('smsSendSchema', () => {
    it('유효한 전화번호 + 메시지', () => {
      const { data, error } = validateInput(smsSendSchema, {
        to: '01012345678',
        text: '테스트 메시지',
      })
      expect(error).toBeNull()
      expect(data?.to).toBe('01012345678')
    })

    it('잘못된 전화번호 형식 → 에러', () => {
      const { error } = validateInput(smsSendSchema, {
        to: '123',
        text: '메시지',
      })
      expect(error).toBeTruthy()
      expect(error).toContain('전화번호')
    })

    it('빈 메시지 → 에러', () => {
      const { error } = validateInput(smsSendSchema, {
        to: '01012345678',
        text: '',
      })
      expect(error).toBeTruthy()
    })
  })

  describe('smsInviteSchema', () => {
    it('유효한 초대 요청', () => {
      const { data, error } = validateInput(smsInviteSchema, {
        driverPhone: '01012345678',
        driverName: '김기사',
        agencyId: '550e8400-e29b-41d4-a716-446655440000',
      })
      expect(error).toBeNull()
      expect(data?.driverName).toBe('김기사')
    })

    it('driverName 누락 → 에러', () => {
      const { error } = validateInput(smsInviteSchema, {
        driverPhone: '01012345678',
      })
      expect(error).toBeTruthy()
    })
  })

  // ── Signed PDF ──
  describe('signedPdfSchema', () => {
    it('유효한 UUID', () => {
      const { data, error } = validateInput(signedPdfSchema, {
        contractId: '550e8400-e29b-41d4-a716-446655440000',
      })
      expect(error).toBeNull()
      expect(data?.contractId).toBeTruthy()
    })

    it('잘못된 UUID → 에러', () => {
      const { error } = validateInput(signedPdfSchema, {
        contractId: 'not-a-uuid',
      })
      expect(error).toBeTruthy()
    })

    it('contractId 누락 → 에러', () => {
      const { error } = validateInput(signedPdfSchema, {})
      expect(error).toBeTruthy()
    })
  })

  // ── AI Template ──
  describe('aiGenerateTemplateSchema', () => {
    it('유효한 입력', () => {
      const { data, error } = validateInput(aiGenerateTemplateSchema, {
        title: '위수탁 표준계약서',
        category: 'standard',
      })
      expect(error).toBeNull()
      expect(data?.title).toBe('위수탁 표준계약서')
    })

    it('title 빈 문자열 → 에러', () => {
      const { error } = validateInput(aiGenerateTemplateSchema, {
        title: '',
      })
      expect(error).toBeTruthy()
    })

    it('잘못된 category → 에러', () => {
      const { error } = validateInput(aiGenerateTemplateSchema, {
        title: '테스트',
        category: 'invalid',
      })
      expect(error).toBeTruthy()
    })
  })

  // ── Contract List Query ──
  describe('contractListQuerySchema', () => {
    it('유효한 status', () => {
      const { data, error } = validateInput(contractListQuerySchema, {
        status: 'signed',
      })
      expect(error).toBeNull()
      expect(data?.status).toBe('signed')
    })

    it('status 없이도 유효', () => {
      const { data, error } = validateInput(contractListQuerySchema, {})
      expect(error).toBeNull()
      expect(data?.status).toBeUndefined()
    })

    it('잘못된 status → 에러', () => {
      const { error } = validateInput(contractListQuerySchema, {
        status: 'invalid_status',
      })
      expect(error).toBeTruthy()
    })
  })

  // ── 기존 스키마 회귀 테스트 ──
  describe('createAmendmentSchema', () => {
    it('유효한 변경 요청', () => {
      const { data, error } = validateInput(createAmendmentSchema, {
        driverIds: ['550e8400-e29b-41d4-a716-446655440000'],
        amendmentType: 'rate_change',
        title: '단가 변경',
      })
      expect(error).toBeNull()
      expect(data?.title).toBe('단가 변경')
    })

    it('빈 driverIds → 에러', () => {
      const { error } = validateInput(createAmendmentSchema, {
        driverIds: [],
        amendmentType: 'rate_change',
        title: '테스트',
      })
      expect(error).toBeTruthy()
    })
  })

  describe('sendContractSchema', () => {
    it('유효한 계약서 발송', () => {
      const { data, error } = validateInput(sendContractSchema, {
        templateIds: ['550e8400-e29b-41d4-a716-446655440000'],
        driverId: '550e8400-e29b-41d4-a716-446655440001',
      })
      expect(error).toBeNull()
      expect(data?.templateIds).toHaveLength(1)
    })
  })

  describe('verifyContractSchema', () => {
    it('유효한 인증코드', () => {
      const { data, error } = validateInput(verifyContractSchema, {
        verificationCode: 'AB12CD34',
      })
      expect(error).toBeNull()
      expect(data?.verificationCode).toBe('AB12CD34')
    })

    it('잘못된 길이 → 에러', () => {
      const { error } = validateInput(verifyContractSchema, {
        verificationCode: 'AB12',
      })
      expect(error).toBeTruthy()
    })
  })

  // ── PII 검증 프리미티브 ──
  describe('businessNumberSchema', () => {
    it('하이픈 포함 형식', () => {
      const r = businessNumberSchema.safeParse('123-45-67890')
      expect(r.success).toBe(true)
    })

    it('하이픈 없는 형식', () => {
      const r = businessNumberSchema.safeParse('1234567890')
      expect(r.success).toBe(true)
    })

    it('잘못된 형식 → 에러', () => {
      const r = businessNumberSchema.safeParse('12345')
      expect(r.success).toBe(false)
    })

    it('undefined 허용 (optional)', () => {
      const r = businessNumberSchema.safeParse(undefined)
      expect(r.success).toBe(true)
    })
  })

  describe('bankAccountSchema', () => {
    it('유효한 계좌번호', () => {
      const r = bankAccountSchema.safeParse('110-123-456789')
      expect(r.success).toBe(true)
    })

    it('너무 짧은 계좌번호 → 에러', () => {
      const r = bankAccountSchema.safeParse('1234')
      expect(r.success).toBe(false)
    })

    it('문자 포함 → 에러', () => {
      const r = bankAccountSchema.safeParse('ABC-123-456')
      expect(r.success).toBe(false)
    })
  })

  describe('phoneSchema', () => {
    it('유효한 전화번호', () => {
      const r = phoneSchema.safeParse('010-1234-5678')
      expect(r.success).toBe(true)
    })

    it('하이픈 없는 형식', () => {
      const r = phoneSchema.safeParse('01012345678')
      expect(r.success).toBe(true)
    })

    it('잘못된 시작번호 → 에러', () => {
      const r = phoneSchema.safeParse('020-1234-5678')
      expect(r.success).toBe(false)
    })
  })

  // ── bindingData 크기 제한 ──
  describe('sendContractSchema bindingData 크기 제한', () => {
    it('정상 크기 bindingData', () => {
      const { error } = validateInput(sendContractSchema, {
        templateIds: ['550e8400-e29b-41d4-a716-446655440000'],
        bindingData: { '기사명': '김철수', '전화번호': '010-1234-5678' },
      })
      expect(error).toBeNull()
    })

    it('키 100자 초과 → 에러', () => {
      const longKey = 'a'.repeat(101)
      const { error } = validateInput(sendContractSchema, {
        templateIds: ['550e8400-e29b-41d4-a716-446655440000'],
        bindingData: { [longKey]: 'value' },
      })
      expect(error).toBeTruthy()
    })

    it('값 5000자 초과 → 에러', () => {
      const longValue = 'x'.repeat(5001)
      const { error } = validateInput(sendContractSchema, {
        templateIds: ['550e8400-e29b-41d4-a716-446655440000'],
        bindingData: { key: longValue },
      })
      expect(error).toBeTruthy()
    })
  })
})
