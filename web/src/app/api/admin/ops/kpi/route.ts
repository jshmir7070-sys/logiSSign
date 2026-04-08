import { NextRequest, NextResponse } from 'next/server'
import { authenticateAdmin } from '@/lib/api-auth'
import { createAdminSupabaseClient } from '@/lib/supabase'
import { getClientIp } from '@/lib/get-ip'
import { rateLimitAuth } from '@/lib/rate-limit'

const supabaseAdmin = createAdminSupabaseClient()

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
  const limited = await rateLimitAuth(ip, '/api/admin/ops/kpi')
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
    const todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate()).toISOString()
    const yesterdayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate() - 1).toISOString()

    const [agenciesRes, todayAgenciesRes, yesterdayAgenciesRes, contractsRes, paymentsRes] = await Promise.all([
      supabaseAdmin.from('agencies').select('id, plan, status, monthly_fee, created_at'),
      supabaseAdmin.from('agencies').select('id', { count: 'exact', head: true }).gte('created_at', todayStart),
      supabaseAdmin.from('agencies').select('id', { count: 'exact', head: true }).gte('created_at', yesterdayStart).lt('created_at', todayStart),
      supabaseAdmin.from('contracts').select('id, status', { count: 'exact' }),
      supabaseAdmin.from('agency_payment_orders').select('id, status, amount').gte('created_at', todayStart),
    ])

    if (agenciesRes.error) throw new Error(agenciesRes.error.message)

    const agencies = (agenciesRes.data ?? []) as Array<Record<string, unknown>>
    const activeAgencies = agencies.filter((agency) => agency.status === 'active')

    const mrrEstimate = activeAgencies.reduce((sum, agency) => {
      const fee =
        typeof agency.monthly_fee === 'number' && agency.monthly_fee > 0
          ? agency.monthly_fee
          : PLAN_FEES[((agency.plan as string) || 'free').toLowerCase()] ?? 0
      return sum + fee
    }, 0)

    const todayNewUsers = todayAgenciesRes.count ?? 0
    const yesterdayNewUsers = yesterdayAgenciesRes.count ?? 0
    const newUsersChange =
      yesterdayNewUsers > 0
        ? (((todayNewUsers - yesterdayNewUsers) / yesterdayNewUsers) * 100).toFixed(1)
        : todayNewUsers > 0
          ? '100.0'
          : '0.0'

    const contracts = (contractsRes.data ?? []) as Array<Record<string, unknown>>
    const totalContracts = contractsRes.count ?? contracts.length
    const completedContracts = contracts.filter((contract) => contract.status === 'completed').length
    const errorRate =
      totalContracts > 0 ? (((totalContracts - completedContracts) / totalContracts) * 100).toFixed(2) : '0.00'

    const payments = (paymentsRes.data ?? []) as Array<Record<string, unknown>>
    const failedPayments = payments.filter((payment) => payment.status === 'failed')

    return NextResponse.json({
      revenue: { value: mrrEstimate, change: '0.0' },
      newUsers: { value: todayNewUsers, change: newUsersChange },
      activeAgencies: { value: activeAgencies.length, change: '0.0' },
      apiCalls: { value: payments.length, change: '0.0' },
      errorRate: { value: errorRate, change: '0.0' },
      uptime: { value: failedPayments.length === 0 ? '99.99' : '99.50', change: '0.0' },
    })
  } catch (fetchError) {
    return NextResponse.json(
      { error: fetchError instanceof Error ? fetchError.message : 'KPI 데이터를 불러오지 못했습니다.' },
      { status: 500 },
    )
  }
}
