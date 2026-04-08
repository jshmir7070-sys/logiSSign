import { NextRequest, NextResponse } from 'next/server'
import { authenticateAdmin } from '@/lib/api-auth'
import { ADMIN_SETTINGS_KEYS } from '@/lib/admin-settings'
import { getClientIp } from '@/lib/get-ip'
import { rateLimitAuth } from '@/lib/rate-limit'
import { createAdminSupabaseClient } from '@/lib/supabase'

const supabaseAdmin = createAdminSupabaseClient()
// `admin_checklist_states` is added by a later migration and may lag behind generated DB types.
// eslint-disable-next-line @typescript-eslint/no-explicit-any
const adminDb = supabaseAdmin as any

const TEAM_SCOPES = [
  { key: 'ops', label: '운영팀 체크리스트' },
  { key: 'cs', label: '고객센터 체크리스트' },
  { key: 'legal', label: '법무 체크리스트' },
  { key: 'finance', label: '재무 체크리스트' },
  { key: 'dev', label: '개발 체크리스트' },
  { key: 'drivers', label: '기사관리 체크리스트' },
] as const

type TeamScopeKey = (typeof TEAM_SCOPES)[number]['key']

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

async function loadLegacyChecklist(): Promise<ChecklistState> {
  const { data, error } = await supabaseAdmin
    .from('admin_settings')
    .select('value')
    .eq('key', ADMIN_SETTINGS_KEYS.guideChecklist)
    .maybeSingle()

  if (error) {
    return {}
  }

  return normalizeChecklistState(data?.value)
}

function isTeamScopeKey(value: unknown): value is TeamScopeKey {
  return TEAM_SCOPES.some((scope) => scope.key === value)
}

async function loadChecklistState(scopeType: 'team' | 'user', scopeKey: string): Promise<ChecklistState> {
  const { data, error } = await adminDb
    .from('admin_checklist_states')
    .select('value')
    .eq('scope_type', scopeType)
    .eq('scope_key', scopeKey)
    .maybeSingle()

  if (error) {
    if (scopeType === 'team' && scopeKey === 'ops') {
      return loadLegacyChecklist()
    }
    return {}
  }

  if (scopeType === 'team' && scopeKey === 'ops' && !data?.value) {
    return loadLegacyChecklist()
  }

  return normalizeChecklistState(data?.value)
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
    const [teamEntries, personalState] = await Promise.all([
      Promise.all(
        TEAM_SCOPES.map(async (scope) => [scope.key, await loadChecklistState('team', scope.key)] as const),
      ),
      loadChecklistState('user', auth.userId),
    ])

    const teams = Object.fromEntries(teamEntries)
    const teamLabels = Object.fromEntries(TEAM_SCOPES.map((scope) => [scope.key, scope.label]))

    return NextResponse.json({
      data: {
        teams,
        mine: personalState,
      },
      scopes: {
        teams: teamLabels,
        mineLabel: '내 담당 체크리스트',
      },
      permissions: {
        canEditTeam: auth.role === 'provider_admin',
      },
    })
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

  try {
    const body = await request.json()
    const scope = body?.scope === 'team' ? 'team' : 'mine'
    const value = normalizeChecklistState(body?.value)
    const teamKey = isTeamScopeKey(body?.scopeKey) ? body.scopeKey : 'ops'

    if (scope === 'team' && auth.role !== 'provider_admin') {
      return NextResponse.json({ error: '플랫폼 관리자만 팀별 체크리스트를 수정할 수 있습니다.' }, { status: 403 })
    }

    const scopeType = scope === 'team' ? 'team' : 'user'
    const scopeKey = scope === 'team' ? teamKey : auth.userId

    const { error: upsertError } = await adminDb.from('admin_checklist_states').upsert(
      {
        scope_type: scopeType,
        scope_key: scopeKey,
        value,
        updated_at: new Date().toISOString(),
        updated_by: auth.userId,
      },
      { onConflict: 'scope_type,scope_key' },
    )

    if (upsertError) {
      throw new Error(upsertError.message)
    }

    return NextResponse.json({ success: true, scope, scopeKey, data: value })
  } catch (updateError) {
    return NextResponse.json(
      { error: updateError instanceof Error ? updateError.message : '운영 체크리스트를 저장하지 못했습니다.' },
      { status: 500 },
    )
  }
}
