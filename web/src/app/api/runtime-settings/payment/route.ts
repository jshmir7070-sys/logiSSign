import { NextRequest, NextResponse } from 'next/server'
import { authenticateRequest } from '@/lib/api-auth'
import { ADMIN_SETTINGS_KEYS, buildAdminSettingsPayload } from '@/lib/admin-settings'
import { createAdminSupabaseClient } from '@/lib/supabase'
import { getClientIp } from '@/lib/get-ip'
import { rateLimitAuth } from '@/lib/rate-limit'

const supabaseAdmin = createAdminSupabaseClient()

export async function GET(request: NextRequest) {
  const ip = getClientIp(request)
  const limited = await rateLimitAuth(ip, '/api/runtime-settings/payment')
  if (limited) return limited

  const { auth, error } = await authenticateRequest(request)
  if (error || !auth) {
    return error ?? NextResponse.json({ error: '인증이 필요합니다.' }, { status: 401 })
  }

  try {
    const { data, error: fetchError } = await supabaseAdmin
      .from('admin_settings')
      .select('key, value')
      .eq('key', ADMIN_SETTINGS_KEYS.payment)
      .maybeSingle()

    if (fetchError) {
      return NextResponse.json({ error: fetchError.message }, { status: 500 })
    }

    const settings = buildAdminSettingsPayload({
      [ADMIN_SETTINGS_KEYS.payment]: data?.value,
    })

    return NextResponse.json(settings.payment)
  } catch (runtimeError) {
    return NextResponse.json(
      { error: runtimeError instanceof Error ? runtimeError.message : '결제 설정을 불러오지 못했습니다.' },
      { status: 500 },
    )
  }
}
