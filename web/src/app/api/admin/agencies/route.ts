import { NextRequest, NextResponse } from 'next/server'
import { authenticateAdmin } from '@/lib/api-auth'
import { createAdminSupabaseClient } from '@/lib/supabase'
import { getClientIp } from '@/lib/get-ip'
import { rateLimitAuth } from '@/lib/rate-limit'

const supabaseAdmin = createAdminSupabaseClient()

function pickLatestByAgency(rows: Array<Record<string, unknown>>) {
  const result = new Map<string, Record<string, unknown>>()

  for (const row of rows) {
    const agencyId = typeof row.agency_id === 'string' ? row.agency_id : ''
    if (!agencyId) continue

    const createdAt = typeof row.created_at === 'string' ? row.created_at : ''
    const current = result.get(agencyId)

    if (!current) {
      result.set(agencyId, row)
      continue
    }

    const currentCreatedAt = typeof current.created_at === 'string' ? current.created_at : ''
    if (new Date(createdAt).getTime() > new Date(currentCreatedAt).getTime()) {
      result.set(agencyId, row)
    }
  }

  return result
}

export async function GET(request: NextRequest) {
  const ip = getClientIp(request)
  const limited = await rateLimitAuth(ip, '/api/admin/agencies')
  if (limited) return limited

  const { auth, error } = await authenticateAdmin(request)
  if (error || !auth) {
    return error ?? NextResponse.json({ error: '인증이 필요합니다.' }, { status: 401 })
  }

  if (auth.role !== 'provider_admin') {
    return NextResponse.json(
      { error: '슈퍼 관리자만 고객사 목록을 조회할 수 있습니다.' },
      { status: 403 }
    )
  }

  try {
    const [agenciesRes, driversRes, ordersRes] = await Promise.all([
      supabaseAdmin
        .from('agencies')
        .select('id, name, owner_name, plan, monthly_fee, created_at, status')
        .order('created_at', { ascending: false }),
      supabaseAdmin.from('drivers').select('agency_id, push_token'),
      supabaseAdmin
        .from('agency_payment_orders')
        .select('agency_id, title, payment_method, status, created_at, paid_at')
        .order('created_at', { ascending: false }),
    ])

    if (agenciesRes.error) throw new Error(agenciesRes.error.message)
    if (driversRes.error) throw new Error(driversRes.error.message)
    if (ordersRes.error) throw new Error(ordersRes.error.message)

    const driverCountMap = new Map<string, number>()
    const appActiveCountMap = new Map<string, number>()
    for (const row of (driversRes.data ?? []) as { agency_id: string | null; push_token: string | null }[]) {
      if (!row.agency_id) continue
      driverCountMap.set(row.agency_id, (driverCountMap.get(row.agency_id) ?? 0) + 1)
      if (row.push_token) {
        appActiveCountMap.set(row.agency_id, (appActiveCountMap.get(row.agency_id) ?? 0) + 1)
      }
    }

    const latestOrderMap = pickLatestByAgency((ordersRes.data ?? []) as Array<Record<string, unknown>>)
    const agencies = ((agenciesRes.data ?? []) as Array<Record<string, unknown>>).map((agency) => {
      const id = String(agency.id)
      const latestOrder = latestOrderMap.get(id)
      const paymentStatus =
        (typeof latestOrder?.status === 'string' && latestOrder.status) ||
        (typeof agency.status === 'string' && agency.status) ||
        'active'

      return {
        ...agency,
        driver_count: driverCountMap.get(id) ?? 0,
        app_active_count: appActiveCountMap.get(id) ?? 0,
        payment_status: paymentStatus,
        latest_payment_title: typeof latestOrder?.title === 'string' ? latestOrder.title : null,
        latest_payment_method:
          typeof latestOrder?.payment_method === 'string' ? latestOrder.payment_method : null,
        latest_payment_at:
          (typeof latestOrder?.paid_at === 'string' && latestOrder.paid_at) ||
          (typeof latestOrder?.created_at === 'string' && latestOrder.created_at) ||
          null,
      }
    })

    return NextResponse.json({ agencies })
  } catch (fetchError) {
    return NextResponse.json(
      {
        error:
          fetchError instanceof Error
            ? fetchError.message
            : '고객사 목록을 불러오지 못했습니다.',
      },
      { status: 500 }
    )
  }
}
