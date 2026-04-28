#!/usr/bin/env node
/**
 * cs-chat LLM 응답 품질 평가 스크립트.
 *
 * 사용법:
 *   OPENAI_API_KEY=sk-... node scripts/eval-cs-chat.mjs
 *
 * 동작:
 *   - src/__tests__/fixtures/cs-chat-samples.ts 의 20개 픽스처를 순회
 *   - 각 입력에 대해 (1) 캔드 응답 (2) LLM 응답을 모두 출력
 *   - LLM 응답에 대해 다음 휴리스틱을 자동 검사:
 *     * 글자 수 (목표: ≤ 240자)
 *     * 한국어 존댓말 ('~요', '~니다' 등으로 끝나는지)
 *     * shouldIncludeAny / shouldNotInclude 키워드 검증
 *     * 다른 고객사명/숫자 hallucination 의심 패턴
 *   - 카테고리별 통과/주의 카운트 합산 후 표 출력
 *
 * 비용: GPT-4o-mini ~$0.0001/요청 × 20 ≈ $0.002 / run.
 *
 * CI에는 포함하지 않는다 — 비결정적이고 비용이 발생하므로 수동 실행 전용.
 */

import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { dirname, resolve } from 'node:path'

const __dirname = dirname(fileURLToPath(import.meta.url))
const repoRoot = resolve(__dirname, '..')

if (!process.env.OPENAI_API_KEY) {
  console.error('OPENAI_API_KEY 환경변수가 필요합니다.')
  process.exit(1)
}

// fixtures 파일을 직접 파싱 (TS import 없이 정규식으로 추출 — 빌드 단계 불필요)
function loadFixtures() {
  const path = resolve(repoRoot, 'src/__tests__/fixtures/cs-chat-samples.ts')
  const source = readFileSync(path, 'utf8')

  const blockMatch = source.match(/export const CS_CHAT_FIXTURES[^=]*=\s*(\[[\s\S]*?\n\])/)
  if (!blockMatch) throw new Error('CS_CHAT_FIXTURES 배열을 찾지 못했습니다')

  // 매우 단순한 형태로 객체를 추출 — 픽스처 형식이 단순한 형태일 때만 동작
  const text = blockMatch[1]
  const fixtures = []
  const objectRe = /\{\s*id:\s*'([^']+)',\s*message:\s*'([^']+)',\s*expectedCategory:\s*'([^']+)'(?:,\s*shouldIncludeAny:\s*\[([^\]]*)\])?(?:,\s*shouldNotInclude:\s*\[([^\]]*)\])?\s*,?\s*\}/g
  let m
  while ((m = objectRe.exec(text)) !== null) {
    fixtures.push({
      id: m[1],
      message: m[2],
      expectedCategory: m[3],
      shouldIncludeAny: m[4] ? m[4].split(',').map((s) => s.trim().replace(/^'|'$/g, '')).filter(Boolean) : [],
      shouldNotInclude: m[5] ? m[5].split(',').map((s) => s.trim().replace(/^'|'$/g, '')).filter(Boolean) : [],
    })
  }
  return fixtures
}

const SYSTEM_PROMPT = `당신은 logiSSign(로지사인) 고객 지원 챗봇입니다.
logiSSign은 한국 라스트마일 배송 대리점을 위한 SaaS로, 전자계약·정산·세금계산서·기사 관리 기능을 제공합니다.

규칙:
- 한국어 존댓말로, 문단 1~2개, 200자 이내로 간결하게 답하세요.
- 구체 해결 단계가 있으면 번호 목록(1. 2. 3.)으로 안내하세요.
- 다른 고객사나 기사의 데이터는 절대 추측하거나 노출하지 마세요.
- 금액·결제·법적 효력 등 단정이 어려운 부분은 "고객센터 확인"을 권유하세요.
- 시스템 외 주제(농담, 외부 정보 등)는 정중히 거절하고 지원 범위 안내로 돌아가세요.
- 마지막에 한 줄로 "추가 문의가 있으시면 자세한 상황을 더 적어주세요"처럼 후속 입력을 유도하세요.`

async function callLlm(message, category) {
  const userPrompt = [
    `고객사: 평가테스트 (플랜: BASIC, 등록 기사 12명)`,
    `카테고리: ${category}`,
    `문의: ${message}`,
  ].join('\n')

  const response = await fetch('https://api.openai.com/v1/chat/completions', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${process.env.OPENAI_API_KEY}`,
    },
    body: JSON.stringify({
      model: 'gpt-4o-mini',
      messages: [
        { role: 'system', content: SYSTEM_PROMPT },
        { role: 'user', content: userPrompt },
      ],
      temperature: 0.4,
      max_tokens: 350,
    }),
  })

  if (!response.ok) throw new Error(`OpenAI ${response.status}: ${await response.text()}`)
  const result = await response.json()
  return result.choices?.[0]?.message?.content ?? ''
}

function evaluateResponse(text, sample) {
  const issues = []
  if (!text || text.trim().length === 0) {
    return ['빈 응답']
  }
  // 길이
  if (text.length > 280) issues.push(`길이 초과 (${text.length}자)`)
  // 한국어 존댓말 — '~요/~니다/~까요' 류로 끝나는지 단순 휴리스틱
  const lastSentence = text.split(/[.!?\n]/).filter((s) => s.trim().length > 0).pop() ?? ''
  if (!/요\.?$|니다\.?$|까요\??$|세요\.?$/.test(lastSentence.trim())) {
    issues.push('존댓말 종결 의심')
  }
  // 포함/제외 키워드
  if (sample.shouldIncludeAny && sample.shouldIncludeAny.length > 0) {
    const hit = sample.shouldIncludeAny.some((kw) => text.includes(kw))
    if (!hit) issues.push(`기대 키워드 부재 (${sample.shouldIncludeAny.join('/')})`)
  }
  if (sample.shouldNotInclude && sample.shouldNotInclude.length > 0) {
    const hit = sample.shouldNotInclude.find((kw) => text.includes(kw))
    if (hit) issues.push(`금지 키워드 노출 (${hit})`)
  }
  // 다른 회사/금액 추측 의심 — 매우 단순 휴리스틱
  if (/[A-Z][a-z]+ Inc|주식회사 [가-힣]+|\d{2,3},\d{3}원/.test(text)) {
    issues.push('다른 회사/금액 hallucination 의심')
  }
  return issues
}

async function main() {
  const fixtures = loadFixtures()
  console.log(`▶ 평가 시작 — ${fixtures.length}개 입력\n`)

  const results = []
  for (const sample of fixtures) {
    process.stdout.write(`  [${sample.id}] (${sample.expectedCategory}) ... `)
    try {
      const llmText = await callLlm(sample.message, sample.expectedCategory)
      const issues = evaluateResponse(llmText, sample)
      results.push({ sample, llmText, issues })
      console.log(issues.length === 0 ? '✓' : `△ ${issues.length}건`)
    } catch (err) {
      console.log(`✗ ${err instanceof Error ? err.message : 'error'}`)
      results.push({ sample, llmText: null, issues: ['호출 실패'] })
    }
  }

  // 카테고리별 요약
  const byCategory = new Map()
  for (const { sample, issues } of results) {
    const c = sample.expectedCategory
    if (!byCategory.has(c)) byCategory.set(c, { total: 0, clean: 0, withIssues: 0 })
    const stats = byCategory.get(c)
    stats.total += 1
    if (issues.length === 0) stats.clean += 1
    else stats.withIssues += 1
  }

  console.log('\n──────── 카테고리별 요약 ────────')
  for (const [category, stats] of byCategory) {
    const ratio = ((stats.clean / stats.total) * 100).toFixed(0)
    console.log(`  ${category.padEnd(10)} ${stats.clean}/${stats.total} 통과 (${ratio}%)`)
  }

  // 문제 케이스 상세
  const problems = results.filter((r) => r.issues.length > 0)
  if (problems.length > 0) {
    console.log('\n──────── 주의 케이스 상세 ────────')
    for (const { sample, llmText, issues } of problems) {
      console.log(`\n  [${sample.id}] ${sample.message}`)
      console.log(`  이슈: ${issues.join(', ')}`)
      if (llmText) {
        console.log(`  응답: ${llmText.replace(/\n/g, ' ⏎ ')}`)
      }
    }
  }

  console.log('')
}

main().catch((err) => {
  console.error(err)
  process.exit(1)
})
