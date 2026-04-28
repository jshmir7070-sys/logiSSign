import { NextRequest, NextResponse } from 'next/server'
import { authenticateAdmin } from '@/lib/api-auth'
import { aiExtractDocumentSchema, validateInput } from '@/lib/api-schemas'
import {
  resolveExtractProvider,
  runExtractDocument,
} from '@/lib/ai-providers'
import { rateLimitAuth } from '@/lib/rate-limit'
import { getClientIp } from '@/lib/get-ip'

/**
 * POST /api/ai/extract-document
 * 업로드한 문서 텍스트에서 계약 본문과 변수 후보를 추출한다.
 *
 * Body: { text, fileName?, provider? }
 *   - provider: 'openai' | 'anthropic' (선택). 미지정 시 EXTRACT_DOCUMENT_PROVIDER 환경변수 → openai 순서.
 *
 * Returns: { content, detectedVariables, provider }
 *   - 선호 provider의 API 키가 없으면 다른 provider로 자동 폴백.
 */
export async function POST(request: NextRequest) {
  const ip = getClientIp(request)
  const limited = await rateLimitAuth(ip, '/api/ai/extract-document')
  if (limited) return limited

  const { auth, error: authError } = await authenticateAdmin(request)
  if (authError || !auth) return authError!

  try {
    const rawBody = await request.json().catch(() => ({}))
    const { data: body, error: validationError } = validateInput(aiExtractDocumentSchema, rawBody)
    if (validationError || !body) {
      return NextResponse.json({ error: validationError ?? '문서 텍스트가 필요합니다' }, { status: 400 })
    }

    const provider = resolveExtractProvider(body.provider)
    const { data, provider: usedProvider, error } = await runExtractDocument(
      { text: body.text, fileName: body.fileName },
      provider,
    )

    if (error || !data) {
      return NextResponse.json(
        { error: error ?? '문서 분석에 실패했습니다' },
        { status: 500 },
      )
    }

    return NextResponse.json({ ...data, provider: usedProvider })
  } catch (err) {
    console.error('[AI ExtractDocument] 예외 발생:', err instanceof Error ? err.message : err)
    return NextResponse.json({ error: '문서 분석 처리 중 오류가 발생했습니다' }, { status: 500 })
  }
}
