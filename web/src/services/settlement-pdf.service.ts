/**
 * 정산서 PDF 렌더러 — pdf-lib 기반
 * SettlementTemplate + SettlementDriverData → PDF bytes
 */

import { PDFDocument, rgb, type PDFPage, type PDFFont } from 'pdf-lib'
import { loadKoreanFonts, type KoreanFonts } from '@/lib/pdf-fonts'
import type {
  SettlementTemplate,
  SettlementDriverData,
  SettlementMeta,
  SettlementItem,
} from '@/types/settlement-template'

/* ── Color Helpers ── */

function hexToRgb(hex: string) {
  const h = hex.replace('#', '')
  const r = parseInt(h.substring(0, 2), 16) / 255
  const g = parseInt(h.substring(2, 4), 16) / 255
  const b = parseInt(h.substring(4, 6), 16) / 255
  return rgb(r, g, b)
}

function formatCurrency(n: number): string {
  if (n < 0) return `-₩${Math.abs(n).toLocaleString('ko-KR')}`
  return `₩${n.toLocaleString('ko-KR')}`
}

function formatNumber(n: number, fmt: SettlementItem['numberFormat']): string {
  switch (fmt) {
    case 'currency': return formatCurrency(n)
    case 'percentage': return `${n.toFixed(1)}%`
    default: return n.toLocaleString('ko-KR')
  }
}

function resolveTemplateVars(text: string, meta: SettlementMeta): string {
  return text
    .replace(/\{\{year\}\}/g, String(meta.year))
    .replace(/\{\{month\}\}/g, String(meta.month))
    .replace(/\{\{agency_name\}\}/g, meta.agencyName)
}

/* ── PDF Layout Engine ── */

interface DrawContext {
  page: PDFPage
  fonts: KoreanFonts
  y: number                // 현재 Y 위치 (위에서 아래로 감소)
  margins: { top: number; right: number; bottom: number; left: number }
  pageWidth: number
  pageHeight: number
  template: SettlementTemplate
}

function contentWidth(ctx: DrawContext): number {
  return ctx.pageWidth - ctx.margins.left - ctx.margins.right
}

function getFont(ctx: DrawContext, weight: 'normal' | 'bold' = 'normal'): PDFFont {
  return weight === 'bold' ? ctx.fonts.bold : ctx.fonts.regular
}

/** 새 페이지가 필요한지 확인, 필요하면 추가 */
function ensureSpace(ctx: DrawContext, needed: number, pdfDoc: PDFDocument): DrawContext {
  if (ctx.y - needed < ctx.margins.bottom) {
    const [w, h] = ctx.template.layout.paperSize === 'Letter' ? [612, 792] : [595.28, 841.89]
    const newPage = pdfDoc.addPage([w, h])
    return { ...ctx, page: newPage, y: h - ctx.margins.top }
  }
  return ctx
}

/* ── Section Renderers ── */

function drawTitle(ctx: DrawContext, meta: SettlementMeta): DrawContext {
  const { title } = ctx.template
  const text = resolveTemplateVars(title.text, meta)
  const font = getFont(ctx, title.fontWeight)
  const fontSize = title.fontSize
  const textWidth = font.widthOfTextAtSize(text, fontSize)

  let x = ctx.margins.left
  if (title.alignment === 'center') x = (ctx.pageWidth - textWidth) / 2
  else if (title.alignment === 'right') x = ctx.pageWidth - ctx.margins.right - textWidth

  ctx.page.drawText(text, {
    x,
    y: ctx.y,
    size: fontSize,
    font,
    color: hexToRgb(title.fontColor),
  })

  return { ...ctx, y: ctx.y - fontSize - 20 }
}

function drawDriverInfo(ctx: DrawContext, driver: SettlementDriverData): DrawContext {
  if (!ctx.template.driverInfo.enabled) return ctx

  const fields = ctx.template.driverInfo.fields.filter(f => f.enabled)
  if (fields.length === 0) return ctx

  const fontSize = 10
  const font = ctx.fonts.regular
  const boldFont = ctx.fonts.bold
  const lineHeight = fontSize + 8

  // 배경 박스
  const boxHeight = Math.ceil(fields.length / 2) * lineHeight + 16
  ctx.page.drawRectangle({
    x: ctx.margins.left,
    y: ctx.y - boxHeight,
    width: contentWidth(ctx),
    height: boxHeight,
    color: rgb(0.97, 0.98, 0.99),
    borderColor: hexToRgb(ctx.template.tableStyle.borderColor),
    borderWidth: 0.5,
  })

  const fieldValues: Record<string, string> = {
    name: driver.name,
    id: driver.id || '-',
    phone: driver.phone || '-',
    region: driver.region || '-',
    period: driver.period || '-',
  }

  const colWidth = contentWidth(ctx) / 2
  let row = 0
  fields.forEach((f, i) => {
    const col = i % 2
    if (col === 0 && i > 0) row++
    const x = ctx.margins.left + 12 + col * colWidth
    const yPos = ctx.y - 12 - row * lineHeight

    ctx.page.drawText(`${f.label}:`, { x, y: yPos, size: fontSize, font: boldFont, color: rgb(0.3, 0.3, 0.3) })
    const labelW = boldFont.widthOfTextAtSize(`${f.label}: `, fontSize)
    ctx.page.drawText(fieldValues[f.field] || '-', { x: x + labelW, y: yPos, size: fontSize, font, color: rgb(0.1, 0.1, 0.1) })
  })

  return { ...ctx, y: ctx.y - boxHeight - 16 }
}

function drawSectionTitle(ctx: DrawContext, title: string, color: string): DrawContext {
  const font = ctx.fonts.bold
  const fontSize = 12

  ctx.page.drawText(title, {
    x: ctx.margins.left,
    y: ctx.y,
    size: fontSize,
    font,
    color: hexToRgb(color),
  })

  return { ...ctx, y: ctx.y - fontSize - 8 }
}

function drawTable(
  ctx: DrawContext,
  headers: string[],
  rows: string[][],
  pdfDoc: PDFDocument
): DrawContext {
  const { tableStyle } = ctx.template
  const colCount = headers.length
  const tableWidth = contentWidth(ctx)
  const colWidths = headers.map((_, i) => {
    if (i === 0) return tableWidth * 0.5  // 항목명 넓게
    return tableWidth * 0.5 / (colCount - 1)
  })

  const headerHeight = tableStyle.headerFontSize + 14
  const rowHeight = tableStyle.bodyFontSize + 12
  const totalNeeded = headerHeight + rows.length * rowHeight

  ctx = ensureSpace(ctx, Math.min(totalNeeded, 200), pdfDoc)

  // 헤더
  const x = ctx.margins.left
  ctx.page.drawRectangle({
    x,
    y: ctx.y - headerHeight,
    width: tableWidth,
    height: headerHeight,
    color: hexToRgb(tableStyle.headerBgColor),
  })

  const headerFont = ctx.fonts.bold
  headers.forEach((h, i) => {
    const textX = i === 0 ? x + 8 : x + colWidths.slice(0, i).reduce((a, b) => a + b, 0) + 8
    ctx.page.drawText(h, {
      x: textX,
      y: ctx.y - headerHeight + 5,
      size: tableStyle.headerFontSize,
      font: headerFont,
      color: hexToRgb(tableStyle.headerTextColor),
    })
  })
  ctx = { ...ctx, y: ctx.y - headerHeight }

  // 행
  const bodyFont = ctx.fonts.regular
  rows.forEach((row, rowIdx) => {
    ctx = ensureSpace(ctx, rowHeight, pdfDoc)

    // 줄무늬
    if (tableStyle.zebraStriping && rowIdx % 2 === 1 && tableStyle.alternateRowColor) {
      ctx.page.drawRectangle({
        x: ctx.margins.left,
        y: ctx.y - rowHeight,
        width: tableWidth,
        height: rowHeight,
        color: hexToRgb(tableStyle.alternateRowColor),
      })
    }

    // 하단 border
    ctx.page.drawLine({
      start: { x: ctx.margins.left, y: ctx.y - rowHeight },
      end: { x: ctx.margins.left + tableWidth, y: ctx.y - rowHeight },
      thickness: 0.5,
      color: hexToRgb(tableStyle.borderColor),
    })

    row.forEach((cell, i) => {
      const textX = i === 0
        ? ctx.margins.left + 8
        : ctx.margins.left + colWidths.slice(0, i).reduce((a, b) => a + b, 0) + 8
      ctx.page.drawText(cell, {
        x: textX,
        y: ctx.y - rowHeight + 4,
        size: tableStyle.bodyFontSize,
        font: bodyFont,
        color: hexToRgb(tableStyle.bodyTextColor),
      })
    })

    ctx = { ...ctx, y: ctx.y - rowHeight }
  })

  return { ...ctx, y: ctx.y - 8 }
}

function drawSubtotal(ctx: DrawContext, label: string, amount: number): DrawContext {
  const font = ctx.fonts.bold
  const fontSize = 11

  const text = `${label}: ${formatCurrency(amount)}`
  const textWidth = font.widthOfTextAtSize(text, fontSize)

  ctx.page.drawText(text, {
    x: ctx.pageWidth - ctx.margins.right - textWidth,
    y: ctx.y,
    size: fontSize,
    font,
    color: rgb(0.2, 0.2, 0.2),
  })

  return { ...ctx, y: ctx.y - fontSize - 12 }
}

function drawTotalSection(ctx: DrawContext, driver: SettlementDriverData): DrawContext {
  const { totalSection } = ctx.template
  if (!totalSection.enabled) return ctx

  const font = getFont(ctx, totalSection.fontWeight)
  const fontSize = totalSection.fontSize
  const boxHeight = fontSize + 24

  // 배경
  if (totalSection.backgroundColor) {
    ctx.page.drawRectangle({
      x: ctx.margins.left,
      y: ctx.y - boxHeight,
      width: contentWidth(ctx),
      height: boxHeight,
      color: hexToRgb(totalSection.backgroundColor),
      borderColor: hexToRgb(ctx.template.tableStyle.borderColor),
      borderWidth: 0.5,
    })
  }

  // 라벨
  ctx.page.drawText(totalSection.label, {
    x: ctx.margins.left + 12,
    y: ctx.y - boxHeight + 8,
    size: fontSize,
    font,
    color: hexToRgb(totalSection.fontColor),
  })

  // 금액 (우측 정렬)
  const amountText = formatCurrency(driver.netAmount)
  const amountWidth = font.widthOfTextAtSize(amountText, fontSize)
  ctx.page.drawText(amountText, {
    x: ctx.pageWidth - ctx.margins.right - amountWidth - 12,
    y: ctx.y - boxHeight + 8,
    size: fontSize,
    font,
    color: hexToRgb(totalSection.fontColor),
  })

  return { ...ctx, y: ctx.y - boxHeight - 16 }
}

function drawFooter(ctx: DrawContext, meta: SettlementMeta): DrawContext {
  const { footer } = ctx.template
  const font = ctx.fonts.regular
  const fontSize = 9

  if (footer.notes) {
    ctx.page.drawText(footer.notes, {
      x: ctx.margins.left,
      y: ctx.y,
      size: fontSize,
      font,
      color: rgb(0.4, 0.4, 0.4),
    })
    ctx = { ...ctx, y: ctx.y - fontSize - 8 }
  }

  if (footer.showDate) {
    const dateText = `발행일: ${meta.generatedAt}`
    ctx.page.drawText(dateText, {
      x: ctx.margins.left,
      y: ctx.y,
      size: fontSize,
      font,
      color: rgb(0.5, 0.5, 0.5),
    })
    ctx = { ...ctx, y: ctx.y - fontSize - 8 }
  }

  if (footer.showSignatureLine) {
    const lineY = ctx.y - 20
    // 서명란 라벨
    ctx.page.drawText('확인 서명:', {
      x: ctx.pageWidth - ctx.margins.right - 180,
      y: lineY + 4,
      size: 9,
      font,
      color: rgb(0.4, 0.4, 0.4),
    })
    // 서명 라인
    ctx.page.drawLine({
      start: { x: ctx.pageWidth - ctx.margins.right - 120, y: lineY },
      end: { x: ctx.pageWidth - ctx.margins.right, y: lineY },
      thickness: 0.5,
      color: rgb(0.3, 0.3, 0.3),
    })
    ctx = { ...ctx, y: lineY - 16 }
  }

  return ctx
}

/* ── Main Export ── */

/**
 * 기사 1명의 정산서 PDF를 생성한다.
 *
 * @param template - 정산서 템플릿 설정
 * @param driver - 기사별 정산 데이터
 * @param meta - 정산 메타 (대리점명, 년월 등)
 * @returns PDF 바이트 (Uint8Array)
 */
export async function generateSettlementPdf(
  template: SettlementTemplate,
  driver: SettlementDriverData,
  meta: SettlementMeta
): Promise<Uint8Array> {
  const [w, h] = template.layout.paperSize === 'Letter' ? [612, 792] : [595.28, 841.89]

  const pdfDoc = await PDFDocument.create()
  const page = pdfDoc.addPage([w, h])
  const fonts = await loadKoreanFonts(pdfDoc)

  let ctx: DrawContext = {
    page,
    fonts,
    y: h - template.layout.margins.top,
    margins: template.layout.margins,
    pageWidth: w,
    pageHeight: h,
    template,
  }

  // 1. 타이틀
  ctx = drawTitle(ctx, meta)

  // 2. 기사 정보
  ctx = drawDriverInfo(ctx, driver)

  // 3. 수익 섹션
  if (template.incomeSection.enabled) {
    const enabledItems = template.incomeSection.items.filter(i => i.enabled)
    if (enabledItems.length > 0) {
      ctx = drawSectionTitle(ctx, template.incomeSection.title, template.incomeSection.titleColor)

      const headers = ['항목', '금액']
      const rows = enabledItems.map(item => [
        item.label,
        formatNumber(driver.incomeItems[item.field] ?? driver.incomeItems[item.label] ?? 0, item.numberFormat),
      ])
      ctx = drawTable(ctx, headers, rows, pdfDoc)

      if (template.incomeSection.showSubtotal) {
        ctx = drawSubtotal(ctx, '수익 소계', driver.incomeTotal)
      }
    }
  }

  // 4. 차감 섹션
  if (template.deductionSection.enabled) {
    const enabledItems = template.deductionSection.items.filter(i => i.enabled)
    if (enabledItems.length > 0) {
      ctx = drawSectionTitle(ctx, template.deductionSection.title, template.deductionSection.titleColor)

      const headers = ['항목', '금액']
      const rows = enabledItems.map(item => [
        item.label,
        formatNumber(driver.deductionItems[item.field] ?? driver.deductionItems[item.label] ?? 0, item.numberFormat),
      ])
      ctx = drawTable(ctx, headers, rows, pdfDoc)

      if (template.deductionSection.showSubtotal) {
        ctx = drawSubtotal(ctx, '차감 소계', driver.deductionTotal)
      }
    }
  }

  // 5. 합계
  ctx = drawTotalSection(ctx, driver)

  // 6. 푸터
  drawFooter(ctx, meta)

  return pdfDoc.save()
}

/**
 * 여러 기사의 정산서를 한 번에 생성한다.
 * 기사별 개별 PDF 바이트 배열을 반환한다.
 */
export async function generateBulkSettlementPdfs(
  template: SettlementTemplate,
  drivers: SettlementDriverData[],
  meta: SettlementMeta,
  onProgress?: (completed: number, total: number) => void
): Promise<Uint8Array[]> {
  const results: Uint8Array[] = []

  for (let i = 0; i < drivers.length; i++) {
    const pdfBytes = await generateSettlementPdf(template, drivers[i], meta)
    results.push(pdfBytes)
    onProgress?.(i + 1, drivers.length)
  }

  return results
}
