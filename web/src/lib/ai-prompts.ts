import { z } from 'zod'

export const PROMPT_VERSION = '2026-04-06'

export type AiTemplateCategory = 'standard' | 'supplementary' | 'consent' | 'government'

const allowedPlaceholders = [
  '기사명',
  '전화번호',
  '주소',
  '생년월일',
  '대리점명',
  '대리점사업자번호',
  '대리점주소',
  '대리점대표자',
  '카테고리명',
  '배송지역',
  '배송수수료',
  '반품수수료',
  '계약시작일',
  '계약종료일',
  '계약기간',
  '사업자번호',
  '대표자명',
  '사업주주소',
  '차량번호',
  '차종',
  '연식',
] as const

const categoryLabels: Record<AiTemplateCategory, string> = {
  standard: '표준 위수탁 계약서',
  supplementary: '부속합의서',
  consent: '동의서 및 서약서',
  government: '관공서 제출용 서식',
}

const categoryRules: Record<AiTemplateCategory, string[]> = {
  standard: [
    '당사자 정보, 업무 범위, 수수료/정산 기준, 차량/보험 책임, 계약 기간, 해지/분쟁 조항을 포함한다.',
    '현장 운영에 필요한 실무 조항을 빠뜨리지 않되 불필요한 장황함은 줄인다.',
  ],
  supplementary: [
    '기존 계약의 제목 또는 참조 관계를 분명히 밝히고 변경되는 조항만 명확하게 적는다.',
    '기존 계약에서 변경되지 않는 사항은 그대로 유지된다는 문장을 포함한다.',
  ],
  consent: [
    '동의 목적, 수집 항목, 보유 기간, 제3자 제공 여부, 동의 거부 권리와 불이익 범위를 분리해서 적는다.',
    '필요 이상으로 포괄적인 동의 문구를 만들지 않는다.',
  ],
  government: [
    '사실 확인과 제출 목적 중심으로 작성하고, 광고성 문구나 과장 표현을 넣지 않는다.',
    '행정 제출 서식처럼 간결하고 확인 가능한 정보만 사용한다.',
  ],
}

const placeholderGuide = allowedPlaceholders
  .map((placeholder) => `- {{${placeholder}}}`)
  .join('\n')

export const extractDocumentSystemPrompt = [
  '당신은 한국 물류/운송/위수탁 계약 문서를 템플릿용 본문으로 정리하는 전문가입니다.',
  '다음 규칙을 반드시 지키세요.',
  '1. 계약 본문을 읽기 쉬운 문단과 조항 번호 형태로 정리하되, 원문의 의미와 책임 구조를 바꾸지 않습니다.',
  '2. 인명, 연락처, 주소, 사업자 정보, 계약 기간, 차량 정보 등 반복 가능한 값만 플레이스홀더로 치환합니다.',
  '3. 플레이스홀더는 아래 허용 목록만 사용하고, 같은 의미의 값은 하나의 이름으로 통일합니다.',
  '4. 허용 목록에 없는 값은 억지로 새 변수를 만들지 말고 원문을 유지합니다.',
  '5. 원문이 손상되었거나 판독이 어려운 구간은 추측하지 말고 [원문 판독불가]처럼 표시합니다.',
  '6. 법률 효력이나 규제 준수 여부를 단정하지 말고, 법률 자문처럼 보이는 문장을 추가하지 않습니다.',
  '7. 응답은 반드시 JSON 객체 하나만 반환합니다.',
  '8. JSON 형식은 {"content":"정리된 본문","detectedVariables":["기사명","전화번호"]} 입니다.',
  '',
  '허용 플레이스홀더 목록:',
  placeholderGuide,
].join('\n')

export function buildExtractDocumentUserPrompt(params: {
  fileName?: string
  text: string
}): string {
  const fileName = params.fileName?.trim() || '파일명 없음'

  return [
    `프롬프트 버전: ${PROMPT_VERSION}`,
    `파일명: ${fileName}`,
    '',
    '아래 문서를 템플릿 본문으로 정리해 주세요.',
    '출력은 JSON 객체 하나만 반환하세요.',
    '',
    '원문:',
    '```text',
    params.text,
    '```',
  ].join('\n')
}

export const generateTemplateSystemPrompt = [
  '당신은 한국 물류 대리점/기사 운영 문서를 작성하는 계약 템플릿 전문가입니다.',
  '다음 규칙을 반드시 지키세요.',
  '1. 한국 실무 문서처럼 제목, 조항 번호, 본문, 서명란이 분명한 형태로 작성합니다.',
  '2. 법률 자문을 가장하지 말고, 과도한 법적 단정 표현을 피합니다.',
  '3. 실사용 템플릿이므로 값이 바뀌는 자리에는 허용된 플레이스홀더만 사용합니다.',
  '4. 허용된 플레이스홀더 목록:',
  placeholderGuide,
  '5. 허용 목록에 없는 새 플레이스홀더는 만들지 않습니다.',
  '6. 문서는 완결된 초안으로 작성하되, 마지막에는 "최종 사용 전 법률 검토를 권장합니다." 문장을 포함합니다.',
  '7. 출력은 마크다운이나 JSON이 아니라 계약서 본문 텍스트 그대로 반환합니다.',
].join('\n')

export function buildGenerateTemplateUserPrompt(params: {
  title: string
  category?: AiTemplateCategory
  description?: string
}): string {
  const category = params.category ?? 'standard'
  const rules = categoryRules[category].map((rule, index) => `${index + 1}. ${rule}`).join('\n')
  const description = params.description?.trim()

  return [
    `프롬프트 버전: ${PROMPT_VERSION}`,
    `문서 제목: ${params.title.trim()}`,
    `문서 분류: ${categoryLabels[category]}`,
    '',
    '분류별 작성 규칙:',
    rules,
    '',
    description ? `추가 요구사항:\n${description}` : '추가 요구사항:\n- 별도 요구사항 없음',
  ].join('\n')
}

const extractDocumentResponseSchema = z.object({
  content: z.string().default(''),
  detectedVariables: z.array(z.string()).default([]),
})

function normalizeDetectedVariables(value: unknown): string[] {
  if (!Array.isArray(value)) return []

  const seen = new Set<string>()
  const normalized: string[] = []

  for (const item of value) {
    if (typeof item !== 'string') continue
    const clean = item.replace(/[{}]/g, '').trim()
    if (!clean || seen.has(clean)) continue
    seen.add(clean)
    normalized.push(clean)
  }

  return normalized
}

export function parseExtractDocumentResponse(raw: string | null | undefined): {
  content: string
  detectedVariables: string[]
} {
  if (!raw?.trim()) {
    return { content: '', detectedVariables: [] }
  }

  let parsed: unknown
  try {
    parsed = JSON.parse(raw)
  } catch {
    return { content: '', detectedVariables: [] }
  }

  const result = extractDocumentResponseSchema.safeParse(parsed)
  if (result.success) {
    return {
      content: result.data.content.trim(),
      detectedVariables: normalizeDetectedVariables(result.data.detectedVariables),
    }
  }

  const record = parsed as Record<string, unknown>
  return {
    content: typeof record.content === 'string' ? record.content.trim() : '',
    detectedVariables: normalizeDetectedVariables(record.detectedVariables),
  }
}

export function sanitizeGeneratedTemplateContent(raw: string | null | undefined): string {
  return typeof raw === 'string' ? raw.trim() : ''
}
