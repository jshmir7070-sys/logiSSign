import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { authenticateAdmin } from '@/lib/api-auth'
import { rateLimitAuth } from '@/lib/rate-limit'
import { getClientIp } from '@/lib/get-ip'

const supabaseAdmin = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!)

const VALID_PLANS = ['free', 'basic', 'standard', 'pro', 'enterprise']

/**
 * POST /api/admin/plan-change
 * 플랫폼 관리자가 특정 고객사의 플랜을 강제로 변경합니다.
 * 아래 3곳을 함께 갱신합니다.
 * - agencies.plan
 * - subscriptions.plan
 * - 해당 고객사 소속 계정의 app_metadata.plan
 */
export async function POST(request: NextRequest) {
  const ip = getClientIp(request)
  const limited = await rateLimitAuth(ip, '/api/admin/plan-change')
  if (limited) return limited

  const { auth, error } = await authenticateAdmin(request)
  if (error || !auth) {
    return error ?? NextResponse.json({ error: '인증에 실패했습니다.' }, { status: 401 })
  }

  if (auth.role !== 'provider_admin') {
    return NextResponse.json({ error: '플랫폼 관리자만 고객사 플랜을 변경할 수 있습니다.' }, { status: 403 })
  }

  const body = await request.json()
  const { agencyId, newPlan, reason } = body as { agencyId?: string; newPlan?: string; reason?: string }

  if (!agencyId || !newPlan) {
    return NextResponse.json({ error: 'agencyId와 newPlan은 필수입니다.' }, { status: 400 })
  }

  if (!VALID_PLANS.includes(newPlan)) {
    return NextResponse.json({ error: `유효하지 않은 플랜입니다: ${newPlan}` }, { status: 400 })
  }

  const { data: agency, error: agencyError } = await supabaseAdmin
    .from('agencies')
    .select('id, plan, name')
    .eq('id', agencyId)
    .single()

  if (agencyError || !agency) {
    return NextResponse.json({ error: '고객사를 찾을 수 없습니다.' }, { status: 404 })
  }

  const oldPlan = (agency as Record<string, string>).plan
  if (oldPlan === newPlan) {
    return NextResponse.json({ error: '현재 플랜과 동일합니다.' }, { status: 400 })
  }

  const { error: updateError } = await supabaseAdmin.from('agencies').update({ plan: newPlan }).eq('id', agencyId)

  if (updateError) {
    console.error('[PlanChange] 고객사 플랜 변경 실패:', updateError.message)
    return NextResponse.json({ error: '고객사 플랜을 변경하지 못했습니다.' }, { status: 500 })
  }

  await supabaseAdmin
    .from('subscriptions')
    .update({ plan: newPlan, updated_at: new Date().toISOString() })
    .eq('agency_id', agencyId)

  const metadataErrors: string[] = []
  let updatedUsers = 0
  let page = 1
  const perPage = 100
  let hasMore = true

  while (hasMore) {
    const { data: userPage } = await supabaseAdmin.auth.admin.listUsers({ page, perPage })
    const users = userPage?.users ?? []
    const agencyUsers = users.filter((user) => user.app_metadata?.agency_id === agencyId)

    updatedUsers += agencyUsers.length

    for (const user of agencyUsers) {
      const { error: metadataError } = await supabaseAdmin.auth.admin.updateUserById(user.id, {
        app_metadata: { ...user.app_metadata, plan: newPlan },
      })

      if (metadataError) {
        metadataErrors.push(`${user.id}: ${metadataError.message}`)
      }
    }

    hasMore = users.length === perPage
    page += 1
  }

  await supabaseAdmin.from('plan_change_log').insert({
    agency_id: agencyId,
    old_plan: oldPlan,
    new_plan: newPlan,
    changed_by: auth.userId,
    change_type: 'admin_override',
    reason: reason || null,
  })

  return NextResponse.json({
    success: true,
    agencyId,
    oldPlan,
    newPlan,
    usersUpdated: updatedUsers,
    metadataErrors: metadataErrors.length > 0 ? metadataErrors : undefined,
  })
}
