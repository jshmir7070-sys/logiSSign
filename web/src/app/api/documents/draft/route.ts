import { NextRequest, NextResponse } from 'next/server'
import { authenticateRequest } from '@/lib/api-auth'
import { createAdminSupabaseClient } from '@/lib/supabase'
import { rateLimitAuth } from '@/lib/rate-limit'
import { getClientIp } from '@/lib/get-ip'

const ALLOWED_MIME_TYPES = new Set([
  'application/pdf',
  'image/png',
  'image/jpeg',
  'image/jpg',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  'application/msword',
])

const ALLOWED_EXTENSIONS = new Set(['.pdf', '.png', '.jpg', '.jpeg', '.doc', '.docx'])

function buildSafeFileName(originalName: string) {
  return originalName.replace(/[^a-zA-Z0-9._-]/g, '_')
}

export async function POST(request: NextRequest) {
  const ip = getClientIp(request)
  const limited = await rateLimitAuth(ip, '/api/documents/draft')
  if (limited) return limited

  const { auth, error: authError } = await authenticateRequest(request)
  if (authError || !auth) return authError!

  try {
    const formData = await request.formData()
    const file = formData.get('file') as File | null

    if (!file) {
      return NextResponse.json({ error: '파일이 필요합니다.' }, { status: 400 })
    }

    if (file.size > 10 * 1024 * 1024) {
      return NextResponse.json({ error: '파일 크기는 10MB 이하만 가능합니다.' }, { status: 400 })
    }

    const fileExt = '.' + (file.name.split('.').pop()?.toLowerCase() ?? '')
    if (!ALLOWED_EXTENSIONS.has(fileExt)) {
      return NextResponse.json({ error: '허용되지 않는 파일 형식입니다.' }, { status: 400 })
    }

    if (file.type && !ALLOWED_MIME_TYPES.has(file.type)) {
      return NextResponse.json({ error: '허용되지 않는 MIME 형식입니다.' }, { status: 400 })
    }

    const agencyId = auth.agencyId
    const safeFileName = buildSafeFileName(file.name)
    const draftPath = `${agencyId}/drafts/${Date.now()}_${safeFileName}`
    const buffer = Buffer.from(await file.arrayBuffer())
    const supabaseAdmin = createAdminSupabaseClient()

    const { error: uploadError } = await supabaseAdmin.storage
      .from('documents')
      .upload(draftPath, buffer, {
        contentType: file.type || 'application/pdf',
        upsert: true,
      })

    if (uploadError) {
      console.error('[Document Draft] Storage upload failed:', uploadError)
      return NextResponse.json({ error: '임시 문서를 업로드하지 못했습니다.' }, { status: 500 })
    }

    const draftTitle = file.name.replace(/\.[^.]+$/, '').trim() || file.name.trim()
    const { data: row, error: insertError } = await supabaseAdmin
      .from('document_files')
      .insert({
        agency_id: agencyId,
        title: draftTitle,
        file_url: draftPath,
        file_name: file.name,
        file_size: file.size,
        mime_type: file.type || 'application/pdf',
        status: 'draft',
      })
      .select('id')
      .single()

    if (insertError || !row) {
      console.error('[Document Draft] DB insert failed:', insertError)
      await supabaseAdmin.storage.from('documents').remove([draftPath])
      return NextResponse.json({ error: '임시 문서를 생성하지 못했습니다.' }, { status: 500 })
    }

    return NextResponse.json({ id: row.id, error: null })
  } catch (error) {
    console.error('[Document Draft] Unexpected error:', error)
    return NextResponse.json({ error: '임시 문서 생성 중 오류가 발생했습니다.' }, { status: 500 })
  }
}

export async function DELETE(request: NextRequest) {
  const ip = getClientIp(request)
  const limited = await rateLimitAuth(ip, '/api/documents/draft')
  if (limited) return limited

  const { auth, error: authError } = await authenticateRequest(request)
  if (authError || !auth) return authError!

  const docId = request.nextUrl.searchParams.get('docId')
  if (!docId) {
    return NextResponse.json({ error: 'docId가 필요합니다.' }, { status: 400 })
  }

  try {
    const supabaseAdmin = createAdminSupabaseClient()
    const { data: doc, error: fetchError } = await supabaseAdmin
      .from('document_files')
      .select('id, agency_id, file_url, status')
      .eq('id', docId)
      .single()

    if (fetchError || !doc) {
      return NextResponse.json({ ok: true })
    }

    if (doc.agency_id !== auth.agencyId || doc.status !== 'draft') {
      return NextResponse.json({ ok: true })
    }

    const storagePath = typeof doc.file_url === 'string' ? doc.file_url : ''
    await supabaseAdmin.from('document_sign_fields').delete().eq('document_file_id', docId)
    await supabaseAdmin.from('document_files').delete().eq('id', docId)

    if (storagePath && !storagePath.startsWith('http')) {
      await supabaseAdmin.storage.from('documents').remove([storagePath])
    }

    return NextResponse.json({ ok: true })
  } catch (error) {
    console.error('[Document Draft] Cleanup failed:', error)
    return NextResponse.json({ error: '임시 문서를 정리하지 못했습니다.' }, { status: 500 })
  }
}
