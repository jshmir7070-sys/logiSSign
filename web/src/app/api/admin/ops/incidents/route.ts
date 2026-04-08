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
    const [securityLogsRes, paymentFailuresRes] = await Promise.all([
      supabaseAdmin.from('security_logs').select('id, event_type, severity, resource, created_at').order('created_at', { ascending: false }).limit(50),
      supabaseAdmin.from('agency_payment_orders').select('id, status, title, created_at').eq('status', 'failed').order('created_at', { ascending: false }).limit(10),
    ])

    if (securityLogsRes.error) throw new Error(securityLogsRes.error.message)

    const securityLogs = (securityLogsRes.data ?? []) as Array<Record<string, unknown>>
    const paymentFailures = (paymentFailuresRes.data ?? []) as Array<Record<string, unknown>>

    const incidents = [
      ...paymentFailures.map((paymentFailure) => ({
        id: String(paymentFailure.id),
        time: new Date(paymentFailure.created_at as string).toLocaleTimeString('ko-KR', { hour: '2-digit', minute: '2-digit' }),
        type: '경고' as const,
        severity: 'warning' as const,
        msg: `결제 실패: ${paymentFailure.title ?? '제목 없음'}`,
        dept: 'finance',
        autoHealed: false,
      })),
      ...securityLogs.map((log) => {
        const eventType = String(log.event_type ?? '')
        const severity = String(log.severity ?? 'info')
        const isAutoHealed = severity !== 'critical' && severity !== 'warning'

        return {
          id: String(log.id),
          time: new Date(log.created_at as string).toLocaleTimeString('ko-KR', { hour: '2-digit', minute: '2-digit' }),
          type: isAutoHealed ? '자동 복구' as const : '경고' as const,
          severity:
            severity === 'critical'
              ? ('critical' as const)
              : severity === 'warning'
                ? ('warning' as const)
                : isAutoHealed
                  ? ('resolved' as const)
                  : ('info' as const),
          msg: `${eventType}: ${log.resource ?? '서비스'}`,
          dept: 'dev',
          autoHealed: isAutoHealed,
        }
      }),
    ].sort((left, right) => right.time.replace(':', '').localeCompare(left.time.replace(':', '')))

    const autoHealed = incidents.filter((incident) => incident.autoHealed).length
    const pending = incidents.filter((incident) => !incident.autoHealed).length

    return NextResponse.json({
      incidents,
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
