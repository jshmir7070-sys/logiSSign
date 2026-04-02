/**
 * 정산 검증 서비스 — 교차검증 + 이상치 감지
 */

import type { SettlementDriverData } from '@/types/settlement-template'

/* ── Types ── */

export type VerificationStatus = 'match' | 'mismatch' | 'warning'

export interface VerificationDetail {
  field: string
  expectedValue: number
  actualValue: number
  difference: number
  status: VerificationStatus
}

export interface VerificationResult {
  driverName: string
  driverIndex: number
  status: VerificationStatus
  details: VerificationDetail[]
  warnings: string[]
}

export interface BulkVerificationSummary {
  total: number
  match: number
  mismatch: number
  warning: number
  results: VerificationResult[]
}

/* ── Verification Logic ── */

/**
 * 단일 기사 정산 검증
 * 1. 수익 합계 = 각 수익 항목 합산
 * 2. 차감 합계 = 각 차감 항목 합산
 * 3. 실 수령액 = 수익 - 차감
 * 4. 음수 정산액 경고
 */
export function verifySettlement(
  driver: SettlementDriverData,
  index: number
): VerificationResult {
  const details: VerificationDetail[] = []
  const warnings: string[] = []

  // 1. 수익 합계 검증
  const incomeSum = Object.values(driver.incomeItems).reduce((a, b) => a + b, 0)
  const incomeDiff = Math.abs(incomeSum - driver.incomeTotal)
  details.push({
    field: '수익 합계',
    expectedValue: incomeSum,
    actualValue: driver.incomeTotal,
    difference: incomeDiff,
    status: incomeDiff === 0 ? 'match' : incomeDiff <= 1 ? 'warning' : 'mismatch',
  })

  // 2. 차감 합계 검증
  const deductionSum = Object.values(driver.deductionItems).reduce((a, b) => a + b, 0)
  const deductionDiff = Math.abs(deductionSum - driver.deductionTotal)
  details.push({
    field: '차감 합계',
    expectedValue: deductionSum,
    actualValue: driver.deductionTotal,
    difference: deductionDiff,
    status: deductionDiff === 0 ? 'match' : deductionDiff <= 1 ? 'warning' : 'mismatch',
  })

  // 3. 실수령 = 수익 - 차감
  const expectedNet = driver.incomeTotal - driver.deductionTotal
  const netDiff = Math.abs(expectedNet - driver.netAmount)
  details.push({
    field: '실수령액',
    expectedValue: expectedNet,
    actualValue: driver.netAmount,
    difference: netDiff,
    status: netDiff === 0 ? 'match' : netDiff <= 1 ? 'warning' : 'mismatch',
  })

  // 4. 경고: 음수 정산
  if (driver.netAmount < 0) {
    warnings.push(`실수령액이 음수입니다 (${driver.netAmount.toLocaleString('ko-KR')}원)`)
  }

  // 5. 경고: 차감이 수익 초과
  if (driver.deductionTotal > driver.incomeTotal) {
    warnings.push('차감 합계가 수익 합계를 초과합니다')
  }

  // 전체 상태 결정
  const hasMismatch = details.some(d => d.status === 'mismatch')
  const hasWarning = details.some(d => d.status === 'warning') || warnings.length > 0
  const status: VerificationStatus = hasMismatch ? 'mismatch' : hasWarning ? 'warning' : 'match'

  return {
    driverName: driver.name,
    driverIndex: index,
    status,
    details,
    warnings,
  }
}

/**
 * 전체 기사 검증 + 이상치 감지
 * 이상치: 평균 대비 ±50% 이상 차이
 */
export function verifyBulkSettlements(drivers: SettlementDriverData[]): BulkVerificationSummary {
  if (drivers.length === 0) {
    return { total: 0, match: 0, mismatch: 0, warning: 0, results: [] }
  }

  // 개별 검증
  const results = drivers.map((d, i) => verifySettlement(d, i))

  // 이상치 감지 — 실수령액 기준
  const netAmounts = drivers.map(d => d.netAmount).filter(n => n > 0)
  if (netAmounts.length >= 3) {
    const avg = netAmounts.reduce((a, b) => a + b, 0) / netAmounts.length
    const threshold = avg * 0.5  // ±50%

    drivers.forEach((d, i) => {
      if (d.netAmount > 0) {
        const diff = Math.abs(d.netAmount - avg)
        if (diff > threshold) {
          const pct = ((d.netAmount / avg - 1) * 100).toFixed(0)
          results[i].warnings.push(
            `실수령액이 평균(${Math.round(avg).toLocaleString('ko-KR')}원) 대비 ${pct}% 차이 (이상치)`
          )
          if (results[i].status === 'match') {
            results[i].status = 'warning'
          }
        }
      }
    })
  }

  return {
    total: results.length,
    match: results.filter(r => r.status === 'match').length,
    mismatch: results.filter(r => r.status === 'mismatch').length,
    warning: results.filter(r => r.status === 'warning').length,
    results,
  }
}
