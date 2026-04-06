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

function monthKey(date: Date): string {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`
}

function monthLabel(key: string): string {
  const month = Number(key.slice(5))
  return `${month}월`
}

export async function GET(request: NextRequest) {
  const ip = getClientIp(request)
  const limited = rateLimitAuth(ip, '/api/admin/dashboard')
  if (limited) return limited

  const { auth, error } = await authenticateAdmin(request)
  if (error || !auth) {
    return error ?? NextResponse.json({ error: '인증이 필요합니다.' }, { status: 401 })
  }

  if (auth.role !== 'provider_admin') {
    return NextResponse.json(
      { error: '슈퍼 관리자만 관리자 대시보드를 조회할 수 있습니다.' },
      { status: 403 }
    )
  }

  try {
    const [agenciesRes, driversRes, contractsRes, settlementsRes, paymentOrdersRes, logsRes] =
      await Promise.all([
        supabaseAdmin
          .from('agencies')
          .select('id, name, plan, status, created_at, monthly_fee')
          .order('created_at', { ascending: false }),
        supabaseAdmin.from('drivers').select('id, user_id, push_token', { count: 'exact' }),
        supabaseAdmin.from('contracts').select('id, status', { count: 'exact' }),
        supabaseAdmin.from('settlements').select('id, status', { count: 'exact' }),
        supabaseAdmin
          .from('agency_payment_orders')
          .select('id, status, amount, purpose, created_at, agencies(name), title')
          .order('created_at', { ascending: false })
          .limit(20),
        supabaseAdmin
          .from('security_logs')
          .select('id, event_type, created_at, resource')
          .order('created_at', { ascending: false })
          .limit(10),
      ])

    if (agenciesRes.error) throw new Error(agenciesRes.error.message)
    if (driversRes.error) throw new Error(driversRes.error.message)
    if (contractsRes.error) throw new Error(contractsRes.error.message)
    if (settlementsRes.error) throw new Error(settlementsRes.error.message)
    if (paymentOrdersRes.error) throw new Error(paymentOrdersRes.error.message)
    if (logsRes.error) throw new Error(logsRes.error.message)

    const agencies = (agenciesRes.data ?? []) as Array<Record<string, unknown>>
    const drivers = (driversRes.data ?? []) as Array<Record<string, unknown>>
    const contracts = (contractsRes.data ?? []) as Array<Record<string, unknown>>
    const settlements = (settlementsRes.data ?? []) as Array<Record<string, unknown>>
    const paymentOrders = (paymentOrdersRes.data ?? []) as Array<Record<string, unknown>>
    const recentLogs = (logsRes.data ?? []) as Array<Record<string, unknown>>

    const activeAgencies = agencies.filter((agency) => (agency.status as string) === 'active')
    const planCounts: Record<string, number> = {
      free: 0,
      point: 0,
      basic: 0,
      standard: 0,
      pro: 0,
      enterprise: 0,
    }

    for (const agency of activeAgencies) {
      const plan = ((agency.plan as string) || 'free').toLowerCase()
      planCounts[plan] = (planCounts[plan] ?? 0) + 1
    }

    const now = new Date()
    const monthBuckets = Array.from({ length: 6 }, (_, index) => {
      const date = new Date(now.getFullYear(), now.getMonth() - (5 - index), 1)
      return monthKey(date)
    })

    const cumulativeMrr = new Map<string, number>(monthBuckets.map((bucket) => [bucket, 0]))
    for (const agency of activeAgencies) {
      const createdAt = new Date(agency.created_at as string)
      const fee =
        typeof agency.monthly_fee === 'number' && agency.monthly_fee > 0
          ? agency.monthly_fee
          : PLAN_FEES[((agency.plan as string) || 'free').toLowerCase()] ?? 0

      for (const bucket of monthBuckets) {
        const year = Number(bucket.slice(0, 4))
        const month = Number(bucket.slice(5, 7))
        const bucketDate = new Date(year, month, 0, 23, 59, 59, 999)
        if (createdAt <= bucketDate) {
          cumulativeMrr.set(bucket, (cumulativeMrr.get(bucket) ?? 0) + fee)
        }
      }
    }

    return NextResponse.json({
      summary: {
        totalAgencies: agencies.length,
        activeAgencies: activeAgencies.length,
        inactiveAgencies: agencies.length - activeAgencies.length,
        totalDrivers: driversRes.count ?? drivers.length,
        linkedDrivers: drivers.filter((row) => typeof row.user_id === 'string' && row.user_id).length,
        pushEnabledDrivers: drivers.filter((row) => typeof row.push_token === 'string' && row.push_token).length,
        totalContracts: contractsRes.count ?? contracts.length,
        pendingContracts: contracts.filter((row) => ['sent', 'viewed'].includes(String(row.status ?? ''))).length,
        totalSettlements: settlementsRes.count ?? settlements.length,
        pendingSettlements: settlements.filter((row) => String(row.status ?? '') === 'draft').length,
        mrrEstimate: activeAgencies.reduce((sum, agency) => {
          const fee =
            typeof agency.monthly_fee === 'number' && agency.monthly_fee > 0
              ? agency.monthly_fee
              : PLAN_FEES[((agency.plan as string) || 'free').toLowerCase()] ?? 0
          return sum + fee
        }, 0),
        pendingPayments: paymentOrders.filter((row) => row.status === 'pending').length,
        failedPayments: paymentOrders.filter((row) => row.status === 'failed').length,
      },
      planCounts,
      mrrHistory: monthBuckets.map((bucket) => ({
        month: monthLabel(bucket),
        mrr: cumulativeMrr.get(bucket) ?? 0,
      })),
      recentAgencies: agencies.slice(0, 10).map((agency) => ({
        id: agency.id,
        name: agency.name,
        plan: agency.plan,
        status: agency.status,
        created_at: agency.created_at,
      })),
      recentLogs,
      recentPaymentOrders: paymentOrders,
    })
  } catch (fetchError) {
    return NextResponse.json(
      {
        error:
          fetchError instanceof Error
            ? fetchError.message
            : '관리자 대시보드 데이터를 불러오지 못했습니다.',
      },
      { status: 500 }
    )
  }
}
