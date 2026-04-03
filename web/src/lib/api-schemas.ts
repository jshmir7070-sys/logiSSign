import { z } from 'zod'

/**
 * API 입력 검증 스키마 모음 (Zod v4)
 * 모든 POST/PATCH 엔드포인트에서 사용
 */

// UUID 형식
const uuid = z.uuid()

// 날짜 형식 YYYY-MM-DD
const dateString = z.string().regex(/^\d{4}-\d{2}-\d{2}$/, '날짜 형식은 YYYY-MM-DD')

// ── 공통 PII 검증 프리미티브 ──

/** 사업자등록번호: 000-00-00000 (하이픈 유무 모두 허용) */
export const businessNumberSchema = z.string()
  .max(12, '사업자등록번호는 12자 이내')
  .regex(/^\d{3}-?\d{2}-?\d{5}$/, '사업자등록번호 형식이 올바르지 않습니다 (000-00-00000)')
  .optional()

/** 은행 계좌번호: 숫자+하이픈, 8~20자 */
export const bankAccountSchema = z.string()
  .max(20, '계좌번호는 20자 이내')
  .regex(/^[\d-]{8,20}$/, '계좌번호 형식이 올바르지 않습니다')
  .optional()

/** 한국 전화번호: 01X-XXXX-XXXX (하이픈 유무 모두 허용) */
export const phoneSchema = z.string()
  .max(13, '전화번호는 13자 이내')
  .regex(/^01[0-9]-?\d{3,4}-?\d{4}$/, '유효한 전화번호 형식이 아닙니다')
  .optional()

/** z.record 키/값 크기 제한 헬퍼 */
function boundedRecord(maxKeyLen: number, maxValLen: number) {
  return z.record(
    z.string().max(maxKeyLen, `키는 ${maxKeyLen}자 이내`),
    z.string().max(maxValLen, `값은 ${maxValLen}자 이내`),
  )
}

// ── Amendments ──

export const createAmendmentSchema = z.object({
  driverIds: z.array(uuid).min(1, '기사를 1명 이상 선택하세요'),
  contractId: uuid.optional(),
  amendmentType: z.enum([
    'rate_change', 'insurance_change', 'deduction_change',
    'area_change', 'renewal', 'general_change',
  ]),
  title: z.string().min(1, '제목은 필수입니다').max(200, '제목은 200자 이내'),
  description: z.string().max(2000).optional(),
  changes: z.object({
    before: z.record(z.string(), z.string()).optional().default({}),
    after: z.record(z.string(), z.string()).optional().default({}),
  }).optional().default({ before: {}, after: {} }),
  effectiveDate: dateString.optional(),
})

export const patchAmendmentSchema = z.object({
  amendmentId: uuid,
  action: z.enum(['approve', 'reject', 'cancel']),
  rejectionReason: z.string().max(1000).optional(),
})

// ── Contracts ──

export const sendContractSchema = z.object({
  driverId: uuid.optional(),
  driverIds: z.array(uuid).optional(),
  templateIds: z.array(uuid).min(1, '템플릿을 1개 이상 선택하세요'),
  bindingDataMap: z.record(
    z.string().max(100),
    boundedRecord(100, 5000),
  ).optional(),
  bindingData: boundedRecord(100, 5000).optional().default({}),
})

// ── Verify ──

export const verifyContractSchema = z.object({
  verificationCode: z
    .string()
    .length(8, '인증코드는 8자리입니다')
    .regex(/^[A-Z0-9]+$/i, '영문/숫자만 가능합니다'),
})

// ── Integrity Check ──

export const integrityCheckSchema = z.object({
  contractId: uuid.optional(),
})

// ── Payment ──

export const paymentSaveBillingKeySchema = z.object({
  action: z.literal('save-billing-key'),
  billingKey: z.string().min(1, '빌링키가 필요합니다'),
  cardName: z.string().optional(),
  cardNumber: z.string().optional(),
})

export const paymentChargeSchema = z.object({
  action: z.literal('charge'),
  billingKey: z.string().optional(),
  plan: z.enum(['free', 'basic', 'standard', 'pro', 'enterprise']),
  billing: z.enum(['monthly', 'yearly']),
})

export const paymentVerifyIdentitySchema = z.object({
  action: z.literal('verify-identity'),
  identityVerificationId: z.string().min(1, '본인인증 ID가 필요합니다'),
})

export const paymentGetPaymentSchema = z.object({
  action: z.literal('get-payment'),
  paymentId: z.string().min(1, '결제 ID가 필요합니다'),
})

export const paymentSchema = z.discriminatedUnion('action', [
  paymentSaveBillingKeySchema,
  paymentChargeSchema,
  paymentVerifyIdentitySchema,
  paymentGetPaymentSchema,
])

// ── SMS ──

export const smsSendSchema = z.object({
  to: z.string().min(1, '수신번호는 필수입니다').regex(/^01[0-9]{8,9}$/, '유효한 전화번호 형식이 아닙니다'),
  text: z.string().min(1, '메시지는 필수입니다').max(2000, '메시지는 2000자 이내'),
  from: z.string().optional(),
})

export const smsInviteSchema = z.object({
  driverPhone: z.string().min(1, '기사 전화번호는 필수입니다'),
  driverName: z.string().min(1, '기사 이름은 필수입니다'),
  inviteCode: z.string().optional(),
  agencyName: z.string().optional(),
  agencyId: z.string().uuid().optional(),
})

// ── Signed PDF ──

export const signedPdfSchema = z.object({
  contractId: uuid,
})

// ── AI Template ──

export const aiGenerateTemplateSchema = z.object({
  title: z.string().min(1, '템플릿 제목이 필요합니다').max(200),
  category: z.enum(['standard', 'supplementary', 'consent', 'government']).optional(),
  description: z.string().max(2000).optional(),
})

// ── Contracts List (query params) ──

export const contractListQuerySchema = z.object({
  status: z.enum(['draft', 'sent', 'viewed', 'signed', 'expired']).optional(),
})

/**
 * 검증 헬퍼 — parse 결과를 { data, error } 형태로 반환
 */
export function validateInput<T>(
  schema: z.ZodType<T>,
  input: unknown
): { data: T | null; error: string | null } {
  const result = schema.safeParse(input)
  if (result.success) {
    return { data: result.data, error: null }
  }
  const messages = result.error.issues.map(i => i.message).join(', ')
  return { data: null, error: messages }
}
