import { NextRequest, NextResponse } from 'next/server'
import { authenticateAdmin } from '@/lib/api-auth'
import { aiGenerateTemplateSchema, validateInput } from '@/lib/api-schemas'
import { rateLimitAuth } from '@/lib/rate-limit'
import { getClientIp } from '@/lib/get-ip'

/**
 * POST /api/ai/generate-template
 * AI로 계약서 템플릿 본문 초안 생성
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
    return NextResponse.json({ error: 'OPENAI_API_KEY가 설정되지 않았습니다. 환경변수를 추가하세요.' }, { status: 500 })
  }

  try {
    const rawBody = await request.json()
    const { data: body, error: validationError } = validateInput(aiGenerateTemplateSchema, rawBody)
    if (validationError || !body) {
      return NextResponse.json({ error: validationError ?? '잘못된 요청입니다' }, { status: 400 })
    }

    const { title, category, description } = body

    const categoryLabels: Record<string, string> = {
      standard: '표준계약서 (위수탁 표준계약서, 운송계약서 등)',
      supplementary: '부속합의서',
      consent: '동의서/서약서 (개인정보 수집, 안전운행 등)',
      government: '관공서 제출 양식',
    }

    const systemPrompt = `당신은 한국 택배·물류 대리점의 법률 계약서 전문가입니다.
아래 규칙에 따라 계약서 본문을 작성하세요:
1. 한국 관련 법령(화물자동차 운수사업법, 개인정보보호법 등)에 맞게 작성
2. {{변수}} 형태의 치환 변수를 적절히 사용:
   {{기사명}}, {{전화번호}}, {{주소}}, {{사번}}, {{대리점명}}, {{대리점사업자번호}}, {{대리점주소}}, {{대리점대표자}}, {{카테고리명}}, {{배송지역}}, {{배송단가}}, {{반품단가}}, {{계약시작일}}, {{계약종료일}}, {{계약일}}, {{사업자번호}}, {{대표자명}}, {{사업장주소}}, {{차량번호}}, {{차종}}, {{연식}}
3. 조항 번호를 사용하여 체계적으로 구성
4. 마지막에 서명란 (갑: 대리점, 을: 기사) 포함
5. 실제 법적 효력을 고려하되 "변호사 검토 권장" 문구 하단에 포함`

    const response = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${apiKey}`,
      },
      body: JSON.stringify({
        model: 'gpt-4o-mini',
        messages: [
          { role: 'system', content: systemPrompt },
          { role: 'user', content: `"${title}" 제목의 ${categoryLabels[category ?? 'standard'] ?? '계약서'}를 작성해주세요.${description ? `\n추가 요구사항: ${description}` : ''}` },
        ],
        temperature: 0.3,
        max_tokens: 4000,
      }),
    })

    if (!response.ok) {
      return NextResponse.json({ error: `OpenAI API 오류: ${response.status}` }, { status: 500 })
    }

    const result = await response.json()
    return NextResponse.json({ content: result.choices?.[0]?.message?.content ?? '' })
  } catch (err) {
    console.error('[AI GenerateTemplate] 예외 발생:', err instanceof Error ? err.message : err)
    return NextResponse.json({ error: '계약서 템플릿 생성 중 오류가 발생했습니다' }, { status: 500 })
  }
}
