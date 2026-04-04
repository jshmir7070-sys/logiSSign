import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { authenticateAdmin } from '@/lib/api-auth'

const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!,
)

const VALID_PLANS = ['free', 'basic', 'standard', 'pro', 'enterprise']

/**
 * POST /api/admin/plan-change
 * 관리자가 특정 대리점의 플랜을 변경합니다.
 * 3곳 동시 업데이트: agencies.plan, subscriptions.plan, 모든 유저 app_metadata.plan
 */
export async function POST(request: NextRequest) {
  const { auth, error } = await authenticateAdmin(request)
  if (error || !auth) return error ?? NextResponse.json({ error: '인증 실패' }, { status: 401 })

  // provider_admin만 허용
  if (auth.role !== 'provider_admin') {
    return NextResponse.json({ error: '슈퍼관리자만 플랜을 변경할 수 있습니다' }, { status: 403 })
  }

  const body = await request.json()
  const { agencyId, newPlan, reason } = body as {
    agencyId?: string
    newPlan?: string
    reason?: string
  }

  if (!agencyId || !newPlan) {
    return NextResponse.json({ error: 'agencyId와 newPlan은 필수입니다' }, { status: 400 })
  }

  if (!VALID_PLANS.includes(newPlan)) {
    return NextResponse.json({ error: `유효하지 않은 플랜: ${newPlan}` }, { status: 400 })
  }

  // 1. 현재 대리점 정보 조회
  const { data: agency, error: agencyErr } = await supabaseAdmin
    .from('agencies')
    .select('id, plan, name')
    .eq('id', agencyId)
    .single()

  if (agencyErr || !agency) {
    return NextResponse.json({ error: '대리점을 찾을 수 없습니다' }, { status: 404 })
  }

  const oldPlan = (agency as Record<string, string>).plan

  if (oldPlan === newPlan) {
    return NextResponse.json({ error: '현재 플랜과 동일합니다' }, { status: 400 })
  }

  // 2. agencies.plan 업데이트
  const { error: updateErr } = await supabaseAdmin
    .from('agencies')
    .update({ plan: newPlan })
    .eq('id', agencyId)

  if (updateErr) {
    return NextResponse.json({ error: '대리점 플랜 업데이트 실패: ' + updateErr.message }, { status: 500 })
  }

  // 3. subscriptions.plan 업데이트 (있는 경우)
  await supabaseAdmin
    .from('subscriptions')
    .update({ plan: newPlan, updated_at: new Date().toISOString() })
    .eq('agency_id', agencyId)

  // 4. 해당 대리점 소속 모든 유저의 app_metadata.plan 업데이트
  const { data: users } = await supabaseAdmin.auth.admin.listUsers({ perPage: 1000 })
  const agencyUsers = (users?.users ?? []).filter(
    u => u.app_metadata?.agency_id === agencyId
  )

  const metadataErrors: string[] = []
  for (const u of agencyUsers) {
    const { error: metaErr } = await supabaseAdmin.auth.admin.updateUserById(u.id, {
      app_metadata: { ...u.app_metadata, plan: newPlan },
    })
    if (metaErr) metadataErrors.push(`${u.id}: ${metaErr.message}`)
  }

  // 5. 감사 로그 기록
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
    usersUpdated: agencyUsers.length,
    metadataErrors: metadataErrors.length > 0 ? metadataErrors : undefined,
  })
}
