import { createBrowserSupabaseClient } from '@/lib/supabase'

/**
 * Expo Push Notification 발송 서비스
 * 서버 → Expo Push API → 기사 앱
 */

interface PushPayload {
  title: string
  body: string
  data?: Record<string, string>
}

interface ExpoPushMessage {
  to: string
  title: string
  body: string
  sound: 'default'
  data?: Record<string, string>
  channelId?: string
}

/**
 * 특정 기사에게 푸시 알림 전송
 */
export async function sendPushToDriver(
  driverId: string,
  payload: PushPayload
): Promise<{ sent: boolean; error: string | null }> {
  const supabase = createBrowserSupabaseClient()

  const { data, error } = await supabase
    .from('drivers')
    .select('push_token')
    .eq('id', driverId)
    .single()

  if (error || !data?.push_token) {
    return { sent: false, error: '푸시 토큰 없음' }
  }

  return sendExpoPush([{
    to: data.push_token as string,
    title: payload.title,
    body: payload.body,
    sound: 'default',
    data: payload.data,
    channelId: 'default',
  }])
}

/**
 * 여러 기사에게 일괄 푸시 알림 전송
 */
export async function sendPushToDrivers(
  driverIds: string[],
  payload: PushPayload
): Promise<{ sent: number; failed: number }> {
  if (driverIds.length === 0) return { sent: 0, failed: 0 }

  const supabase = createBrowserSupabaseClient()

  const { data } = await supabase
    .from('drivers')
    .select('id, push_token')
    .in('id', driverIds)

  const tokens = (data ?? [])
    .filter((d): d is { id: string; push_token: string } => !!d.push_token)

  if (tokens.length === 0) return { sent: 0, failed: driverIds.length }

  const messages: ExpoPushMessage[] = tokens.map((d) => ({
    to: d.push_token,
    title: payload.title,
    body: payload.body,
    sound: 'default',
    data: payload.data,
    channelId: 'default',
  }))

  // Expo Push API는 한 번에 100개씩
  let sent = 0
  let failed = 0

  for (let i = 0; i < messages.length; i += 100) {
    const batch = messages.slice(i, i + 100)
    const result = await sendExpoPush(batch)
    if (result.sent) {
      sent += batch.length
    } else {
      failed += batch.length
    }
  }

  return { sent, failed }
}

/**
 * 대리점 전체 기사에게 푸시 알림 (공지사항 등)
 */
export async function sendPushToAllDrivers(
  agencyId: string,
  payload: PushPayload
): Promise<{ sent: number; failed: number }> {
  const supabase = createBrowserSupabaseClient()

  const { data } = await supabase
    .from('drivers')
    .select('id')
    .eq('agency_id', agencyId)
    .eq('status', 'active')

  const driverIds = (data ?? []).map((d) => d.id)
  return sendPushToDrivers(driverIds, payload)
}

interface PushResult {
  sent: boolean
  error: string | null
}

// ── 정산서 발행 알림 ──

export async function notifySettlementCreated(
  driverIds: string[],
  yearMonth: string
): Promise<{ sent: number; failed: number }> {
  const result = await sendPushToDrivers(driverIds, {
    title: '📋 정산서 발행',
    body: `${yearMonth} 정산서가 발행되었습니다. 확인해주세요.`,
    data: { type: 'settlement', yearMonth },
  })
  if (result.failed > 0) {
    console.warn(`[Push] 정산서 발행 알림 실패: ${result.failed}/${result.sent + result.failed}건`)
  }
  return result
}

// ── 계약서 도착 알림 ──

export async function notifyContractSent(
  driverId: string,
  contractId: string,
  contractTitle: string
): Promise<PushResult> {
  const result = await sendPushToDriver(driverId, {
    title: '📝 계약서 도착',
    body: `"${contractTitle}" 계약서가 도착했습니다. 확인 후 서명해주세요.`,
    data: { type: 'contract', id: contractId },
  })
  if (!result.sent) {
    console.warn(`[Push] 계약서 도착 알림 실패 (driver: ${driverId}): ${result.error}`)
  }
  return result
}

// ── 계약 변경 요청 알림 ──

export async function notifyAmendmentRequest(
  driverId: string,
  amendmentId: string,
  title: string
): Promise<PushResult> {
  const result = await sendPushToDriver(driverId, {
    title: '⚠️ 계약 변경 요청',
    body: `"${title}" 변경 요청이 도착했습니다. 확인 후 수락/거부해주세요.`,
    data: { type: 'amendment', id: amendmentId },
  })
  if (!result.sent) {
    console.warn(`[Push] 변경 요청 알림 실패 (driver: ${driverId}): ${result.error}`)
  }
  return result
}

// ── 변경 요청 응답 알림 (대리점에게) ──

export async function notifyAmendmentResponse(
  driverId: string,
  driverName: string,
  amendmentTitle: string,
  accepted: boolean
): Promise<void> {
  // 대리점 담당자에게 알릴 때는 기사 이름 포함
  // 현재는 로그용. 추후 대리점 포털 알림 확장 가능
  // (프로덕션에서는 DB 로깅으로 교체 필요)
}

// ── 공지사항 알림 ──

export async function notifyNewNotice(
  agencyId: string,
  noticeTitle: string
): Promise<{ sent: number; failed: number }> {
  const result = await sendPushToAllDrivers(agencyId, {
    title: '📢 공지사항',
    body: noticeTitle,
    data: { type: 'notice' },
  })
  if (result.failed > 0) {
    console.warn(`[Push] 공지사항 알림 실패: ${result.failed}/${result.sent + result.failed}건`)
  }
  return result
}
// ── Expo Push API 호출 ──

async function sendExpoPush(
  messages: ExpoPushMessage[]
): Promise<{ sent: boolean; error: string | null }> {
  try {
    const response = await fetch('https://exp.host/--/api/v2/push/send', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Accept': 'application/json',
      },
      body: JSON.stringify(messages.length === 1 ? messages[0] : messages),
    })

    if (!response.ok) {
      const text = await response.text()
      return { sent: false, error: `Expo Push API 오류: ${response.status} ${text}` }
    }

    return { sent: true, error: null }
  } catch (err) {
    return { sent: false, error: err instanceof Error ? err.message : 'Push 발송 실패' }
  }
}
