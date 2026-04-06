import { describe, expect, it } from 'vitest'
import {
  aggregateParsedRows,
  calculateRateAmount,
  parseExcelData,
  type ExcelColumnMapping,
} from '@/services/excel-settlement.service'

describe('excel settlement helpers', () => {
  it('parses optional amount columns', () => {
    const mapping: ExcelColumnMapping = {
      employee_code_col: 'ID',
      delivery_count_col: '배송건수',
      delivery_amount_col: '배송금액',
      return_count_col: '반품건수',
      return_amount_col: '반품금액',
      collect_count_col: '집하건수',
      collect_amount_col: '집하금액',
      fresh_back_amount_col: '프레쉬백',
      incentive_amount_col: '인센티브',
      etc_income_amount_col: '기타수입',
    }

    const { parsed } = parseExcelData([
      {
        ID: 'DRV001',
        배송건수: 10,
        배송금액: 120000,
        반품건수: 2,
        반품금액: 12000,
        집하건수: 1,
        집하금액: 5000,
        프레쉬백: 3000,
        인센티브: 7000,
        기타수입: 2000,
      },
    ], mapping)

    expect(parsed[0].delivery_amount).toBe(120000)
    expect(parsed[0].return_amount).toBe(12000)
    expect(parsed[0].collect_amount).toBe(5000)
    expect(parsed[0].fresh_back_amount).toBe(3000)
    expect(parsed[0].incentive_amount).toBe(7000)
    expect(parsed[0].etc_income_amount).toBe(2000)
  })

  it('merges duplicated employee rows', () => {
    const aggregated = aggregateParsedRows([
      {
        employee_code: 'DRV001',
        delivery_count: 10,
        return_count: 1,
        collect_count: 0,
        delivery_amount: 100000,
        return_amount: 5000,
        collect_amount: 0,
        fresh_count: 0,
        etc_count: 0,
        fresh_back_amount: 1000,
        incentive_amount: 2000,
        etc_income_amount: 0,
        raw_data: {},
      },
      {
        employee_code: 'DRV001',
        delivery_count: 5,
        return_count: 2,
        collect_count: 1,
        delivery_amount: 40000,
        return_amount: 8000,
        collect_amount: 3000,
        fresh_count: 0,
        etc_count: 0,
        fresh_back_amount: 0,
        incentive_amount: 1000,
        etc_income_amount: 500,
        raw_data: {},
      },
    ])

    expect(aggregated).toHaveLength(1)
    expect(aggregated[0].delivery_count).toBe(15)
    expect(aggregated[0].return_count).toBe(3)
    expect(aggregated[0].collect_count).toBe(1)
    expect(aggregated[0].delivery_amount).toBe(140000)
    expect(aggregated[0].return_amount).toBe(13000)
    expect(aggregated[0].collect_amount).toBe(3000)
    expect(aggregated[0].incentive_amount).toBe(3000)
    expect(aggregated[0].etc_income_amount).toBe(500)
  })

  it('calculates percentage mode as fee deduction from gross sales', () => {
    expect(calculateRateAmount('percentage', 10, 10, 100000)).toBe(90000)
    expect(calculateRateAmount('fixed', 12, 1500, 0)).toBe(18000)
  })
})
