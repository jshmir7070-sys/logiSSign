/**
 * 포트원 V2 결제 서비스
 * - 정기결제 (빌링키 발급 → 예약 결제)
 * - 본인인증
 *
 * 포트원 V2 API 문서: https://developers.portone.io/
 */

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

/** 포트원 V2 인증 토큰 발급 */
async function getPortoneToken(): Promise<string> {
  const secret = process.env.PORTONE_API_SECRET
  if (!secret) throw new Error('PORTONE_API_SECRET 미설정')

  const res = await fetch(`${PORTONE_API_BASE}/login/api-secret`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ apiSecret: secret }),
  })

  if (!res.ok) throw new Error(`포트원 인증 실패: ${res.status}`)
  const data = await res.json()
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

/** 구독 결제 금액 계산 */
export function getSubscriptionAmount(plan: string, billing: string): number {
  const prices: Record<string, number> = {
    free: 0,
    basic: 49900,
    standard: 99000,
  }

  const base = prices[plan] ?? 0
  if (base === 0) return 0

  const discounts: Record<string, number> = {
    monthly: 0,
    '1year': 0.2,
    '2year': 0.3,
    '3year': 0.4,
  }

  const discount = discounts[billing] ?? 0
  const months = billing === '1year' ? 12 : billing === '2year' ? 24 : billing === '3year' ? 36 : 1

  if (billing === 'monthly') return base
  return Math.round(base * (1 - discount) * months)
}
