/**
 * 정산 서비스 배럴 (barrel re-export)
 *
 * 기존 import 호환성을 위해 3개 하위 서비스에서 모두 re-export
 *
 * 분리된 서비스:
 *  - excel-parser.service.ts      — 엑셀 파싱, 컬럼 매핑, 시트 감지, 기사 매칭
 *  - settlement-calculator.service.ts — 세금/공제 계산, 일반 정산, DB 저장
 *  - coupang-settlement.service.ts    — 쿠팡 정산 (라우트별 + 요약 모드)
 */

// excel-parser
export {
  type ExcelColumnMapping,
  type ParsedExcelRow,
  type SheetInfo,
  type UnmatchedRow,
  type DriverMatch,
  type CoupangSummaryRow,
  type CoupangRawRow,
  type RouteSettlementDetail,
  DEFAULT_COLUMN_MAPPINGS,
  parseExcelData,
  detectSheetTypes,
  parseCoupangSummary,
  parseCoupangRaw,
  aggregateParsedRows,
  aggregateCoupangSummaryRows,
  matchDrivers,
} from './excel-parser.service'

// settlement-calculator
export {
  type SettlementCalcResult,
  calculateTaxDeductions,
  calculateRateAmount,
  appendContractDeductions,
  appendInsuranceDeductions,
  calculateSettlements,
  saveSettlements,
} from './settlement-calculator.service'

// coupang-settlement
export {
  calculateCoupangRouteSettlements,
  calculateCoupangSettlements,
} from './coupang-settlement.service'
