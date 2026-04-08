import { NextRequest, NextResponse } from 'next/server'
import { authenticateAdmin } from '@/lib/api-auth'
import { createAdminSupabaseClient } from '@/lib/supabase'
import { getClientIp } from '@/lib/get-ip'
import { rateLimitAuth } from '@/lib/rate-limit'

const supabaseAdmin = createAdminSupabaseClient()
const DAY_LABELS = ['일', '월', '화', '수', '목', '금', '토']

const PLAN_FEES: Record<string, number> = {
  free: 0,
  point: 0,
  basic: 49900,
  standard: 99000,
  pro: 199000,
  enterprise: 0,
}

export async function GET(request: NextRequest) {
  const ip = getClientIp(request)
  const limited = await rateLimitAuth(ip, '/api/admin/ops/weekly')
  if (limited) return limited

  const { auth, error } = await authenticateAdmin(request)
  if (error || !auth) {
    return error ?? NextResponse.json({ error: '인증이 필요합니다.' }, { status: 401 })
  }

  if (auth.role !== 'provider_admin') {
    return NextResponse.json({ error: '플랫폼 관리자만 조회할 수 있습니다.' }, { status: 403 })
  }

  try {
    const now = new Date()
    const weekAgo = new Date(now.getFullYear(), now.getMonth(), now.getDate() - 6)
    const weekAgoISO = weekAgo.toISOString()

    const [agenciesRes, securityLogsRes, paymentsRes] = await Promise.all([
      supabaseAdmin.from('agencies').select('id, plan, monthly_fee, created_at').gte('created_at', weekAgoISO),
      supabaseAdmin.from('security_logs').select('id, severity, created_at').gte('created_at', weekAgoISO).in('severity', ['warning', 'critical']),
      supabaseAdmin.from('agency_payment_orders').select('id, status, amount, created_at').gte('created_at', weekAgoISO),
    ])

    const agencies = (agenciesRes.data ?? []) as Array<Record<string, unknown>>
    const logs = (securityLogsRes.data ?? []) as Array<Record<string, unknown>>
    const payments = (paymentsRes.data ?? []) as Array<Record<string, unknown>>

    const weeklyData = Array.from({ length: 7 }, (_, index) => {
      const date = new Date(weekAgo.getFullYear(), weekAgo.getMonth(), weekAgo.getDate() + index)
      const dateStr = date.toISOString().slice(0, 10)
      const dayLabel = DAY_LABELS[date.getDay()]

      const dayAgencies = agencies.filter((agency) => String(agency.created_at ?? '').slice(0, 10) === dateStr)
      const dayRevenue = dayAgencies.reduce((sum, agency) => {
        const fee =
          typeof agency.monthly_fee === 'number' && agency.monthly_fee > 0
            ? agency.monthly_fee
            : PLAN_FEES[((agency.plan as string) || 'free').toLowerCase()] ?? 0
        return sum + fee
      }, 0)

      const dayErrors = logs.filter((log) => String(log.created_at ?? '').slice(0, 10) === dateStr).length
      const dayPayments = payments.filter((payment) => String(payment.created_at ?? '').slice(0, 10) === dateStr).length

      return {
        day: dayLabel,
        date: dateStr,
        revenue: dayRevenue,
        users: dayAgencies.length,
        errors: dayErrors,
        payments: dayPayments,
      }
    })

    return NextResponse.json({ weeklyData })
  } catch (fetchError) {
    return NextResponse.json(
      { error: fetchError instanceof Error ? fetchError.message : '주간 데이터를 불러오지 못했습니다.' },
      { status: 500 },
    )
  }
}
