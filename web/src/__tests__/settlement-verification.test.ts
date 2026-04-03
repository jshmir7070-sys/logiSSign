import { describe, it, expect } from 'vitest'
import {
  verifySettlement,
  verifyBulkSettlements,
} from '@/services/settlement-verification.service'
import type { SettlementDriverData } from '@/types/settlement-template'

function makeDriver(overrides: Partial<SettlementDriverData> = {}): SettlementDriverData {
  return {
    name: '홍길동',
    id: 'DRV001',
    incomeItems: { '기본운임': 500000, '인센티브': 20000 },
    deductionItems: { '수수료': 16500, '보험료': 15000 },
    incomeTotal: 520000,
    deductionTotal: 31500,
    netAmount: 488500,
    ...overrides,
  }
}

describe('verifySettlement', () => {
  it('정상 데이터 → match', () => {
    const result = verifySettlement(makeDriver(), 0)
    expect(result.status).toBe('match')
    expect(result.details).toHaveLength(3)
    expect(result.details.every(d => d.status === 'match')).toBe(true)
    expect(result.warnings).toHaveLength(0)
  })

  it('수익 합계 불일치 → mismatch', () => {
    const driver = makeDriver({ incomeTotal: 999999 })
    const result = verifySettlement(driver, 0)
    expect(result.status).toBe('mismatch')
    expect(result.details[0].status).toBe('mismatch')
    expect(result.details[0].field).toBe('수익 합계')
  })

  it('차감 합계 불일치 → mismatch', () => {
    const driver = makeDriver({ deductionTotal: 999 })
    const result = verifySettlement(driver, 0)
    expect(result.status).toBe('mismatch')
    expect(result.details[1].status).toBe('mismatch')
  })

  it('실수령 불일치 → mismatch', () => {
    const driver = makeDriver({ netAmount: 0 })
    const result = verifySettlement(driver, 0)
    expect(result.status).toBe('mismatch')
    expect(result.details[2].status).toBe('mismatch')
  })

  it('음수 정산 → warning', () => {
    const driver = makeDriver({
      incomeItems: { '운임': 10000 },
      deductionItems: { '수수료': 50000 },
      incomeTotal: 10000,
      deductionTotal: 50000,
      netAmount: -40000,
    })
    const result = verifySettlement(driver, 0)
    expect(result.warnings.some(w => w.includes('음수'))).toBe(true)
  })

  it('차감 > 수익 → warning', () => {
    const driver = makeDriver({
      incomeItems: { '운임': 10000 },
      deductionItems: { '수수료': 50000 },
      incomeTotal: 10000,
      deductionTotal: 50000,
      netAmount: -40000,
    })
    const result = verifySettlement(driver, 0)
    expect(result.warnings.some(w => w.includes('초과'))).toBe(true)
  })

  it('빈 항목 → 0원 정상 처리', () => {
    const driver = makeDriver({
      incomeItems: {},
      deductionItems: {},
      incomeTotal: 0,
      deductionTotal: 0,
      netAmount: 0,
    })
    const result = verifySettlement(driver, 0)
    expect(result.status).toBe('match')
  })
})

describe('verifyBulkSettlements', () => {
  it('빈 배열 → 빈 결과', () => {
    const summary = verifyBulkSettlements([])
    expect(summary.total).toBe(0)
    expect(summary.results).toHaveLength(0)
  })

  it('정상 데이터 3명 → 전부 match', () => {
    const drivers = [makeDriver(), makeDriver({ name: '김철수' }), makeDriver({ name: '이영희' })]
    const summary = verifyBulkSettlements(drivers)
    expect(summary.total).toBe(3)
    expect(summary.match).toBe(3)
    expect(summary.mismatch).toBe(0)
  })

  it('이상치 감지 (±50%)', () => {
    const drivers = [
      makeDriver({ netAmount: 500000 }),
      makeDriver({ name: '김철수', netAmount: 480000 }),
      makeDriver({ name: '이영희', netAmount: 510000 }),
      makeDriver({ name: '박민수', netAmount: 1500000 }), // 이상치
    ]
    const summary = verifyBulkSettlements(drivers)
    const outlier = summary.results.find(r => r.driverName === '박민수')
    expect(outlier?.warnings.some(w => w.includes('이상치'))).toBe(true)
  })

  it('mismatch + warning 카운트', () => {
    const drivers = [
      makeDriver(),
      makeDriver({ name: '불일치', incomeTotal: 999 }),
    ]
    const summary = verifyBulkSettlements(drivers)
    expect(summary.mismatch).toBe(1)
    expect(summary.match).toBe(1)
  })
})
