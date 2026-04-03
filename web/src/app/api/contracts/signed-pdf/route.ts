import { NextRequest, NextResponse } from 'next/server'
import { authenticateRequest } from '@/lib/api-auth'
import { generateSignedPdf } from '@/services/signed-pdf.service'
import { createClient } from '@supabase/supabase-js'
import { signedPdfSchema, validateInput } from '@/lib/api-schemas'

const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!,
  { auth: { autoRefreshToken: false, persistSession: false } }
)

export const dynamic = 'force-dynamic'
export const maxDuration = 60

/** POST /api/contracts/signed-pdf — 서명 완료 계약서 PDF 생성 */
export async function POST(request: NextRequest) {
  const { auth, error } = await authenticateRequest(request)
  if (error) return error

  try {
    const rawBody = await request.json().catch(() => ({}))
    const { data: body, error: validationError } = validateInput(signedPdfSchema, rawBody)
    if (validationError || !body) {
      return NextResponse.json({ error: validationError ?? '계약서 ID가 필요합니다' }, { status: 400 })
    }

    const { contractId } = body

    // ✅ 보안: 계약서가 요청자의 agency 소속인지 확인
    const { data: contract } = await supabaseAdmin
      .from('contracts')
      .select('agency_id')
      .eq('id', contractId)
      .single()

    if (!contract || contract.agency_id !== auth!.agencyId) {
      return NextResponse.json({ error: '권한이 없습니다' }, { status: 403 })
    }

    const result = await generateSignedPdf(contractId)

    if (result.error) {
      return NextResponse.json({ url: null, error: result.error }, { status: 500 })
    }

    return NextResponse.json({ url: result.url, error: null })
  } catch (err) {
    return NextResponse.json(
      { url: null, error: err instanceof Error ? err.message : 'PDF 생성 실패' },
      { status: 500 }
    )
  }
}
