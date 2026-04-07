import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { Resend } from 'resend'
import { apiError } from '@/lib/api-error'
import { authenticateCron } from '@/lib/api-auth'
import {
  ADMIN_SETTINGS_KEYS,
  DEFAULT_ADMIN_PAYMENT_SETTINGS,
  buildAdminSettingsPayload,
} from '@/lib/admin-settings'
import { addDays, todayKST } from '@/lib/date-kst'
import { sendRenewalSms, sendSms } from '@/services/sms.service'

const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!,
  { auth: { autoRefreshToken: false, persistSession: false } },
)

const resendApiKey = process.env.RESEND_API_KEY
const resendFromEmail = process.env.RESEND_FROM_EMAIL || 'logiSSign <onboarding@resend.dev>'
const resendClient = resendApiKey ? new Resend(resendApiKey) : null

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

  for (let index = 0; index < messages.length; index += 100) {
    const batch = messages.slice(index, index + 100)
    await fetch('https://exp.host/--/api/v2/push/send', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(batch.length === 1 ? batch[0] : batch),
    }).catch((error) => console.error('Push notification failed:', error))
  }
}

async function getPaymentSettings() {
  const { data } = await supabaseAdmin
    .from('admin_settings')
    .select('value')
    .eq('key', ADMIN_SETTINGS_KEYS.payment)
    .maybeSingle()

  return buildAdminSettingsPayload({
    [ADMIN_SETTINGS_KEYS.payment]: data?.value,
  }).payment
}

async function createSubscriptionExpiryNotice(params: {
  agencyId: string
  plan: string
  expiresAt: string
  daysLeft: number
}) {
  const title = `플랜 만료 예정 안내 (D-${params.daysLeft})`
  const today = todayKST()
  const noticeDateStart = `${today}T00:00:00+09:00`

  const { data: existing } = await supabaseAdmin
    .from('notices')
    .select('id')
    .eq('agency_id', params.agencyId)
    .eq('title', title)
    .gte('created_at', noticeDateStart)
    .limit(1)
    .maybeSingle()

  if (existing?.id) {
    return false
  }

  const expiryText = new Date(params.expiresAt).toLocaleDateString('ko-KR')
  const content =
    `현재 이용 중인 ${params.plan.toUpperCase()} 플랜의 만료 예정일은 ${expiryText}입니다.\n` +
    '설정 > 결제 관리에서 등록된 카드 상태와 다음 결제 일정을 확인해 주세요.\n' +
    '카드 등록과 카드 변경은 구독형 플랜 이용 중에만 가능합니다.'

  const { error } = await supabaseAdmin.from('notices').insert({
    created_by_type: 'provider',
    agency_id: params.agencyId,
    target_type: 'agency',
    title,
    content,
    category: 'notice',
    status: 'published',
    published_at: new Date().toISOString(),
  })

  if (error) {
    throw new Error(error.message)
  }

  return true
}

async function sendSubscriptionExpirySms(params: {
  phone: string | null
  agencyName: string
  plan: string
  expiresAt: string
  daysLeft: number
}) {
  if (!params.phone) return false

  const expiryText = new Date(params.expiresAt).toLocaleDateString('ko-KR')
  const result = await sendSms({
    to: params.phone,
    text:
      `[로지싸인] ${params.agencyName}의 ${params.plan.toUpperCase()} 플랜이 ${expiryText}에 만료됩니다. ` +
      `D-${params.daysLeft} 안내입니다. 설정 > 결제 관리에서 카드 상태와 결제 일정을 확인해 주세요.`,
  })

  return result.sent
}

async function sendSubscriptionExpiryEmail(params: {
  email: string | null
  agencyName: string
  plan: string
  expiresAt: string
  daysLeft: number
}) {
  if (!params.email || !resendClient) return false

  const expiryText = new Date(params.expiresAt).toLocaleDateString('ko-KR')

  await resendClient.emails.send({
    from: resendFromEmail,
    to: params.email,
    subject: `[로지싸인] ${params.plan.toUpperCase()} 플랜 만료 예정 안내 (D-${params.daysLeft})`,
    html: `
      <div style="font-family: Pretendard, -apple-system, BlinkMacSystemFont, sans-serif; max-width: 600px; margin: 0 auto; padding: 24px;">
        <h1 style="font-size: 22px; color: #111827; margin-bottom: 16px;">플랜 만료 예정 안내</h1>
        <p style="font-size: 15px; line-height: 1.7; color: #374151;">
          ${params.agencyName}에서 사용 중인 <strong>${params.plan.toUpperCase()}</strong> 플랜은
          <strong>${expiryText}</strong>에 만료됩니다.
        </p>
        <p style="font-size: 15px; line-height: 1.7; color: #374151;">
          설정 &gt; 결제 관리에서 등록된 카드 상태와 다음 결제 일정을 확인해 주세요.
        </p>
        <div style="margin-top: 24px; padding: 16px; border-radius: 12px; background: #eff6ff; color: #1d4ed8; font-size: 14px;">
          카드 등록과 카드 변경은 구독형 플랜 이용 중에만 가능합니다.
        </div>
      </div>
    `,
  })

  return true
}

export async function GET(request: NextRequest) {
  const cronError = authenticateCron(request)
  if (cronError) return cronError

  const today = todayKST()
  const sixtyDaysLater = addDays(today, 60)
  let renewalPushNotified = 0
  let renewalSmsNotified = 0
  let activated = 0
  let subscriptionExpiryNotices = 0
  let subscriptionExpirySms = 0
  let subscriptionExpiryEmails = 0

  try {
    const { data: expiring } = await supabaseAdmin
      .from('driver_contract_periods')
      .select('id, driver_id, agency_id, period_end')
      .eq('status', 'active')
      .lte('period_end', sixtyDaysLater)
      .gte('period_end', today)

    if (expiring && expiring.length > 0) {
      const driverIds = Array.from(new Set((expiring as { driver_id: string }[]).map((period) => period.driver_id)))
      const { data: existingAmendments } = await supabaseAdmin
        .from('contract_amendments')
        .select('driver_id')
        .in('driver_id', driverIds)
        .eq('amendment_type', 'renewal')
        .in('status', ['pending', 'approved'])

      const alreadyHandled = new Set(
        ((existingAmendments as { driver_id: string }[] | null) ?? []).map((item) => item.driver_id),
      )

      const needsNotification = (expiring as { driver_id: string; period_end: string }[]).filter(
        (period) => !alreadyHandled.has(period.driver_id),
      )

      if (needsNotification.length > 0) {
        const notifyDriverIds = needsNotification.map((period) => period.driver_id)
        const { data: drivers } = await supabaseAdmin
          .from('drivers')
          .select('id, name, phone, push_token')
          .in('id', notifyDriverIds)

        const tokens = ((drivers ?? []) as Array<{
          id: string
          name: string | null
          phone: string | null
          push_token: string | null
        }>)
          .map((driver) => driver.push_token)
          .filter((token): token is string => Boolean(token))

        if (tokens.length > 0) {
          await sendExpoPush(
            tokens,
            '계약 만료 안내',
            '계약 만료일이 60일 이내로 다가오고 있습니다. 갱신 안내를 확인해 주세요.',
            { type: 'renewal_reminder' },
          )
          renewalPushNotified = tokens.length
        }

        for (const period of needsNotification) {
          const driver = (drivers ?? []).find((item) => item.id === period.driver_id)
          if (!driver?.phone) continue

          const sent = await sendRenewalSms(
            driver.phone,
            driver.name ?? '기사님',
            new Date(period.period_end).toLocaleDateString('ko-KR'),
          )

          if (sent.sent) {
            renewalSmsNotified += 1
          }
        }
      }
    }

    const { data: upcoming } = await supabaseAdmin
      .from('driver_contract_periods')
      .select('id, driver_id')
      .eq('status', 'upcoming')
      .lte('period_start', today)

    if (upcoming && upcoming.length > 0) {
      const upcomingIds = (upcoming as { id: string; driver_id: string }[]).map((period) => period.id)
      const upcomingDriverIds = Array.from(
        new Set((upcoming as { id: string; driver_id: string }[]).map((period) => period.driver_id)),
      )

      await supabaseAdmin
        .from('driver_contract_periods')
        .update({ status: 'expired', updated_at: new Date().toISOString() })
        .in('driver_id', upcomingDriverIds)
        .eq('status', 'active')

      await supabaseAdmin
        .from('driver_contract_periods')
        .update({ status: 'active', updated_at: new Date().toISOString() })
        .in('id', upcomingIds)

      activated = upcomingIds.length
    }

    await supabaseAdmin
      .from('driver_contract_periods')
      .update({ status: 'expired', updated_at: new Date().toISOString() })
      .eq('status', 'active')
      .lt('period_end', today)

    const paymentSettings = await getPaymentSettings().catch(() => DEFAULT_ADMIN_PAYMENT_SETTINGS)
    const noticeDays = paymentSettings.subscriptionExpiryNoticeDays.length
      ? paymentSettings.subscriptionExpiryNoticeDays
      : DEFAULT_ADMIN_PAYMENT_SETTINGS.subscriptionExpiryNoticeDays

    const { data: subscriptions, error: subscriptionError } = await supabaseAdmin
      .from('subscriptions')
      .select('agency_id, plan, status, expires_at, agencies(name, phone, email)')
      .eq('status', 'active')
      .not('expires_at', 'is', null)

    if (subscriptionError) {
      throw subscriptionError
    }

    const activeSubscriptions =
      (subscriptions as Array<{
        agency_id: string
        plan: string
        status: string
        expires_at: string | null
        agencies?: { name?: string | null; phone?: string | null; email?: string | null } | null
      }> | null) ?? []

    for (const subscription of activeSubscriptions) {
      if (!subscription.expires_at || subscription.plan === 'point') continue

      const expiresAt = new Date(subscription.expires_at)
      const todayDate = new Date(`${today}T00:00:00+09:00`)
      const expiryDate = new Date(
        `${expiresAt.getFullYear()}-${String(expiresAt.getMonth() + 1).padStart(2, '0')}-${String(
          expiresAt.getDate(),
        ).padStart(2, '0')}T00:00:00+09:00`,
      )

      const daysLeft = Math.round((expiryDate.getTime() - todayDate.getTime()) / (1000 * 60 * 60 * 24))
      if (!noticeDays.includes(daysLeft)) continue

      const created = await createSubscriptionExpiryNotice({
        agencyId: subscription.agency_id,
        plan: subscription.plan,
        expiresAt: subscription.expires_at,
        daysLeft,
      })

      if (!created) continue

      subscriptionExpiryNotices += 1

      const smsSent = await sendSubscriptionExpirySms({
        phone: subscription.agencies?.phone ?? null,
        agencyName: subscription.agencies?.name ?? '대리점',
        plan: subscription.plan,
        expiresAt: subscription.expires_at,
        daysLeft,
      })

      if (smsSent) {
        subscriptionExpirySms += 1
      }

      const emailSent = await sendSubscriptionExpiryEmail({
        email: subscription.agencies?.email ?? null,
        agencyName: subscription.agencies?.name ?? '대리점',
        plan: subscription.plan,
        expiresAt: subscription.expires_at,
        daysLeft,
      }).catch((error) => {
        console.error('Subscription expiry email failed:', error)
        return false
      })

      if (emailSent) {
        subscriptionExpiryEmails += 1
      }
    }

    return NextResponse.json({
      success: true,
      date: today,
      renewalPushNotified,
      renewalSmsNotified,
      activated,
      subscriptionExpiryNotices,
      subscriptionExpirySms,
      subscriptionExpiryEmails,
    })
  } catch (error) {
    return apiError(error)
  }
}
