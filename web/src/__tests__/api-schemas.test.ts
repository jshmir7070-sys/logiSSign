import { describe, expect, it } from 'vitest'
import {
  aiGenerateTemplateSchema,
  bankAccountSchema,
  businessNumberSchema,
  contractListQuerySchema,
  createAmendmentSchema,
  paymentSchema,
  phoneSchema,
  sendContractSchema,
  signedPdfSchema,
  smsInviteSchema,
  smsSendSchema,
  validateInput,
  verifyContractSchema,
} from '@/lib/api-schemas'

describe('API 입력 스키마', () => {
  describe('paymentSchema', () => {
    it('플랜 1회성 결제 기록 요청을 검증한다', () => {
      const { data, error } = validateInput(paymentSchema, {
        action: 'record-plan-payment',
        paymentId: 'pay_123',
        plan: 'standard',
        billing: '1year',
        amount: 950400,
        paymentMethod: 'CARD',
      })

      expect(error).toBeNull()
      expect(data?.action).toBe('record-plan-payment')
    })

    it('플랜 1회성 간편결제 요청을 검증한다', () => {
      const { data, error } = validateInput(paymentSchema, {
        action: 'record-plan-payment',
        paymentId: 'pay_124',
        plan: 'basic',
        billing: 'monthly',
        amount: 49900,
        paymentMethod: 'EASY_PAY',
        easyPayProvider: 'KAKAOPAY',
        paymentSchedule: 'one_time',
      })

      expect(error).toBeNull()
      expect(data?.action).toBe('record-plan-payment')
    })

    it('플랜 월 정기구독 플래그를 검증한다', () => {
      const { data, error } = validateInput(paymentSchema, {
        action: 'record-plan-payment',
        paymentId: 'pay_125',
        plan: 'pro',
        billing: 'monthly',
        amount: 149000,
        paymentMethod: 'CARD',
        paymentSchedule: 'recurring',
      })

      expect(error).toBeNull()
      expect(data?.action).toBe('record-plan-payment')
    })

    it('포인트 충전 결제 기록 요청을 검증한다', () => {
      const { data, error } = validateInput(paymentSchema, {
        action: 'record-point-payment',
        paymentId: 'pay_456',
        packageId: '550e8400-e29b-41d4-a716-446655440000',
        paymentMethod: 'EASY_PAY',
        easyPayProvider: 'KAKAOPAY',
      })

      expect(error).toBeNull()
      expect(data?.action).toBe('record-point-payment')
    })

    it('포인트형 전환 요청을 검증한다', () => {
      const { data, error } = validateInput(paymentSchema, {
        action: 'switch-to-point',
      })

      expect(error).toBeNull()
      expect(data?.action).toBe('switch-to-point')
    })

    it('본인인증 확인 요청을 검증한다', () => {
      const { data, error } = validateInput(paymentSchema, {
        action: 'verify-identity',
        identityVerificationId: 'identity_123',
      })

      expect(error).toBeNull()
      expect(data?.action).toBe('verify-identity')
    })

    it('잘못된 결제수단은 거부한다', () => {
      const { error } = validateInput(paymentSchema, {
        action: 'record-plan-payment',
        paymentId: 'pay_789',
        plan: 'basic',
        billing: 'monthly',
        amount: 49900,
        paymentMethod: 'CASH',
      })

      expect(error).toBeTruthy()
    })
  })

  describe('smsSendSchema', () => {
    it('정상적인 문자 발송 요청을 검증한다', () => {
      const { data, error } = validateInput(smsSendSchema, {
        to: '01012345678',
        text: '테스트 메시지',
      })

      expect(error).toBeNull()
      expect(data?.to).toBe('01012345678')
    })

    it('잘못된 전화번호는 거부한다', () => {
      const { error } = validateInput(smsSendSchema, {
        to: '123',
        text: '메시지',
      })

      expect(error).toBeTruthy()
    })
  })

  describe('smsInviteSchema', () => {
    it('기사 초대 요청을 검증한다', () => {
      const { data, error } = validateInput(smsInviteSchema, {
        driverPhone: '01012345678',
        driverName: '김기사',
        agencyId: '550e8400-e29b-41d4-a716-446655440000',
      })

      expect(error).toBeNull()
      expect(data?.driverName).toBe('김기사')
    })
  })

  describe('signedPdfSchema', () => {
    it('정상 UUID를 허용한다', () => {
      const { error } = validateInput(signedPdfSchema, {
        contractId: '550e8400-e29b-41d4-a716-446655440000',
      })

      expect(error).toBeNull()
    })

    it('잘못된 UUID는 거부한다', () => {
      const { error } = validateInput(signedPdfSchema, {
        contractId: 'not-a-uuid',
      })

      expect(error).toBeTruthy()
    })
  })

  describe('aiGenerateTemplateSchema', () => {
    it('템플릿 생성 입력을 검증한다', () => {
      const { data, error } = validateInput(aiGenerateTemplateSchema, {
        title: '운송 위수탁 계약서',
        category: 'standard',
      })

      expect(error).toBeNull()
      expect(data?.title).toBe('운송 위수탁 계약서')
    })
  })

  describe('contractListQuerySchema', () => {
    it('정상 상태 필터를 허용한다', () => {
      const { data, error } = validateInput(contractListQuerySchema, {
        status: 'signed',
      })

      expect(error).toBeNull()
      expect(data?.status).toBe('signed')
    })
  })

  describe('createAmendmentSchema', () => {
    it('변경 계약 요청을 검증한다', () => {
      const { data, error } = validateInput(createAmendmentSchema, {
        driverIds: ['550e8400-e29b-41d4-a716-446655440000'],
        amendmentType: 'rate_change',
        title: '단가 변경 계약',
      })

      expect(error).toBeNull()
      expect(data?.title).toBe('단가 변경 계약')
    })
  })

  describe('sendContractSchema', () => {
    it('계약 발송 요청을 검증한다', () => {
      const { data, error } = validateInput(sendContractSchema, {
        templateIds: ['550e8400-e29b-41d4-a716-446655440000'],
        driverId: '550e8400-e29b-41d4-a716-446655440001',
        bindingData: {
          기사명: '김기사',
          전화번호: '010-1234-5678',
        },
      })

      expect(error).toBeNull()
      expect(data?.templateIds).toHaveLength(1)
    })

    it('bindingData key 길이 제한을 검증한다', () => {
      const longKey = 'a'.repeat(101)
      const { error } = validateInput(sendContractSchema, {
        templateIds: ['550e8400-e29b-41d4-a716-446655440000'],
        bindingData: { [longKey]: 'value' },
      })

      expect(error).toBeTruthy()
    })
  })

  describe('verifyContractSchema', () => {
    it('인증코드 길이를 검증한다', () => {
      const { error } = validateInput(verifyContractSchema, {
        verificationCode: 'AB12CD34',
      })

      expect(error).toBeNull()
    })
  })

  describe('PII 기본 검증기', () => {
    it('사업자번호 형식을 검증한다', () => {
      expect(businessNumberSchema.safeParse('123-45-67890').success).toBe(true)
      expect(businessNumberSchema.safeParse('1234567890').success).toBe(true)
      expect(businessNumberSchema.safeParse('12345').success).toBe(false)
    })

    it('계좌번호 형식을 검증한다', () => {
      expect(bankAccountSchema.safeParse('110-123-456789').success).toBe(true)
      expect(bankAccountSchema.safeParse('1234').success).toBe(false)
    })

    it('전화번호 형식을 검증한다', () => {
      expect(phoneSchema.safeParse('010-1234-5678').success).toBe(true)
      expect(phoneSchema.safeParse('01012345678').success).toBe(true)
      expect(phoneSchema.safeParse('020-1234-5678').success).toBe(false)
    })
  })
})
