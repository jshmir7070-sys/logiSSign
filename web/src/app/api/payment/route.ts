import { NextRequest, NextResponse } from 'next/server'
import { authenticateRequest } from '@/lib/api-auth'
import { getPayment, payWithBillingKey, getIdentityVerification } from '@/services/payment.service'
import { createClient } from '@supabase/supabase-js'
import { paymentSchema, validateInput } from '@/lib/api-schemas'

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
    const rawBody = await request.json()
    const { data: body, error: validationError } = validateInput(paymentSchema, rawBody)
    if (validationError || !body) {
      return NextResponse.json({ error: validationError ?? '잘못된 요청입니다' }, { status: 400 })
    }

    const { action } = body

    // 빌링키 등록 완료 → DB 저장
    if (action === 'save-billing-key') {
      const { billingKey, cardName, cardNumber } = body

      // ✅ PG사에서 빌링키 유효성 검증
      try {
        const token = await (async () => {
          const secret = process.env.PORTONE_API_SECRET
          if (!secret) throw new Error('PORTONE_API_SECRET 미설정')
          const res = await fetch('https://api.portone.io/login/api-secret', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ apiSecret: secret }),
          })
          if (!res.ok) throw new Error('포트원 인증 실패')
          const data = await res.json()
          return data.accessToken as string
        })()

        // 빌링키 정보 조회로 유효성 확인
        const verifyRes = await fetch(`https://api.portone.io/billing-keys/${encodeURIComponent(billingKey)}`, {
          headers: { Authorization: `Bearer ${token}` },
        })
        if (!verifyRes.ok) {
          return NextResponse.json({ error: '유효하지 않은 빌링키입니다' }, { status: 400 })
        }
        const billingInfo = await verifyRes.json()
        const verifiedCardName = billingInfo.methods?.[0]?.card?.name ?? cardName ?? ''
        const verifiedCardNumber = billingInfo.methods?.[0]?.card?.number ?? cardNumber ?? ''

        await supabaseAdmin
          .from('subscriptions')
          .upsert({
            agency_id: auth.agencyId,
            billing_key: billingKey,
            card_name: verifiedCardName,
            card_number_masked: verifiedCardNumber,
            status: 'active',
            updated_at: new Date().toISOString(),
          }, { onConflict: 'agency_id' })

        return NextResponse.json({ success: true, cardName: verifiedCardName })
      } catch (e) {
        console.error('[Payment] 빌링키 검증 실패:', e); return NextResponse.json({ error: '카드 등록에 실패했습니다. 다시 시도해주세요.' }, { status: 400 })
      }
    }

    // 정기결제 실행
    if (action === 'charge') {
      const { plan, billing } = body
      const billingKey = 'billingKey' in body ? body.billingKey : undefined

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
      // ✅ 보안: CI/DI는 브라우저에 내려주지 않음 (최소권한)
      return NextResponse.json({
        verified: result.verified,
        name: result.name,
        phone: result.phone,
        birthDate: result.birthDate,
        error: result.error,
      })
    }

    // 결제 조회
    if (action === 'get-payment') {
      const { paymentId } = body
      const data = await getPayment(paymentId)
      return NextResponse.json(data)
    }

    return NextResponse.json({ error: '알 수 없는 action' }, { status: 400 })
  } catch {
    return NextResponse.json(
      { error: '결제 처리 중 오류가 발생했습니다' },
      { status: 500 }
    )
  }
}
