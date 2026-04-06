import { NextRequest, NextResponse } from 'next/server'
import { authenticateAdmin } from '@/lib/api-auth'
import { aiGenerateTemplateSchema, validateInput } from '@/lib/api-schemas'
import {
  buildGenerateTemplateUserPrompt,
  generateTemplateSystemPrompt,
  sanitizeGeneratedTemplateContent,
  type AiTemplateCategory,
} from '@/lib/ai-prompts'
import { rateLimitAuth } from '@/lib/rate-limit'
import { getClientIp } from '@/lib/get-ip'

/**
 * POST /api/ai/generate-template
 * AI로 계약서 템플릿 초안을 생성한다.
 *
 * Body: { title, category, description? }
 * Returns: { content }
 */
export async function POST(request: NextRequest) {
  const ip = getClientIp(request)
  const limited = rateLimitAuth(ip, '/api/ai/generate-template')
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
    const rawBody = await request.json()
    const { data: body, error: validationError } = validateInput(aiGenerateTemplateSchema, rawBody)
    if (validationError || !body) {
      return NextResponse.json({ error: validationError ?? '잘못된 요청입니다' }, { status: 400 })
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
          { role: 'system', content: generateTemplateSystemPrompt },
          {
            role: 'user',
            content: buildGenerateTemplateUserPrompt({
              title: body.title,
              category: (body.category ?? 'standard') as AiTemplateCategory,
              description: body.description,
            }),
          },
        ],
        temperature: 0.3,
        max_tokens: 4000,
      }),
    })

    if (!response.ok) {
      return NextResponse.json({ error: `OpenAI API 오류: ${response.status}` }, { status: 500 })
    }

    const result = await response.json()
    return NextResponse.json({
      content: sanitizeGeneratedTemplateContent(result.choices?.[0]?.message?.content),
    })
  } catch (err) {
    console.error('[AI GenerateTemplate] 예외 발생:', err instanceof Error ? err.message : err)
    return NextResponse.json({ error: '계약서 템플릿 생성 중 오류가 발생했습니다' }, { status: 500 })
  }
}
