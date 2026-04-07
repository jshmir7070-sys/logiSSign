import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { authenticateAdmin } from '@/lib/api-auth'
import { rateLimitAuth } from '@/lib/rate-limit'
import { getClientIp } from '@/lib/get-ip'

const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!,
)

/**
 * GET /api/admin/plan-configs
 * 전체 플랜 설정 조회
 */
export async function GET(request: NextRequest) {
  const ip = getClientIp(request)
  const limited = await rateLimitAuth(ip, '/api/admin/plan-configs')
  if (limited) return limited

  const { auth, error } = await authenticateAdmin(request)
  if (error || !auth) return error ?? NextResponse.json({ error: '인증 실패' }, { status: 401 })

  const { data, error: fetchErr } = await supabaseAdmin
    .from('plan_configs')
    .select('*')
    .order('sort_order', { ascending: true })

  if (fetchErr) {
    console.error('[plan-configs] fetch error:', fetchErr.message)
    return NextResponse.json({ error: '플랜 설정 조회 실패' }, { status: 500 })
  }

  return NextResponse.json({ data })
}

/**
 * PATCH /api/admin/plan-configs
 * 특정 플랜 설정 수정 (provider_admin만)
 */
export async function PATCH(request: NextRequest) {
  const ip = getClientIp(request)
  const limited = await rateLimitAuth(ip, '/api/admin/plan-configs')
  if (limited) return limited

  const { auth, error } = await authenticateAdmin(request)
  if (error || !auth) return error ?? NextResponse.json({ error: '인증 실패' }, { status: 401 })

  if (auth.role !== 'provider_admin') {
    return NextResponse.json({ error: '슈퍼관리자만 플랜 설정을 변경할 수 있습니다' }, { status: 403 })
  }

  const body = await request.json()
  const { plan, label, price_monthly, max_drivers, max_admin_accounts,
    max_default_templates, max_upload_templates, features, description } = body as {
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

  // ✅ 보안: 명시적 필드 화이트리스트 (mass assignment 방지)
  const safeUpdates: Record<string, unknown> = { updated_at: new Date().toISOString() }
  if (label !== undefined) safeUpdates.label = label
  if (price_monthly !== undefined) safeUpdates.price_monthly = price_monthly
  if (max_drivers !== undefined) safeUpdates.max_drivers = max_drivers
  if (max_admin_accounts !== undefined) safeUpdates.max_admin_accounts = max_admin_accounts
  if (max_default_templates !== undefined) safeUpdates.max_default_templates = max_default_templates
  if (max_upload_templates !== undefined) safeUpdates.max_upload_templates = max_upload_templates
  if (features !== undefined) safeUpdates.features = features
  if (description !== undefined) safeUpdates.description = description

  const { error: updateErr } = await supabaseAdmin
    .from('plan_configs')
    .update(safeUpdates)
    .eq('plan', plan)

  if (updateErr) {
    console.error('[plan-configs] update error:', updateErr.message)
    return NextResponse.json({ error: '플랜 설정 업데이트 실패' }, { status: 500 })
  }

  return NextResponse.json({ success: true, plan })
}
