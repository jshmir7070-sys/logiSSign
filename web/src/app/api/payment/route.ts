import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { authenticateRequest } from '@/lib/api-auth'
import { getClientIp } from '@/lib/get-ip'
import { paymentSchema, validateInput } from '@/lib/api-schemas'
import { isPointBased, isPlanAtLeast } from '@/lib/plan-limits'
import { rateLimitAuth } from '@/lib/rate-limit'
import { chargePoints } from '@/services/point.service'
import {
  getBaseMonthlyPrice,
  getBillingDiscountRate,
  getBillingMonths,
  getIdentityVerification,
  getPayment,
  normalizePortonePayment,
} from '@/services/payment.service'

const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!,
  { auth: { autoRefreshToken: false, persistSession: false } },
)

function addMonths(date: Date, months: number): Date {
  const next = new Date(date)
  next.setMonth(next.getMonth() + months)
  return next
}

async function updateAgencyUsersPlan(agencyId: string, plan: string) {
  let page = 1
  const perPage = 100
  let hasMore = true

  while (hasMore) {
    const { data } = await supabaseAdmin.auth.admin.listUsers({ page, perPage })
    const users = data?.users ?? []
    const agencyUsers = users.filter((user) => user.app_metadata?.agency_id === agencyId)

    for (const user of agencyUsers) {
      await supabaseAdmin.auth.admin.updateUserById(user.id, {
        app_metadata: {
          ...user.app_metadata,
          plan,
        },
      })
    }

    hasMore = users.length === perPage
    page += 1
  }
}

async function getExistingPaymentOrder(paymentId: string) {
  const { data } = await supabaseAdmin
    .from('agency_payment_orders')
    .select('*')
    .eq('payment_id', paymentId)
    .maybeSingle()

  return data as Record<string, unknown> | null
}

async function upsertPaymentOrder(order: Record<string, unknown>) {
  const { error } = await supabaseAdmin.from('agency_payment_orders').upsert(order, { onConflict: 'payment_id' })

  if (error) {
    throw new Error(`결제 주문 저장에 실패했습니다: ${error.message}`)
  }
}

async function upsertSubscriptionRecord(params: {
  agencyId: string
  plan: string
  billing: string
  amount: number
  paymentMethod: string
  status: string
  pendingPlan?: string | null
  startedAt?: string | null
  expiresAt?: string | null
}) {
  const { data: existing } = await supabaseAdmin
    .from('subscriptions')
    .select('id')
    .eq('agency_id', params.agencyId)
    .order('updated_at', { ascending: false })
    .limit(1)
    .maybeSingle()

  const payload = {
    agency_id: params.agencyId,
    plan: params.plan,
    billing_cycle: params.billing,
    amount: params.amount,
    monthly_amount: Math.round(params.amount / getBillingMonths(params.billing)),
    total_amount: params.amount,
    payment_method: params.paymentMethod.toLowerCase(),
    status: params.status,
    pending_plan: params.pendingPlan ?? null,
    started_at: params.startedAt ?? null,
    expires_at: params.expiresAt ?? null,
    updated_at: new Date().toISOString(),
  }

  if (existing?.id) {
    const { error } = await supabaseAdmin.from('subscriptions').update(payload).eq('id', existing.id)
    if (error) {
      throw new Error(`플랜 상태 업데이트에 실패했습니다: ${error.message}`)
    }
    return
  }

  const { error } = await supabaseAdmin.from('subscriptions').insert(payload)
  if (error) {
    throw new Error(`플랜 상태 생성에 실패했습니다: ${error.message}`)
  }
}

async function getLatestSubscription(agencyId: string) {
  const { data, error } = await supabaseAdmin
    .from('subscriptions')
    .select('id, plan, status, billing_key, card_name, card_number_masked')
    .eq('agency_id', agencyId)
    .order('updated_at', { ascending: false })
    .limit(1)
    .maybeSingle()

  if (error) {
    throw new Error(`구독 정보를 조회하지 못했습니다. ${error.message}`)
  }

  return data
}

export async function POST(request: NextRequest) {
  const ip = getClientIp(request)
  const limited = await rateLimitAuth(ip, '/api/payment')
  if (limited) return limited

  try {
    const rawBody = await request.json()
    const { data: body, error: validationError } = validateInput(paymentSchema, rawBody)

    if (validationError || !body) {
      return NextResponse.json(
        { error: validationError ?? '잘못된 결제 요청입니다.' },
        { status: 400 },
      )
    }

    if (body.action === 'verify-identity') {
      const result = await getIdentityVerification(body.identityVerificationId)
      return NextResponse.json({
        verified: result.verified,
        name: result.name,
        phone: result.phone,
        birthDate: result.birthDate,
        error: result.error,
      })
    }

    const { auth, error: authError } = await authenticateRequest(request)
    if (authError || !auth) return authError!

    if (body.action === 'save-billing-key') {
      const subscription = await getLatestSubscription(auth.agencyId)

      if (!subscription || isPointBased(subscription.plan)) {
        return NextResponse.json(
          { error: '구독형 플랜 이용 중일 때만 카드 등록 또는 변경이 가능합니다.' },
          { status: 400 },
        )
      }

      const { error } = await supabaseAdmin
        .from('subscriptions')
        .update({
          billing_key: body.billingKey,
          card_name: body.cardName ?? null,
          card_number_masked: body.cardNumberMasked ?? null,
          updated_at: new Date().toISOString(),
        })
        .eq('id', subscription.id)

      if (error) {
        return NextResponse.json(
          { error: `카드 등록 정보를 저장하지 못했습니다. ${error.message}` },
          { status: 500 },
        )
      }

      return NextResponse.json({
        success: true,
        registered: true,
        cardName: body.cardName ?? null,
        cardNumberMasked: body.cardNumberMasked ?? null,
      })
    }

    if (body.action === 'charge') {
      return NextResponse.json(
        {
          error:
            '자동 정기결제는 현재 사용하지 않습니다. 카드 등록은 만료 안내와 수동 결제 전환을 위한 용도로만 지원합니다.',
        },
        { status: 410 },
      )
    }

    if (body.action === 'switch-to-point') {
      const { data: agency } = await supabaseAdmin.from('agencies').select('plan').eq('id', auth.agencyId).single()
      const oldPlan = (agency?.plan as string | undefined) ?? 'free'

      await supabaseAdmin
        .from('agencies')
        .update({
          plan: 'free',
          plan_type: 'point',
        })
        .eq('id', auth.agencyId)

      await upsertSubscriptionRecord({
        agencyId: auth.agencyId,
        plan: 'free',
        billing: 'monthly',
        amount: 0,
        paymentMethod: 'POINT',
        status: 'active',
      })

      await updateAgencyUsersPlan(auth.agencyId, 'free')

      await supabaseAdmin.from('plan_change_log').insert({
        agency_id: auth.agencyId,
        old_plan: oldPlan,
        new_plan: 'free',
        changed_by: auth.userId,
        change_type: 'self_upgrade',
        reason: '포인트형 전환',
      })

      return NextResponse.json({ success: true, plan: 'free' })
    }

    if (body.action === 'record-point-payment') {
      const { data: pointPackage } = await supabaseAdmin
        .from('point_packages')
        .select('*')
        .eq('id', body.packageId)
        .eq('is_active', true)
        .single()

      if (!pointPackage) {
        return NextResponse.json({ error: '유효한 포인트 패키지가 없습니다.' }, { status: 400 })
      }

      const existingOrder = await getExistingPaymentOrder(body.paymentId)
      if (existingOrder?.applied_at) {
        const balanceResult = await supabaseAdmin
          .from('point_balances')
          .select('balance')
          .eq('agency_id', auth.agencyId)
          .maybeSingle()

        return NextResponse.json({
          status: existingOrder.status,
          balanceAfter: balanceResult.data?.balance ?? 0,
          paymentId: body.paymentId,
        })
      }

      const payment = await getPayment(body.paymentId)
      const normalized = normalizePortonePayment(payment)

      if (normalized.amount !== pointPackage.price) {
        return NextResponse.json({ error: '결제 금액 검증에 실패했습니다.' }, { status: 400 })
      }

      await upsertPaymentOrder({
        payment_id: body.paymentId,
        agency_id: auth.agencyId,
        purpose: 'point',
        title: `${pointPackage.name} 포인트 충전`,
        payment_method: body.paymentMethod,
        easy_pay_provider: body.easyPayProvider ?? normalized.easyPayProvider,
        amount: pointPackage.price,
        currency: 'KRW',
        status: normalized.status,
        point_package_id: pointPackage.id,
        point_amount: pointPackage.points,
        bonus_points: pointPackage.bonus_points,
        virtual_account_bank: normalized.virtualAccountBank,
        virtual_account_number: normalized.virtualAccountNumber,
        virtual_account_holder: normalized.virtualAccountHolder,
        deposit_expires_at: normalized.depositExpiresAt,
        paid_at: normalized.paidAt,
        created_by: auth.userId,
        portone_payload: normalized.payload,
        metadata: {
          packageName: pointPackage.name,
        },
        updated_at: new Date().toISOString(),
      })

      if (normalized.status !== 'paid') {
        return NextResponse.json({
          status: normalized.status,
          paymentId: body.paymentId,
          depositExpiresAt: normalized.depositExpiresAt,
          virtualAccountBank: normalized.virtualAccountBank,
          virtualAccountNumber: normalized.virtualAccountNumber,
          virtualAccountHolder: normalized.virtualAccountHolder,
        })
      }

      const chargeResult = await chargePoints({
        agencyId: auth.agencyId,
        points: pointPackage.points,
        bonusPoints: pointPackage.bonus_points,
        paymentId: body.paymentId,
        userId: auth.userId,
        description: `${pointPackage.name} 충전`,
      })

      await supabaseAdmin
        .from('agency_payment_orders')
        .update({
          applied_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
        })
        .eq('payment_id', body.paymentId)

      return NextResponse.json({
        status: 'paid',
        paymentId: body.paymentId,
        balanceAfter: chargeResult.balanceAfter,
        charged: pointPackage.points,
        bonus: pointPackage.bonus_points,
      })
    }

    if (body.action === 'record-plan-payment') {
      const isRecurringPlanPayment = body.paymentSchedule === 'recurring'

      if (isRecurringPlanPayment && body.billing !== 'monthly') {
        return NextResponse.json(
          { error: '월 정기구독은 월 결제 상품에서만 사용할 수 있습니다.' },
          { status: 400 },
        )
      }

      if (isRecurringPlanPayment && body.paymentMethod !== 'CARD') {
        return NextResponse.json(
          { error: '구독형 플랜 결제는 카드 결제만 사용할 수 있습니다.' },
          { status: 400 },
        )
      }

      const currentAgency = await supabaseAdmin.from('agencies').select('plan').eq('id', auth.agencyId).single()
      const currentPlan = (currentAgency.data?.plan as string | undefined) ?? 'free'
      const isDowngrade =
        currentPlan !== body.plan &&
        currentPlan !== 'free' &&
        !isPointBased(currentPlan) &&
        isPlanAtLeast(currentPlan, body.plan)

      if (isDowngrade) {
        return NextResponse.json(
          { error: `현재 ${currentPlan} 플랜에서 ${body.plan} 플랜으로 바로 변경할 수 없습니다.` },
          { status: 400 },
        )
      }

      const expectedAmount = Math.round(
        getBaseMonthlyPrice(body.plan) *
          (1 - getBillingDiscountRate(body.billing) / 100) *
          getBillingMonths(body.billing),
      )

      if (expectedAmount !== body.amount) {
        return NextResponse.json({ error: '주문 금액 검증에 실패했습니다.' }, { status: 400 })
      }

      const existingOrder = await getExistingPaymentOrder(body.paymentId)
      if (existingOrder?.applied_at) {
        return NextResponse.json({
          status: existingOrder.status,
          paymentId: body.paymentId,
          plan: body.plan,
        })
      }

      const payment = await getPayment(body.paymentId)
      const normalized = normalizePortonePayment(payment)

      if (normalized.amount !== body.amount) {
        return NextResponse.json(
          { error: 'PortOne 결제 금액과 요청 금액이 일치하지 않습니다.' },
          { status: 400 },
        )
      }

      await upsertPaymentOrder({
        payment_id: body.paymentId,
        agency_id: auth.agencyId,
        purpose: 'plan',
        title: `${body.plan} 플랜 결제`,
        payment_method: body.paymentMethod,
        easy_pay_provider: body.easyPayProvider ?? normalized.easyPayProvider,
        amount: body.amount,
        currency: 'KRW',
        status: normalized.status,
        plan: body.plan,
        billing_cycle: body.billing,
        virtual_account_bank: normalized.virtualAccountBank,
        virtual_account_number: normalized.virtualAccountNumber,
        virtual_account_holder: normalized.virtualAccountHolder,
        deposit_expires_at: normalized.depositExpiresAt,
        paid_at: normalized.paidAt,
        created_by: auth.userId,
        portone_payload: normalized.payload,
        metadata: {
          monthlyAmount: Math.round(body.amount / getBillingMonths(body.billing)),
          paymentSchedule: body.paymentSchedule,
        },
        updated_at: new Date().toISOString(),
      })

      if (normalized.status !== 'paid') {
        await upsertSubscriptionRecord({
          agencyId: auth.agencyId,
          plan: currentPlan,
          billing: body.billing,
          amount: body.amount,
          paymentMethod: body.paymentMethod,
          status: 'pending_payment',
          pendingPlan: body.plan,
        })

        return NextResponse.json({
          status: normalized.status,
          paymentId: body.paymentId,
          plan: body.plan,
          depositExpiresAt: normalized.depositExpiresAt,
          virtualAccountBank: normalized.virtualAccountBank,
          virtualAccountNumber: normalized.virtualAccountNumber,
          virtualAccountHolder: normalized.virtualAccountHolder,
        })
      }

      const months = getBillingMonths(body.billing)
      const startedAt = new Date()
      const expiresAt = addMonths(startedAt, months)

      await supabaseAdmin
        .from('agencies')
        .update({
          plan: body.plan,
          plan_type: 'subscription',
          monthly_fee: Math.round(body.amount / months),
        })
        .eq('id', auth.agencyId)

      await upsertSubscriptionRecord({
        agencyId: auth.agencyId,
        plan: body.plan,
        billing: body.billing,
        amount: body.amount,
        paymentMethod: body.paymentMethod,
        status: 'active',
        startedAt: startedAt.toISOString(),
        expiresAt: expiresAt.toISOString(),
      })

      await updateAgencyUsersPlan(auth.agencyId, body.plan)

      await supabaseAdmin
        .from('agency_payment_orders')
        .update({
          applied_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
        })
        .eq('payment_id', body.paymentId)

      await supabaseAdmin.from('plan_change_log').insert({
        agency_id: auth.agencyId,
        old_plan: currentPlan,
        new_plan: body.plan,
        changed_by: auth.userId,
        change_type: 'self_upgrade',
        reason: `1회성 플랜 결제 (${body.billing})`,
      })

      return NextResponse.json({
        status: 'paid',
        paymentId: body.paymentId,
        plan: body.plan,
        expiresAt: expiresAt.toISOString(),
      })
    }

    if (body.action === 'get-payment') {
      const payment = await getPayment(body.paymentId)
      return NextResponse.json({
        payment,
        normalized: normalizePortonePayment(payment),
      })
    }

    return NextResponse.json({ error: '지원하지 않는 결제 요청입니다.' }, { status: 400 })
  } catch (error) {
    console.error('[Payment] Unexpected error:', error)
    return NextResponse.json({ error: '결제 처리 중 오류가 발생했습니다.' }, { status: 500 })
  }
}
