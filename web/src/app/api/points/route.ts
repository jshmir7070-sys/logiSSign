import { NextRequest, NextResponse } from 'next/server'
import { authenticateRequest } from '@/lib/api-auth'
import { getPointBalance, chargePoints, getPointTransactions, getPointPackages } from '@/services/point.service'
import { payWithBillingKey } from '@/services/payment.service'
import { createClient } from '@supabase/supabase-js'

const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!,
  { auth: { autoRefreshToken: false, persistSession: false } }
)

export async function GET(request: NextRequest) {
  const { auth, error: authError } = await authenticateRequest(request)
  if (authError || !auth) return authError!

  const agencyId = auth.agencyId
  if (!agencyId) return NextResponse.json({ error: '대리점 정보 없음' }, { status: 403 })

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

  return NextResponse.json({ error: '잘못된 action' }, { status: 400 })
}

export async function POST(request: NextRequest) {
  const { auth, error: authError } = await authenticateRequest(request)
  if (authError || !auth) return authError!

  const agencyId = auth.agencyId
  if (!agencyId) return NextResponse.json({ error: '대리점 정보 없음' }, { status: 403 })

  try {
    const body = await request.json()
    const { action } = body

    // 포인트 충전 (카드 결제)
    if (action === 'charge') {
      const { packageId, billingKey: inputBillingKey } = body

      // 패키지 조회
      const { data: pkg } = await supabaseAdmin
        .from('point_packages')
        .select('*')
        .eq('id', packageId)
        .eq('is_active', true)
        .single()

      if (!pkg) {
        return NextResponse.json({ error: '유효하지 않은 충전 패키지' }, { status: 400 })
      }

      // 빌링키 조회
      let billingKey = inputBillingKey
      if (!billingKey) {
        const { data: sub } = await supabaseAdmin
          .from('subscriptions')
          .select('billing_key')
          .eq('agency_id', agencyId)
          .single()
        billingKey = sub?.billing_key
      }

      if (!billingKey) {
        return NextResponse.json({ error: '등록된 카드가 없습니다. 먼저 카드를 등록해주세요.' }, { status: 400 })
      }

      // 결제 실행
      const paymentId = `point_${agencyId}_${Date.now()}`
      const payResult = await payWithBillingKey({
        billingKey,
        paymentId,
        orderName: `logiSSign 포인트 충전 ${pkg.name}`,
        amount: pkg.price,
        customer: { name: agencyId },
      })

      if (payResult.error) {
        return NextResponse.json({ error: payResult.error }, { status: 500 })
      }

      // 포인트 충전
      const result = await chargePoints({
        agencyId,
        points: pkg.points,
        bonusPoints: pkg.bonus_points,
        paymentId,
        userId: auth.userId,
        description: `${pkg.name} 충전`,
      })

      return NextResponse.json({
        balanceAfter: result.balanceAfter,
        charged: pkg.points,
        bonus: pkg.bonus_points,
        paymentId,
      })
    }

    // 관리자 수동 충전 (무료 지급/이벤트 등)
    if (action === 'admin-charge') {
      const role = auth.role
      if (role !== 'provider_admin' && role !== 'super_admin') {
        return NextResponse.json({ error: '권한이 없습니다' }, { status: 403 })
      }

      const { targetAgencyId, points, description } = body
      if (!targetAgencyId || !points || points <= 0) {
        return NextResponse.json({ error: '대상 업체와 포인트를 입력하세요' }, { status: 400 })
      }

      const result = await chargePoints({
        agencyId: targetAgencyId,
        points,
        userId: auth.userId,
        description: description ?? `관리자 수동 지급 ${points}P`,
      })

      return NextResponse.json({ balanceAfter: result.balanceAfter })
    }

    return NextResponse.json({ error: '알 수 없는 action' }, { status: 400 })
  } catch (err) {
    const message = err instanceof Error ? err.message : '포인트 처리 중 오류'
    return NextResponse.json({ error: message }, { status: 500 })
  }
}
