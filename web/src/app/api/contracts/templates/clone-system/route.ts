import { NextRequest, NextResponse } from 'next/server'
import { authenticateRequest } from '@/lib/api-auth'
import { createAdminSupabaseClient } from '@/lib/supabase'
import { getClientIp } from '@/lib/get-ip'
import { rateLimitAuth } from '@/lib/rate-limit'

const supabaseAdmin = createAdminSupabaseClient()

export async function POST(request: NextRequest) {
  const ip = getClientIp(request)
  const limited = await rateLimitAuth(ip, '/api/contracts/templates/clone-system')
  if (limited) return limited

  const { auth, error } = await authenticateRequest(request)
  if (error || !auth) return error!

  try {
    const body = (await request.json()) as { templateId?: string }
    const templateId = body.templateId?.trim()

    if (!templateId) {
      return NextResponse.json({ error: '템플릿 ID가 필요합니다.' }, { status: 400 })
    }

    const { data: existingTemplate, error: fetchError } = await supabaseAdmin
      .from('contract_templates')
      .select('id, agency_id, principal_id, title, content, category, is_active, is_system, template_type, template_pdf_url, sign_fields')
      .eq('id', templateId)
      .single()

    if (fetchError || !existingTemplate) {
      return NextResponse.json({ error: '템플릿을 찾을 수 없습니다.' }, { status: 404 })
    }

    const row = existingTemplate as Record<string, unknown>
    const templateAgencyId = row.agency_id as string | null
    const isSystemTemplate = templateAgencyId === null || row.is_system === true

    if (!isSystemTemplate) {
      if (templateAgencyId !== auth.agencyId) {
        return NextResponse.json({ error: '이 템플릿을 편집할 권한이 없습니다.' }, { status: 403 })
      }

      return NextResponse.json({ templateId, reused: true, cloned: false })
    }

    const { data: agencyOwnedCandidates } = await supabaseAdmin
      .from('contract_templates')
      .select('id, template_pdf_url, content')
      .eq('agency_id', auth.agencyId)
      .eq('title', row.title as string)
      .order('created_at', { ascending: false })

    const matchedExisting = ((agencyOwnedCandidates ?? []) as Record<string, unknown>[]).find((candidate) => (
      ((candidate.template_pdf_url as string | null) ?? null) === ((row.template_pdf_url as string | null) ?? null)
      && ((candidate.content as string | null) ?? '') === ((row.content as string | null) ?? '')
    ))

    if (matchedExisting?.id) {
      return NextResponse.json({ templateId: matchedExisting.id, reused: true, cloned: false })
    }

    const clonePayload = {
      agency_id: auth.agencyId,
      principal_id: row.principal_id ?? null,
      title: row.title,
      content: row.content,
      category: row.category ?? null,
      is_active: true,
      is_system: false,
      template_type: row.template_type ?? null,
      template_pdf_url: row.template_pdf_url ?? null,
      sign_fields: Array.isArray(row.sign_fields) ? row.sign_fields : [],
    } as Record<string, unknown>

    const { data: clonedTemplate, error: insertError } = await supabaseAdmin
      .from('contract_templates')
      .insert(clonePayload as never)
      .select('id')
      .single()

    if (insertError || !clonedTemplate) {
      return NextResponse.json({ error: insertError?.message ?? '템플릿 복제에 실패했습니다.' }, { status: 500 })
    }

    return NextResponse.json({ templateId: clonedTemplate.id, reused: false, cloned: true })
  } catch (cloneError) {
    return NextResponse.json(
      { error: cloneError instanceof Error ? cloneError.message : '템플릿 복제 중 오류가 발생했습니다.' },
      { status: 500 },
    )
  }
}
