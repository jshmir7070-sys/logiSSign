import { describe, it, expect } from 'vitest'
import {
  parseExcelData,
  detectSheetTypes,
  parseCoupangSummary,
  type ExcelColumnMapping,
} from '@/services/excel-settlement.service'

describe('parseExcelData', () => {
  const mapping: ExcelColumnMapping = {
    employee_code_col: 'ID',
    delivery_count_col: '배송',
    return_count_col: '반품',
  }

  it('정상 행 파싱', () => {
    const rows = [
      { ID: 'DRV001', '배송': 100, '반품': 5 },
      { ID: 'DRV002', '배송': 80, '반품': 3 },
    ]
    const { parsed, errors } = parseExcelData(rows, mapping)
    expect(parsed).toHaveLength(2)
    expect(errors).toHaveLength(0)
    expect(parsed[0].employee_code).toBe('DRV001')
    expect(parsed[0].delivery_count).toBe(100)
    expect(parsed[0].return_count).toBe(5)
  })

  it('ID 없는 행 건너뜀', () => {
    const rows = [
      { ID: '', '배송': 100 },
      { ID: 'DRV001', '배송': 50 },
    ]
    const { parsed } = parseExcelData(rows, mapping)
    expect(parsed).toHaveLength(1)
    expect(parsed[0].employee_code).toBe('DRV001')
  })

  it('숫자 아닌 값 → 0', () => {
    const rows = [{ ID: 'DRV001', '배송': 'abc', '반품': null }]
    const { parsed } = parseExcelData(rows, mapping)
    expect(parsed[0].delivery_count).toBe(0)
    expect(parsed[0].return_count).toBe(0)
  })

  it('빈 배열 → 빈 결과', () => {
    const { parsed, errors } = parseExcelData([], mapping)
    expect(parsed).toHaveLength(0)
    expect(errors).toHaveLength(0)
  })

  it('optional 컬럼 미매핑 시 0', () => {
    const minMapping: ExcelColumnMapping = {
      employee_code_col: 'code',
      delivery_count_col: 'del',
    }
    const rows = [{ code: 'A', del: 10 }]
    const { parsed } = parseExcelData(rows, minMapping)
    expect(parsed[0].return_count).toBe(0)
    expect(parsed[0].collect_count).toBe(0)
    expect(parsed[0].fresh_count).toBe(0)
  })
})

describe('detectSheetTypes', () => {
  it('정산총괄 시트 감지', () => {
    const result = detectSheetTypes(
      ['정산총괄', '기타'],
      (name) => name === '정산총괄' ? [[], [], [], [], ['', '', '', 'ID', '배송']] : [[]]
    )
    expect(result).toHaveLength(2)
    expect(result[0].detected).toBe('coupang_summary')
    expect(result[1].detected).toBe('generic')
  })

  it('정산Raw 시트 감지', () => {
    const result = detectSheetTypes(['정산Raw'], () => [[]])
    expect(result[0].detected).toBe('coupang_raw')
  })

  it('분실파손 시트 감지', () => {
    const result = detectSheetTypes(['분실파손내역'], () => [[]])
    expect(result[0].detected).toBe('damage_list')
  })

  it('헤더 기반 자동 감지', () => {
    const result = detectSheetTypes(
      ['Sheet1'],
      () => [[], [], [], [], ['A', 'B', 'ID', '배송', '반품'], [], []]
    )
    expect(result[0].detected).toBe('coupang_summary')
  })
})

describe('parseCoupangSummary', () => {
  it('정상 파싱 (row 5부터)', () => {
    const rows: unknown[][] = [
      [], [], [], [],
      ['', '', '', 'ID', '배송', '반품', '합계', '기본', '신선', '추가', '파손'], // header row 4
      ['', '', '', 'drv@test', 100, 5, 105, 50000, 1000, 500, 0],                // data row 5
    ]
    const { parsed, skipped } = parseCoupangSummary(rows)
    expect(parsed).toHaveLength(1)
    expect(skipped).toHaveLength(0)
    expect(parsed[0].employee_code).toBe('drv@test')
    expect(parsed[0].delivery_count).toBe(100)
    expect(parsed[0].return_count).toBe(5)
  })

  it('@ 없는 ID는 skip', () => {
    const rows: unknown[][] = [
      [], [], [], [],
      ['header'],
      ['', '', '', '에코백회수', 0, 0, 0, 0, 0, 0, 0],
    ]
    const { parsed, skipped } = parseCoupangSummary(rows)
    expect(parsed).toHaveLength(0)
    expect(skipped).toContain('에코백회수')
  })

  it('빈 rows → 빈 결과', () => {
    const { parsed } = parseCoupangSummary([])
    expect(parsed).toHaveLength(0)
  })
})
