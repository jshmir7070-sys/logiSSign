import { NextRequest, NextResponse } from 'next/server'
import {
  ADMIN_SETTINGS_KEYS,
  buildAdminSettingsPayload,
  type AdminEmailTemplate,
  type AdminGeneralSettings,
  type AdminPaymentSettings,
} from '@/lib/admin-settings'
import { authenticateAdmin } from '@/lib/api-auth'
import { createAdminSupabaseClient } from '@/lib/supabase'
import { getClientIp } from '@/lib/get-ip'
import { rateLimitAuth } from '@/lib/rate-limit'

const supabaseAdmin = createAdminSupabaseClient()

async function loadSettings() {
  const { data, error } = await supabaseAdmin
    .from('admin_settings')
    .select('key, value')
    .in('key', Object.values(ADMIN_SETTINGS_KEYS))

  if (error) {
    throw new Error(error.message)
  }

  const rowMap = Object.fromEntries(
    ((data ?? []) as { key: string; value: unknown }[]).map((row) => [row.key, row.value])
  )

  return buildAdminSettingsPayload(rowMap)
}

export async function GET(request: NextRequest) {
  const ip = getClientIp(request)
  const limited = rateLimitAuth(ip, '/api/admin/settings')
  if (limited) return limited

  const { auth, error } = await authenticateAdmin(request)
  if (error || !auth) {
    return error ?? NextResponse.json({ error: '인증이 필요합니다.' }, { status: 401 })
  }

  try {
    return NextResponse.json(await loadSettings())
  } catch (fetchError) {
    return NextResponse.json(
      {
        error:
          fetchError instanceof Error ? fetchError.message : '설정을 불러오지 못했습니다.',
      },
      { status: 500 }
    )
  }
}

export async function PATCH(request: NextRequest) {
  const ip = getClientIp(request)
  const limited = rateLimitAuth(ip, '/api/admin/settings')
  if (limited) return limited

  const { auth, error } = await authenticateAdmin(request)
  if (error || !auth) {
    return error ?? NextResponse.json({ error: '인증이 필요합니다.' }, { status: 401 })
  }

  if (auth.role !== 'provider_admin') {
    return NextResponse.json(
      { error: '슈퍼 관리자만 관리자 설정을 변경할 수 있습니다.' },
      { status: 403 }
    )
  }

  try {
    const body = await request.json()
    const section = typeof body?.section === 'string' ? body.section : ''
    const value = body?.value

    if (
      !section ||
      !Object.values(ADMIN_SETTINGS_KEYS).includes(
        section as (typeof ADMIN_SETTINGS_KEYS)[keyof typeof ADMIN_SETTINGS_KEYS]
      )
    ) {
      return NextResponse.json({ error: '유효한 설정 섹션이 아닙니다.' }, { status: 400 })
    }

    const existing = await loadSettings()
    let normalizedValue: AdminGeneralSettings | AdminPaymentSettings | AdminEmailTemplate[]

    if (section === ADMIN_SETTINGS_KEYS.general) {
      normalizedValue = buildAdminSettingsPayload({ [ADMIN_SETTINGS_KEYS.general]: value }).general
    } else if (section === ADMIN_SETTINGS_KEYS.payment) {
      normalizedValue = buildAdminSettingsPayload({ [ADMIN_SETTINGS_KEYS.payment]: value }).payment
    } else {
      normalizedValue = buildAdminSettingsPayload({
        [ADMIN_SETTINGS_KEYS.emailTemplates]: value,
      }).emailTemplates
    }

    const mergedValue =
      section === ADMIN_SETTINGS_KEYS.general
        ? { ...existing.general, ...(normalizedValue as AdminGeneralSettings) }
        : section === ADMIN_SETTINGS_KEYS.payment
          ? { ...existing.payment, ...(normalizedValue as AdminPaymentSettings) }
          : normalizedValue

    const { error: upsertError } = await supabaseAdmin.from('admin_settings').upsert({
      key: section,
      value: mergedValue,
      updated_at: new Date().toISOString(),
      updated_by: auth.userId,
    })

    if (upsertError) {
      return NextResponse.json({ error: upsertError.message }, { status: 500 })
    }

    return NextResponse.json({ success: true, section, value: mergedValue })
  } catch (updateError) {
    return NextResponse.json(
      {
        error:
          updateError instanceof Error ? updateError.message : '설정을 저장하지 못했습니다.',
      },
      { status: 500 }
    )
  }
}
