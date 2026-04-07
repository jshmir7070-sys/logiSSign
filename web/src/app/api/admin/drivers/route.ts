import { NextRequest, NextResponse } from 'next/server'
import { authenticateAdmin } from '@/lib/api-auth'
import { createAdminSupabaseClient } from '@/lib/supabase'
import { getClientIp } from '@/lib/get-ip'
import { rateLimitAuth } from '@/lib/rate-limit'

const supabaseAdmin = createAdminSupabaseClient()

export async function GET(request: NextRequest) {
  const ip = getClientIp(request)
  const limited = await rateLimitAuth(ip, '/api/admin/drivers')
  if (limited) return limited

  const { auth, error } = await authenticateAdmin(request)
  if (error || !auth) return error ?? NextResponse.json({ error: '인증이 필요합니다.' }, { status: 401 })

  if (auth.role !== 'provider_admin') {
    return NextResponse.json({ error: '슈퍼 관리자만 기사 목록을 조회할 수 있습니다.' }, { status: 403 })
  }

  try {
    const [driversRes, agenciesRes, contractsRes, deliveriesRes, settlementsRes] = await Promise.all([
      supabaseAdmin
        .from('drivers')
        .select('id, agency_id, user_id, name, phone, email, employee_code, driver_code, delivery_area, vehicle_number, push_token, status, created_at')
        .order('created_at', { ascending: false }),
      supabaseAdmin.from('agencies').select('id, name'),
      supabaseAdmin.from('contracts').select('driver_id, status, sent_at, signed_at'),
      supabaseAdmin.from('document_deliveries').select('driver_id, status, sent_at, viewed_at, signed_at'),
      supabaseAdmin.from('settlements').select('driver_id, year_month, status, sent_at, created_at'),
    ])

    if (driversRes.error) throw new Error(driversRes.error.message)
    if (agenciesRes.error) throw new Error(agenciesRes.error.message)
    if (contractsRes.error) throw new Error(contractsRes.error.message)
    if (deliveriesRes.error) throw new Error(deliveriesRes.error.message)
    if (settlementsRes.error) throw new Error(settlementsRes.error.message)

    const agencyMap = new Map(
      ((agenciesRes.data ?? []) as { id: string; name: string }[]).map((agency) => [agency.id, agency.name])
    )

    const pendingContractMap = new Map<string, number>()
    const lastContractActivityMap = new Map<string, string>()
    for (const contract of (contractsRes.data ?? []) as Array<Record<string, string | null>>) {
      const driverId = contract.driver_id
      if (!driverId) continue
      const status = contract.status ?? ''
      if (status === 'sent' || status === 'viewed') {
        pendingContractMap.set(driverId, (pendingContractMap.get(driverId) ?? 0) + 1)
      }
      const latest = contract.signed_at ?? contract.sent_at
      if (latest) {
        const current = lastContractActivityMap.get(driverId)
        if (!current || new Date(latest).getTime() > new Date(current).getTime()) {
          lastContractActivityMap.set(driverId, latest)
        }
      }
    }

    const pendingDocumentMap = new Map<string, number>()
    const lastDocumentActivityMap = new Map<string, string>()
    for (const delivery of (deliveriesRes.data ?? []) as Array<Record<string, string | null>>) {
      const driverId = delivery.driver_id
      if (!driverId) continue
      const status = delivery.status ?? ''
      if (status === 'sent' || status === 'delivered' || status === 'viewed') {
        pendingDocumentMap.set(driverId, (pendingDocumentMap.get(driverId) ?? 0) + 1)
      }
      const latest = delivery.signed_at ?? delivery.viewed_at ?? delivery.sent_at
      if (latest) {
        const current = lastDocumentActivityMap.get(driverId)
        if (!current || new Date(latest).getTime() > new Date(current).getTime()) {
          lastDocumentActivityMap.set(driverId, latest)
        }
      }
    }

    const latestSettlementMonthMap = new Map<string, string>()
    const lastSettlementActivityMap = new Map<string, string>()
    for (const settlement of (settlementsRes.data ?? []) as Array<Record<string, string | null>>) {
      const driverId = settlement.driver_id
      if (!driverId) continue
      if (settlement.year_month) {
        const currentMonth = latestSettlementMonthMap.get(driverId)
        if (!currentMonth || settlement.year_month > currentMonth) {
          latestSettlementMonthMap.set(driverId, settlement.year_month)
        }
      }
      const latest = settlement.sent_at ?? settlement.created_at
      if (latest) {
        const current = lastSettlementActivityMap.get(driverId)
        if (!current || new Date(latest).getTime() > new Date(current).getTime()) {
          lastSettlementActivityMap.set(driverId, latest)
        }
      }
    }

    const drivers = ((driversRes.data ?? []) as Array<Record<string, unknown>>).map((driver) => {
      const id = driver.id as string
      const lastActivityCandidates = [
        typeof driver.created_at === 'string' ? driver.created_at : null,
        lastContractActivityMap.get(id) ?? null,
        lastDocumentActivityMap.get(id) ?? null,
        lastSettlementActivityMap.get(id) ?? null,
      ].filter((value): value is string => !!value)

      const lastActivity =
        lastActivityCandidates.length > 0
          ? lastActivityCandidates.sort((a, b) => new Date(b).getTime() - new Date(a).getTime())[0]
          : null

      return {
        ...driver,
        agency_name: agencyMap.get((driver.agency_id as string) ?? '') ?? '-',
        linked: typeof driver.user_id === 'string' && driver.user_id.length > 0,
        push_enabled: typeof driver.push_token === 'string' && driver.push_token.length > 0,
        pending_contracts: pendingContractMap.get(id) ?? 0,
        pending_documents: pendingDocumentMap.get(id) ?? 0,
        latest_settlement_month: latestSettlementMonthMap.get(id) ?? null,
        last_activity_at: lastActivity,
      }
    })

    const summary = {
      totalDrivers: drivers.length,
      linkedDrivers: drivers.filter((driver) => driver.linked).length,
      pushEnabledDrivers: drivers.filter((driver) => driver.push_enabled).length,
      pendingContracts: drivers.reduce((sum, driver) => sum + driver.pending_contracts, 0),
      pendingDocuments: drivers.reduce((sum, driver) => sum + driver.pending_documents, 0),
    }

    return NextResponse.json({ drivers, summary })
  } catch (fetchError) {
    return NextResponse.json(
      { error: fetchError instanceof Error ? fetchError.message : '기사 운영 목록을 불러오지 못했습니다.' },
      { status: 500 }
    )
  }
}
