import { NextRequest, NextResponse } from 'next/server'
import { authenticateRequest } from '@/lib/api-auth'
import { createClient } from '@supabase/supabase-js'

const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!,
  { auth: { autoRefreshToken: false, persistSession: false } }
)

/**
 * POST /api/documents/upload
 * 외부문서 PDF 업로드 (service_role로 Storage 접근)
 */
export async function POST(request: NextRequest) {
  const { auth, error: authError } = await authenticateRequest(request)
  if (authError || !auth) return authError!

  try {
    const formData = await request.formData()
    const file = formData.get('file') as File | null
    const title = formData.get('title') as string | null

    if (!file || !title?.trim()) {
      return NextResponse.json({ error: '파일과 제목은 필수입니다' }, { status: 400 })
    }

    if (file.size > 10 * 1024 * 1024) {
      return NextResponse.json({ error: '파일 크기는 10MB 이하만 가능합니다' }, { status: 400 })
    }

    const agencyId = auth.agencyId
    const fileName = `${agencyId}/${Date.now()}_${file.name}`
    const buffer = Buffer.from(await file.arrayBuffer())

    // 1. Storage 업로드 (service_role — RLS 우회)
    const { error: storageErr } = await supabaseAdmin.storage
      .from('documents')
      .upload(fileName, buffer, {
        contentType: file.type || 'application/pdf',
        upsert: true,
      })

    if (storageErr) {
      console.error('[Document Upload] Storage error:', storageErr)
      return NextResponse.json({ error: '파일 업로드 실패: ' + storageErr.message }, { status: 500 })
    }

    // 2. Signed URL 생성
    const { data: urlData } = await supabaseAdmin.storage
      .from('documents')
      .createSignedUrl(fileName, 86400) // 24시간

    const fileUrl = urlData?.signedUrl ?? ''

    // 3. DB 등록
    const { data: doc, error: insertErr } = await supabaseAdmin
      .from('document_files')
      .insert({
        agency_id: agencyId,
        title: title.trim(),
        file_url: fileName, // Storage path 저장 (signed URL은 매번 생성)
        file_name: file.name,
        file_size: file.size,
        mime_type: file.type || 'application/pdf',
        status: 'draft',
      })
      .select('id')
      .single()

    if (insertErr || !doc) {
      console.error('[Document Upload] DB error:', insertErr)
      return NextResponse.json({ error: '문서 등록 실패: ' + (insertErr?.message ?? '') }, { status: 500 })
    }

    return NextResponse.json({ id: doc.id, fileUrl, error: null })
  } catch (err) {
    console.error('[Document Upload] Unexpected:', err)
    return NextResponse.json({ error: '업로드 중 오류가 발생했습니다' }, { status: 500 })
  }
}
