import { describe, it, expect } from 'vitest'
import {
  detectFormulaType,
  FormulaType,
  extractPercentageRate,
  extractCellReferences,
  extractRelatedColumns,
  inferColumnSign,
  type DetectedFormula,
} from '@/services/formula-parser.service'

describe('detectFormulaType', () => {
  it('SUM → SUM', () => {
    expect(detectFormulaType('SUM(B2:B100)')).toBe(FormulaType.SUM)
  })
  it('SUMIF → SUM', () => {
    expect(detectFormulaType('SUMIF(A2:A100,"배송",B2:B100)')).toBe(FormulaType.SUM)
  })
  it('SUMIFS → SUM', () => {
    expect(detectFormulaType('SUMIFS(C2:C100,A2:A100,"배송")')).toBe(FormulaType.SUM)
  })
  it('SUMPRODUCT → SUM', () => {
    expect(detectFormulaType('SUMPRODUCT(A2:A10,B2:B10)')).toBe(FormulaType.SUM)
  })
  it('*0.033 → PERCENTAGE', () => {
    expect(detectFormulaType('B5*0.033')).toBe(FormulaType.PERCENTAGE)
  })
  it('*3.3% → PERCENTAGE', () => {
    expect(detectFormulaType('B5*3.3%')).toBe(FormulaType.PERCENTAGE)
  })
  it('/1.1 → PERCENTAGE (VAT 역산)', () => {
    expect(detectFormulaType('C5/1.1')).toBe(FormulaType.PERCENTAGE)
  })
  it('A5-B5 → SUBTRACTION', () => {
    expect(detectFormulaType('A5-B5')).toBe(FormulaType.SUBTRACTION)
  })
  it('C10-D10 → SUBTRACTION', () => {
    expect(detectFormulaType('C10-D10')).toBe(FormulaType.SUBTRACTION)
  })
  it('IF(B5>100,...) → CONDITIONAL', () => {
    expect(detectFormulaType('IF(B5>100,B5*0.03,B5*0.05)')).toBe(FormulaType.CONDITIONAL)
  })
  it('VLOOKUP → LOOKUP', () => {
    expect(detectFormulaType('VLOOKUP(A1,Sheet2!A:B,2,0)')).toBe(FormulaType.LOOKUP)
  })
  it('INDEX → LOOKUP', () => {
    expect(detectFormulaType('INDEX(B:B,MATCH(A1,A:A,0))')).toBe(FormulaType.LOOKUP)
  })
  it('복합 수식 → CUSTOM', () => {
    expect(detectFormulaType('ROUND(B5*1.1,0)')).toBe(FormulaType.CUSTOM)
  })
})

describe('extractPercentageRate', () => {
  it('*0.033 → 3.3', () => {
    expect(extractPercentageRate('B5*0.033')).toBeCloseTo(3.3)
  })
  it('*0.1 → 10', () => {
    expect(extractPercentageRate('C5*0.1')).toBeCloseTo(10)
  })
  it('*3.3% → 3.3', () => {
    expect(extractPercentageRate('B5*3.3%')).toBeCloseTo(3.3)
  })
  it('/1.1 → 10 (VAT)', () => {
    expect(extractPercentageRate('C5/1.1')).toBe(10)
  })
  it('수식 없음 → null', () => {
    expect(extractPercentageRate('SUM(A1:A10)')).toBeNull()
  })
})

describe('extractCellReferences', () => {
  it('단일 참조', () => {
    expect(extractCellReferences('B5*0.033')).toEqual(['B5'])
  })
  it('복수 참조', () => {
    const refs = extractCellReferences('A5-B5+C10')
    expect(refs).toContain('A5')
    expect(refs).toContain('B5')
    expect(refs).toContain('C10')
  })
  it('범위 참조', () => {
    const refs = extractCellReferences('SUM(B2:B100)')
    expect(refs).toContain('B2')
    expect(refs).toContain('B100')
  })
  it('중복 제거', () => {
    const refs = extractCellReferences('B5+B5')
    expect(refs).toEqual(['B5'])
  })
})

describe('extractRelatedColumns', () => {
  it('단일 컬럼', () => {
    expect(extractRelatedColumns('SUM(B2:B100)')).toEqual(['B'])
  })
  it('복수 컬럼', () => {
    const cols = extractRelatedColumns('A5-B5+C10')
    expect(cols).toContain('A')
    expect(cols).toContain('B')
    expect(cols).toContain('C')
  })
})

describe('inferColumnSign', () => {
  const makeFormula = (type: FormulaType, formula = ''): DetectedFormula => ({
    cell: 'Z1',
    formula,
    type,
    relatedColumns: [],
    calculatedValue: 0,
  })

  it('SUBTRACTION → negative', () => {
    expect(inferColumnSign(makeFormula(FormulaType.SUBTRACTION), [])).toBe('negative')
  })
  it('PERCENTAGE 낮은 수수료 → negative', () => {
    expect(inferColumnSign(makeFormula(FormulaType.PERCENTAGE, 'B5*0.033'), [100, 200])).toBe('negative')
  })
  it('대부분 양수 → positive', () => {
    expect(inferColumnSign(makeFormula(FormulaType.SUM), [100, 200, 300, -10])).toBe('positive')
  })
  it('대부분 음수 → negative', () => {
    expect(inferColumnSign(makeFormula(FormulaType.SUM), [-100, -200, -300, 10])).toBe('negative')
  })
  it('혼합 → mixed', () => {
    expect(inferColumnSign(makeFormula(FormulaType.CUSTOM), [100, -100])).toBe('mixed')
  })
  it('빈 배열 → mixed', () => {
    expect(inferColumnSign(makeFormula(FormulaType.CUSTOM), [])).toBe('mixed')
  })
})
