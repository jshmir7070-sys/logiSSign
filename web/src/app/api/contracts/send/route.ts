import { getClientIp } from '@/lib/get-ip'
import { apiError } from '@/lib/api-error'
import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { authenticateRequest } from '@/lib/api-auth'
import { sendContractSchema, validateInput } from '@/lib/api-schemas'
import { rateLimitAuth } from '@/lib/rate-limit'

const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!,
  { auth: { autoRefreshToken: false, persistSession: false } }
)

/** SHA-256 해시 생성 */
async function sha256(text: string): Promise<string> {
  const encoder = new TextEncoder()
  const data = encoder.encode(text)
  const hashBuffer = await crypto.subtle.digest('SHA-256', data)
  return Array.from(new Uint8Array(hashBuffer)).map(b => b.toString(16).padStart(2, '0')).join('')
}

/** HTML 특수문자 이스케이프 */
function escapeHtml(text: string): string {
  return text
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;')
}

/** 변수 치환 (RegExp 특수문자 이스케이프 + HTML 이스케이프) */
function bindVariables(content: string, data: Record<string, string>): string {
  let result = content
  for (const [key, value] of Object.entries(data)) {
    const escapedKey = key.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
    const safeValue = escapeHtml(value || '')
    result = result.replace(new RegExp(`\\{\\{${escapedKey}\\}\\}`, 'g'), safeValue)
  }
  return result
}

export async function POST(request: NextRequest) {
  const ip = getClientIp(request)
  const limited = rateLimitAuth(ip, '/api/contracts/send')
  if (limited) return limited

  const { auth, error: authError } = await authenticateRequest(request)
  if (authError) return authError

  try {
    const body = await request.json()
    const { data: validated, error: validationError } = validateInput(sendContractSchema, body)
    if (validationError || !validated) {
      return NextResponse.json({ error: validationError }, { status: 400 })
    }

    // 단건 (driverId) 또는 다건 (driverIds) 지원
    const driverIds: string[] = validated.driverIds ?? (validated.driverId ? [validated.driverId] : [])
    const { templateIds, bindingData, bindingDataMap } = validated

    if (driverIds.length === 0) {
      return NextResponse.json({ error: '기사를 1명 이상 선택하세요' }, { status: 400 })
    }

    const agencyId = auth!.agencyId
    if (!agencyId) {
      return NextResponse.json({ error: '대리점 정보가 없습니다' }, { status: 403 })
    }

    // 소속 기사 일괄 확인
    const { data: drivers } = await supabaseAdmin
      .from('drivers')
      .select('id, push_token')
      .eq('agency_id', agencyId)
      .in('id', driverIds)

    if (!drivers?.length) {
      return NextResponse.json({ error: '소속 기사가 아닙니다' }, { status: 403 })
    }
    const validDriverIds = new Set(drivers.map(d => d.id))

    // 템플릿 조회
    const { data: templates, error: fetchErr } = await supabaseAdmin
      .from('contract_templates')
      .select('id, title, content')
      .in('id', templateIds)
      .or(`agency_id.eq.${agencyId},agency_id.is.null`)

    if (fetchErr || !templates?.length) {
      return NextResponse.json({ error: '템플릿 조회 실패' }, { status: 400 })
    }

    // 전체 계약서 일괄 생성 (기사 × 템플릿)
    const contracts: Record<string, unknown>[] = []
    const pushTokens: string[] = []

    for (const did of driverIds) {
      if (!validDriverIds.has(did)) continue
      const driverBindingData = bindingDataMap?.[did] ?? bindingData ?? {}

      for (const tmpl of templates) {
        const boundContent = bindVariables((tmpl as { content: string }).content, driverBindingData)
        const contentHash = await sha256(boundContent)
        const signToken = crypto.randomUUID()

        contracts.push({
          agency_id: agencyId,
          template_id: (tmpl as { id: string }).id,
          driver_id: did,
          title: (tmpl as { title: string }).title,
          content: boundContent,
          content_hash: contentHash,
          sign_token: signToken,
          binding_data: driverBindingData,
          status: 'sent',
          sent_at: new Date().toISOString(),
        })
      }

      // 푸시 토큰 수집
      const driver = drivers.find(d => d.id === did)
      if (driver?.push_token) pushTokens.push(driver.push_token as string)
    }

    // 일괄 INSERT
    const { data: inserted, error: insertErr } = await supabaseAdmin
      .from('contracts')
      .insert(contracts as never[])
      .select('id')

    if (insertErr) {
      console.error('[ContractSend] Insert error:', insertErr)
      return NextResponse.json({ error: '계약서 생성 실패: ' + insertErr.message }, { status: 500 })
    }

    // 푸시 알림 일괄 발송 (SMS 대신 푸시)
    if (pushTokens.length > 0) {
      const pushMessages = pushTokens.map(token => ({
        to: token,
        title: '📝 계약서 도착',
        body: `${templates.length}건의 계약서가 도착했습니다. 확인 후 서명해주세요.`,
        sound: 'default' as const,
        data: { type: 'contract' },
        channelId: 'default',
      }))

      // 100건씩 배치
      for (let i = 0; i < pushMessages.length; i += 100) {
        const batch = pushMessages.slice(i, i + 100)
        try {
          await fetch('https://exp.host/--/api/v2/push/send', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
            body: JSON.stringify(batch),
          })
        } catch { /* 푸시 실패 무시 — 비치명적 */ }
      }
    }

    return NextResponse.json({ created: inserted?.length ?? 0 })
  } catch (err) {
    console.error('[ContractSend] Unexpected error:', err)
    return apiError('계약서 전송 중 오류가 발생했습니다', 500)
  }
}
