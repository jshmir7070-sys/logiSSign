import ExcelJS from 'exceljs'

export type ExcelWorkbook = ExcelJS.Workbook
export type ExcelWorksheet = ExcelJS.Worksheet

const UNSAFE_EXCEL_KEYS = new Set(['__proto__', 'constructor', 'prototype'])

function normalizeHeader(value: unknown, index: number) {
  const header = String(value ?? '').trim() || `Column ${index + 1}`
  return UNSAFE_EXCEL_KEYS.has(header) ? `_${header}` : header
}

function cellToPlainValue(value: ExcelJS.CellValue): unknown {
  if (value == null) return ''
  if (value instanceof Date) return value.toISOString()

  if (typeof value === 'object') {
    if ('formula' in value) return cellToPlainValue(value.result ?? '')
    if ('text' in value) return value.text ?? ''
    if ('richText' in value) return value.richText.map((part) => part.text).join('')
    if ('result' in value) return cellToPlainValue(value.result ?? '')
    return String(value)
  }

  return value
}

function rowHasValue(row: unknown[]) {
  return row.some((value) => value != null && String(value).trim() !== '')
}

export async function loadExcelWorkbook(buffer: ArrayBuffer) {
  const workbook = new ExcelJS.Workbook()
  await workbook.xlsx.load(buffer)
  return workbook
}

export function getWorksheetNames(workbook: ExcelWorkbook) {
  return workbook.worksheets.map((worksheet) => worksheet.name)
}

export function getWorksheet(workbook: ExcelWorkbook, name: string) {
  return workbook.getWorksheet(name)
}

export function worksheetToRows(worksheet: ExcelWorksheet) {
  const columnCount = worksheet.columnCount
  const rows: unknown[][] = []

  for (let rowNumber = 1; rowNumber <= worksheet.rowCount; rowNumber += 1) {
    const row = worksheet.getRow(rowNumber)
    const values: unknown[] = []
    for (let columnNumber = 1; columnNumber <= columnCount; columnNumber += 1) {
      values.push(cellToPlainValue(row.getCell(columnNumber).value))
    }
    if (rowHasValue(values)) rows.push(values)
  }

  return rows
}

export function sheetToSafeRecords(worksheet: ExcelWorksheet) {
  const rows = worksheetToRows(worksheet)
  if (rows.length === 0) return []

  const headers = rows[0].map(normalizeHeader)

  return rows.slice(1).filter(rowHasValue).map((row) => {
    const record: Record<string, unknown> = Object.create(null)
    headers.forEach((header, index) => {
      record[header] = row[index] ?? ''
    })
    return record
  })
}

export async function downloadRowsAsXlsx(
  rows: unknown[][],
  sheetName: string,
  fileName: string,
  columnWidths?: number[]
) {
  const workbook = new ExcelJS.Workbook()
  const worksheet = workbook.addWorksheet(sheetName)
  rows.forEach((row) => worksheet.addRow(row))

  if (columnWidths) {
    worksheet.columns = columnWidths.map((width) => ({ width }))
  }

  const buffer = await workbook.xlsx.writeBuffer()
  const blob = new Blob(
    [buffer],
    { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' }
  )
  const url = URL.createObjectURL(blob)
  const anchor = document.createElement('a')
  anchor.href = url
  anchor.download = fileName
  anchor.click()
  URL.revokeObjectURL(url)
}

export async function downloadRecordsAsXlsx(
  records: Record<string, unknown>[],
  sheetName: string,
  fileName: string,
  columnWidths?: number[]
) {
  const headers = records.length > 0 ? Object.keys(records[0]) : []
  const rows = [
    headers,
    ...records.map((record) => headers.map((header) => record[header] ?? '')),
  ]
  await downloadRowsAsXlsx(rows, sheetName, fileName, columnWidths)
}
