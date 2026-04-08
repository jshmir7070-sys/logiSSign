import { NextRequest, NextResponse } from 'next/server'
import { authenticateAdmin } from '@/lib/api-auth'
import { ADMIN_SETTINGS_KEYS } from '@/lib/admin-settings'
import { getClientIp } from '@/lib/get-ip'
import { rateLimitAuth } from '@/lib/rate-limit'
import { createAdminSupabaseClient } from '@/lib/supabase'

const supabaseAdmin = createAdminSupabaseClient()

type ChecklistState = Record<string, boolean>

function normalizeChecklistState(value: unknown): ChecklistState {
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    return {}
  }

  return Object.fromEntries(
    Object.entries(value as Record<string, unknown>).filter(
      ([key, entry]) => key.trim().length > 0 && typeof entry === 'boolean',
    ),
  ) as ChecklistState
}

export async function GET(request: NextRequest) {
  const ip = getClientIp(request)
  const limited = await rateLimitAuth(ip, '/api/admin/guide-checklist')
  if (limited) return limited

  const { auth, error } = await authenticateAdmin(request)
  if (error || !auth) {
    return error ?? NextResponse.json({ error: '인증이 필요합니다.' }, { status: 401 })
  }

  try {
    const { data, error: fetchError } = await supabaseAdmin
      .from('admin_settings')
      .select('value')
      .eq('key', ADMIN_SETTINGS_KEYS.guideChecklist)
      .maybeSingle()

    if (fetchError) throw new Error(fetchError.message)

    return NextResponse.json({ data: normalizeChecklistState(data?.value) })
  } catch (fetchError) {
    return NextResponse.json(
      { error: fetchError instanceof Error ? fetchError.message : '운영 체크리스트를 불러오지 못했습니다.' },
      { status: 500 },
    )
  }
}

export async function PATCH(request: NextRequest) {
  const ip = getClientIp(request)
  const limited = await rateLimitAuth(ip, '/api/admin/guide-checklist')
  if (limited) return limited

  const { auth, error } = await authenticateAdmin(request)
  if (error || !auth) {
    return error ?? NextResponse.json({ error: '인증이 필요합니다.' }, { status: 401 })
  }

  if (auth.role !== 'provider_admin') {
    return NextResponse.json({ error: '플랫폼 관리자만 운영 체크리스트를 수정할 수 있습니다.' }, { status: 403 })
  }

  try {
    const body = await request.json()
    const value = normalizeChecklistState(body?.value)

    const { error: upsertError } = await supabaseAdmin.from('admin_settings').upsert({
      key: ADMIN_SETTINGS_KEYS.guideChecklist,
      value,
      updated_at: new Date().toISOString(),
      updated_by: auth.userId,
    })

    if (upsertError) throw new Error(upsertError.message)

    return NextResponse.json({ success: true, data: value })
  } catch (updateError) {
    return NextResponse.json(
      { error: updateError instanceof Error ? updateError.message : '운영 체크리스트를 저장하지 못했습니다.' },
      { status: 500 },
    )
  }
}
