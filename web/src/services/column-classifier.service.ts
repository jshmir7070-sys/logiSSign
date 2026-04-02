/**
 * 컬럼 자동 분류기 — 헤더 키워드 + 수식 분석으로 수익/차감/정보 컬럼을 자동 매핑한다.
 */

import { type DetectedFormula, FormulaType, extractPercentageRate } from './formula-parser.service'

/* ── Types ── */

export type ColumnCategory = 'income' | 'deduction' | 'info' | 'unmapped'

export interface ColumnClassification {
  columnIndex: number
  header: string
  category: ColumnCategory
  confidence: number           // 0~1
  subType?: string             // driver_id, driver_name, total 등
  formula?: DetectedFormula
  detectedRate?: number        // 수수료율 (예: 3.3)
}

/* ── Keyword Maps ── */

const INCOME_KEYWORDS = [
  '운임', '배송료', '수익', '매출', '건당', '단가', '배달료', '운송료',
  '추가수당', '인센티브', '보조금', '지원금', '기본급', '기본운임',
  '프레쉬', '회수', '집하료', '반품료', '수입', '급여',
]

const DEDUCTION_KEYWORDS = [
  '수수료', '차감', '공제', '보험', '유류비', '장비', '위약금',
  '반품', '미배', '사고', '분실', '파손', '임대', '렌탈',
  '원천', '세금', '부가세', 'VAT', '고용보험', '산재보험',
  '국민연금', '건강보험', '과태료', '벌금', '할부', '대여',
]

const INFO_KEYWORDS = [
  '이름', '성명', '사번', '연락처', '전화', '구간', '지역',
  '날짜', '기간', '비고', '메모', '주소', '소속', '부서',
]

const DRIVER_ID_KEYWORDS = ['기사번호', '사번', 'ID', '코드', 'employee', 'code']
const DRIVER_NAME_KEYWORDS = ['기사명', '성명', '이름', '배송기사', 'name', '기사']
const TOTAL_KEYWORDS = ['합계', '총액', '정산액', '지급액', '실수령', '실지급', 'total', 'net']

/* ── Classification Logic ── */

/**
 * 헤더 문자열을 키워드 매칭으로 분류한다.
 * confidence: 정확 일치 = 0.9, 부분 일치 = 0.7
 */
export function classifyByKeyword(header: string): ColumnClassification {
  const h = header.trim().toLowerCase()
  const base: Omit<ColumnClassification, 'columnIndex' | 'header'> = {
    category: 'unmapped',
    confidence: 0,
  }

  // 차감 키워드 (합계보다 먼저 체크 — '차감합계' 같은 복합어 처리)
  if (matchesAny(h, DEDUCTION_KEYWORDS)) {
    return { ...base, columnIndex: -1, header, category: 'deduction', confidence: 0.8 }
  }

  // 기사 ID
  if (matchesAny(h, DRIVER_ID_KEYWORDS)) {
    return { ...base, columnIndex: -1, header, category: 'info', confidence: 0.95, subType: 'driver_id' }
  }

  // 기사명
  if (matchesAny(h, DRIVER_NAME_KEYWORDS)) {
    return { ...base, columnIndex: -1, header, category: 'info', confidence: 0.95, subType: 'driver_name' }
  }

  // 합계/정산액
  if (matchesAny(h, TOTAL_KEYWORDS)) {
    return { ...base, columnIndex: -1, header, category: 'income', confidence: 0.85, subType: 'total' }
  }

  // 수익 키워드
  if (matchesAny(h, INCOME_KEYWORDS)) {
    return { ...base, columnIndex: -1, header, category: 'income', confidence: 0.8 }
  }

  // 정보 키워드
  if (matchesAny(h, INFO_KEYWORDS)) {
    return { ...base, columnIndex: -1, header, category: 'info', confidence: 0.7 }
  }

  return { ...base, columnIndex: -1, header }
}

/**
 * 수식 정보를 활용하여 분류 정확도를 보강한다.
 */
export function refineWithFormula(
  classification: ColumnClassification,
  formula: DetectedFormula | undefined,
  columnValues: number[]
): ColumnClassification {
  if (!formula) {
    // 수식 없어도 값 기반 분류는 수행
    return refineWithValues(classification, columnValues)
  }

  const result = { ...classification, formula }

  // 비율 수식 → 수수료(차감) 가능성 높음
  if (formula.type === FormulaType.PERCENTAGE) {
    const rate = extractPercentageRate(formula.formula)
    if (rate !== null) {
      result.detectedRate = rate
      if (rate < 20) {
        result.category = 'deduction'
        result.confidence = Math.max(result.confidence, 0.85)
      }
    }
  }

  // SUM 수식 → 소계/합계
  if (formula.type === FormulaType.SUM) {
    result.confidence = Math.max(result.confidence, 0.7)
    result.subType = result.subType || 'subtotal'
  }

  // 차감 수식 → 차감 항목
  if (formula.type === FormulaType.SUBTRACTION) {
    result.category = 'deduction'
    result.confidence = Math.max(result.confidence, 0.75)
  }

  // 값 기반 보강
  return refineWithValues(result, columnValues)
}

/** 값 기반으로 unmapped 컬럼을 분류한다 */
function refineWithValues(
  classification: ColumnClassification,
  columnValues: number[]
): ColumnClassification {
  const result = { ...classification }
  if (columnValues.length > 0) {
    const negativeRatio = columnValues.filter(v => v < 0).length / columnValues.length
    if (negativeRatio > 0.7 && result.category === 'unmapped') {
      result.category = 'deduction'
      result.confidence = Math.max(result.confidence, 0.6)
    }
    const positiveRatio = columnValues.filter(v => v > 0).length / columnValues.length
    if (positiveRatio > 0.7 && result.category === 'unmapped') {
      result.category = 'income'
      result.confidence = Math.max(result.confidence, 0.5)
    }
  }

  return result
}

/**
 * 전체 컬럼 자동 분류를 수행한다.
 *
 * @param headers - 엑셀 헤더 배열
 * @param formulas - 감지된 수식 목록 (컬럼별)
 * @param columnValues - 각 컬럼의 숫자값 배열 (샘플링)
 */
export function classifyColumns(
  headers: string[],
  formulas: Map<number, DetectedFormula>,
  columnValues: Map<number, number[]>
): ColumnClassification[] {
  return headers.map((header, index) => {
    // 1단계: 키워드 기반 분류
    const keywordResult = classifyByKeyword(header)
    keywordResult.columnIndex = index
    keywordResult.header = header

    // 2단계: 수식 기반 보강
    const formula = formulas.get(index)
    const values = columnValues.get(index) || []
    const refined = refineWithFormula(keywordResult, formula, values)

    return refined
  })
}

/* ── Helpers ── */

function matchesAny(text: string, keywords: string[]): boolean {
  return keywords.some(kw => text.includes(kw.toLowerCase()))
}

/* ── Auto-Detect Keywords Export (프롬프트 호환) ── */
export const AUTO_DETECT_KEYWORDS = {
  income: INCOME_KEYWORDS,
  deduction: DEDUCTION_KEYWORDS,
  info: INFO_KEYWORDS,
  driver_id: DRIVER_ID_KEYWORDS,
  driver_name: DRIVER_NAME_KEYWORDS,
  total: TOTAL_KEYWORDS,
}
