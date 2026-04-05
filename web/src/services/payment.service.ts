/**
 * 포트원 V2 결제 서비스
 * - 정기결제 (빌링키 발급 → 예약 결제)
 * - 본인인증
 *
 * 포트원 V2 API 문서: https://developers.portone.io/
 */

import { PLAN_PRICES, PLAN_DISCOUNTS } from '@/lib/plan-limits'

const PORTONE_API_BASE = 'https://api.portone.io'

/* ══════════════════════ Types ══════════════════════ */

export interface BillingKeyResult {
  billingKey: string
  cardName: string
  cardNumber: string  // 마스킹
  error: string | null
}

export interface PaymentResult {
  paymentId: string
  status: 'PAID' | 'FAILED' | 'CANCELLED'
  amount: number
  error: string | null
}

export interface IdentityVerificationResult {
  verified: boolean
  name: string
  phone: string
  birthDate: string
  ci: string
  di: string
  error: string | null
}

/* ══════════════════════ 서버 전용 (API Secret 사용) ══════════════════════ */

/** 포트원 V2 인증 토큰 발급 (캐싱) */
let _cachedToken: { token: string; expiresAt: number } | null = null

async function getPortoneToken(): Promise<string> {
  // 캐시된 토큰이 유효하면 재사용 (만료 1분 전 갱신)
  if (_cachedToken && Date.now() < _cachedToken.expiresAt - 60_000) {
    return _cachedToken.token
  }

  const secret = process.env.PORTONE_API_SECRET
  if (!secret) throw new Error('PORTONE_API_SECRET 미설정')

  const res = await fetch(`${PORTONE_API_BASE}/login/api-secret`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ apiSecret: secret }),
  })

  if (!res.ok) throw new Error('결제 시스템 인증 실패')
  const data = await res.json()

  // 토큰 캐시 (기본 30분)
  _cachedToken = {
    token: data.accessToken,
    expiresAt: Date.now() + 30 * 60_000,
  }

  return data.accessToken
}

/** 결제 단건 조회 */
export async function getPayment(paymentId: string): Promise<Record<string, unknown>> {
  const token = await getPortoneToken()
  const res = await fetch(`${PORTONE_API_BASE}/payments/${encodeURIComponent(paymentId)}`, {
    headers: { Authorization: `Bearer ${token}` },
  })
  if (!res.ok) throw new Error(`결제 조회 실패: ${res.status}`)
  return res.json()
}

/** 빌링키로 정기결제 실행 */
export async function payWithBillingKey(params: {
  billingKey: string
  paymentId: string
  orderName: string
  amount: number
  currency?: string
  customer: { name: string; email?: string; phone?: string }
}): Promise<PaymentResult> {
  const token = await getPortoneToken()

  const res = await fetch(`${PORTONE_API_BASE}/payments/${encodeURIComponent(params.paymentId)}/billing-key`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${token}`,
    },
    body: JSON.stringify({
      billingKey: params.billingKey,
      orderName: params.orderName,
      amount: { total: params.amount },
      currency: params.currency ?? 'KRW',
      customer: params.customer,
    }),
  })

  if (!res.ok) {
    const err = await res.text()
    return { paymentId: params.paymentId, status: 'FAILED', amount: 0, error: `결제 실패: ${err}` }
  }

  const data = await res.json()
  return {
    paymentId: params.paymentId,
    status: data.status ?? 'PAID',
    amount: params.amount,
    error: null,
  }
}

/** 결제 취소 */
export async function cancelPayment(paymentId: string, reason: string): Promise<{ error: string | null }> {
  const token = await getPortoneToken()

  const res = await fetch(`${PORTONE_API_BASE}/payments/${encodeURIComponent(paymentId)}/cancel`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${token}`,
    },
    body: JSON.stringify({ reason }),
  })

  if (!res.ok) {
    return { error: `취소 실패: ${res.status}` }
  }
  return { error: null }
}

/** 본인인증 결과 조회 */
export async function getIdentityVerification(identityVerificationId: string): Promise<IdentityVerificationResult> {
  const token = await getPortoneToken()

  const res = await fetch(`${PORTONE_API_BASE}/identity-verifications/${encodeURIComponent(identityVerificationId)}`, {
    headers: { Authorization: `Bearer ${token}` },
  })

  if (!res.ok) {
    return { verified: false, name: '', phone: '', birthDate: '', ci: '', di: '', error: `조회 실패: ${res.status}` }
  }

  const data = await res.json()
  const info = data.verifiedCustomer ?? {}

  return {
    verified: data.status === 'VERIFIED',
    name: info.name ?? '',
    phone: info.phoneNumber ?? '',
    birthDate: info.birthDate ?? '',
    ci: info.ci ?? '',
    di: info.di ?? '',
    error: null,
  }
}

/* ══════════════════════ 클라이언트 헬퍼 ══════════════════════ */

/** 포트원 SDK 로드 (클라이언트) */
export function getPortoneStoreId(): string {
  return process.env.NEXT_PUBLIC_PORTONE_STORE_ID ?? ''
}

export function getPortoneChannelKey(): string {
  return process.env.NEXT_PUBLIC_PORTONE_CHANNEL_KEY ?? ''
}

/** 구독 결제 금액 계산 — plan-limits.ts 중앙 가격 참조 */
export { getSubscriptionPrice as getSubscriptionAmount } from '@/lib/plan-limits'

/**
 * 플랜 업그레이드 시 차액 정산 (프로레이션)
 * 
 * 현재 플랜의 잔여일수 크레딧을 계산하고,
 * 새 플랜의 동일 기간 비용에서 차감한 차액을 반환한다.
 */
export function calculateProration(opts: {
  currentPlan: string
  currentBilling: string
  currentStartDate: string     // 현재 결제 시작일 (ISO)
  newPlan: string
  newBilling: string
}): {
  credit: number               // 기존 플랜 잔여 크레딧
  newAmount: number             // 새 플랜 잔여 기간 비용
  chargeAmount: number          // 실제 청구 금액 (차액)
  remainingDays: number         // 잔여 일수
  totalDays: number             // 전체 결제 기간 일수
} {
  const prices = PLAN_PRICES as Record<string, number>
  const discounts: Record<string, number> = {}
  for (const [k, v] of Object.entries(PLAN_DISCOUNTS as Record<string, number>)) { discounts[k] = v / 100 }

  const now = new Date()
  const start = new Date(opts.currentStartDate)
  const currentMonths = opts.currentBilling === '1year' ? 12 : opts.currentBilling === '2year' ? 24 : 1
  const totalDays = currentMonths * 30
  const usedDays = Math.max(0, Math.floor((now.getTime() - start.getTime()) / (1000 * 60 * 60 * 24)))
  const remainingDays = Math.max(0, totalDays - usedDays)

  // 기존 플랜 일일 단가
  const currentBase = prices[opts.currentPlan] ?? 0
  const currentDiscount = discounts[opts.currentBilling] ?? 0
  const currentTotal = currentBase * (1 - currentDiscount) * currentMonths
  const currentDailyRate = totalDays > 0 ? currentTotal / totalDays : 0

  // 크레딧 = 잔여일 × 일일 단가
  const credit = Math.round(currentDailyRate * remainingDays)

  // 새 플랜 잔여 기간 비용
  const newBase = prices[opts.newPlan] ?? 0
  const newDiscount = discounts[opts.newBilling] ?? 0
  const newMonths = opts.newBilling === '1year' ? 12 : opts.newBilling === '2year' ? 24 : 1
  const newTotalForPeriod = newBase * (1 - newDiscount) * newMonths
  const newDailyRate = (newMonths * 30) > 0 ? newTotalForPeriod / (newMonths * 30) : 0
  const newAmount = Math.round(newDailyRate * remainingDays)

  // 차액 (최소 0원 — 다운그레이드 시 크레딧이 더 큰 경우)
  const chargeAmount = Math.max(0, newAmount - credit)

  return { credit, newAmount, chargeAmount, remainingDays, totalDays }
}
