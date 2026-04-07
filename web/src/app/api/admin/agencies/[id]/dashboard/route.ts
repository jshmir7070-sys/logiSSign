import { NextRequest, NextResponse } from 'next/server'
import { authenticateAdmin } from '@/lib/api-auth'
import { createAdminSupabaseClient } from '@/lib/supabase'
import { getClientIp } from '@/lib/get-ip'
import { rateLimitAuth } from '@/lib/rate-limit'

const supabaseAdmin = createAdminSupabaseClient()

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const ip = getClientIp(request)
  const limited = await rateLimitAuth(ip, '/api/admin/agencies/dashboard')
  if (limited) return limited

  const { auth, error } = await authenticateAdmin(request)
  if (error || !auth) {
    return error ?? NextResponse.json({ error: '인증이 필요합니다.' }, { status: 401 })
  }

  if (auth.role !== 'provider_admin') {
    return NextResponse.json({ error: '권한이 없습니다.' }, { status: 403 })
  }

  const { id: agencyId } = await params

  try {
    const [
      agencyRes,
      driversRes,
      contractsRes,
      settlementsRes,
      paymentOrdersRes,
      settlementJobsRes,
      pointBalanceRes,
      pointTxRes,
    ] = await Promise.all([
      supabaseAdmin
        .from('agencies')
        .select('id, name, owner_name, phone, email, plan, plan_type, monthly_fee, status, created_at, business_number, address, logo_url, max_drivers')
        .eq('id', agencyId)
        .single(),
      supabaseAdmin
        .from('drivers')
        .select('id, name, phone, push_token, created_at, status')
        .eq('agency_id', agencyId)
        .order('created_at', { ascending: false }),
      supabaseAdmin
        .from('contracts')
        .select('id, title, status, sent_at, signed_at, created_at')
        .eq('agency_id', agencyId)
        .order('created_at', { ascending: false }),
      supabaseAdmin
        .from('settlements')
        .select('id, year_month, status, total_amount, net_amount, sent_at, created_at, driver_id')
        .eq('agency_id', agencyId)
        .order('created_at', { ascending: false }),
      supabaseAdmin
        .from('agency_payment_orders')
        .select('id, title, status, amount, payment_method, created_at, paid_at')
        .eq('agency_id', agencyId)
        .order('created_at', { ascending: false }),
      supabaseAdmin
        .from('settlement_jobs')
        .select('id, status, total_drivers, completed_drivers, failed_drivers, created_at')
        .eq('agency_id', agencyId)
        .order('created_at', { ascending: false })
        .limit(20),
      supabaseAdmin
        .from('point_balances')
        .select('balance, total_charged, total_used, updated_at')
        .eq('agency_id', agencyId)
        .maybeSingle(),
      supabaseAdmin
        .from('point_transactions')
        .select('id, type, amount, balance_after, description, created_at')
        .eq('agency_id', agencyId)
        .order('created_at', { ascending: false })
        .limit(15),
    ])

    if (agencyRes.error) throw new Error(agencyRes.error.message)
    if (!agencyRes.data) {
      return NextResponse.json({ error: '고객사를 찾을 수 없습니다.' }, { status: 404 })
    }

    const drivers = (driversRes.data ?? []) as Array<{ id: string; name: string; phone: string | null; push_token: string | null; created_at: string; status: string | null }>
    const contracts = (contractsRes.data ?? []) as Array<{ id: string; title: string; status: string; sent_at: string | null; signed_at: string | null; created_at: string }>
    const settlements = (settlementsRes.data ?? []) as Array<{ id: string; year_month: string; status: string; total_amount: number | null; net_amount: number | null; sent_at: string | null; created_at: string; driver_id: string | null }>
    const paymentOrders = (paymentOrdersRes.data ?? []) as Array<{ id: string; title: string; status: string; amount: number | null; payment_method: string | null; created_at: string; paid_at: string | null }>
    const settlementJobs = (settlementJobsRes.data ?? []) as Array<{ id: string; status: string; total_drivers: number | null; completed_drivers: number | null; failed_drivers: number | null; created_at: string }>

    // Driver stats
    const driverStats = {
      total: drivers.length,
      appActive: drivers.filter((d) => !!d.push_token).length,
      drivers,
    }

    // Contract stats
    const contractCounts = { draft: 0, sent: 0, viewed: 0, signed: 0, expired: 0 }
    for (const c of contracts) {
      if (c.status in contractCounts) {
        contractCounts[c.status as keyof typeof contractCounts]++
      }
    }
    const contractStats = {
      total: contracts.length,
      counts: contractCounts,
      signRate: contracts.length > 0
        ? Math.round((contractCounts.signed / contracts.length) * 100)
        : 0,
      recent: contracts.slice(0, 10),
    }

    // Settlement stats
    const settlementCounts = { draft: 0, sent: 0, confirmed: 0 }
    for (const s of settlements) {
      if (s.status in settlementCounts) {
        settlementCounts[s.status as keyof typeof settlementCounts]++
      }
    }
    const jobFailedCount = settlementJobs.filter((j) => j.status === 'failed').length
    const jobCompletedCount = settlementJobs.filter((j) => j.status === 'completed').length
    const settlementStats = {
      total: settlements.length,
      counts: settlementCounts,
      jobTotal: settlementJobs.length,
      jobCompleted: jobCompletedCount,
      jobFailed: jobFailedCount,
      recent: settlements.slice(0, 10),
    }

    // Payment stats
    const paymentCounts = { paid: 0, pending: 0, failed: 0, cancelled: 0 }
    let totalPaid = 0
    for (const p of paymentOrders) {
      if (p.status in paymentCounts) {
        paymentCounts[p.status as keyof typeof paymentCounts]++
      }
      if (p.status === 'paid' && p.amount) totalPaid += p.amount
    }
    const paymentStats = {
      total: paymentOrders.length,
      counts: paymentCounts,
      totalPaidAmount: totalPaid,
      recent: paymentOrders.slice(0, 10),
    }

    // Point stats
    const agencyData = agencyRes.data as Record<string, unknown>
    const maxDrivers = typeof agencyData.max_drivers === 'number' ? agencyData.max_drivers : 0
    const planType = typeof agencyData.plan_type === 'string' ? agencyData.plan_type : 'subscription'
    const overCount = Math.max(0, driverStats.appActive - maxDrivers)

    const pointBalance = (pointBalanceRes as { data: { balance: number; total_charged: number; total_used: number; updated_at: string } | null }).data
    const pointTransactions = ((pointTxRes as { data: Array<Record<string, unknown>> | null }).data ?? []) as Array<{
      id: string; type: string; amount: number; balance_after: number; description: string | null; created_at: string
    }>

    const pointStats = {
      balance: pointBalance?.balance ?? 0,
      totalCharged: pointBalance?.total_charged ?? 0,
      totalUsed: pointBalance?.total_used ?? 0,
      lastUpdated: pointBalance?.updated_at ?? null,
      recentTransactions: pointTransactions.slice(0, 10),
    }

    const usageStats = {
      planType,
      maxDrivers,
      currentAppActive: driverStats.appActive,
      overCount,
    }

    return NextResponse.json({
      agency: agencyRes.data,
      driverStats,
      contractStats,
      settlementStats,
      paymentStats,
      pointStats,
      usageStats,
    })
  } catch (fetchError) {
    return NextResponse.json(
      {
        error:
          fetchError instanceof Error
            ? fetchError.message
            : '고객사 현황을 불러오지 못했습니다.',
      },
      { status: 500 },
    )
  }
}
