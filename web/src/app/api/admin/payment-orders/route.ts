import { NextRequest, NextResponse } from 'next/server'
import { authenticateAdmin } from '@/lib/api-auth'
import { getClientIp } from '@/lib/get-ip'
import { rateLimitAuth } from '@/lib/rate-limit'
import { createAdminSupabaseClient } from '@/lib/supabase'
import {
  cancelAgencyPaymentOrder,
  markAgencyPaymentOrderPaid,
  saveAgencyPaymentOrderMemo,
} from '@/services/admin-payment-order.service'

const supabaseAdmin = createAdminSupabaseClient()

export async function GET(request: NextRequest) {
  const ip = getClientIp(request)
  const limited = rateLimitAuth(ip, '/api/admin/payment-orders')
  if (limited) return limited

  const { auth, error } = await authenticateAdmin(request)
  if (error || !auth) return error ?? NextResponse.json({ error: '인증이 필요합니다.' }, { status: 401 })

  if (auth.role !== 'provider_admin') {
    return NextResponse.json({ error: '슈퍼 관리자만 결제 주문을 조회할 수 있습니다.' }, { status: 403 })
  }

  const { searchParams } = new URL(request.url)
  const statusFilter = searchParams.get('status')

  let query = supabaseAdmin
    .from('agency_payment_orders')
    .select(
      'id, agency_id, payment_id, title, purpose, payment_method, easy_pay_provider, amount, status, created_at, paid_at, applied_at, virtual_account_bank, virtual_account_number, deposit_expires_at, metadata, portone_payload, agencies(name)'
    )
    .order('created_at', { ascending: false })
    .limit(200)

  if (statusFilter) {
    query = query.eq('status', statusFilter)
  }

  const { data, error: fetchError } = await query
  if (fetchError) {
    return NextResponse.json({ error: fetchError.message }, { status: 500 })
  }

  const orders = (data ?? []) as Array<Record<string, unknown>>
  const summary = {
    totalOrders: orders.length,
    paidOrders: orders.filter((order) => order.status === 'paid').length,
    pendingOrders: orders.filter((order) => order.status === 'pending').length,
    failedOrders: orders.filter((order) => order.status === 'failed').length,
    cancelledOrders: orders.filter((order) => order.status === 'cancelled').length,
    paidAmount: orders
      .filter((order) => order.status === 'paid')
      .reduce((sum, order) => sum + (typeof order.amount === 'number' ? order.amount : 0), 0),
  }

  return NextResponse.json({ orders, summary })
}

export async function PATCH(request: NextRequest) {
  const ip = getClientIp(request)
  const limited = rateLimitAuth(ip, '/api/admin/payment-orders')
  if (limited) return limited

  const { auth, error } = await authenticateAdmin(request)
  if (error || !auth) return error ?? NextResponse.json({ error: '인증이 필요합니다.' }, { status: 401 })

  if (auth.role !== 'provider_admin') {
    return NextResponse.json({ error: '슈퍼 관리자만 결제 주문을 처리할 수 있습니다.' }, { status: 403 })
  }

  try {
    const body = await request.json()
    const orderId = typeof body?.orderId === 'string' ? body.orderId : ''
    const action = typeof body?.action === 'string' ? body.action : ''
    const memo = typeof body?.memo === 'string' ? body.memo.trim() : ''

    if (!orderId || !action) {
      return NextResponse.json({ error: 'orderId와 action이 필요합니다.' }, { status: 400 })
    }

    if (action === 'mark_paid') {
      const result = await markAgencyPaymentOrderPaid(orderId, auth.userId, memo)
      return NextResponse.json({ success: true, action, result })
    }

    if (action === 'cancel') {
      const result = await cancelAgencyPaymentOrder(orderId, auth.userId, memo)
      return NextResponse.json({ success: true, action, result })
    }

    if (action === 'save_memo') {
      const result = await saveAgencyPaymentOrderMemo(orderId, auth.userId, memo)
      return NextResponse.json({ success: true, action, result })
    }

    return NextResponse.json({ error: '지원하지 않는 액션입니다.' }, { status: 400 })
  } catch (updateError) {
    return NextResponse.json(
      { error: updateError instanceof Error ? updateError.message : '결제 주문 처리에 실패했습니다.' },
      { status: 500 }
    )
  }
}
