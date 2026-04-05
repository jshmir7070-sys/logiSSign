import { getClientIp } from '@/lib/get-ip'
import { apiError } from '@/lib/api-error'
import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { authenticateRequest } from '@/lib/api-auth'
import { rateLimitAuth } from '@/lib/rate-limit'
import { isPaidPlan, type PlanType } from '@/lib/plan-limits'
import { deductPoints, hasEnoughPoints } from '@/services/point.service'

const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!,
  { auth: { autoRefreshToken: false, persistSession: false } }
)

/**
 * POST /api/settlements/send
 * 정산서 발송 (draft → sent) + 포인트 차감
 *
 * Body: { settlementIds: string[] }
 *
 * 포인트 단가: settlement_generate = 700P / 5명 1세트
 * 구독형(basic+)은 무제한
 */
export async function POST(request: NextRequest) {
  const ip = getClientIp(request)
  const limited = rateLimitAuth(ip, '/api/settlements/send')
  if (limited) return limited

  const { auth, error: authError } = await authenticateRequest(request)
  if (authError) return authError

  try {
    const body = await request.json()
    const settlementIds: string[] = body.settlementIds
    if (!Array.isArray(settlementIds) || settlementIds.length === 0) {
      return NextResponse.json({ error: '발송할 정산서를 선택하세요' }, { status: 400 })
    }

    const agencyId = auth!.agencyId

    // 소속 정산서인지 확인 + draft 상태만
    const { data: settlements, error: fetchErr } = await supabaseAdmin
      .from('settlements')
      .select('id, driver_id')
      .eq('agency_id', agencyId)
      .eq('status', 'draft')
      .in('id', settlementIds)

    if (fetchErr) throw fetchErr
    if (!settlements?.length) {
      return NextResponse.json({ error: '발송 가능한 정산서가 없습니다' }, { status: 400 })
    }

    const validIds = settlements.map(s => s.id)
    const uniqueDrivers = new Set(settlements.map(s => s.driver_id).filter(Boolean))
    const driverCount = uniqueDrivers.size

    // 포인트 차감 계산: 5명 1세트 (올림)
    const setCount = Math.ceil(driverCount / 5)

    // 대리점 플랜 조회
    const { data: agency } = await supabaseAdmin
      .from('agencies')
      .select('plan')
      .eq('id', agencyId)
      .single()
    const agencyPlan = (agency?.plan ?? 'free') as PlanType
    const isSubscription = isPaidPlan(agencyPlan) && agencyPlan !== 'point'

    // 포인트 차감 (무료/포인트 플랜만) — 먼저 차감 후 상태 변경
    let pointDeducted = 0
    if (!isSubscription && setCount > 0) {
      const check = await hasEnoughPoints(agencyId, 'settlement_generate', setCount)
      if (!check.enough) {
        return NextResponse.json({
          error: `포인트 잔액 부족 (필요: ${check.required.toLocaleString()}P, 잔액: ${check.balance.toLocaleString()}P). 포인트를 충전하거나 구독 플랜으로 변경해주세요.`,
        }, { status: 402 })
      }

      // ⚡ 먼저 포인트 차감 (원자적) — 실패 시 발송 안 함
      try {
        const result = await deductPoints({
          agencyId,
          action: 'settlement_generate',
          count: setCount,
          referenceType: 'settlement',
          userId: auth!.userId,
        })
        pointDeducted = result.deducted
      } catch (pointErr) {
        console.error('[SettlementSend] Point deduction failed:', pointErr)
        return NextResponse.json({
          error: '포인트 차감에 실패했습니다. 잠시 후 다시 시도해주세요.',
        }, { status: 402 })
      }
    }

    // 상태 업데이트: draft → sent (포인트 차감 성공 후)
    const { error: updateErr } = await supabaseAdmin
      .from('settlements')
      .update({ status: 'sent', sent_at: new Date().toISOString() })
      .in('id', validIds)

    if (updateErr) {
      console.error('[SettlementSend] Update error:', updateErr)
      if (pointDeducted > 0) {
        console.error(`[SettlementSend] ⚠️ 포인트 ${pointDeducted}P 차감됨, 상태 변경 실패 — 수동 환불 필요. agency=${agencyId}`)
      }
      throw updateErr
    }

    // 기사 푸시 알림 발송
    const driverIds = Array.from(uniqueDrivers) as string[]
    if (driverIds.length > 0) {
      const { data: drivers } = await supabaseAdmin
        .from('drivers')
        .select('push_token')
        .in('id', driverIds)
        .not('push_token', 'is', null)

      const tokens = (drivers ?? []).map(d => d.push_token).filter(Boolean) as string[]
      if (tokens.length > 0) {
        const pushMessages = tokens.map(token => ({
          to: token,
          title: '정산서 도착',
          body: '정산서가 도착했습니다. 확인해주세요.',
          sound: 'default' as const,
          data: { type: 'settlement' },
          channelId: 'default',
        }))

        for (let i = 0; i < pushMessages.length; i += 100) {
          const batch = pushMessages.slice(i, i + 100)
          try {
            await fetch('https://exp.host/--/api/v2/push/send', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
              body: JSON.stringify(batch),
            })
          } catch { /* 푸시 실패 무시 */ }
        }
      }
    }

    return NextResponse.json({ sent: validIds.length, driverCount })
  } catch (err) {
    console.error('[SettlementSend] Unexpected error:', err)
    return apiError('정산서 발송 중 오류가 발생했습니다', 500)
  }
}
