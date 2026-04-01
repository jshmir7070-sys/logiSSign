import { NextRequest, NextResponse } from 'next/server'
import { authenticateRequest } from '@/lib/api-auth'
import { generateSignedPdf } from '@/services/signed-pdf.service'

export const dynamic = 'force-dynamic'
export const maxDuration = 60

/** POST /api/contracts/signed-pdf — 서명 완료 계약서 PDF 생성 */
export async function POST(request: NextRequest) {
  const { auth, error } = await authenticateRequest(request)
  if (error) return error

  try {
    const body = await request.json().catch(() => ({}))
    const contractId = body?.contractId as string | undefined

    if (!contractId || typeof contractId !== 'string') {
      return NextResponse.json(
        { error: '계약서 ID가 필요합니다' },
        { status: 400 }
      )
    }

    const result = await generateSignedPdf(contractId)

    if (result.error) {
      return NextResponse.json(
        { url: null, error: result.error },
        { status: 500 }
      )
    }

    return NextResponse.json({ url: result.url, error: null })
  } catch (err) {
    return NextResponse.json(
      { url: null, error: err instanceof Error ? err.message : 'PDF 생성 실패' },
      { status: 500 }
    )
  }
}