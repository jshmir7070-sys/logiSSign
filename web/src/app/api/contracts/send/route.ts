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

    const { driverId, templateIds, bindingData } = validated

    // 인증된 사용자의 agencyId 사용
    const agencyId = auth!.agencyId
    if (!agencyId) {
      return NextResponse.json({ error: '대리점 정보가 없습니다' }, { status: 403 })
    }

    // 소속 기사 확인
    const { data: driver } = await supabaseAdmin
      .from('drivers')
      .select('id, agency_id')
      .eq('id', driverId)
      .eq('agency_id', agencyId)
      .single()

    if (!driver) {
      return NextResponse.json({ error: '소속 기사가 아닙니다' }, { status: 403 })
    }

    // 1. 템플릿 조회 (소속 대리점 것 + 시스템 공용 템플릿)
    const { data: templates, error: fetchErr } = await supabaseAdmin
      .from('contract_templates')
      .select('id, title, content')
      .in('id', templateIds)
      .or(`agency_id.eq.${agencyId},agency_id.is.null`)

    if (fetchErr || !templates?.length) {
      return NextResponse.json({ error: '템플릿 조회 실패' }, { status: 400 })
    }

    // 2. 계약서 생성
    const contracts = []
    for (const tmpl of templates) {
      const boundContent = bindVariables((tmpl as { content: string }).content, bindingData ?? {})
      const contentHash = await sha256(boundContent)
      const signToken = crypto.randomUUID()

      contracts.push({
        agency_id: agencyId,
        template_id: (tmpl as { id: string }).id,
        driver_id: driverId,
        title: (tmpl as { title: string }).title,
        content: boundContent,
        content_hash: contentHash,
        sign_token: signToken,
        binding_data: bindingData ?? null,
        status: 'sent',
        sent_at: new Date().toISOString(),
      })
    }

    const { data: inserted, error: insertErr } = await supabaseAdmin
      .from('contracts')
      .insert(contracts as never[])
      .select('id')

    if (insertErr) {
      console.error('[ContractSend] Insert error:', insertErr)
      return NextResponse.json({ error: '계약서 생성 실패: ' + insertErr.message }, { status: 500 })
    }

    return NextResponse.json({ created: inserted?.length ?? 0 })
  } catch (err) {
    console.error('[ContractSend] Unexpected error:', err)
    return apiError('계약서 전송 중 오류가 발생했습니다', 500)
  }
}
