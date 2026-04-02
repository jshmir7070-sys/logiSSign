import { describe, it, expect } from 'vitest'
import {
  classifyByKeyword,
  classifyColumns,
  refineWithFormula,
  type ColumnClassification,
} from '@/services/column-classifier.service'
import { FormulaType, type DetectedFormula } from '@/services/formula-parser.service'

describe('classifyByKeyword', () => {
  // 수익 키워드
  it('운임 → income', () => {
    const r = classifyByKeyword('기본운임')
    expect(r.category).toBe('income')
    expect(r.confidence).toBeGreaterThanOrEqual(0.7)
  })
  it('배송료 → income', () => {
    expect(classifyByKeyword('배송료').category).toBe('income')
  })
  it('인센티브 → income', () => {
    expect(classifyByKeyword('인센티브').category).toBe('income')
  })

  // 차감 키워드
  it('수수료 → deduction', () => {
    const r = classifyByKeyword('수수료')
    expect(r.category).toBe('deduction')
    expect(r.confidence).toBeGreaterThanOrEqual(0.7)
  })
  it('보험료 → deduction', () => {
    expect(classifyByKeyword('고용보험').category).toBe('deduction')
  })
  it('차감 → deduction', () => {
    expect(classifyByKeyword('차감합계').category).toBe('deduction')
  })
  it('유류비 → deduction', () => {
    expect(classifyByKeyword('유류비 지원').category).toBe('deduction')
  })

  // 정보 키워드
  it('이름 → info', () => {
    expect(classifyByKeyword('기사 이름').category).toBe('info')
  })
  it('연락처 → info', () => {
    expect(classifyByKeyword('연락처').category).toBe('info')
  })

  // 특수 키워드
  it('사번 → info (driver_id)', () => {
    const r = classifyByKeyword('사번')
    expect(r.category).toBe('info')
    expect(r.subType).toBe('driver_id')
    expect(r.confidence).toBeGreaterThanOrEqual(0.9)
  })
  it('기사명 → info (driver_name)', () => {
    const r = classifyByKeyword('기사명')
    expect(r.category).toBe('info')
    expect(r.subType).toBe('driver_name')
  })
  it('합계 → income (total)', () => {
    const r = classifyByKeyword('정산합계')
    expect(r.category).toBe('income')
    expect(r.subType).toBe('total')
  })
  it('실수령 → income (total)', () => {
    const r = classifyByKeyword('실수령액')
    expect(r.category).toBe('income')
    expect(r.subType).toBe('total')
  })

  // 미분류
  it('알 수 없는 헤더 → unmapped', () => {
    const r = classifyByKeyword('Column7')
    expect(r.category).toBe('unmapped')
    expect(r.confidence).toBe(0)
  })
})

describe('refineWithFormula', () => {
  const base: ColumnClassification = {
    columnIndex: 0,
    header: '테스트',
    category: 'unmapped',
    confidence: 0,
  }

  it('PERCENTAGE + 낮은 수수료 → deduction', () => {
    const formula: DetectedFormula = {
      cell: 'C5',
      formula: 'B5*0.033',
      type: FormulaType.PERCENTAGE,
      relatedColumns: ['B'],
      calculatedValue: 330,
    }
    const r = refineWithFormula(base, formula, [100, 200])
    expect(r.category).toBe('deduction')
    expect(r.detectedRate).toBeCloseTo(3.3)
    expect(r.confidence).toBeGreaterThanOrEqual(0.85)
  })

  it('SUM → subtotal confidence 증가', () => {
    const formula: DetectedFormula = {
      cell: 'D100',
      formula: 'SUM(D2:D99)',
      type: FormulaType.SUM,
      relatedColumns: ['D'],
      calculatedValue: 50000,
    }
    const r = refineWithFormula(base, formula, [])
    expect(r.confidence).toBeGreaterThanOrEqual(0.7)
    expect(r.subType).toBe('subtotal')
  })

  it('SUBTRACTION → deduction', () => {
    const formula: DetectedFormula = {
      cell: 'E5',
      formula: 'C5-D5',
      type: FormulaType.SUBTRACTION,
      relatedColumns: ['C', 'D'],
      calculatedValue: -5000,
    }
    const r = refineWithFormula(base, formula, [])
    expect(r.category).toBe('deduction')
  })

  it('대부분 음수 값 → deduction', () => {
    const r = refineWithFormula(base, undefined, [-100, -200, -300, -400, 10])
    expect(r.category).toBe('deduction')
  })

  it('대부분 양수 값 → income', () => {
    const r = refineWithFormula(base, undefined, [100, 200, 300, 400, -10])
    expect(r.category).toBe('income')
  })
})

describe('classifyColumns', () => {
  it('전체 파이프라인', () => {
    const headers = ['사번', '기사명', '배송건수', '기본운임', '수수료', '보험료', '정산액', '비고']
    const formulas = new Map<number, DetectedFormula>()
    formulas.set(4, {
      cell: 'E2',
      formula: 'D2*0.033',
      type: FormulaType.PERCENTAGE,
      relatedColumns: ['D'],
      calculatedValue: 3300,
    })

    const columnValues = new Map<number, number[]>()
    columnValues.set(3, [100000, 120000, 90000]) // 기본운임 — 양수
    columnValues.set(4, [-3300, -3960, -2970])   // 수수료 — 음수
    columnValues.set(5, [-15000, -15000, -15000]) // 보험료 — 음수

    const result = classifyColumns(headers, formulas, columnValues)

    expect(result).toHaveLength(8)

    // 사번
    expect(result[0].category).toBe('info')
    expect(result[0].subType).toBe('driver_id')

    // 기사명
    expect(result[1].category).toBe('info')
    expect(result[1].subType).toBe('driver_name')

    // 기본운임
    expect(result[3].category).toBe('income')

    // 수수료 (키워드 + 수식 + 음수값)
    expect(result[4].category).toBe('deduction')
    expect(result[4].detectedRate).toBeCloseTo(3.3)

    // 보험료
    expect(result[5].category).toBe('deduction')

    // 정산액
    expect(result[6].subType).toBe('total')
  })
})
