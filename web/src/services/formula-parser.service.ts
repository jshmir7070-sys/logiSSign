/**
 * 수식 파싱 엔진 — SheetJS 수식 문자열을 분석하여 정산 로직을 감지한다.
 *
 * SheetJS는 cellFormula:true 옵션으로 파싱 시 셀의 f 속성에 수식 문자열을 제공한다.
 * 이 모듈은 해당 수식을 분석하여 FormulaType을 결정하고 관련 컬럼/값을 추출한다.
 */

/* ── Types ── */

export enum FormulaType {
  SUM = 'SUM',
  PERCENTAGE = 'PERCENTAGE',
  SUBTRACTION = 'SUBTRACTION',
  CONDITIONAL = 'CONDITIONAL',
  LOOKUP = 'LOOKUP',
  CUSTOM = 'CUSTOM',
}

export interface ParsedCell {
  value: unknown
  formula: string | null
  type: 'number' | 'string' | 'date' | 'boolean' | 'empty'
  address: string
}

export interface DetectedFormula {
  cell: string
  formula: string
  type: FormulaType
  relatedColumns: string[]
  calculatedValue: number
}

export interface ParsedSheetWithFormulas {
  name: string
  headers: string[]
  rows: ParsedCell[][]
  formulas: DetectedFormula[]
  totalRows: number
  totalCols: number
}

/* ── Formula Detection ── */

/** 수식 문자열에서 FormulaType을 감지한다 */
export function detectFormulaType(formula: string): FormulaType {
  const upper = formula.toUpperCase().trim()

  // SUM, SUMIF, SUMIFS, SUMPRODUCT
  if (/^SUM(IF|IFS|PRODUCT)?\s*\(/.test(upper)) {
    return FormulaType.SUM
  }

  // VLOOKUP, HLOOKUP, INDEX, MATCH
  if (/^(VLOOKUP|HLOOKUP|INDEX|MATCH|XLOOKUP)\s*\(/.test(upper)) {
    return FormulaType.LOOKUP
  }

  // IF 조건문
  if (/^IF\s*\(/.test(upper)) {
    return FormulaType.CONDITIONAL
  }

  // 비율 계산: *0.0X, *X%, /100
  if (/\*\s*0\.\d+/.test(formula) || /\*\s*\d+(\.\d+)?%/.test(formula) || /\/\s*1\.1\b/.test(formula)) {
    return FormulaType.PERCENTAGE
  }

  // 차감: A-B 패턴 (셀 참조 간 뺄셈)
  if (/^[A-Z]+\d+\s*-\s*[A-Z]+\d+$/.test(upper) || /[A-Z]+\d+\s*-\s*[A-Z]+\d+/.test(upper)) {
    return FormulaType.SUBTRACTION
  }

  return FormulaType.CUSTOM
}

/** 수식에서 수수료율을 추출한다 (예: *0.033 → 3.3) */
export function extractPercentageRate(formula: string): number | null {
  // *0.033, *0.1 패턴
  const decimalMatch = formula.match(/\*\s*(0\.\d+)/)
  if (decimalMatch) {
    return parseFloat(decimalMatch[1]) * 100
  }

  // *3.3%, *10% 패턴
  const percentMatch = formula.match(/\*\s*(\d+(?:\.\d+)?)%/)
  if (percentMatch) {
    return parseFloat(percentMatch[1])
  }

  // /1.1 패턴 (VAT 역산 10%)
  if (/\/\s*1\.1\b/.test(formula)) {
    return 10
  }

  return null
}

/** 수식에서 참조하는 셀 주소를 추출한다 */
export function extractCellReferences(formula: string): string[] {
  const refs: string[] = []
  const cellPattern = /([A-Z]+)(\d+)/g
  let match

  while ((match = cellPattern.exec(formula)) !== null) {
    refs.push(match[0])
  }

  return Array.from(new Set(refs))
}

/** 셀 주소에서 컬럼 문자를 추출한다 (B5 → B) */
export function extractColumnLetter(address: string): string {
  const match = address.match(/^([A-Z]+)/)
  return match ? match[1] : ''
}

/** 셀 참조 목록에서 고유 컬럼 목록을 추출한다 */
export function extractRelatedColumns(formula: string): string[] {
  const refs = extractCellReferences(formula)
  const columns = refs.map(extractColumnLetter).filter(Boolean)
  return Array.from(new Set(columns))
}

/* ── Sheet Parsing ── */

/**
 * SheetJS 워크시트에서 수식 포함 파싱한다.
 * SheetJS의 sheet_to_json 대신 직접 셀을 순회하여 수식(f)을 보존한다.
 */
export function parseSheetWithFormulas(
  worksheet: Record<string, unknown>,
  sheetName: string
): ParsedSheetWithFormulas {
  const ws = worksheet as Record<string, { v?: unknown; f?: string; t?: string }>
  const ref = (ws['!ref'] as unknown as string) || 'A1'
  const range = decodeRange(ref)

  const headers: string[] = []
  const rows: ParsedCell[][] = []
  const formulas: DetectedFormula[] = []

  // 헤더 추출 (첫 번째 행)
  for (let c = range.s.c; c <= range.e.c; c++) {
    const addr = encodeCell(range.s.r, c)
    const cell = ws[addr]
    headers.push(cell?.v != null ? String(cell.v) : `Column${c + 1}`)
  }

  // 데이터 행 + 수식 추출
  for (let r = range.s.r + 1; r <= range.e.r; r++) {
    const row: ParsedCell[] = []

    for (let c = range.s.c; c <= range.e.c; c++) {
      const addr = encodeCell(r, c)
      const cell = ws[addr]

      const parsed: ParsedCell = {
        value: cell?.v ?? null,
        formula: cell?.f ?? null,
        type: getCellType(cell),
        address: addr,
      }

      row.push(parsed)

      // 수식 감지
      if (cell?.f) {
        const formulaType = detectFormulaType(cell.f)
        formulas.push({
          cell: addr,
          formula: cell.f,
          type: formulaType,
          relatedColumns: extractRelatedColumns(cell.f),
          calculatedValue: typeof cell.v === 'number' ? cell.v : 0,
        })
      }
    }

    rows.push(row)
  }

  return {
    name: sheetName,
    headers,
    rows,
    formulas,
    totalRows: rows.length,
    totalCols: headers.length,
  }
}

/* ── Helpers ── */

function getCellType(cell: { t?: string } | undefined): ParsedCell['type'] {
  if (!cell || cell.t === undefined) return 'empty'
  switch (cell.t) {
    case 'n': return 'number'
    case 's': return 'string'
    case 'd': return 'date'
    case 'b': return 'boolean'
    default: return 'string'
  }
}

function decodeRange(ref: string): { s: { r: number; c: number }; e: { r: number; c: number } } {
  const parts = ref.split(':')
  const s = decodeCellAddress(parts[0])
  const e = parts[1] ? decodeCellAddress(parts[1]) : s
  return { s, e }
}

function decodeCellAddress(addr: string): { r: number; c: number } {
  const match = addr.match(/^([A-Z]+)(\d+)$/)
  if (!match) return { r: 0, c: 0 }
  const col = match[1].split('').reduce((acc, ch) => acc * 26 + ch.charCodeAt(0) - 64, 0) - 1
  const row = parseInt(match[2]) - 1
  return { r: row, c: col }
}

function encodeCell(row: number, col: number): string {
  let colStr = ''
  let c = col
  do {
    colStr = String.fromCharCode(65 + (c % 26)) + colStr
    c = Math.floor(c / 26) - 1
  } while (c >= 0)
  return `${colStr}${row + 1}`
}

/** 수식 기반으로 컬럼이 양수(수익) 산출인지 음수(차감) 산출인지 추정 */
export function inferColumnSign(
  formula: DetectedFormula,
  columnValues: number[]
): 'positive' | 'negative' | 'mixed' {
  // 수식에서 차감 패턴 감지
  if (formula.type === FormulaType.SUBTRACTION) {
    return 'negative'
  }

  // 비율 수식에서 수수료 패턴 (곱하기 소수)
  if (formula.type === FormulaType.PERCENTAGE) {
    const rate = extractPercentageRate(formula.formula)
    if (rate !== null && rate < 20) {
      return 'negative' // 수수료는 보통 20% 미만
    }
  }

  // 값 기반 판단
  const positiveCount = columnValues.filter(v => v > 0).length
  const negativeCount = columnValues.filter(v => v < 0).length
  const total = positiveCount + negativeCount

  if (total === 0) return 'mixed'
  if (negativeCount / total > 0.7) return 'negative'
  if (positiveCount / total > 0.7) return 'positive'
  return 'mixed'
}
