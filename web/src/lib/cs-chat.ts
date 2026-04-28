/**
 * CS 챗봇 카테고리 감지 + 프롬프트 + LLM 폴백 로직.
 * 라우트에서 분리해 단위 테스트와 평가 스크립트가 같은 코드를 검증할 수 있게 함.
 */

export type CsCategory =
  | 'payment'
  | 'contract'
  | 'settlement'
  | 'driver'
  | 'plan'
  | 'account'
  | 'bug'
  | 'feedback'
  | 'other'

/** LLM 폴백을 사용할 카테고리 — 정형 응답이 약한 영역만 한정 */
export const LLM_FALLBACK_CATEGORIES: ReadonlySet<CsCategory> = new Set([
  'other',
  'bug',
  'feedback',
])

// 우선순위: 문제 호소(bug)와 개선 요청(feedback)을 도메인 카테고리보다 먼저 검사한다.
// 예) "정산서 PDF가 깨져요" 는 settlement(정산)가 아니라 bug 로 분류돼야 한다.
export const KEYWORD_CATEGORY_MAP: Array<{ keywords: string[]; category: CsCategory }> = [
  {
    keywords: [
      '오류', '버그', '에러', '고장', '문제',
      '안 됨', '안됨', '작동',
      '깨져', '깨짐', '깨졌', // 화면 깨짐
      '꺼져', '꺼짐', '꺼졌', // 앱 종료
      '멈춤', '멈춰', '멈췄',
      '느려', '느림',
      // '다운' 은 '다운로드' 와 충돌해서 제외 — 앱 종료는 '꺼짐' 시리즈로 충분
    ],
    category: 'bug',
  },
  {
    keywords: [
      '건의', '피드백', '의견', '제안', '요청사항', '개선',
      '좋겠', '있었으면', '있으면',
      '기능 추가', '추가했으면',
    ],
    category: 'feedback',
  },
  // 플랜은 driver 보다 먼저 — "기사 수 한도" 같은 입력이 driver 로 새지 않게 한다
  { keywords: ['플랜', '요금', '업그레이드', '다운그레이드', '구독', '한도', '기사 수'], category: 'plan' },
  { keywords: ['결제', '카드', '환불', '입금', '가상계좌', '청구', '영수증', '포인트 충전'], category: 'payment' },
  { keywords: ['계약서', '계약', '템플릿', '재발송', '전자서명'], category: 'contract' },
  { keywords: ['정산', '엑셀', '단가', '세금계산서', '거래처', '정산서'], category: 'settlement' },
  { keywords: ['드라이버', '배달', '초대', '앱 연동'], category: 'driver' },
  { keywords: ['비밀번호', '로그인', '관리자', '탈퇴', '도장'], category: 'account' },
]

export function detectCategory(message: string): CsCategory {
  for (const { keywords, category } of KEYWORD_CATEGORY_MAP) {
    if (keywords.some((k) => message.includes(k))) return category
  }
  return 'other'
}

export const LLM_SYSTEM_PROMPT = `당신은 logiSSign(로지사인) 고객 지원 챗봇입니다.
logiSSign은 한국 라스트마일 배송 대리점을 위한 SaaS로, 전자계약·정산·세금계산서·기사 관리 기능을 제공합니다.

규칙:
- 한국어 존댓말로, 문단 1~2개, 200자 이내로 간결하게 답하세요.
- 구체 해결 단계가 있으면 번호 목록(1. 2. 3.)으로 안내하세요.
- 다른 고객사나 기사의 데이터는 절대 추측하거나 노출하지 마세요.
- 금액·결제·법적 효력 등 단정이 어려운 부분은 "고객센터 확인"을 권유하세요.
- 시스템 외 주제(농담, 외부 정보 등)는 정중히 거절하고 지원 범위 안내로 돌아가세요.
- 마지막에 한 줄로 "추가 문의가 있으시면 자세한 상황을 더 적어주세요"처럼 후속 입력을 유도하세요.`

export interface LlmFallbackContext {
  message: string
  category: CsCategory
  plan: string
  driverCount: number
  agencyName: string
}

export function buildLlmUserPrompt(ctx: LlmFallbackContext): string {
  return [
    `고객사: ${ctx.agencyName} (플랜: ${ctx.plan.toUpperCase()}, 등록 기사 ${ctx.driverCount}명)`,
    `카테고리: ${ctx.category}`,
    `문의: ${ctx.message.slice(0, 1500)}`,
  ].join('\n')
}

export async function fetchLlmFallback(ctx: LlmFallbackContext): Promise<string | null> {
  const apiKey = process.env.OPENAI_API_KEY
  if (!apiKey) return null

  const controller = new AbortController()
  const timer = setTimeout(() => controller.abort(), 8000)

  try {
    const response = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${apiKey}`,
      },
      signal: controller.signal,
      body: JSON.stringify({
        model: 'gpt-4o-mini',
        messages: [
          { role: 'system', content: LLM_SYSTEM_PROMPT },
          { role: 'user', content: buildLlmUserPrompt(ctx) },
        ],
        temperature: 0.4,
        max_tokens: 350,
      }),
    })

    if (!response.ok) return null

    const result = await response.json()
    const content = result?.choices?.[0]?.message?.content
    return typeof content === 'string' && content.trim().length > 0 ? content.trim() : null
  } catch {
    return null
  } finally {
    clearTimeout(timer)
  }
}
