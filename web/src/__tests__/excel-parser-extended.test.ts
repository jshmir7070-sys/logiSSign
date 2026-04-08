/**
 * excel-parser.service extended tests
 *
 * Tests for Coupang-specific parsing: parseCoupangRaw, aggregateCoupangSummaryRows,
 * and detectSheetTypes.
 */
import { describe, it, expect, vi } from 'vitest'

// Mock the browser supabase client (imported at module level by the service)
vi.mock('@/lib/supabase', () => ({
  createBrowserSupabaseClient: vi.fn(() => ({})),
}))

import {
  parseCoupangRaw,
  aggregateCoupangSummaryRows,
  detectSheetTypes,
} from '@/services/excel-parser.service'
import type { CoupangSummaryRow } from '@/services/excel-parser.service'

/* ── parseCoupangRaw ── */

describe('parseCoupangRaw', () => {
  it('filters out non-driver rows (no @ in ID)', () => {
    const rows: unknown[][] = [
      // Row 0 is header, skipped by parser (starts at i=1)
      ['type', 'ID', 'route', 'date', 'camp', 'shift', 'vendor', 'del', 'ret', 'rate', 'extra', 'base', 'extraAmt', 'total', 'fresh'],
      // Valid driver row (has @)
      ['배송', 'driver1@camp', 'R001', 20260301, 'CAMP1', '주간', 'V1', 50, 2, 3500, 100, 175000, 5000, 180000, 0],
      // Non-driver row (no @) - should be filtered
      ['배송', 'ADMIN_USER', 'R002', 20260301, 'CAMP1', '주간', 'V1', 30, 1, 3500, 100, 105000, 3000, 108000, 0],
      // Another valid driver row
      ['반품', 'driver2@camp', 'R003', 20260301, 'CAMP2', '야간', 'V2', 10, 5, 3000, 50, 30000, 250, 30250, 0],
    ]

    const { parsed } = parseCoupangRaw(rows)

    expect(parsed).toHaveLength(2)
    expect(parsed[0].employee_code).toBe('driver1@camp')
    expect(parsed[1].employee_code).toBe('driver2@camp')
    // The ADMIN_USER row without @ should not appear
    expect(parsed.every((r) => r.employee_code.includes('@'))).toBe(true)
  })

  it('skips zero-delivery rows (0 delivery and 0 return, not 수기반영)', () => {
    const rows: unknown[][] = [
      ['type', 'ID', 'route', 'date', 'camp', 'shift', 'vendor', 'del', 'ret', 'rate', 'extra', 'base', 'extraAmt', 'total', 'fresh'],
      // Normal row with deliveries
      ['배송', 'a@camp', 'R001', 20260301, 'C1', 'D', 'V1', 50, 0, 3500, 0, 175000, 0, 175000, 0],
      // Zero delivery AND zero return -> should be skipped
      ['배송', 'b@camp', 'R002', 20260301, 'C1', 'D', 'V1', 0, 0, 3500, 0, 0, 0, 0, 0],
      // Zero delivery but non-zero return -> should be kept
      ['반품', 'c@camp', 'R003', 20260301, 'C1', 'D', 'V1', 0, 3, 2000, 0, 6000, 0, 6000, 0],
      // Zero both but type is 수기반영 -> should be kept
      ['수기반영', 'd@camp', 'R004', 20260301, 'C1', 'D', 'V1', 0, 0, 0, 0, 5000, 0, 5000, 0],
    ]

    const { parsed } = parseCoupangRaw(rows)

    expect(parsed).toHaveLength(3)
    expect(parsed.map((r) => r.employee_code)).toEqual(['a@camp', 'c@camp', 'd@camp'])
  })

  it('parses all numeric fields correctly', () => {
    const rows: unknown[][] = [
      ['header'],
      ['배송', 'test@camp', 'R100', 20260315, 'CAMP-A', '주간', 'VENDOR-X', 120, 8, 3500, 200, 420000, 24000, 444000, 15000],
    ]

    const { parsed } = parseCoupangRaw(rows)

    expect(parsed).toHaveLength(1)
    const row = parsed[0]
    expect(row.type).toBe('배송')
    expect(row.employee_code).toBe('test@camp')
    expect(row.route_code).toBe('R100')
    expect(row.delivery_date).toBe(20260315)
    expect(row.delivery_count).toBe(120)
    expect(row.return_count).toBe(8)
    expect(row.coupang_rate).toBe(3500)
    expect(row.extra_incentive_unit).toBe(200)
    expect(row.base_amount).toBe(420000)
    expect(row.extra_amount).toBe(24000)
    expect(row.total_amount).toBe(444000)
    expect(row.fresh_incentive).toBe(15000)
  })
})

/* ── aggregateCoupangSummaryRows ── */

describe('aggregateCoupangSummaryRows', () => {
  it('merges rows with the same employee_code', () => {
    const rows: CoupangSummaryRow[] = [
      {
        employee_code: 'driver1@camp',
        delivery_count: 100,
        return_count: 5,
        total_count: 105,
        coupang_base_amount: 350000,
        fresh_incentive: 10000,
        extra_incentive: 5000,
        damage_deduction: 2000,
        coupang_total: 363000,
      },
      {
        employee_code: 'driver1@camp',
        delivery_count: 80,
        return_count: 3,
        total_count: 83,
        coupang_base_amount: 280000,
        fresh_incentive: 8000,
        extra_incentive: 3000,
        damage_deduction: 1000,
        coupang_total: 290000,
      },
      {
        employee_code: 'driver2@camp',
        delivery_count: 50,
        return_count: 2,
        total_count: 52,
        coupang_base_amount: 175000,
        fresh_incentive: 5000,
        extra_incentive: 2000,
        damage_deduction: 0,
        coupang_total: 182000,
      },
    ]

    const result = aggregateCoupangSummaryRows(rows)

    expect(result).toHaveLength(2)

    const driver1 = result.find((r) => r.employee_code === 'driver1@camp')!
    expect(driver1).toBeDefined()
    expect(driver1.delivery_count).toBe(180) // 100 + 80
    expect(driver1.return_count).toBe(8)     // 5 + 3
    expect(driver1.total_count).toBe(188)    // 105 + 83
    expect(driver1.coupang_base_amount).toBe(630000) // 350000 + 280000
    expect(driver1.fresh_incentive).toBe(18000) // 10000 + 8000
    expect(driver1.extra_incentive).toBe(8000)  // 5000 + 3000
    expect(driver1.damage_deduction).toBe(3000) // 2000 + 1000
    expect(driver1.coupang_total).toBe(653000)  // 363000 + 290000

    const driver2 = result.find((r) => r.employee_code === 'driver2@camp')!
    expect(driver2.delivery_count).toBe(50) // unchanged
  })

  it('returns single row as-is when no duplicates', () => {
    const rows: CoupangSummaryRow[] = [
      {
        employee_code: 'solo@camp',
        delivery_count: 40,
        return_count: 1,
        total_count: 41,
        coupang_base_amount: 140000,
        fresh_incentive: 3000,
        extra_incentive: 1000,
        damage_deduction: 0,
        coupang_total: 144000,
      },
    ]

    const result = aggregateCoupangSummaryRows(rows)

    expect(result).toHaveLength(1)
    expect(result[0].delivery_count).toBe(40)
    expect(result[0].coupang_total).toBe(144000)
  })
})

/* ── detectSheetTypes ── */

describe('detectSheetTypes', () => {
  const emptyRows = () => [] as unknown[][]

  it('identifies coupang_summary by sheet name containing "정산총괄"', () => {
    const result = detectSheetTypes(
      ['정산총괄', '기타시트'],
      emptyRows
    )

    expect(result).toHaveLength(2)
    expect(result[0].detected).toBe('coupang_summary')
    expect(result[0].name).toBe('정산총괄')
    expect(result[1].detected).toBe('generic')
  })

  it('identifies coupang_summary by sheet name containing "summary" (case insensitive)', () => {
    const result = detectSheetTypes(
      ['Monthly Summary'],
      emptyRows
    )

    expect(result[0].detected).toBe('coupang_summary')
  })

  it('identifies coupang_raw by sheet name containing "정산Raw"', () => {
    const result = detectSheetTypes(
      ['정산Raw', '기타데이터'],
      emptyRows
    )

    expect(result[0].detected).toBe('coupang_raw')
    expect(result[0].name).toBe('정산Raw')
    expect(result[1].detected).toBe('generic')
  })

  it('identifies coupang_raw by sheet name containing "raw" (case insensitive)', () => {
    const result = detectSheetTypes(
      ['2026-03 Raw Data'],
      emptyRows
    )

    expect(result[0].detected).toBe('coupang_raw')
  })

  it('identifies damage_list by sheet name containing "분실파손"', () => {
    const result = detectSheetTypes(
      ['분실파손'],
      emptyRows
    )

    expect(result[0].detected).toBe('damage_list')
  })

  it('falls back to header detection when name is generic', () => {
    // Provide 5 rows so the header check on row index 4 is triggered
    const getRows = (name: string) => {
      if (name === 'Sheet1') {
        return [
          ['A'],
          ['B'],
          ['C'],
          ['D'],
          ['번호', 'ID', '배송', '반품'], // row[4] contains ID and 배송
        ] as unknown[][]
      }
      return [] as unknown[][]
    }

    const result = detectSheetTypes(['Sheet1'], getRows)
    expect(result[0].detected).toBe('coupang_summary')
  })

  it('marks as generic when no pattern matches', () => {
    const result = detectSheetTypes(
      ['매출내역', '인건비'],
      emptyRows
    )

    expect(result[0].detected).toBe('generic')
    expect(result[1].detected).toBe('generic')
  })
})
