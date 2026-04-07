import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { authenticateRequest } from '@/lib/api-auth'
import { getClientIp } from '@/lib/get-ip'
import { rateLimitAuth } from '@/lib/rate-limit'
import { createSignedStorageUrl } from '@/lib/storage-reference'

const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!,
  { auth: { autoRefreshToken: false, persistSession: false } }
)

type FileType = 'signed_pdf' | 'audit_certificate' | 'template_pdf'

function isFileType(value: string): value is FileType {
  return value === 'signed_pdf' || value === 'audit_certificate' || value === 'template_pdf'
}

export async function POST(request: NextRequest) {
  const ip = getClientIp(request)
  const limited = await rateLimitAuth(ip, '/api/contracts/file-url')
  if (limited) return limited

  const { auth, error: authError } = await authenticateRequest(request)
  if (authError || !auth) return authError!

  try {
    const body = await request.json()
    const contractId = typeof body?.contractId === 'string' ? body.contractId : ''
    const fileType = typeof body?.fileType === 'string' ? body.fileType : ''

    if (!contractId || !isFileType(fileType)) {
      return NextResponse.json({ error: 'contractId와 fileType이 필요합니다' }, { status: 400 })
    }

    const { data: contract, error: contractError } = await supabaseAdmin
      .from('contracts')
      .select('id, agency_id, driver_id, signed_pdf_url, template_pdf_url')
      .eq('id', contractId)
      .single()

    if (contractError || !contract) {
      return NextResponse.json({ error: '계약서를 찾을 수 없습니다' }, { status: 404 })
    }

    if (auth.role === 'agency_admin' || auth.role === 'provider_admin') {
      if (contract.agency_id !== auth.agencyId) {
        return NextResponse.json({ error: '권한이 없습니다' }, { status: 403 })
      }
    } else if (auth.role === 'driver') {
      const { data: driver } = await supabaseAdmin
        .from('drivers')
        .select('id, agency_id')
        .eq('user_id', auth.userId)
        .maybeSingle()

      if (!driver || driver.id !== contract.driver_id || driver.agency_id !== contract.agency_id) {
        return NextResponse.json({ error: '권한이 없습니다' }, { status: 403 })
      }
    } else {
      return NextResponse.json({ error: '지원하지 않는 역할입니다' }, { status: 403 })
    }

    let reference: string | null = null
    if (fileType === 'signed_pdf') {
      reference = contract.signed_pdf_url
    } else if (fileType === 'template_pdf') {
      reference = contract.template_pdf_url
    } else {
      const { data: signature } = await supabaseAdmin
        .from('contract_signatures')
        .select('audit_certificate_url')
        .eq('contract_id', contractId)
        .order('signed_at', { ascending: false })
        .limit(1)
        .maybeSingle()

      reference = (signature?.audit_certificate_url as string | null) ?? null
    }

    if (!reference) {
      return NextResponse.json({ error: '파일이 아직 준비되지 않았습니다' }, { status: 404 })
    }

    const { url, error } = await createSignedStorageUrl(
      supabaseAdmin,
      'contracts',
      reference,
      60 * 30
    )

    if (error || !url) {
      return NextResponse.json({ error: error ?? '파일 URL 생성 실패' }, { status: 500 })
    }

    return NextResponse.json({ url, error: null })
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : '파일 URL 생성 실패' },
      { status: 500 }
    )
  }
}
