import { chargePoints } from '@/services/point.service'
import { createAdminSupabaseClient } from '@/lib/supabase'

const supabaseAdmin = createAdminSupabaseClient()

type PaymentOrderRecord = {
  id: string
  agency_id: string
  payment_id: string
  purpose: 'plan' | 'point'
  payment_method: string
  amount: number
  status: string
  plan: string | null
  billing_cycle: string | null
  point_amount: number | null
  bonus_points: number | null
  applied_at: string | null
  metadata: Record<string, unknown> | null
}

function addMonths(date: Date, months: number): Date {
  const next = new Date(date)
  next.setMonth(next.getMonth() + months)
  return next
}

function getBillingMonths(billingCycle: string | null | undefined): number {
  if (billingCycle === '2year') return 24
  if (billingCycle === '1year') return 12
  return 1
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

  const billingMonths = getBillingMonths(params.billing)
  const payload = {
    agency_id: params.agencyId,
    plan: params.plan,
    billing_cycle: params.billing,
    amount: params.amount,
    monthly_amount: Math.round(params.amount / billingMonths),
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
    if (error) throw new Error(error.message)
    return
  }

  const { error } = await supabaseAdmin.from('subscriptions').insert(payload)
  if (error) throw new Error(error.message)
}

async function getPaymentOrder(orderId: string): Promise<PaymentOrderRecord> {
  const { data, error } = await supabaseAdmin
    .from('agency_payment_orders')
    .select('id, agency_id, payment_id, purpose, payment_method, amount, status, plan, billing_cycle, point_amount, bonus_points, applied_at, metadata')
    .eq('id', orderId)
    .single()

  if (error || !data) {
    throw new Error(error?.message ?? '결제 주문을 찾을 수 없습니다.')
  }

  return data as PaymentOrderRecord
}

function mergeMetadata(
  order: PaymentOrderRecord,
  patch: Record<string, unknown>
): Record<string, unknown> {
  const current =
    order.metadata && typeof order.metadata === 'object' && !Array.isArray(order.metadata)
      ? order.metadata
      : {}

  return {
    ...current,
    ...patch,
  }
}

export async function applyAgencyPaymentOrder(orderId: string, actorUserId: string) {
  const order = await getPaymentOrder(orderId)

  if (order.status !== 'paid') {
    throw new Error('결제 완료 상태의 주문만 적용할 수 있습니다.')
  }

  if (order.applied_at) {
    return { alreadyApplied: true, order }
  }

  if (order.purpose === 'point') {
    await chargePoints({
      agencyId: order.agency_id,
      points: order.point_amount ?? 0,
      bonusPoints: order.bonus_points ?? 0,
      paymentId: order.payment_id,
      userId: actorUserId,
      description: typeof order.metadata?.packageName === 'string' ? `${order.metadata.packageName} 충전` : '관리자 결제 확정',
    })
  } else {
    if (!order.plan) {
      throw new Error('플랜 주문 정보가 올바르지 않습니다.')
    }

    const { data: agency } = await supabaseAdmin
      .from('agencies')
      .select('plan')
      .eq('id', order.agency_id)
      .single()

    const oldPlan = (agency?.plan as string | undefined) ?? 'free'
    const months = getBillingMonths(order.billing_cycle)
    const startedAt = new Date()
    const expiresAt = addMonths(startedAt, months)

    const { error: updateAgencyError } = await supabaseAdmin
      .from('agencies')
      .update({
        plan: order.plan,
        plan_type: 'subscription',
        monthly_fee: Math.round(order.amount / months),
      })
      .eq('id', order.agency_id)

    if (updateAgencyError) {
      throw new Error(updateAgencyError.message)
    }

    await upsertSubscriptionRecord({
      agencyId: order.agency_id,
      plan: order.plan,
      billing: order.billing_cycle ?? 'monthly',
      amount: order.amount,
      paymentMethod: order.payment_method,
      status: 'active',
      startedAt: startedAt.toISOString(),
      expiresAt: expiresAt.toISOString(),
    })

    await updateAgencyUsersPlan(order.agency_id, order.plan)

    await supabaseAdmin.from('plan_change_log').insert({
      agency_id: order.agency_id,
      old_plan: oldPlan,
      new_plan: order.plan,
      changed_by: actorUserId,
      change_type: 'admin_override',
      reason: '관리자 결제 확정 처리',
    })
  }

  const appliedAt = new Date().toISOString()
  const { error: updateOrderError } = await supabaseAdmin
    .from('agency_payment_orders')
    .update({
      applied_at: appliedAt,
      updated_at: appliedAt,
      metadata: mergeMetadata(order, {
        appliedBy: actorUserId,
        appliedAt,
      }),
    })
    .eq('id', orderId)

  if (updateOrderError) {
    throw new Error(updateOrderError.message)
  }

  return { alreadyApplied: false, orderId, appliedAt }
}

export async function markAgencyPaymentOrderPaid(orderId: string, actorUserId: string, memo?: string) {
  const order = await getPaymentOrder(orderId)
  const paidAt = new Date().toISOString()

  const { error } = await supabaseAdmin
    .from('agency_payment_orders')
    .update({
      status: 'paid',
      paid_at: paidAt,
      updated_at: paidAt,
      metadata: mergeMetadata(order, {
        adminMemo: memo ?? (typeof order.metadata?.adminMemo === 'string' ? order.metadata.adminMemo : ''),
        lastAction: 'mark_paid',
        lastActionBy: actorUserId,
        lastActionAt: paidAt,
      }),
    })
    .eq('id', orderId)

  if (error) {
    throw new Error(error.message)
  }

  return applyAgencyPaymentOrder(orderId, actorUserId)
}

export async function cancelAgencyPaymentOrder(orderId: string, actorUserId: string, memo?: string) {
  const order = await getPaymentOrder(orderId)

  if (order.applied_at) {
    throw new Error('이미 적용된 결제 주문은 취소할 수 없습니다.')
  }

  const cancelledAt = new Date().toISOString()
  const { error } = await supabaseAdmin
    .from('agency_payment_orders')
    .update({
      status: 'cancelled',
      updated_at: cancelledAt,
      metadata: mergeMetadata(order, {
        adminMemo: memo ?? (typeof order.metadata?.adminMemo === 'string' ? order.metadata.adminMemo : ''),
        lastAction: 'cancel',
        lastActionBy: actorUserId,
        lastActionAt: cancelledAt,
      }),
    })
    .eq('id', orderId)

  if (error) {
    throw new Error(error.message)
  }

  if (order.purpose === 'plan') {
    await supabaseAdmin
      .from('subscriptions')
      .update({
        status: 'cancelled',
        pending_plan: null,
        updated_at: cancelledAt,
      })
      .eq('agency_id', order.agency_id)
      .eq('status', 'pending_payment')
  }

  return { orderId, cancelledAt }
}

export async function saveAgencyPaymentOrderMemo(orderId: string, actorUserId: string, memo: string) {
  const order = await getPaymentOrder(orderId)
  const updatedAt = new Date().toISOString()

  const { error } = await supabaseAdmin
    .from('agency_payment_orders')
    .update({
      updated_at: updatedAt,
      metadata: mergeMetadata(order, {
        adminMemo: memo,
        memoUpdatedBy: actorUserId,
        memoUpdatedAt: updatedAt,
      }),
    })
    .eq('id', orderId)

  if (error) {
    throw new Error(error.message)
  }

  return { orderId, updatedAt }
}
