import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { authenticateRequest } from '@/lib/api-auth'
import { getClientIp } from '@/lib/get-ip'
import { rateLimitAuth } from '@/lib/rate-limit'
import { chargePoints, getPointBalance, getPointPackages, getPointTransactions } from '@/services/point.service'
import { getPayment, normalizePortonePayment } from '@/services/payment.service'

const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!,
  { auth: { autoRefreshToken: false, persistSession: false } }
)

async function getExistingPaymentOrder(paymentId: string) {
  const { data } = await supabaseAdmin
    .from('agency_payment_orders')
    .select('*')
    .eq('payment_id', paymentId)
    .maybeSingle()

  return data as Record<string, unknown> | null
}

export async function GET(request: NextRequest) {
  const ip = getClientIp(request)
  const limited = rateLimitAuth(ip, '/api/points')
  if (limited) return limited

  const { auth, error: authError } = await authenticateRequest(request)
  if (authError || !auth) return authError!

  const agencyId = auth.agencyId
  if (!agencyId) {
    return NextResponse.json({ error: '대리점 정보를 찾을 수 없습니다.' }, { status: 403 })
  }

  const { searchParams } = new URL(request.url)
  const action = searchParams.get('action') ?? 'balance'

  if (action === 'balance') {
    const balance = await getPointBalance(agencyId)
    return NextResponse.json(balance)
  }

  if (action === 'transactions') {
    const limit = Number(searchParams.get('limit') ?? '20')
    const offset = Number(searchParams.get('offset') ?? '0')
    const type = searchParams.get('type') ?? undefined
    const transactions = await getPointTransactions(agencyId, { limit, offset, type })
    return NextResponse.json({ transactions })
  }

  if (action === 'packages') {
    const packages = await getPointPackages()
    return NextResponse.json({ packages })
  }

  return NextResponse.json({ error: '잘못된 action입니다.' }, { status: 400 })
}

export async function POST(request: NextRequest) {
  const ip = getClientIp(request)
  const limited = rateLimitAuth(ip, '/api/points')
  if (limited) return limited

  const { auth, error: authError } = await authenticateRequest(request)
  if (authError || !auth) return authError!

  const agencyId = auth.agencyId
  if (!agencyId) {
    return NextResponse.json({ error: '대리점 정보를 찾을 수 없습니다.' }, { status: 403 })
  }

  try {
    const body = await request.json()
    const { action } = body

    if (action === 'charge') {
      const { packageId, paymentId, paymentMethod, easyPayProvider } = body as {
        packageId?: string
        paymentId?: string
        paymentMethod?: string
        easyPayProvider?: string
      }

      if (!packageId || !paymentId || !paymentMethod) {
        return NextResponse.json({ error: '패키지와 결제 정보가 필요합니다.' }, { status: 400 })
      }

      const { data: pointPackage } = await supabaseAdmin
        .from('point_packages')
        .select('*')
        .eq('id', packageId)
        .eq('is_active', true)
        .single()

      if (!pointPackage) {
        return NextResponse.json({ error: '유효한 포인트 패키지가 아닙니다.' }, { status: 400 })
      }

      const existingOrder = await getExistingPaymentOrder(paymentId)
      if (existingOrder?.applied_at) {
        const balance = await getPointBalance(agencyId)
        return NextResponse.json({
          status: existingOrder.status,
          paymentId,
          balanceAfter: balance.balance,
        })
      }

      const payment = await getPayment(paymentId)
      const normalized = normalizePortonePayment(payment)

      if (normalized.amount !== pointPackage.price) {
        return NextResponse.json({ error: '결제 금액 검증에 실패했습니다.' }, { status: 400 })
      }

      const { error: orderError } = await supabaseAdmin
        .from('agency_payment_orders')
        .upsert(
          {
            payment_id: paymentId,
            agency_id: agencyId,
            purpose: 'point',
            title: `${pointPackage.name} 포인트 충전`,
            payment_method: paymentMethod,
            easy_pay_provider: easyPayProvider ?? normalized.easyPayProvider,
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
            metadata: { packageName: pointPackage.name },
            updated_at: new Date().toISOString(),
          },
          { onConflict: 'payment_id' }
        )

      if (orderError) {
        return NextResponse.json({ error: `결제 기록 저장에 실패했습니다: ${orderError.message}` }, { status: 500 })
      }

      if (normalized.status !== 'paid') {
        return NextResponse.json({
          status: normalized.status,
          paymentId,
          depositExpiresAt: normalized.depositExpiresAt,
          virtualAccountBank: normalized.virtualAccountBank,
          virtualAccountNumber: normalized.virtualAccountNumber,
          virtualAccountHolder: normalized.virtualAccountHolder,
        })
      }

      const result = await chargePoints({
        agencyId,
        points: pointPackage.points,
        bonusPoints: pointPackage.bonus_points,
        paymentId,
        userId: auth.userId,
        description: `${pointPackage.name} 충전`,
      })

      await supabaseAdmin
        .from('agency_payment_orders')
        .update({
          applied_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
        })
        .eq('payment_id', paymentId)

      return NextResponse.json({
        status: 'paid',
        paymentId,
        balanceAfter: result.balanceAfter,
        charged: pointPackage.points,
        bonus: pointPackage.bonus_points,
      })
    }

    if (action === 'admin-charge') {
      const role = auth.role
      if (role !== 'provider_admin' && role !== 'super_admin') {
        return NextResponse.json({ error: '권한이 없습니다.' }, { status: 403 })
      }

      const { targetAgencyId, points, description } = body
      if (!targetAgencyId || !points || points <= 0) {
        return NextResponse.json({ error: '대상 업체와 포인트를 입력해 주세요.' }, { status: 400 })
      }

      const result = await chargePoints({
        agencyId: targetAgencyId,
        points,
        userId: auth.userId,
        description: description ?? `관리자 수동 지급 ${points}P`,
      })

      return NextResponse.json({ balanceAfter: result.balanceAfter })
    }

    return NextResponse.json({ error: '지원하지 않는 action입니다.' }, { status: 400 })
  } catch (err) {
    const message = err instanceof Error ? err.message : '포인트 처리 중 오류가 발생했습니다.'
    return NextResponse.json({ error: message }, { status: 500 })
  }
}
