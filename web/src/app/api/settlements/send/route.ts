import { createClient } from '@supabase/supabase-js'
import { NextRequest, NextResponse } from 'next/server'

import { apiError } from '@/lib/api-error'
import { authenticateRequest } from '@/lib/api-auth'
import { getClientIp } from '@/lib/get-ip'
import { isPointBased, isPaidPlan, type PlanType } from '@/lib/plan-limits'
import { rateLimitAuth } from '@/lib/rate-limit'
import { createSignedStorageUrl } from '@/lib/storage-reference'
import { deductPoints, hasEnoughPoints } from '@/services/point.service'
import { buildRenderableSettlementTemplate, buildSettlementDriverData, type SettlementPdfSource } from '@/services/settlement-rendering.service'
import { generateSettlementPdf } from '@/services/settlement-pdf.service'
import { sendSms } from '@/services/sms.service'
import { DEFAULT_TEMPLATE, type SettlementMeta, type SettlementTemplate } from '@/types/settlement-template'

const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!,
  { auth: { autoRefreshToken: false, persistSession: false } },
)

type SettlementSendRow = {
  id: string
  driver_id: string | null
  year_month: string
  delivery_count: number
  delivery_amount: number
  return_count: number
  return_amount: number
  pickup_count: number
  pickup_amount: number
  fresh_incentive: number
  extra_incentive: number
  total_amount: number
  total_deduction: number
  vat_amount: number
  net_amount: number
  deduction_detail: Record<string, number> | null
  drivers: {
    name: string
    employee_code: string | null
    driver_code: string | null
    phone: string | null
    delivery_area: string | null
    vehicle_number: string | null
  } | null
  principals: { name: string } | null
}

type DriverChannel = {
  id: string
  name: string
  phone: string | null
  push_token: string | null
}

function cloneTemplate(template: SettlementTemplate): SettlementTemplate {
  return JSON.parse(JSON.stringify(template)) as SettlementTemplate
}

function pickSettlementTemplate(
  rows: Array<{ template_config: SettlementTemplate; is_default: boolean }> | null,
): SettlementTemplate {
  const chosen = rows?.find((row) => row.is_default)?.template_config ?? rows?.[0]?.template_config
  return cloneTemplate(chosen ?? DEFAULT_TEMPLATE)
}

async function resolveAgencyLogoUrl(reference: string | null): Promise<string | undefined> {
  if (!reference) return undefined
  if (/^https?:\/\//i.test(reference)) return reference

  const { url } = await createSignedStorageUrl(supabaseAdmin, 'documents', reference, 60 * 30)
  return url ?? undefined
}

function toSettlementPdfSource(row: SettlementSendRow): SettlementPdfSource {
  return {
    driverName: row.drivers?.name ?? '기사',
    employeeCode: row.drivers?.employee_code ?? null,
    phone: row.drivers?.phone ?? null,
    region: row.drivers?.delivery_area ?? null,
    companyName: row.principals?.name ?? null,
    vehicleNumber: row.drivers?.vehicle_number ?? null,
    yearMonth: row.year_month,
    deliveryCount: row.delivery_count ?? 0,
    deliveryAmount: row.delivery_amount ?? 0,
    returnCount: row.return_count ?? 0,
    returnAmount: row.return_amount ?? 0,
    pickupCount: row.pickup_count ?? 0,
    pickupAmount: row.pickup_amount ?? 0,
    freshIncentive: row.fresh_incentive ?? 0,
    extraIncentive: row.extra_incentive ?? 0,
    totalAmount: row.total_amount ?? 0,
    totalDeduction: row.total_deduction ?? 0,
    vatAmount: row.vat_amount ?? 0,
    netAmount: row.net_amount ?? 0,
    deductionDetail: row.deduction_detail,
  }
}

async function generateSettlementPdfs(agencyId: string, settlements: SettlementSendRow[]): Promise<number> {
  const { data: agency } = await supabaseAdmin
    .from('agencies')
    .select('name, phone, address, logo_url')
    .eq('id', agencyId)
    .single()

  const agencyInfo = (agency ?? {}) as {
    name?: string
    phone?: string | null
    address?: string | null
    logo_url?: string | null
  }

  const { data: templateRows, error: templateError } = await supabaseAdmin
    .from('settlement_templates')
    .select('template_config, is_default, updated_at, created_at')
    .eq('agency_id', agencyId)
    .order('is_default', { ascending: false })
    .order('updated_at', { ascending: false })
    .order('created_at', { ascending: false })
    .limit(10)

  if (templateError) {
    throw templateError
  }

  const selectedTemplate = pickSettlementTemplate(
    (templateRows ?? []) as Array<{ template_config: SettlementTemplate; is_default: boolean }>,
  )
  const logoUrl = await resolveAgencyLogoUrl(agencyInfo.logo_url ?? null)

  for (const settlement of settlements) {
    const source = toSettlementPdfSource(settlement)
    const template = buildRenderableSettlementTemplate(selectedTemplate, source)
    const driver = buildSettlementDriverData(source, template)

    if (template.footer.showCompanyInfo) {
      template.footer.companyPhone = template.footer.companyPhone || agencyInfo.phone || ''
      template.footer.companyAddress = template.footer.companyAddress || agencyInfo.address || ''
    }

    const [yearRaw, monthRaw] = settlement.year_month.split('-')
    const year = Number(yearRaw) || new Date().getFullYear()
    const month = Number(monthRaw) || new Date().getMonth() + 1

    const meta: SettlementMeta = {
      agencyName: agencyInfo.name || '대리점',
      year,
      month,
      generatedAt: new Date().toLocaleDateString('ko-KR'),
      documentNumber: `ST-${String(year)}${String(month).padStart(2, '0')}-${settlement.id.slice(0, 8).toUpperCase()}`,
      logoUrl,
    }

    const pdfBytes = await generateSettlementPdf(template, driver, meta)
    const pdfPath = `${agencyId}/${settlement.year_month}/${settlement.id}.pdf`

    const { error: uploadError } = await supabaseAdmin.storage.from('settlements').upload(pdfPath, pdfBytes, {
      contentType: 'application/pdf',
      upsert: true,
    })

    if (uploadError) {
      throw new Error(`정산서 PDF 업로드에 실패했습니다: ${uploadError.message}`)
    }

    const { error: updateError } = await supabaseAdmin
      .from('settlements')
      .update({ pdf_url: pdfPath })
      .eq('id', settlement.id)

    if (updateError) {
      throw updateError
    }
  }

  return settlements.length
}

async function sendPushNotification(driverId: string, token: string): Promise<boolean> {
  try {
    const response = await fetch('https://exp.host/--/api/v2/push/send', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
      body: JSON.stringify({
        to: token,
        title: '정산서가 도착했습니다',
        body: '커스텀 정산서가 발송되었습니다. 앱에서 바로 확인해 주세요.',
        sound: 'default',
        data: { type: 'settlement', driverId },
        channelId: 'default',
      }),
    })

    return response.ok
  } catch {
    return false
  }
}

export async function POST(request: NextRequest) {
  const ip = getClientIp(request)
  const limited = await rateLimitAuth(ip, '/api/settlements/send')
  if (limited) return limited

  const { auth, error: authError } = await authenticateRequest(request)
  if (authError || !auth) return authError!

  try {
    const body = await request.json()
    const settlementIds: string[] = body.settlementIds
    if (!Array.isArray(settlementIds) || settlementIds.length === 0) {
      return NextResponse.json({ error: '발송할 정산서를 선택해 주세요.' }, { status: 400 })
    }

    const agencyId = auth.agencyId

    const { data: settlements, error: fetchError } = await supabaseAdmin
      .from('settlements')
      .select(
        [
          'id',
          'driver_id',
          'year_month',
          'delivery_count',
          'delivery_amount',
          'return_count',
          'return_amount',
          'pickup_count',
          'pickup_amount',
          'fresh_incentive',
          'extra_incentive',
          'total_amount',
          'total_deduction',
          'vat_amount',
          'net_amount',
          'deduction_detail',
          'drivers(name, employee_code, driver_code, phone, delivery_area, vehicle_number)',
          'principals(name)',
        ].join(', '),
      )
      .eq('agency_id', agencyId)
      .eq('status', 'draft')
      .in('id', settlementIds)

    if (fetchError) throw fetchError

    const settlementRows = (settlements ?? []) as unknown as SettlementSendRow[]
    if (!settlementRows.length) {
      return NextResponse.json({ error: '발송 가능한 정산서가 없습니다.' }, { status: 400 })
    }

    const validIds = settlementRows.map((settlement) => settlement.id)
    const driverIds = Array.from(
      new Set(settlementRows.map((settlement) => settlement.driver_id).filter(Boolean)),
    ) as string[]

    const { data: driverContacts, error: driverContactError } = await supabaseAdmin
      .from('drivers')
      .select('id, name, phone, push_token')
      .in('id', driverIds)

    if (driverContactError) {
      throw driverContactError
    }

    const driverChannels = (driverContacts ?? []) as DriverChannel[]
    const contactMap = new Map(driverChannels.map((driver) => [driver.id, driver]))
    const unreachableDrivers = driverChannels.filter((driver) => !driver.push_token && !driver.phone)

    if (unreachableDrivers.length > 0) {
      const names = unreachableDrivers.map((driver) => driver.name).join(', ')
      return NextResponse.json(
        {
          error: `알림을 보낼 수 없는 기사가 있습니다. 푸시 토큰 또는 휴대전화 번호를 먼저 확인해 주세요. ${names}`,
        },
        { status: 400 },
      )
    }

    const { data: agency } = await supabaseAdmin
      .from('agencies')
      .select('plan, name')
      .eq('id', agencyId)
      .single()

    const agencyPlan = (agency?.plan ?? 'free') as PlanType
    const agencyName = (agency?.name as string) ?? '대리점'
    const isSubscription = isPaidPlan(agencyPlan) && !isPointBased(agencyPlan)

    const generatedPdfCount = await generateSettlementPdfs(agencyId, settlementRows)

    // --- Fire push + SMS simultaneously per driver using Promise.allSettled ---
    const baseUrl = process.env.NEXT_PUBLIC_APP_URL || 'https://logissign.com'

    const pushResults: Array<{ driverId: string; sent: boolean }> = []
    const smsResults: Array<{ driverId: string; sent: boolean }> = []

    const notificationPromises: Promise<void>[] = []

    for (const driverId of driverIds) {
      const driver = contactMap.get(driverId)
      if (!driver) continue

      const yearMonth =
        settlementRows.find((s) => s.driver_id === driver.id)?.year_month ?? ''
      const settlementLink = `${baseUrl}/portal/settlements?ym=${encodeURIComponent(yearMonth)}`

      const channelPromises: Array<Promise<{ channel: 'push' | 'sms'; sent: boolean }>> = []

      // Push notification for drivers with a push token
      if (driver.push_token) {
        channelPromises.push(
          sendPushNotification(driver.id, driver.push_token).then((ok) => ({
            channel: 'push' as const,
            sent: ok,
          })),
        )
      }

      // SMS to ALL drivers with a phone number (simultaneous, not fallback)
      if (driver.phone) {
        const smsText =
          `[${agencyName}] ${yearMonth} 정산서가 도착했습니다. 확인: ${settlementLink}`
        channelPromises.push(
          sendSms({ to: driver.phone, text: smsText }).then((r) => ({
            channel: 'sms' as const,
            sent: r.sent,
          })),
        )
      }

      if (channelPromises.length > 0) {
        notificationPromises.push(
          Promise.allSettled(channelPromises).then((results) => {
            for (const result of results) {
              if (result.status === 'fulfilled') {
                const { channel, sent } = result.value
                if (channel === 'push') pushResults.push({ driverId, sent })
                if (channel === 'sms') smsResults.push({ driverId, sent })
              } else {
                // Promise rejected — log and record as failure
                console.error(`[SettlementSend] Notification error for driver ${driverId}:`, result.reason)
              }
            }
          }),
        )
      }
    }

    // Wait for all drivers' notifications to complete
    await Promise.allSettled(notificationPromises)

    // Log delivery summary
    const pushSentCount = pushResults.filter((r) => r.sent).length
    const pushFailedCount = pushResults.filter((r) => !r.sent).length
    const smsSentCount = smsResults.filter((r) => r.sent).length
    const smsFailedCount = smsResults.filter((r) => !r.sent).length
    console.info(
      `[SettlementSend] Push: ${pushSentCount} sent / ${pushFailedCount} failed | SMS: ${smsSentCount} sent / ${smsFailedCount} failed`,
    )

    // A driver is "notified" if at least one channel succeeded
    const notifiedDriverIds = new Set<string>()
    const failedDriverIds = new Set<string>()

    for (const driverId of driverIds) {
      const pushOk = pushResults.some((r) => r.driverId === driverId && r.sent)
      const smsOk = smsResults.some((r) => r.driverId === driverId && r.sent)
      if (pushOk || smsOk) {
        notifiedDriverIds.add(driverId)
      } else {
        failedDriverIds.add(driverId)
      }
    }

    if (notifiedDriverIds.size === 0) {
      return NextResponse.json(
        { error: '실제로 정산서를 전달할 수 있는 기사 연락 수단이 없습니다.' },
        { status: 400 },
      )
    }

    const sentSettlementIds = settlementRows
      .filter((settlement) => settlement.driver_id && notifiedDriverIds.has(settlement.driver_id))
      .map((settlement) => settlement.id)

    const notifiedDriverCount = notifiedDriverIds.size
    const actualSetCount = Math.ceil(notifiedDriverCount / 5)
    let pointDeducted = 0

    if (!isSubscription && actualSetCount > 0) {
      const pointCheck = await hasEnoughPoints(agencyId, 'settlement_generate', actualSetCount)
      if (!pointCheck.enough) {
        return NextResponse.json(
          {
            error: `포인트가 부족합니다. 필요 ${pointCheck.required.toLocaleString()}P / 보유 ${pointCheck.balance.toLocaleString()}P`,
          },
          { status: 402 },
        )
      }

      const result = await deductPoints({
        agencyId,
        action: 'settlement_generate',
        count: actualSetCount,
        referenceType: 'settlement',
        userId: auth.userId,
      })
      pointDeducted = result.deducted
    }

    const sentAt = new Date().toISOString()
    const { error: updateError } = await supabaseAdmin
      .from('settlements')
      .update({ status: 'sent', sent_at: sentAt })
      .in('id', sentSettlementIds)

    if (updateError) {
      throw updateError
    }

    return NextResponse.json({
      sent: sentSettlementIds.length,
      driverCount: notifiedDriverCount,
      generatedPdfCount,
      pushSent: pushSentCount,
      pushFailed: pushFailedCount,
      smsSent: smsSentCount,
      smsFailed: smsFailedCount,
      failedDrivers: Array.from(failedDriverIds),
      pointDeducted,
      draftRetained: validIds.filter((id) => !sentSettlementIds.includes(id)).length,
    })
  } catch (error) {
    console.error('[SettlementSend] Unexpected error:', error)
    return apiError('정산서 발송 중 오류가 발생했습니다.', 500)
  }
}
