import { NextRequest, NextResponse } from 'next/server'
import { authenticateAdmin } from '@/lib/api-auth'
import { createAdminSupabaseClient } from '@/lib/supabase'
import { getClientIp } from '@/lib/get-ip'
import { rateLimitAuth } from '@/lib/rate-limit'

const supabaseAdmin = createAdminSupabaseClient()

function normalizeCategory(value: string | null) {
  const trimmed = value?.trim() ?? ''
  return trimmed.length > 0 ? trimmed : null
}

function templateContentPlaceholder(title: string) {
  return `[PDF 템플릿] ${title}`
}

/**
 * PUT /api/admin/templates/[id]
 * 기본 템플릿 수정 (title, category, is_active)
 */
export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const ip = getClientIp(request)
  const limited = await rateLimitAuth(ip, '/api/admin/templates/[id]')
  if (limited) return limited

  const { auth, error } = await authenticateAdmin(request)
  if (error || !auth) return error!

  if (auth.role !== 'provider_admin') {
    return NextResponse.json(
      { error: '플랫폼 관리자만 기본 템플릿을 수정할 수 있습니다.' },
      { status: 403 }
    )
  }

  const { id: templateId } = await params

  try {
    const body = (await request.json()) as {
      title?: string
      category?: string | null
      is_active?: boolean
    }

    const updatePayload: Record<string, unknown> = {}

    if (typeof body.title === 'string' && body.title.trim()) {
      updatePayload.title = body.title.trim()
      updatePayload.content = templateContentPlaceholder(body.title.trim())
    }
    if ('category' in body) {
      updatePayload.category = normalizeCategory(body.category ?? null)
    }
    if (typeof body.is_active === 'boolean') {
      updatePayload.is_active = body.is_active
    }

    if (Object.keys(updatePayload).length === 0) {
      return NextResponse.json(
        { error: '수정할 항목이 없습니다.' },
        { status: 400 }
      )
    }

    const { data, error: updateError } = await supabaseAdmin
      .from('contract_templates')
      .update(updatePayload as never)
      .eq('id', templateId)
      .is('agency_id', null)
      .select('id, title, category, is_active, created_at, template_pdf_url, template_type, is_system')
      .single()

    if (updateError || !data) {
      return NextResponse.json(
        { error: updateError?.message ?? '기본 템플릿을 수정하지 못했습니다.' },
        { status: 500 }
      )
    }

    return NextResponse.json({ template: data })
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : '기본 템플릿 수정 중 오류가 발생했습니다.' },
      { status: 500 }
    )
  }
}

/**
 * DELETE /api/admin/templates/[id]
 * 기본 템플릿 소프트 삭제 (is_active = false)
 */
export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const ip = getClientIp(request)
  const limited = await rateLimitAuth(ip, '/api/admin/templates/[id]')
  if (limited) return limited

  const { auth, error } = await authenticateAdmin(request)
  if (error || !auth) return error!

  if (auth.role !== 'provider_admin') {
    return NextResponse.json(
      { error: '플랫폼 관리자만 기본 템플릿을 삭제할 수 있습니다.' },
      { status: 403 }
    )
  }

  const { id: templateId } = await params

  const { data, error: updateError } = await supabaseAdmin
    .from('contract_templates')
    .update({ is_active: false } as never)
    .eq('id', templateId)
    .is('agency_id', null)
    .select('id, title, is_active')
    .single()

  if (updateError || !data) {
    return NextResponse.json(
      { error: updateError?.message ?? '템플릿을 비활성화하지 못했습니다.' },
      { status: 404 }
    )
  }

  return NextResponse.json({ ok: true, template: data })
}
