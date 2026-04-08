import { NextRequest, NextResponse } from 'next/server'

import { authenticateRequest } from '@/lib/api-auth'
import { getClientIp } from '@/lib/get-ip'
import { rateLimitAuth } from '@/lib/rate-limit'
import { createAdminSupabaseClient } from '@/lib/supabase'
import type { TaxInvoiceSendChannel } from '@/types/database'
import { sendSms } from '@/services/sms.service'

const supabaseAdmin = createAdminSupabaseClient()

type DriverContact = {
  id: string
  name: string
  phone: string | null
  push_token: string | null
}

type TaxInvoiceSendRow = {
  id: string
  agency_id: string | null
  driver_id: string | null
  year_month: string
  total_amount: number
  status: string
  drivers: DriverContact | null
}

type SendResult = {
  invoiceId: string
  driverName: string
  channel: TaxInvoiceSendChannel
  success: boolean
  reason?: string
  createdAt: string
}

async function sendPushNotification(
  token: string,
  title: string,
  body: string,
  data: Record<string, unknown>,
): Promise<boolean> {
  try {
    const response = await fetch('https://exp.host/--/api/v2/push/send', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Accept: 'application/json',
      },
      body: JSON.stringify({
        to: token,
        title,
        body,
        sound: 'default',
        channelId: 'default',
        data,
      }),
    })

    return response.ok
  } catch {
    return false
  }
}

function formatAmount(amount: number): string {
  return `₩${amount.toLocaleString('ko-KR')}`
}

export async function POST(request: NextRequest) {
  const limited = await rateLimitAuth(getClientIp(request), '/api/tax-invoices/send')
  if (limited) return limited

  const { auth, error: authError } = await authenticateRequest(request)
  if (authError || !auth) return authError!

  try {
    const body = await request.json()
    const rawInvoiceIds: unknown[] = Array.isArray(body.invoiceIds) ? body.invoiceIds : []
    const invoiceIds = rawInvoiceIds.filter(
      (value): value is string => typeof value === 'string' && value.length > 0,
    )

    if (invoiceIds.length === 0) {
      return NextResponse.json({ error: '전송할 세금계산서를 선택해 주세요.' }, { status: 400 })
    }

    const { data, error } = await supabaseAdmin
      .from('tax_invoices')
      .select(
        'id, agency_id, driver_id, year_month, total_amount, status, drivers(id, name, phone, push_token)',
      )
      .eq('agency_id', auth.agencyId)
      .in('id', invoiceIds)

    if (error) throw error

    const invoices = (data ?? []) as unknown as TaxInvoiceSendRow[]
    if (invoices.length === 0) {
      return NextResponse.json(
        { error: '전송 가능한 세금계산서를 찾지 못했습니다.' },
        { status: 404 },
      )
    }

    const issuedInvoices = invoices.filter((invoice) => invoice.status === 'issued')
    if (issuedInvoices.length === 0) {
      return NextResponse.json(
        { error: '발행 완료된 세금계산서만 공급자에게 전송할 수 있습니다.' },
        { status: 400 },
      )
    }

    const now = new Date().toISOString()
    const logRows: {
      tax_invoice_id: string
      agency_id: string
      driver_id: string | null
      channel: TaxInvoiceSendChannel
      success: boolean
      reason: string | null
      sent_by_user_id: string
      created_at: string
    }[] = []
    const results: SendResult[] = []

    let pushSent = 0
    let smsSent = 0
    let failed = 0
    const sentIds: string[] = []

    for (const invoice of issuedInvoices) {
      const driver = invoice.drivers

      if (!invoice.agency_id || !invoice.driver_id || !driver) {
        const reason = '연결된 기사 정보를 찾지 못했습니다.'
        failed += 1
        logRows.push({
          tax_invoice_id: invoice.id,
          agency_id: auth.agencyId,
          driver_id: invoice.driver_id ?? null,
          channel: 'none',
          success: false,
          reason,
          sent_by_user_id: auth.userId,
          created_at: now,
        })
        results.push({
          invoiceId: invoice.id,
          driverName: driver?.name ?? '기사 정보 없음',
          channel: 'none',
          success: false,
          reason,
          createdAt: now,
        })
        continue
      }

      const title = '세금계산서가 도착했습니다'
      const bodyText = `${invoice.year_month} 세금계산서 ${formatAmount(invoice.total_amount)}를 앱에서 확인해 주세요.`

      let delivered = false
      let channel: TaxInvoiceSendChannel = 'none'
      let reason: string | null = null

      if (driver.push_token) {
        delivered = await sendPushNotification(driver.push_token, title, bodyText, {
          type: 'tax_invoice',
          id: invoice.id,
        })

        if (delivered) {
          pushSent += 1
          channel = 'push'
        } else {
          reason = '앱 푸시 전송에 실패했습니다.'
        }
      }

      if (!delivered && driver.phone) {
        const smsResult = await sendSms({
          to: driver.phone,
          text: `[로지싸인] ${invoice.year_month} 세금계산서가 발행되었습니다. 앱에서 확인해 주세요.`,
        })

        if (smsResult.sent) {
          delivered = true
          smsSent += 1
          channel = 'sms'
          reason = null
        } else if (!reason) {
          reason = '문자 전송에 실패했습니다.'
        }
      }

      if (delivered) {
        sentIds.push(invoice.id)
      } else {
        failed += 1
        if (!reason) {
          reason = '앱 푸시 토큰 또는 휴대폰 번호가 없어 전송할 수 없습니다.'
        }
      }

      logRows.push({
        tax_invoice_id: invoice.id,
        agency_id: invoice.agency_id,
        driver_id: invoice.driver_id,
        channel,
        success: delivered,
        reason,
        sent_by_user_id: auth.userId,
        created_at: now,
      })

      results.push({
        invoiceId: invoice.id,
        driverName: driver.name,
        channel,
        success: delivered,
        reason: reason ?? undefined,
        createdAt: now,
      })
    }

    let logPersisted = true
    if (logRows.length > 0) {
      const { error: logError } = await supabaseAdmin.from('tax_invoice_send_logs').insert(logRows)
      if (logError) {
        console.error('Failed to persist tax invoice send logs', logError)
        logPersisted = false
      }
    }

    return NextResponse.json({
      requested: invoiceIds.length,
      eligible: issuedInvoices.length,
      skippedPending: invoices.length - issuedInvoices.length,
      pushSent,
      smsSent,
      failed,
      sentIds,
      results,
      logPersisted,
    })
  } catch (error) {
    const message =
      error instanceof Error ? error.message : '세금계산서 전송 중 오류가 발생했습니다.'
    return NextResponse.json({ error: message }, { status: 500 })
  }
}
