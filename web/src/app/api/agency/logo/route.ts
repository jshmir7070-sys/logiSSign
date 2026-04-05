import { NextRequest, NextResponse } from 'next/server'
import { authenticateRequest } from '@/lib/api-auth'
import { createClient } from '@supabase/supabase-js'
import { rateLimitAuth } from '@/lib/rate-limit'
import { getClientIp } from '@/lib/get-ip'

const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!,
  { auth: { autoRefreshToken: false, persistSession: false } }
)

/** POST /api/agency/logo — 운영사 로고 업로드 */
export async function POST(request: NextRequest) {
  const ip = getClientIp(request)
  const limited = rateLimitAuth(ip, '/api/agency/logo')
  if (limited) return limited

  const { auth, error: authError } = await authenticateRequest(request)
  if (authError || !auth) return authError!

  try {
    const formData = await request.formData()
    const file = formData.get('file') as File | null
    if (!file || !file.type.startsWith('image/')) {
      return NextResponse.json({ error: '이미지 파일만 업로드 가능합니다' }, { status: 400 })
    }
    if (file.size > 2 * 1024 * 1024) {
      return NextResponse.json({ error: '2MB 이하만 가능합니다' }, { status: 400 })
    }

    const agencyId = auth.agencyId
    const ext = file.name.split('.').pop()?.replace(/[^a-zA-Z0-9]/g, '') ?? 'png'
    const path = `${agencyId}/logo.${ext}`
    const buffer = Buffer.from(await file.arrayBuffer())

    // Storage 업로드 (service_role)
    const { error: uploadErr } = await supabaseAdmin.storage
      .from('documents')
      .upload(path, buffer, { contentType: file.type, upsert: true })

    if (uploadErr) {
      return NextResponse.json({ error: '업로드 실패: ' + uploadErr.message }, { status: 500 })
    }

    // Signed URL 생성 (장기 — 10년)
    const { data: signedData } = await supabaseAdmin.storage
      .from('documents')
      .createSignedUrl(path, 60 * 60 * 24 * 365 * 10)

    const logoUrl = signedData?.signedUrl ?? ''

    // agencies.logo_url 업데이트
    await supabaseAdmin.from('agencies').update({ logo_url: logoUrl }).eq('id', agencyId)

    return NextResponse.json({ logoUrl, error: null })
  } catch (err) {
    return NextResponse.json({ error: '로고 업로드 실패' }, { status: 500 })
  }
}
