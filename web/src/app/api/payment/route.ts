import { NextRequest, NextResponse } from 'next/server'
import { authenticateRequest } from '@/lib/api-auth'
import { getPayment, payWithBillingKey, getIdentityVerification } from '@/services/payment.service'
import { createClient } from '@supabase/supabase-js'

const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!,
  { auth: { autoRefreshToken: false, persistSession: false } }
)

/**
 * POST /api/payment/billing-key
 * 빌링키 등록 완료 후 서버에서 검증 + DB 저장
 */
export async function POST(request: NextRequest) {
  const { auth, error: authError } = await authenticateRequest(request)
  if (authError || !auth) return authError!

  try {
    const { action, ...body } = await request.json()

    // 빌링키 등록 완료 → DB 저장
    if (action === 'save-billing-key') {
      const { billingKey, cardName, cardNumber } = body

      await supabaseAdmin
        .from('subscriptions')
        .upsert({
          agency_id: auth.agencyId,
          billing_key: billingKey,
          card_name: cardName ?? '',
          card_number_masked: cardNumber ?? '',
          status: 'active',
          updated_at: new Date().toISOString(),
        }, { onConflict: 'agency_id' })

      return NextResponse.json({ success: true })
    }

    // 정기결제 실행
    if (action === 'charge') {
      const { billingKey, plan, billing } = body

      // 구독 정보 조회
      const { data: sub } = await supabaseAdmin
        .from('subscriptions')
        .select('billing_key')
        .eq('agency_id', auth.agencyId)
        .single()

      const key = billingKey ?? sub?.billing_key
      if (!key) {
        return NextResponse.json({ error: '등록된 카드가 없습니다' }, { status: 400 })
      }

      const { getSubscriptionAmount } = await import('@/services/payment.service')
      const amount = getSubscriptionAmount(plan, billing)
      if (amount === 0) {
        return NextResponse.json({ error: 'Free 플랜은 결제가 필요 없습니다' }, { status: 400 })
      }

      const paymentId = `sub_${auth.agencyId}_${Date.now()}`
      const result = await payWithBillingKey({
        billingKey: key,
        paymentId,
        orderName: `logiSSign ${plan} 플랜 (${billing})`,
        amount,
        customer: { name: auth.agencyId },
      })

      if (result.error) {
        return NextResponse.json({ error: result.error }, { status: 500 })
      }

      // 플랜 업데이트
      await supabaseAdmin
        .from('agencies')
        .update({ plan, monthly_fee: amount })
        .eq('id', auth.agencyId)

      return NextResponse.json({ paymentId: result.paymentId, amount: result.amount })
    }

    // 본인인증 결과 조회
    if (action === 'verify-identity') {
      const { identityVerificationId } = body
      const result = await getIdentityVerification(identityVerificationId)
      return NextResponse.json(result)
    }

    // 결제 조회
    if (action === 'get-payment') {
      const { paymentId } = body
      const data = await getPayment(paymentId)
      return NextResponse.json(data)
    }

    return NextResponse.json({ error: '알 수 없는 action' }, { status: 400 })
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : '결제 처리 실패' },
      { status: 500 }
    )
  }
}
