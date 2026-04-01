import { z } from 'zod'

/**
 * API 입력 검증 스키마 모음 (Zod v4)
 * 모든 POST/PATCH 엔드포인트에서 사용
 */

// UUID 형식
const uuid = z.uuid()

// 날짜 형식 YYYY-MM-DD
const dateString = z.string().regex(/^\d{4}-\d{2}-\d{2}$/, '날짜 형식은 YYYY-MM-DD')

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
  driverId: uuid,
  templateIds: z.array(uuid).min(1, '템플릿을 1개 이상 선택하세요'),
  bindingData: z.record(z.string(), z.string()).optional().default({}),
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
