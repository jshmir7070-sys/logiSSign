import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { authenticateAdmin } from '@/lib/api-auth'

const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!,
)

/**
 * GET /api/admin/plan-configs
 * 전체 플랜 설정 조회
 */
export async function GET(request: NextRequest) {
  const { auth, error } = await authenticateAdmin(request)
  if (error || !auth) return error ?? NextResponse.json({ error: '인증 실패' }, { status: 401 })

  const { data, error: fetchErr } = await supabaseAdmin
    .from('plan_configs')
    .select('*')
    .order('sort_order', { ascending: true })

  if (fetchErr) {
    return NextResponse.json({ error: fetchErr.message }, { status: 500 })
  }

  return NextResponse.json({ data })
}

/**
 * PATCH /api/admin/plan-configs
 * 특정 플랜 설정 수정 (provider_admin만)
 */
export async function PATCH(request: NextRequest) {
  const { auth, error } = await authenticateAdmin(request)
  if (error || !auth) return error ?? NextResponse.json({ error: '인증 실패' }, { status: 401 })

  if (auth.role !== 'provider_admin') {
    return NextResponse.json({ error: '슈퍼관리자만 플랜 설정을 변경할 수 있습니다' }, { status: 403 })
  }

  const body = await request.json()
  const { plan, ...updates } = body as {
    plan: string
    label?: string
    price_monthly?: number
    max_drivers?: number | null
    max_admin_accounts?: number
    max_default_templates?: number
    max_upload_templates?: number
    features?: Record<string, boolean>
    description?: string
  }

  if (!plan) {
    return NextResponse.json({ error: 'plan 필드는 필수입니다' }, { status: 400 })
  }

  const { error: updateErr } = await supabaseAdmin
    .from('plan_configs')
    .update({ ...updates, updated_at: new Date().toISOString() })
    .eq('plan', plan)

  if (updateErr) {
    return NextResponse.json({ error: updateErr.message }, { status: 500 })
  }

  return NextResponse.json({ success: true, plan })
}
