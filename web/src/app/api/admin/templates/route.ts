import { NextRequest, NextResponse } from 'next/server'
import { authenticateAdmin } from '@/lib/api-auth'
import { createAdminSupabaseClient } from '@/lib/supabase'
import { getClientIp } from '@/lib/get-ip'
import { rateLimitAuth } from '@/lib/rate-limit'

const supabaseAdmin = createAdminSupabaseClient()
const MAX_TEMPLATE_SIZE = 20 * 1024 * 1024

function buildSafeFileName(originalName: string) {
  return originalName.replace(/[^a-zA-Z0-9._-]/g, '_')
}

function templateContentPlaceholder(title: string) {
  return `[PDF 템플릿] ${title}`
}

function normalizeCategory(value: string | null) {
  const trimmed = value?.trim() ?? ''
  return trimmed.length > 0 ? trimmed : null
}

export async function GET(request: NextRequest) {
  const ip = getClientIp(request)
  const limited = await rateLimitAuth(ip, '/api/admin/templates')
  if (limited) return limited

  const { auth, error } = await authenticateAdmin(request)
  if (error || !auth) return error!

  if (auth.role !== 'provider_admin') {
    return NextResponse.json({ error: '플랫폼 관리자만 기본 템플릿을 관리할 수 있습니다.' }, { status: 403 })
  }

  const { data, error: fetchError } = await supabaseAdmin
    .from('contract_templates')
    .select('id, title, category, is_active, created_at, template_pdf_url, template_type, is_system')
    .is('agency_id', null)
    .order('created_at', { ascending: true })

  if (fetchError) {
    return NextResponse.json({ error: fetchError.message }, { status: 500 })
  }

  return NextResponse.json({
    templates: ((data ?? []) as Record<string, unknown>[]).map((row) => ({
      id: row.id,
      title: row.title,
      category: row.category ?? null,
      is_active: row.is_active ?? true,
      created_at: row.created_at,
      template_pdf_url: row.template_pdf_url ?? null,
      template_type: row.template_type ?? null,
      is_system: row.is_system ?? true,
    })),
  })
}

export async function POST(request: NextRequest) {
  const ip = getClientIp(request)
  const limited = await rateLimitAuth(ip, '/api/admin/templates')
  if (limited) return limited

  const { auth, error } = await authenticateAdmin(request)
  if (error || !auth) return error!

  if (auth.role !== 'provider_admin') {
    return NextResponse.json({ error: '플랫폼 관리자만 기본 템플릿을 등록할 수 있습니다.' }, { status: 403 })
  }

  try {
    const formData = await request.formData()
    const file = formData.get('file')
    const title = String(formData.get('title') ?? '').trim()
    const category = normalizeCategory(String(formData.get('category') ?? ''))

    if (!(file instanceof File)) {
      return NextResponse.json({ error: 'PDF 파일을 선택해 주세요.' }, { status: 400 })
    }

    if (!title) {
      return NextResponse.json({ error: '템플릿 이름을 입력해 주세요.' }, { status: 400 })
    }

    const fileExt = `.${file.name.split('.').pop()?.toLowerCase() ?? ''}`
    if (fileExt !== '.pdf' || file.type !== 'application/pdf') {
      return NextResponse.json({ error: '기본 템플릿은 PDF 파일만 업로드할 수 있습니다.' }, { status: 400 })
    }

    if (file.size > MAX_TEMPLATE_SIZE) {
      return NextResponse.json({ error: '파일 크기는 20MB 이하만 업로드할 수 있습니다.' }, { status: 400 })
    }

    const safeFileName = buildSafeFileName(file.name)
    const storagePath = `system/${Date.now()}_${safeFileName}`
    const buffer = Buffer.from(await file.arrayBuffer())

    const { error: uploadError } = await supabaseAdmin.storage
      .from('contracts')
      .upload(storagePath, buffer, {
        contentType: 'application/pdf',
        upsert: false,
      })

    if (uploadError) {
      return NextResponse.json({ error: 'PDF 파일을 업로드하지 못했습니다.' }, { status: 500 })
    }

    const insertPayload = {
      agency_id: null,
      principal_id: null,
      title,
      content: templateContentPlaceholder(title),
      category,
      is_active: true,
      is_system: true,
      template_type: 'pdf',
      template_pdf_url: storagePath,
      sign_fields: [],
    } as Record<string, unknown>

    const { data, error: insertError } = await supabaseAdmin
      .from('contract_templates')
      .insert(insertPayload as never)
      .select('id, title, category, is_active, created_at, template_pdf_url, template_type, is_system')
      .single()

    if (insertError || !data) {
      await supabaseAdmin.storage.from('contracts').remove([storagePath])
      return NextResponse.json({ error: insertError?.message ?? '기본 템플릿을 저장하지 못했습니다.' }, { status: 500 })
    }

    return NextResponse.json({ template: data })
  } catch (uploadError) {
    return NextResponse.json(
      { error: uploadError instanceof Error ? uploadError.message : '기본 템플릿 등록 중 오류가 발생했습니다.' },
      { status: 500 },
    )
  }
}

export async function PATCH(request: NextRequest) {
  const ip = getClientIp(request)
  const limited = await rateLimitAuth(ip, '/api/admin/templates')
  if (limited) return limited

  const { auth, error } = await authenticateAdmin(request)
  if (error || !auth) return error!

  if (auth.role !== 'provider_admin') {
    return NextResponse.json({ error: '플랫폼 관리자만 기본 템플릿을 수정할 수 있습니다.' }, { status: 403 })
  }

  try {
    const body = (await request.json()) as {
      id?: string
      title?: string
      category?: string | null
      is_active?: boolean
    }

    if (!body.id) {
      return NextResponse.json({ error: '템플릿 ID가 필요합니다.' }, { status: 400 })
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

    const { data, error: updateError } = await supabaseAdmin
      .from('contract_templates')
      .update(updatePayload as never)
      .eq('id', body.id)
      .is('agency_id', null)
      .select('id, title, category, is_active, created_at, template_pdf_url, template_type, is_system')
      .single()

    if (updateError || !data) {
      return NextResponse.json({ error: updateError?.message ?? '기본 템플릿을 수정하지 못했습니다.' }, { status: 500 })
    }

    return NextResponse.json({ template: data })
  } catch (updateError) {
    return NextResponse.json(
      { error: updateError instanceof Error ? updateError.message : '기본 템플릿 수정 중 오류가 발생했습니다.' },
      { status: 500 },
    )
  }
}

export async function DELETE(request: NextRequest) {
  const ip = getClientIp(request)
  const limited = await rateLimitAuth(ip, '/api/admin/templates')
  if (limited) return limited

  const { auth, error } = await authenticateAdmin(request)
  if (error || !auth) return error!

  if (auth.role !== 'provider_admin') {
    return NextResponse.json({ error: '플랫폼 관리자만 기본 템플릿을 삭제할 수 있습니다.' }, { status: 403 })
  }

  const templateId = request.nextUrl.searchParams.get('id')
  if (!templateId) {
    return NextResponse.json({ error: '템플릿 ID가 필요합니다.' }, { status: 400 })
  }

  const { data: existing, error: fetchError } = await supabaseAdmin
    .from('contract_templates')
    .select('id, template_pdf_url')
    .eq('id', templateId)
    .is('agency_id', null)
    .single()

  if (fetchError || !existing) {
    return NextResponse.json({ error: '삭제할 기본 템플릿을 찾을 수 없습니다.' }, { status: 404 })
  }

  const templatePdfUrl = (existing as Record<string, unknown>).template_pdf_url as string | null

  const { error: deleteError } = await supabaseAdmin
    .from('contract_templates')
    .delete()
    .eq('id', templateId)
    .is('agency_id', null)

  if (deleteError) {
    return NextResponse.json({ error: deleteError.message }, { status: 500 })
  }

  if (templatePdfUrl) {
    const { count } = await supabaseAdmin
      .from('contract_templates')
      .select('id', { count: 'exact', head: true })
      .eq('template_pdf_url', templatePdfUrl)

    if (!count) {
      await supabaseAdmin.storage.from('contracts').remove([templatePdfUrl])
    }
  }

  return NextResponse.json({ ok: true })
}
