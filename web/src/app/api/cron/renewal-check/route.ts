import { apiError } from '@/lib/api-error'
import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { authenticateCron } from '@/lib/api-auth'
import { todayKST, addDays } from '@/lib/date-kst'

/**
 * GET /api/cron/renewal-check
 *
 * 매일 실행 (Vercel CRON 또는 외부 스케줄러):
 * 1. 만료 60일 이내 active 기간 조회
 * 2. 이미 재계약 요청(pending/approved amendment)이 없는 기사에게 알림 생성
 * 3. upcoming 기간 중 시작일이 오늘인 것 → active 전환
 *
 * Vercel cron 설정: vercel.json에 추가
 * { "crons": [{ "path": "/api/cron/renewal-check", "schedule": "0 1 * * *" }] }
 */

const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!,
  { auth: { autoRefreshToken: false, persistSession: false } }
)

// Expo Push API
async function sendExpoPush(tokens: string[], title: string, body: string, data?: Record<string, string>) {
  const messages = tokens.filter(Boolean).map((to) => ({
    to,
    title,
    body,
    sound: 'default' as const,
    data,
    channelId: 'default',
  }))
  if (messages.length === 0) return

  for (let i = 0; i < messages.length; i += 100) {
    const batch = messages.slice(i, i + 100)
    await fetch('https://exp.host/--/api/v2/push/send', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(batch.length === 1 ? batch[0] : batch),
    }).catch(err => console.error('Push notification failed:', err))
  }
}

export async function GET(request: NextRequest) {
  // timing-safe 인증
  const cronError = authenticateCron(request)
  if (cronError) return cronError

  const today = todayKST()
  const sixtyDaysLater = addDays(today, 60)
  let notified = 0
  let activated = 0

  try {
    // ──────────────────────────────────
    // 1. 만료 60일 이내 기간 조회 → 알림
    // ──────────────────────────────────
    const { data: expiring } = await supabaseAdmin
      .from('driver_contract_periods')
      .select('id, driver_id, agency_id, period_end')
      .eq('status', 'active')
      .lte('period_end', sixtyDaysLater)
      .gte('period_end', today)

    if (expiring && expiring.length > 0) {
      // 이미 pending 재계약 요청이 있는 기사 제외
      const driverIds = Array.from(new Set((expiring as { driver_id: string }[]).map((p) => p.driver_id)))
      const { data: existingAmendments } = await supabaseAdmin
        .from('contract_amendments')
        .select('driver_id')
        .in('driver_id', driverIds)
        .eq('amendment_type', 'renewal')
        .in('status', ['pending', 'approved'])

      const alreadyHandled = new Set(
        (existingAmendments as { driver_id: string }[] ?? []).map((a) => a.driver_id)
      )

      const needsNotification = (expiring as { driver_id: string; period_end: string }[])
        .filter((p) => !alreadyHandled.has(p.driver_id))

      if (needsNotification.length > 0) {
        // 기사 push_token 조회
        const notifyDriverIds = needsNotification.map((p) => p.driver_id)
        const { data: drivers } = await supabaseAdmin
          .from('drivers')
          .select('id, push_token')
          .in('id', notifyDriverIds)

        const tokens = (drivers ?? [])
          .filter((d): d is { id: string; push_token: string } => !!(d as { push_token?: string }).push_token)
          .map((d) => (d as { push_token: string }).push_token)

        if (tokens.length > 0) {
          await sendExpoPush(
            tokens,
            '📋 계약 만료 안내',
            '계약 만료가 60일 이내입니다. 재계약 관련 안내를 확인해주세요.',
            { type: 'renewal_reminder' }
          )
          notified = tokens.length
        }
      }
    }

    // ──────────────────────────────────
    // 2. upcoming → active 전환
    // ──────────────────────────────────
    const { data: upcoming } = await supabaseAdmin
      .from('driver_contract_periods')
      .select('id, driver_id')
      .eq('status', 'upcoming')
      .lte('period_start', today)

    if (upcoming && upcoming.length > 0) {
      const upcomingIds = (upcoming as { id: string; driver_id: string }[]).map((p) => p.id)
      const upcomingDriverIds = Array.from(new Set((upcoming as { id: string; driver_id: string }[]).map((p) => p.driver_id)))

      // 기존 active → expired
      await supabaseAdmin
        .from('driver_contract_periods')
        .update({ status: 'expired', updated_at: new Date().toISOString() })
        .in('driver_id', upcomingDriverIds)
        .eq('status', 'active')

      // upcoming → active
      await supabaseAdmin
        .from('driver_contract_periods')
        .update({ status: 'active', updated_at: new Date().toISOString() })
        .in('id', upcomingIds)

      activated = upcomingIds.length
    }

    // ──────────────────────────────────
    // 3. 만료일 지난 active → expired
    // ──────────────────────────────────
    await supabaseAdmin
      .from('driver_contract_periods')
      .update({ status: 'expired', updated_at: new Date().toISOString() })
      .eq('status', 'active')
      .lt('period_end', today)

    return NextResponse.json({
      success: true,
      date: today,
      notified,
      activated,
    })
  } catch (err) {
    return apiError(err)
  }
}
