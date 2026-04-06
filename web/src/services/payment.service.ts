import { PLAN_DISCOUNTS, PLAN_PRICES } from '@/lib/plan-limits'

const PORTONE_API_BASE = 'https://api.portone.io'

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

export interface NormalizedPortonePayment {
  paymentId: string
  status: 'paid' | 'pending' | 'failed' | 'cancelled'
  statusRaw: string
  amount: number
  method: string | null
  easyPayProvider: string | null
  virtualAccountBank: string | null
  virtualAccountNumber: string | null
  virtualAccountHolder: string | null
  depositExpiresAt: string | null
  paidAt: string | null
  payload: Record<string, unknown>
}

let cachedToken: { token: string; expiresAt: number } | null = null

function getPortoneSecret(): string {
  const secret = process.env.PORTONE_V2_SECRET ?? process.env.PORTONE_API_SECRET
  if (!secret) {
    throw new Error('PORTONE API secret is not configured.')
  }
  return secret
}

async function getPortoneToken(): Promise<string> {
  if (cachedToken && Date.now() < cachedToken.expiresAt - 60_000) {
    return cachedToken.token
  }

  const response = await fetch(`${PORTONE_API_BASE}/login/api-secret`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ apiSecret: getPortoneSecret() }),
  })

  if (!response.ok) {
    throw new Error('Failed to authenticate with PortOne.')
  }

  const data = await response.json()
  cachedToken = {
    token: data.accessToken,
    expiresAt: Date.now() + 30 * 60_000,
  }
  return data.accessToken
}

async function portoneFetch(path: string, init?: RequestInit): Promise<Response> {
  const token = await getPortoneToken()
  return fetch(`${PORTONE_API_BASE}${path}`, {
    ...init,
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${token}`,
      ...(init?.headers ?? {}),
    },
  })
}

function pickFirstString(...values: unknown[]): string | null {
  for (const value of values) {
    if (typeof value === 'string' && value.trim()) {
      return value
    }
  }
  return null
}

function pickFirstNumber(...values: unknown[]): number {
  for (const value of values) {
    if (typeof value === 'number' && Number.isFinite(value)) {
      return value
    }
  }
  return 0
}

function toRecord(value: unknown): Record<string, unknown> {
  return typeof value === 'object' && value !== null ? (value as Record<string, unknown>) : {}
}

function resolveNormalizedStatus(payload: Record<string, unknown>): {
  normalized: NormalizedPortonePayment['status']
  raw: string
} {
  const raw = String(payload.status ?? '').toUpperCase()

  if (raw === 'PAID') {
    return { normalized: 'paid', raw }
  }
  if (raw.includes('CANCEL')) {
    return { normalized: 'cancelled', raw }
  }
  if (raw.includes('FAIL')) {
    return { normalized: 'failed', raw }
  }
  if (raw.includes('VIRTUAL_ACCOUNT') || raw === 'READY' || raw === 'PENDING') {
    return { normalized: 'pending', raw }
  }

  return { normalized: 'pending', raw }
}

export async function getPayment(paymentId: string): Promise<Record<string, unknown>> {
  const response = await portoneFetch(`/payments/${encodeURIComponent(paymentId)}`)
  if (!response.ok) {
    throw new Error(`Failed to fetch payment: ${response.status}`)
  }
  return response.json()
}

export function normalizePortonePayment(payload: Record<string, unknown>): NormalizedPortonePayment {
  const method = toRecord(payload.method)
  const amount = toRecord(payload.amount)
  const virtualAccount = toRecord(
    method.virtualAccount ?? payload.virtualAccount ?? payload.account
  )
  const { normalized, raw } = resolveNormalizedStatus(payload)

  return {
    paymentId: String(payload.paymentId ?? ''),
    status: normalized,
    statusRaw: raw,
    amount: pickFirstNumber(
      amount.total,
      amount.paid,
      payload.amount,
      payload.totalAmount
    ),
    method: pickFirstString(
      method.type,
      payload.payMethod,
      payload.method as string | undefined
    ),
    easyPayProvider: pickFirstString(
      method.easyPayProvider,
      toRecord(method.easyPay).provider,
      toRecord(payload.easyPay).provider
    ),
    virtualAccountBank: pickFirstString(
      virtualAccount.bank,
      virtualAccount.bankCode,
      toRecord(virtualAccount.bankInfo).bank
    ),
    virtualAccountNumber: pickFirstString(
      virtualAccount.accountNumber,
      virtualAccount.number
    ),
    virtualAccountHolder: pickFirstString(
      virtualAccount.accountHolder,
      virtualAccount.holderName
    ),
    depositExpiresAt: pickFirstString(
      virtualAccount.expiresAt,
      virtualAccount.expiryDate,
      toRecord(virtualAccount.accountExpiry).dueDate
    ),
    paidAt: pickFirstString(payload.paidAt, payload.updatedAt, payload.requestedAt),
    payload,
  }
}

export async function payWithBillingKey(params: {
  billingKey: string
  paymentId: string
  orderName: string
  amount: number
  currency?: string
  customer: { name: string; email?: string; phone?: string }
}): Promise<PaymentResult> {
  const response = await portoneFetch(`/payments/${encodeURIComponent(params.paymentId)}/billing-key`, {
    method: 'POST',
    body: JSON.stringify({
      billingKey: params.billingKey,
      orderName: params.orderName,
      amount: { total: params.amount },
      currency: params.currency ?? 'KRW',
      customer: params.customer,
    }),
  })

  if (!response.ok) {
    const text = await response.text()
    return {
      paymentId: params.paymentId,
      status: 'FAILED',
      amount: 0,
      error: `Billing-key payment failed: ${text}`,
    }
  }

  const data = await response.json()
  return {
    paymentId: params.paymentId,
    status: data.status ?? 'PAID',
    amount: params.amount,
    error: null,
  }
}

export async function cancelPayment(paymentId: string, reason: string): Promise<{ error: string | null }> {
  const response = await portoneFetch(`/payments/${encodeURIComponent(paymentId)}/cancel`, {
    method: 'POST',
    body: JSON.stringify({ reason }),
  })

  if (!response.ok) {
    return { error: `Cancel failed: ${response.status}` }
  }

  return { error: null }
}

export async function getIdentityVerification(
  identityVerificationId: string
): Promise<IdentityVerificationResult> {
  const response = await portoneFetch(
    `/identity-verifications/${encodeURIComponent(identityVerificationId)}`
  )

  if (!response.ok) {
    return {
      verified: false,
      name: '',
      phone: '',
      birthDate: '',
      ci: '',
      di: '',
      error: `Verification lookup failed: ${response.status}`,
    }
  }

  const data = await response.json()
  const customer = toRecord(data.verifiedCustomer)

  return {
    verified: data.status === 'VERIFIED',
    name: pickFirstString(customer.name, customer.fullName) ?? '',
    phone: pickFirstString(customer.phoneNumber, customer.phone) ?? '',
    birthDate: pickFirstString(customer.birthDate) ?? '',
    ci: pickFirstString(customer.ci) ?? '',
    di: pickFirstString(customer.di) ?? '',
    error: null,
  }
}

export function getPortoneStoreId(): string {
  return process.env.NEXT_PUBLIC_PORTONE_STORE_ID ?? ''
}

export function getPortoneChannelKey(): string {
  return process.env.NEXT_PUBLIC_PORTONE_CHANNEL_KEY ?? ''
}

export { getSubscriptionPrice as getSubscriptionAmount } from '@/lib/plan-limits'

export function getBillingMonths(billing: string): number {
  if (billing === '1year') return 12
  if (billing === '2year') return 24
  if (billing === '3year') return 36
  return 1
}

export function getBillingDiscountRate(billing: string): number {
  return PLAN_DISCOUNTS[billing] ?? 0
}

export function getBaseMonthlyPrice(plan: string): number {
  return PLAN_PRICES[plan as keyof typeof PLAN_PRICES] ?? 0
}

export function calculateProration(opts: {
  currentPlan: string
  currentBilling: string
  currentStartDate: string
  newPlan: string
  newBilling: string
}) {
  const now = new Date()
  const start = new Date(opts.currentStartDate)
  const currentMonths = getBillingMonths(opts.currentBilling)
  const totalDays = currentMonths * 30
  const usedDays = Math.max(
    0,
    Math.floor((now.getTime() - start.getTime()) / (1000 * 60 * 60 * 24))
  )
  const remainingDays = Math.max(0, totalDays - usedDays)

  const currentBase = getBaseMonthlyPrice(opts.currentPlan)
  const currentDiscount = getBillingDiscountRate(opts.currentBilling) / 100
  const currentTotal = currentBase * (1 - currentDiscount) * currentMonths
  const currentDailyRate = totalDays > 0 ? currentTotal / totalDays : 0

  const credit = Math.round(currentDailyRate * remainingDays)

  const newMonths = getBillingMonths(opts.newBilling)
  const newBase = getBaseMonthlyPrice(opts.newPlan)
  const newDiscount = getBillingDiscountRate(opts.newBilling) / 100
  const newTotal = newBase * (1 - newDiscount) * newMonths
  const newDailyRate = newMonths > 0 ? newTotal / (newMonths * 30) : 0
  const newAmount = Math.round(newDailyRate * remainingDays)

  return {
    credit,
    newAmount,
    chargeAmount: Math.max(0, newAmount - credit),
    remainingDays,
    totalDays,
  }
}
