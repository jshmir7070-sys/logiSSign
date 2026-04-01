import { NextRequest, NextResponse } from 'next/server'
import { authenticateAdmin } from '@/lib/api-auth'

/**
 * POST /api/ai/extract-document
 * 업로드된 문서 텍스트에서 계약서 본문 추출 + 변수 자동 매핑
 *
 * Body: { text, fileName? }
 * Returns: { content, detectedVariables }
 */
export async function POST(request: NextRequest) {
  const { auth, error: authError } = await authenticateAdmin(request)
  if (authError || !auth) return authError!

  const apiKey = process.env.OPENAI_API_KEY
  if (!apiKey) {
    return NextResponse.json({ error: 'OPENAI_API_KEY가 설정되지 않았습니다. 환경변수를 추가하세요.' }, { status: 500 })
  }

  try {
    const { text, fileName } = await request.json()
    if (!text || text.length < 10) return NextResponse.json({ error: '문서 텍스트가 필요합니다' }, { status: 400 })

    const systemPrompt = `당신은 한국 물류 계약서 분석 전문가입니다.
주어진 문서 텍스트를 분석하여:
1. 계약서 본문을 정리하고 조항 번호를 정돈하세요
2. 기사/대리점 정보가 들어갈 자리를 {{변수}} 형태로 변환하세요:
   - 기사 이름 → {{기사명}}
   - 기사 전화번호 → {{전화번호}}
   - 기사 주소 → {{주소}}
   - 대리점 상호 → {{대리점명}}
   - 대리점 사업자번호 → {{대리점사업자번호}}
   - 계약 시작일 → {{계약시작일}}
   - 계약 종료일 → {{계약종료일}}
   - 차량번호 → {{차량번호}}
   - 등등
3. 원본의 법적 내용은 최대한 유지하세요
4. 응답은 JSON 형식: { "content": "변환된 본문", "detectedVariables": ["기사명", "전화번호", ...] }`

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
          { role: 'user', content: `파일명: ${fileName ?? '알 수 없음'}\n\n문서 내용:\n${text.slice(0, 8000)}` },
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
    const parsed = JSON.parse(result.choices?.[0]?.message?.content ?? '{}')

    return NextResponse.json({
      content: parsed.content ?? '',
      detectedVariables: parsed.detectedVariables ?? [],
    })
  } catch (err) {
    return NextResponse.json({ error: err instanceof Error ? err.message : '문서 분석 실패' }, { status: 500 })
  }
}
