import { NextRequest, NextResponse } from 'next/server'
import { authenticateAdmin } from '@/lib/api-auth'
import { aiExtractDocumentSchema, validateInput } from '@/lib/api-schemas'
import {
  buildExtractDocumentUserPrompt,
  extractDocumentSystemPrompt,
  parseExtractDocumentResponse,
} from '@/lib/ai-prompts'
import { rateLimitAuth } from '@/lib/rate-limit'
import { getClientIp } from '@/lib/get-ip'

/**
 * POST /api/ai/extract-document
 * 업로드한 문서 텍스트에서 계약 본문과 변수 후보를 추출한다.
 *
 * Body: { text, fileName? }
 * Returns: { content, detectedVariables }
 */
export async function POST(request: NextRequest) {
  const ip = getClientIp(request)
  const limited = rateLimitAuth(ip, '/api/ai/extract-document')
  if (limited) return limited

  const { auth, error: authError } = await authenticateAdmin(request)
  if (authError || !auth) return authError!

  const apiKey = process.env.OPENAI_API_KEY
  if (!apiKey) {
    return NextResponse.json(
      { error: 'OPENAI_API_KEY가 설정되지 않았습니다. 환경변수를 추가해 주세요.' },
      { status: 500 }
    )
  }

  try {
    const rawBody = await request.json().catch(() => ({}))
    const { data: body, error: validationError } = validateInput(aiExtractDocumentSchema, rawBody)
    if (validationError || !body) {
      return NextResponse.json({ error: validationError ?? '문서 텍스트가 필요합니다' }, { status: 400 })
    }

    const response = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${apiKey}`,
      },
      body: JSON.stringify({
        model: 'gpt-4o-mini',
        messages: [
          { role: 'system', content: extractDocumentSystemPrompt },
          {
            role: 'user',
            content: buildExtractDocumentUserPrompt({
              fileName: body.fileName,
              text: body.text.slice(0, 8000),
            }),
          },
        ],
        temperature: 0.2,
        max_tokens: 4000,
        response_format: { type: 'json_object' },
      }),
    })

    if (!response.ok) {
      return NextResponse.json({ error: `OpenAI API 오류: ${response.status}` }, { status: 500 })
    }

    const result = await response.json()
    const parsed = parseExtractDocumentResponse(result.choices?.[0]?.message?.content)

    return NextResponse.json(parsed)
  } catch (err) {
    console.error('[AI ExtractDocument] 예외 발생:', err instanceof Error ? err.message : err)
    return NextResponse.json({ error: '문서 분석 처리 중 오류가 발생했습니다' }, { status: 500 })
  }
}
