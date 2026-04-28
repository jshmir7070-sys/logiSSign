/**
 * CS 챗봇 카테고리 감지 + LLM 폴백 동작 테스트.
 *
 * 통합 평가(실제 OpenAI 호출 대비 응답 품질 점검)는 별도 스크립트
 * scripts/eval-cs-chat.mjs 로 분리 — 비용 발생 + 비결정성 테스트라 CI에서는 제외.
 */

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import {
  KEYWORD_CATEGORY_MAP,
  LLM_FALLBACK_CATEGORIES,
  LLM_SYSTEM_PROMPT,
  buildLlmUserPrompt,
  detectCategory,
  fetchLlmFallback,
} from '@/lib/cs-chat'
import { CS_CHAT_FIXTURES } from './fixtures/cs-chat-samples'

const ORIGINAL_FETCH = globalThis.fetch

describe('cs-chat detectCategory', () => {
  it('20개 픽스처 입력에 대해 기대 카테고리로 분류한다', () => {
    const mismatches: string[] = []
    for (const sample of CS_CHAT_FIXTURES) {
      const detected = detectCategory(sample.message)
      if (detected !== sample.expectedCategory) {
        mismatches.push(
          `[${sample.id}] expected=${sample.expectedCategory} got=${detected} — ${sample.message.slice(0, 40)}`,
        )
      }
    }
    expect(mismatches).toEqual([])
  })

  it('정형 카테고리(payment/contract/...)는 LLM_FALLBACK 대상에서 제외된다', () => {
    const llmCategories = Array.from(LLM_FALLBACK_CATEGORIES)
    expect(llmCategories.sort()).toEqual(['bug', 'feedback', 'other'])
    expect(llmCategories).not.toContain('payment')
    expect(llmCategories).not.toContain('contract')
    expect(llmCategories).not.toContain('settlement')
  })

  it('키워드 맵의 모든 카테고리가 CsCategory 유형 안에 있다', () => {
    const allowedCategories = ['payment', 'contract', 'settlement', 'driver', 'plan', 'account', 'bug', 'feedback']
    for (const { category } of KEYWORD_CATEGORY_MAP) {
      expect(allowedCategories).toContain(category)
    }
  })

  it('의도가 모호한 입력은 other로 떨어진다', () => {
    expect(detectCategory('안녕하세요')).toBe('other')
    expect(detectCategory('잘 모르겠어요')).toBe('other')
  })
})

describe('cs-chat buildLlmUserPrompt', () => {
  it('고객사 컨텍스트와 카테고리, 메시지를 한 프롬프트에 묶는다', () => {
    const prompt = buildLlmUserPrompt({
      message: '서명이 안돼요',
      category: 'bug',
      plan: 'basic',
      driverCount: 12,
      agencyName: '테스트대리점',
    })

    expect(prompt).toContain('테스트대리점')
    expect(prompt).toContain('BASIC')
    expect(prompt).toContain('12명')
    expect(prompt).toContain('카테고리: bug')
    expect(prompt).toContain('서명이 안돼요')
  })

  it('1500자를 넘는 메시지는 잘라낸다', () => {
    const longMessage = '가'.repeat(2000)
    const prompt = buildLlmUserPrompt({
      message: longMessage,
      category: 'feedback',
      plan: 'free',
      driverCount: 0,
      agencyName: '',
    })

    // 1500자 잘림 + 헤더 줄들이 추가되므로 총 길이는 더 작음
    const messageLine = prompt.split('\n').find((line) => line.startsWith('문의:'))
    expect(messageLine).toBeDefined()
    expect((messageLine ?? '').length).toBeLessThanOrEqual('문의: '.length + 1500)
  })
})

describe('cs-chat LLM_SYSTEM_PROMPT', () => {
  it('주요 안전장치 문구를 모두 포함한다', () => {
    // 다른 고객사 데이터 노출 금지, 시스템 외 주제 거절, 길이 제약, 후속 입력 유도
    expect(LLM_SYSTEM_PROMPT).toContain('다른 고객사')
    expect(LLM_SYSTEM_PROMPT).toContain('정중히 거절')
    expect(LLM_SYSTEM_PROMPT).toContain('200자 이내')
    expect(LLM_SYSTEM_PROMPT).toContain('logiSSign')
  })
})

describe('cs-chat fetchLlmFallback', () => {
  beforeEach(() => {
    vi.stubEnv('OPENAI_API_KEY', 'sk-test-key')
  })

  afterEach(() => {
    vi.unstubAllEnvs()
    globalThis.fetch = ORIGINAL_FETCH
    vi.restoreAllMocks()
  })

  it('API 키 부재 시 즉시 null을 돌려주고 호출하지 않는다', async () => {
    vi.stubEnv('OPENAI_API_KEY', '')
    const fetchSpy = vi.fn()
    globalThis.fetch = fetchSpy as unknown as typeof globalThis.fetch

    const result = await fetchLlmFallback({
      message: '테스트',
      category: 'bug',
      plan: 'free',
      driverCount: 0,
      agencyName: 'X',
    })

    expect(result).toBeNull()
    expect(fetchSpy).not.toHaveBeenCalled()
  })

  it('정상 응답을 받으면 메시지 텍스트를 반환한다', async () => {
    globalThis.fetch = vi.fn(
      async () =>
        new Response(
          JSON.stringify({
            choices: [{ message: { content: '안녕하세요. 도움 드리겠습니다.' } }],
          }),
          { status: 200 },
        ),
    ) as unknown as typeof globalThis.fetch

    const result = await fetchLlmFallback({
      message: '서명이 안돼요',
      category: 'bug',
      plan: 'basic',
      driverCount: 5,
      agencyName: '테스트',
    })

    expect(result).toBe('안녕하세요. 도움 드리겠습니다.')
  })

  it('OpenAI Chat Completions 형식의 페이로드를 보낸다', async () => {
    const fetchSpy = vi.fn(
      async () =>
        new Response(
          JSON.stringify({ choices: [{ message: { content: '응답' } }] }),
          { status: 200 },
        ),
    )
    globalThis.fetch = fetchSpy as unknown as typeof globalThis.fetch

    await fetchLlmFallback({
      message: '문제',
      category: 'other',
      plan: 'pro',
      driverCount: 100,
      agencyName: 'A',
    })

    const [url, init] = fetchSpy.mock.calls[0] as [string, RequestInit]
    expect(url).toBe('https://api.openai.com/v1/chat/completions')

    const body = JSON.parse(String(init?.body))
    expect(body.model).toBe('gpt-4o-mini')
    expect(body.temperature).toBe(0.4)
    expect(body.max_tokens).toBe(350)
    expect(body.messages).toHaveLength(2)
    expect(body.messages[0].role).toBe('system')
    expect(body.messages[0].content).toContain('logiSSign')
    expect(body.messages[1].role).toBe('user')
  })

  it('HTTP 4xx/5xx는 null로 떨어져 캔드 응답으로 폴백되도록 한다', async () => {
    globalThis.fetch = vi.fn(
      async () => new Response('rate limited', { status: 429 }),
    ) as unknown as typeof globalThis.fetch

    const result = await fetchLlmFallback({
      message: '테스트',
      category: 'bug',
      plan: 'free',
      driverCount: 0,
      agencyName: 'X',
    })

    expect(result).toBeNull()
  })

  it('네트워크 throw도 null로 떨어진다', async () => {
    globalThis.fetch = vi.fn(async () => {
      throw new Error('network down')
    }) as unknown as typeof globalThis.fetch

    const result = await fetchLlmFallback({
      message: '테스트',
      category: 'bug',
      plan: 'free',
      driverCount: 0,
      agencyName: 'X',
    })

    expect(result).toBeNull()
  })

  it('빈 응답 컨텐츠는 null로 처리한다', async () => {
    globalThis.fetch = vi.fn(
      async () => new Response(JSON.stringify({ choices: [{ message: { content: '   ' } }] }), { status: 200 }),
    ) as unknown as typeof globalThis.fetch

    const result = await fetchLlmFallback({
      message: '테스트',
      category: 'bug',
      plan: 'free',
      driverCount: 0,
      agencyName: 'X',
    })

    expect(result).toBeNull()
  })
})
