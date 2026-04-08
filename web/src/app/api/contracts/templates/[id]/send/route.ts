import { NextRequest, NextResponse } from 'next/server'
import { authenticateAdmin } from '@/lib/api-auth'
import { createAdminSupabaseClient } from '@/lib/supabase'
import { getClientIp } from '@/lib/get-ip'
import { rateLimitAuth } from '@/lib/rate-limit'

const supabaseAdmin = createAdminSupabaseClient()

/**
 * POST /api/contracts/templates/[id]/send
 * 템플릿에서 계약서를 생성하여 기사(들)에게 전송
 *
 * Request body:
 *   { driver_ids: string[] }
 *
 * Response:
 *   { contract_ids: string[] }
 */
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const ip = getClientIp(request)
  const limited = await rateLimitAuth(ip, '/api/contracts/templates/[id]/send')
  if (limited) return limited

  const { auth, error } = await authenticateAdmin(request)
  if (error || !auth) return error!

  const { id: templateId } = await params

  try {
    // 1. 템플릿 조회
    const { data: template, error: templateError } = await supabaseAdmin
      .from('contract_templates')
      .select('id, title, content, category, is_active, template_pdf_url, template_type, sign_fields, agency_id')
      .eq('id', templateId)
      .single()

    if (templateError || !template) {
      return NextResponse.json(
        { error: '템플릿을 찾을 수 없습니다.' },
        { status: 404 }
      )
    }

    const tmpl = template as Record<string, unknown>

    if (tmpl.is_active === false) {
      return NextResponse.json(
        { error: '비활성화된 템플릿입니다.' },
        { status: 400 }
      )
    }

    // 2. Body 파싱
    const body = (await request.json()) as { driver_ids?: string[] }
    const driverIds = body.driver_ids

    if (!Array.isArray(driverIds) || driverIds.length === 0) {
      return NextResponse.json(
        { error: 'driver_ids 배열이 필요합니다.' },
        { status: 400 }
      )
    }

    // 3. 각 기사에 대해 계약서 레코드 생성
    const now = new Date().toISOString()
    const contractRows = driverIds.map((driverId) => ({
      template_id: templateId,
      agency_id: tmpl.agency_id ?? auth.agencyId,
      driver_id: driverId,
      title: tmpl.title,
      content: tmpl.content,
      category: tmpl.category ?? null,
      status: 'sent',
      sent_at: now,
      template_pdf_url: tmpl.template_pdf_url ?? null,
      template_type: tmpl.template_type ?? null,
      sign_fields: tmpl.sign_fields ?? [],
      created_by: auth.userId,
    }))

    const { data: contracts, error: insertError } = await supabaseAdmin
      .from('contracts')
      .insert(contractRows as never)
      .select('id')

    if (insertError || !contracts) {
      return NextResponse.json(
        { error: insertError?.message ?? '계약서 생성에 실패했습니다.' },
        { status: 500 }
      )
    }

    const contractIds = (contracts as { id: string }[]).map((c) => c.id)

    return NextResponse.json({ contract_ids: contractIds })
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : '계약서 전송 중 오류가 발생했습니다.' },
      { status: 500 }
    )
  }
}
