import { z } from 'zod'

/**
 * API 입력 검증 스키마 모음
 */

const uuid = z.string().uuid('UUID 형식이 올바르지 않습니다.')
const dateString = z
  .string()
  .regex(/^\d{4}-\d{2}-\d{2}$/, '날짜 형식은 YYYY-MM-DD 여야 합니다.')

export const businessNumberSchema = z
  .string()
  .max(12, '사업자등록번호는 12자 이내여야 합니다.')
  .regex(/^\d{3}-?\d{2}-?\d{5}$/, '사업자등록번호 형식이 올바르지 않습니다. (000-00-00000)')
  .optional()

export const bankAccountSchema = z
  .string()
  .max(20, '계좌번호는 20자 이내여야 합니다.')
  .regex(/^[\d-]{8,20}$/, '계좌번호 형식이 올바르지 않습니다.')
  .optional()

export const phoneSchema = z
  .string()
  .max(13, '전화번호는 13자 이내여야 합니다.')
  .regex(/^01[0-9]-?\d{3,4}-?\d{4}$/, '유효한 휴대전화번호 형식이 아닙니다.')
  .optional()

function boundedRecord(maxKeyLen: number, maxValLen: number) {
  return z.record(
    z.string().max(maxKeyLen, `키는 ${maxKeyLen}자 이내여야 합니다.`),
    z.string().max(maxValLen, `값은 ${maxValLen}자 이내여야 합니다.`)
  )
}

export const createAmendmentSchema = z.object({
  driverIds: z.array(uuid).min(1, '기사는 1명 이상 선택해야 합니다.'),
  contractId: uuid.optional(),
  amendmentType: z.enum([
    'rate_change',
    'insurance_change',
    'deduction_change',
    'area_change',
    'renewal',
    'general_change',
  ]),
  title: z.string().min(1, '제목은 필수입니다.').max(200, '제목은 200자 이내여야 합니다.'),
  description: z.string().max(2000).optional(),
  changes: z
    .object({
      before: z.record(z.string(), z.string()).optional().default({}),
      after: z.record(z.string(), z.string()).optional().default({}),
    })
    .optional()
    .default({ before: {}, after: {} }),
  effectiveDate: dateString.optional(),
})

export const patchAmendmentSchema = z.object({
  amendmentId: uuid,
  action: z.enum(['approve', 'reject', 'cancel']),
  rejectionReason: z.string().max(1000).optional(),
})

export const sendContractSchema = z.object({
  driverId: uuid.optional(),
  driverIds: z.array(uuid).optional(),
  templateIds: z.array(uuid).min(1, '템플릿은 1개 이상 선택해야 합니다.'),
  bindingDataMap: z.record(z.string().max(100), boundedRecord(100, 5000)).optional(),
  bindingData: boundedRecord(100, 5000).optional().default({}),
})

export const verifyContractSchema = z.object({
  verificationCode: z
    .string()
    .length(8, '인증코드는 8자리여야 합니다.')
    .regex(/^[A-Z0-9]+$/i, '인증코드는 영문 대문자와 숫자만 사용할 수 있습니다.'),
})

export const integrityCheckSchema = z.object({
  contractId: uuid.optional(),
})

export const paymentSaveBillingKeySchema = z.object({
  action: z.literal('save-billing-key'),
  billingKey: z.string().min(1, '빌링키가 필요합니다.'),
  cardName: z.string().max(50).optional(),
  cardNumberMasked: z.string().max(32).optional(),
})

export const paymentChargeSchema = z.object({
  action: z.literal('charge'),
  billingKey: z.string().optional(),
  plan: z.enum(['free', 'basic', 'standard', 'pro', 'enterprise']),
  billing: z.enum(['monthly', '1year', '2year']),
})

const planPaymentMethodSchema = z.enum(['CARD', 'EASY_PAY', 'TRANSFER', 'VIRTUAL_ACCOUNT'])
const pointPaymentMethodSchema = z.enum(['CARD', 'EASY_PAY', 'TRANSFER', 'VIRTUAL_ACCOUNT'])
const easyPayProviderSchema = z.enum(['KAKAOPAY', 'NAVERPAY', 'TOSSPAY', 'PAYCO']).optional()
const paymentScheduleSchema = z.enum(['one_time', 'recurring'])

export const paymentRecordPlanSchema = z.object({
  action: z.literal('record-plan-payment'),
  paymentId: z.string().min(1, '결제 ID가 필요합니다.'),
  plan: z.enum(['basic', 'standard', 'pro', 'enterprise']),
  billing: z.enum(['monthly', '1year', '2year']),
  amount: z.number().int().positive(),
  paymentMethod: planPaymentMethodSchema,
  easyPayProvider: easyPayProviderSchema.optional(),
  paymentSchedule: paymentScheduleSchema.default('one_time'),
})

export const paymentRecordPointSchema = z.object({
  action: z.literal('record-point-payment'),
  paymentId: z.string().min(1, '결제 ID가 필요합니다.'),
  packageId: z.string().uuid('패키지 ID가 유효하지 않습니다.'),
  paymentMethod: pointPaymentMethodSchema,
  easyPayProvider: easyPayProviderSchema,
})

export const paymentSwitchToPointSchema = z.object({
  action: z.literal('switch-to-point'),
})

export const paymentVerifyIdentitySchema = z.object({
  action: z.literal('verify-identity'),
  identityVerificationId: z.string().min(1, '본인인증 ID가 필요합니다.'),
})

export const paymentGetPaymentSchema = z.object({
  action: z.literal('get-payment'),
  paymentId: z.string().min(1, '결제 ID가 필요합니다.'),
})

export const paymentSchema = z.discriminatedUnion('action', [
  paymentSaveBillingKeySchema,
  paymentChargeSchema,
  paymentRecordPlanSchema,
  paymentRecordPointSchema,
  paymentSwitchToPointSchema,
  paymentVerifyIdentitySchema,
  paymentGetPaymentSchema,
])

export const smsSendSchema = z.object({
  to: z
    .string()
    .min(1, '수신번호는 필수입니다.')
    .regex(/^01[0-9]{8,9}$/, '유효한 휴대전화번호 형식이 아닙니다.'),
  text: z
    .string()
    .min(1, '메시지는 필수입니다.')
    .max(2000, '메시지는 2000자 이내여야 합니다.'),
  from: z.string().optional(),
})

export const smsInviteSchema = z.object({
  driverPhone: z.string().min(1, '기사 휴대전화번호는 필수입니다.'),
  driverName: z.string().min(1, '기사 이름은 필수입니다.'),
  driverCode: z.string().regex(/^[A-Z0-9]{3}-\d{6}$/).optional(),
  inviteCode: z.string().optional(),
  agencyName: z.string().optional(),
  agencyId: z.string().uuid().optional(),
})

export const signedPdfSchema = z.object({
  contractId: uuid,
})

export const aiExtractDocumentSchema = z.object({
  text: z
    .string()
    .trim()
    .min(10, '문서 텍스트가 필요합니다.')
    .max(50000, '문서 크기가 50KB를 초과합니다.'),
  fileName: z.string().trim().max(255, '파일명은 255자 이내여야 합니다.').optional(),
  provider: z.enum(['openai', 'anthropic']).optional(),
})

export const aiGenerateTemplateSchema = z.object({
  title: z.string().min(1, '템플릿 제목이 필요합니다.').max(200),
  category: z.enum(['standard', 'supplementary', 'consent', 'government']).optional(),
  description: z.string().max(2000).optional(),
})

export const contractListQuerySchema = z.object({
  status: z.enum(['draft', 'sent', 'viewed', 'signed', 'expired']).optional(),
})

export function validateInput<T>(
  schema: z.ZodType<T>,
  input: unknown
): { data: T | null; error: string | null } {
  const result = schema.safeParse(input)
  if (result.success) {
    return { data: result.data, error: null }
  }

  const messages = result.error.issues.map((issue) => issue.message).join(', ')
  return { data: null, error: messages }
}
