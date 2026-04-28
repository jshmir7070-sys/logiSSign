import {
  buildExtractDocumentUserPrompt,
  extractDocumentSystemPrompt,
  parseExtractDocumentResponse,
} from '@/lib/ai-prompts'

/**
 * AI provider routing for document extraction.
 *
 * 운송사 양식 다변화에 대비해 OpenAI(GPT-4o-mini)와 Anthropic(Claude Sonnet) 중
 * 한 곳을 선택해 호출한다. 선호 provider의 API 키가 없으면 다른 provider로 자동 폴백.
 *
 * 환경변수 우선순위:
 *   1. EXTRACT_DOCUMENT_PROVIDER ('openai' | 'anthropic') — 강제 지정
 *   2. 요청 본문의 provider 필드 — 호출자 지정
 *   3. 기본값: 'openai'
 */

export type AiProvider = 'openai' | 'anthropic'

export interface ExtractDocumentInput {
  text: string
  fileName?: string
}

export interface ExtractDocumentResult {
  content: string
  detectedVariables: string[]
}

export interface ExtractDocumentResponse {
  data: ExtractDocumentResult | null
  provider: AiProvider | null
  error: string | null
}

const OPENAI_MODEL = 'gpt-4o-mini'
const ANTHROPIC_MODEL = 'claude-sonnet-4-6'
const REQUEST_TIMEOUT_MS = 30_000

export function resolveExtractProvider(requested?: string | null): AiProvider {
  const envOverride = (process.env.EXTRACT_DOCUMENT_PROVIDER ?? '').toLowerCase()
  if (envOverride === 'anthropic' || envOverride === 'openai') {
    return envOverride
  }
  if (requested === 'anthropic' || requested === 'openai') {
    return requested
  }
  return 'openai'
}

function hasProviderKey(provider: AiProvider): boolean {
  if (provider === 'anthropic') return Boolean(process.env.ANTHROPIC_API_KEY)
  return Boolean(process.env.OPENAI_API_KEY)
}

async function callOpenAi(input: ExtractDocumentInput): Promise<ExtractDocumentResult> {
  const apiKey = process.env.OPENAI_API_KEY
  if (!apiKey) throw new Error('OPENAI_API_KEY가 설정되지 않았습니다')

  const controller = new AbortController()
  const timer = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS)

  try {
    const response = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${apiKey}`,
      },
      signal: controller.signal,
      body: JSON.stringify({
        model: OPENAI_MODEL,
        messages: [
          { role: 'system', content: extractDocumentSystemPrompt },
          {
            role: 'user',
            content: buildExtractDocumentUserPrompt({
              fileName: input.fileName,
              text: input.text.slice(0, 8000),
            }),
          },
        ],
        temperature: 0.2,
        max_tokens: 4000,
        response_format: { type: 'json_object' },
      }),
    })

    if (!response.ok) {
      throw new Error(`OpenAI API 오류: ${response.status}`)
    }

    const result = await response.json()
    return parseExtractDocumentResponse(result?.choices?.[0]?.message?.content)
  } finally {
    clearTimeout(timer)
  }
}

async function callAnthropic(input: ExtractDocumentInput): Promise<ExtractDocumentResult> {
  const apiKey = process.env.ANTHROPIC_API_KEY
  if (!apiKey) throw new Error('ANTHROPIC_API_KEY가 설정되지 않았습니다')

  const controller = new AbortController()
  const timer = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS)

  // Claude는 OpenAI와 달리 response_format 옵션이 없으므로 system 프롬프트에 한 번 더 못박는다.
  const systemPrompt =
    extractDocumentSystemPrompt +
    '\n\n출력 제약: JSON 객체 한 개 외에는 어떠한 설명·코드블록·접두문도 출력하지 않습니다.'

  try {
    const response = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': apiKey,
        'anthropic-version': '2023-06-01',
      },
      signal: controller.signal,
      body: JSON.stringify({
        model: ANTHROPIC_MODEL,
        max_tokens: 4000,
        temperature: 0.2,
        system: systemPrompt,
        messages: [
          {
            role: 'user',
            content: buildExtractDocumentUserPrompt({
              fileName: input.fileName,
              text: input.text.slice(0, 8000),
            }),
          },
        ],
      }),
    })

    if (!response.ok) {
      throw new Error(`Anthropic API 오류: ${response.status}`)
    }

    const result = await response.json()
    const blocks = Array.isArray(result?.content) ? result.content : []
    const text = blocks
      .filter((block: unknown): block is { type: string; text: string } => {
        return (
          typeof block === 'object' &&
          block !== null &&
          (block as Record<string, unknown>).type === 'text' &&
          typeof (block as Record<string, unknown>).text === 'string'
        )
      })
      .map((block: { text: string }) => block.text)
      .join('')

    return parseExtractDocumentResponse(stripJsonFence(text))
  } finally {
    clearTimeout(timer)
  }
}

/** Claude가 가끔 ```json ... ``` 으로 감싸 주는 경우를 대비한 가벼운 정리. */
function stripJsonFence(raw: string): string {
  const trimmed = raw.trim()
  const fenced = trimmed.match(/^```(?:json)?\s*([\s\S]*?)\s*```$/i)
  return fenced ? fenced[1].trim() : trimmed
}

export async function runExtractDocument(
  input: ExtractDocumentInput,
  preferred: AiProvider,
): Promise<ExtractDocumentResponse> {
  const order: AiProvider[] = preferred === 'anthropic' ? ['anthropic', 'openai'] : ['openai', 'anthropic']

  let lastError: string | null = null

  for (const provider of order) {
    if (!hasProviderKey(provider)) {
      lastError = `${provider} API 키 미설정`
      continue
    }

    try {
      const data = provider === 'anthropic' ? await callAnthropic(input) : await callOpenAi(input)
      return { data, provider, error: null }
    } catch (err) {
      lastError = err instanceof Error ? err.message : `${provider} 호출 실패`
    }
  }

  return { data: null, provider: null, error: lastError ?? '문서 분석 실패' }
}
