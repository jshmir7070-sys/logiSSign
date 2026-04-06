import { describe, expect, it } from 'vitest'
import { aiExtractDocumentSchema } from '@/lib/api-schemas'
import {
  PROMPT_VERSION,
  buildExtractDocumentUserPrompt,
  buildGenerateTemplateUserPrompt,
  extractDocumentSystemPrompt,
  generateTemplateSystemPrompt,
  parseExtractDocumentResponse,
  sanitizeGeneratedTemplateContent,
} from '@/lib/ai-prompts'

describe('ai-prompts', () => {
  it('extract-document 시스템 프롬프트에 JSON 응답 규칙이 포함된다', () => {
    expect(extractDocumentSystemPrompt).toContain('JSON 객체')
    expect(extractDocumentSystemPrompt).toContain('{{기사명}}')
  })

  it('extract-document 유저 프롬프트가 파일명과 버전을 포함한다', () => {
    const prompt = buildExtractDocumentUserPrompt({
      fileName: 'sample-contract.txt',
      text: '제1조 계약 내용',
    })

    expect(prompt).toContain(PROMPT_VERSION)
    expect(prompt).toContain('sample-contract.txt')
    expect(prompt).toContain('제1조 계약 내용')
  })

  it('generate-template 유저 프롬프트가 분류별 규칙을 포함한다', () => {
    const prompt = buildGenerateTemplateUserPrompt({
      title: '기사 위수탁 계약서',
      category: 'standard',
      description: '보험 조항을 포함해 주세요.',
    })

    expect(prompt).toContain('표준 위수탁 계약서')
    expect(prompt).toContain('보험 조항을 포함해 주세요.')
    expect(generateTemplateSystemPrompt).toContain('최종 사용 전 법률 검토를 권장합니다.')
  })

  it('extract 응답 파서가 잘못된 JSON을 안전하게 비운다', () => {
    expect(parseExtractDocumentResponse('not-json')).toEqual({
      content: '',
      detectedVariables: [],
    })
  })

  it('extract 응답 파서가 변수 배열을 정규화한다', () => {
    const parsed = parseExtractDocumentResponse(JSON.stringify({
      content: '정리된 계약서',
      detectedVariables: ['기사명', '{{전화번호}}', '기사명', 123, ' '],
    }))

    expect(parsed).toEqual({
      content: '정리된 계약서',
      detectedVariables: ['기사명', '전화번호'],
    })
  })

  it('생성 템플릿 응답은 문자열만 정리한다', () => {
    expect(sanitizeGeneratedTemplateContent('  계약서 본문  ')).toBe('계약서 본문')
    expect(sanitizeGeneratedTemplateContent(undefined)).toBe('')
  })
})

describe('aiExtractDocumentSchema', () => {
  it('정상 입력을 허용한다', () => {
    const result = aiExtractDocumentSchema.safeParse({
      text: '제1조 이 계약은 배송 업무를 위탁하기 위해 체결한다.',
      fileName: 'contract.txt',
    })

    expect(result.success).toBe(true)
  })

  it('너무 짧은 텍스트를 거절한다', () => {
    const result = aiExtractDocumentSchema.safeParse({
      text: '짧음',
    })

    expect(result.success).toBe(false)
  })
})
