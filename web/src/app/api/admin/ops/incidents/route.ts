import { NextRequest, NextResponse } from 'next/server'
import { authenticateAdmin } from '@/lib/api-auth'
import { createAdminSupabaseClient } from '@/lib/supabase'
import { getClientIp } from '@/lib/get-ip'
import { rateLimitAuth } from '@/lib/rate-limit'

const supabaseAdmin = createAdminSupabaseClient()

export async function GET(request: NextRequest) {
  const ip = getClientIp(request)
  const limited = await rateLimitAuth(ip, '/api/admin/ops/incidents')
  if (limited) return limited

  const { auth, error } = await authenticateAdmin(request)
  if (error || !auth) {
    return error ?? NextResponse.json({ error: '인증이 필요합니다.' }, { status: 401 })
  }

  if (auth.role !== 'provider_admin') {
    return NextResponse.json({ error: '플랫폼 관리자만 조회할 수 있습니다.' }, { status: 403 })
  }

  try {
    const [securityLogsRes, paymentFailuresRes, taxInvoiceFailuresRes] = await Promise.all([
      supabaseAdmin
        .from('security_logs')
        .select('id, event_type, severity, resource, created_at')
        .order('created_at', { ascending: false })
        .limit(50),
      supabaseAdmin
        .from('agency_payment_orders')
        .select('id, status, title, created_at')
        .eq('status', 'failed')
        .order('created_at', { ascending: false })
        .limit(15),
      supabaseAdmin
        .from('tax_invoice_send_logs')
        .select('id, tax_invoice_id, reason, created_at')
        .eq('success', false)
        .order('created_at', { ascending: false })
        .limit(15),
    ])

    if (securityLogsRes.error) throw new Error(securityLogsRes.error.message)

    const securityLogs = (securityLogsRes.data ?? []) as Array<Record<string, unknown>>
    const paymentFailures = (paymentFailuresRes.data ?? []) as Array<Record<string, unknown>>
    const taxInvoiceFailures = (taxInvoiceFailuresRes.data ?? []) as Array<Record<string, unknown>>

    const incidents = [
      ...paymentFailures.map((paymentFailure) => ({
        id: `payment-${paymentFailure.id}`,
        createdAt: String(paymentFailure.created_at),
        time: new Date(String(paymentFailure.created_at)).toLocaleTimeString('ko-KR', { hour: '2-digit', minute: '2-digit' }),
        type: '결제 실패',
        severity: 'warning' as const,
        msg: `${paymentFailure.title ?? '결제 주문'} 처리에 실패했습니다.`,
        dept: 'finance',
        autoHealed: false,
      })),
      ...taxInvoiceFailures.map((failure) => ({
        id: `tax-${failure.id}`,
        createdAt: String(failure.created_at),
        time: new Date(String(failure.created_at)).toLocaleTimeString('ko-KR', { hour: '2-digit', minute: '2-digit' }),
        type: '세금계산서 전송 실패',
        severity: 'warning' as const,
        msg: failure.reason ? `공급자 전송 실패: ${failure.reason}` : '세금계산서 공급자 전송에 실패했습니다.',
        dept: 'finance',
        autoHealed: false,
      })),
      ...securityLogs.map((log) => {
        const severity = String(log.severity ?? 'info')
        const eventType = String(log.event_type ?? 'system_event')
        const autoHealed = severity !== 'critical' && severity !== 'warning'
        return {
          id: `security-${log.id}`,
          createdAt: String(log.created_at),
          time: new Date(String(log.created_at)).toLocaleTimeString('ko-KR', { hour: '2-digit', minute: '2-digit' }),
          type: autoHealed ? '자동 복구' : '보안 경고',
          severity:
            severity === 'critical'
              ? ('critical' as const)
              : severity === 'warning'
                ? ('warning' as const)
                : autoHealed
                  ? ('resolved' as const)
                  : ('info' as const),
          msg: `${eventType}: ${String(log.resource ?? 'system')}`,
          dept: 'dev',
          autoHealed,
        }
      }),
    ].sort((left, right) => right.createdAt.localeCompare(left.createdAt))

    const autoHealed = incidents.filter((incident) => incident.autoHealed).length
    const pending = incidents.filter((incident) => !incident.autoHealed).length

    return NextResponse.json({
      incidents: incidents.map(({ createdAt: _createdAt, ...incident }) => incident),
      summary: {
        total: incidents.length,
        autoHealed,
        pending,
        levels: {
          level1: incidents.filter((incident) => incident.autoHealed && incident.severity === 'resolved').length,
          level2: incidents.filter((incident) => incident.autoHealed && incident.severity === 'info').length,
          level3: incidents.filter((incident) => !incident.autoHealed && incident.severity === 'warning').length,
          level4: incidents.filter((incident) => !incident.autoHealed && incident.severity === 'critical').length,
        },
      },
    })
  } catch (fetchError) {
    return NextResponse.json(
      { error: fetchError instanceof Error ? fetchError.message : '이슈 데이터를 불러오지 못했습니다.' },
      { status: 500 },
    )
  }
}
