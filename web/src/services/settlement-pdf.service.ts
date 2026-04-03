/**
 * 정산서 PDF 렌더러 v2 — 5종 디자인 HTML 참조 리뉴얼
 * pdf-lib 기반: 그라디언트 헤더, 요약 카드, 좌측 컬러바, 다크 합계박스
 */

import { PDFDocument, rgb, type PDFPage, type PDFFont } from 'pdf-lib'
import { loadKoreanFonts, type KoreanFonts } from '@/lib/pdf-fonts'
import type {
  SettlementTemplate,
  SettlementDriverData,
  SettlementMeta,
  SettlementItem,
} from '@/types/settlement-template'

/* ── Helpers ── */

function hex(h: string) {
  const c = h.replace('#', '')
  return rgb(parseInt(c.substring(0, 2), 16) / 255, parseInt(c.substring(2, 4), 16) / 255, parseInt(c.substring(4, 6), 16) / 255)
}

function krw(n: number): string {
  if (n < 0) return `-₩${Math.abs(n).toLocaleString('ko-KR')}`
  return `₩${n.toLocaleString('ko-KR')}`
}

function numStr(n: number, fmt: SettlementItem['numberFormat']): string {
  switch (fmt) {
    case 'currency': return krw(n)
    case 'percentage': return `${n.toFixed(1)}%`
    default: return n.toLocaleString('ko-KR')
  }
}

function tplVars(text: string, meta: SettlementMeta): string {
  return text
    .replace(/\{\{year\}\}/g, String(meta.year))
    .replace(/\{\{month\}\}/g, String(meta.month))
    .replace(/\{\{agency_name\}\}/g, meta.agencyName)
}

function amountInWords(n: number): string {
  if (n <= 0) return ''
  const units = ['', '만', '억', '조']
  const digits = ['', '일', '이', '삼', '사', '오', '육', '칠', '팔', '구']
  const subUnits = ['', '십', '백', '천']
  let str = ''
  let group = 0
  let remaining = Math.abs(Math.round(n))
  while (remaining > 0) {
    const chunk = remaining % 10000
    if (chunk > 0) {
      let chunkStr = ''
      let c = chunk
      for (let i = 0; i < 4 && c > 0; i++) {
        const d = c % 10
        if (d > 0) chunkStr = digits[d] + subUnits[i] + chunkStr
        c = Math.floor(c / 10)
      }
      str = chunkStr + units[group] + str
    }
    remaining = Math.floor(remaining / 10000)
    group++
  }
  return `금 ${str}원정`
}

/* ── Layout Context ── */

interface Ctx {
  page: PDFPage
  fonts: KoreanFonts
  y: number
  m: { top: number; right: number; bottom: number; left: number }
  w: number
  h: number
  tpl: SettlementTemplate
  logoImage?: import('pdf-lib').PDFImage
}

function cw(c: Ctx) { return c.w - c.m.left - c.m.right }
function font(c: Ctx, bold = false): PDFFont { return bold ? c.fonts.bold : c.fonts.regular }
function need(c: Ctx, h: number, doc: PDFDocument): Ctx {
  if (c.y - h < c.m.bottom) {
    const p = doc.addPage([c.w, c.h])
    return { ...c, page: p, y: c.h - c.m.top }
  }
  return c
}

/* ── Section Renderers ── */

function drawHeader(c: Ctx, meta: SettlementMeta, driver: SettlementDriverData): Ctx {
  const { header } = c.tpl
  const headerH = header.style === 'gradient' || header.style === 'solid' ? 120 : 0

  if (headerH > 0) {
    // 헤더 배경
    c.page.drawRectangle({
      x: 0, y: c.h - headerH, width: c.w, height: headerH,
      color: hex(header.primaryColor),
    })
    // 그라디언트 효과 (2번째 색상으로 반투명 오버레이)
    if (header.style === 'gradient' && header.secondaryColor) {
      c.page.drawRectangle({
        x: c.w * 0.5, y: c.h - headerH, width: c.w * 0.5, height: headerH,
        color: hex(header.secondaryColor), opacity: 0.4,
      })
    }

    let ty = c.h - 30
    const tc = hex(header.textColor)
    const f = font(c, true)

    // 운영사 로고 (위치 설정 반영)
    let logoOffsetX = 0
    if (meta.logoUrl && c.logoImage) {
      const logoH = header.logoSize ?? 36
      const logoDims = c.logoImage.scale(logoH / c.logoImage.height)
      const logoPos = header.logoPosition ?? 'left'
      const logoX = logoPos === 'center' ? (c.w - logoDims.width) / 2
        : logoPos === 'right' ? c.w - c.m.right - logoDims.width
        : c.m.left
      c.page.drawImage(c.logoImage, {
        x: logoX,
        y: c.h - 22 - logoH,
        width: logoDims.width,
        height: logoDims.height,
      })
      if (logoPos === 'left') logoOffsetX = logoDims.width + 8
    }

    // 부제
    if (header.showSubtitle && header.subtitleText) {
      c.page.drawText(header.subtitleText.toUpperCase(), { x: c.m.left + logoOffsetX, y: ty, size: 8, font: font(c), color: rgb(1, 1, 1) })
      ty -= 16
    }

    // 타이틀
    const titleText = tplVars(c.tpl.title.text, meta)
    c.page.drawText(titleText, { x: c.m.left + logoOffsetX, y: ty, size: c.tpl.title.fontSize, font: f, color: tc })
    ty -= c.tpl.title.fontSize + 12

    // 회사명 + 기사명 (우측)
    if (header.showCompanyName) {
      const cn = meta.agencyName
      const cnW = font(c).widthOfTextAtSize(cn, 10)
      c.page.drawText(cn, { x: c.w - c.m.right - cnW, y: c.h - 30, size: 10, font: font(c), color: tc })
    }

    // 기사명 (우측 하단)
    const dn = `${driver.name}${driver.id ? ` (${driver.id})` : ''}`
    const dnW = font(c).widthOfTextAtSize(dn, 11)
    c.page.drawText(dn, { x: c.w - c.m.right - dnW, y: c.h - headerH + 20, size: 11, font: font(c, true), color: tc })

    return { ...c, y: c.h - headerH - 16 }
  }

  // Minimal header — 타이틀만
  const titleText = tplVars(c.tpl.title.text, meta)
  const tf = font(c, true)
  const tfs = c.tpl.title.fontSize
  let tx = c.m.left
  if (c.tpl.title.alignment === 'center') tx = (c.w - tf.widthOfTextAtSize(titleText, tfs)) / 2
  else if (c.tpl.title.alignment === 'right') tx = c.w - c.m.right - tf.widthOfTextAtSize(titleText, tfs)

  c.page.drawText(titleText, { x: tx, y: c.y, size: tfs, font: tf, color: hex(header.textColor) })
  c = { ...c, y: c.y - tfs - 4 }

  // 문서번호
  if (header.showDocumentNumber && meta.documentNumber) {
    const dn = `문서번호: ${meta.documentNumber}`
    if (c.tpl.title.alignment === 'center') {
      const dnW = font(c).widthOfTextAtSize(dn, 9)
      c.page.drawText(dn, { x: (c.w - dnW) / 2, y: c.y, size: 9, font: font(c), color: rgb(0.5, 0.5, 0.5) })
    } else {
      c.page.drawText(dn, { x: c.m.left, y: c.y, size: 9, font: font(c), color: rgb(0.5, 0.5, 0.5) })
    }
    c = { ...c, y: c.y - 16 }
  }

  // 구분선
  c.page.drawLine({
    start: { x: c.m.left, y: c.y }, end: { x: c.w - c.m.right, y: c.y },
    thickness: 1, color: hex(header.primaryColor),
  })
  return { ...c, y: c.y - 20 }
}

function drawDriverInfo(c: Ctx, driver: SettlementDriverData): Ctx {
  if (!c.tpl.driverInfo.enabled) return c
  const fields = c.tpl.driverInfo.fields.filter(f => f.enabled)
  if (fields.length === 0) return c

  const vals: Record<string, string> = {
    name: driver.name, id: driver.id || '-', phone: driver.phone || '-',
    region: driver.region || '-', period: driver.period || '-',
    deliveryCount: driver.deliveryCount ? `${driver.deliveryCount}건` : '-',
    companyName: driver.companyName || '-', vehicleNumber: driver.vehicleNumber || '-',
  }

  const fs = 10
  const lh = fs + 8
  const boxH = Math.ceil(fields.length / 2) * lh + 16

  c.page.drawRectangle({
    x: c.m.left, y: c.y - boxH, width: cw(c), height: boxH,
    color: rgb(0.97, 0.97, 0.99), borderColor: rgb(0.9, 0.9, 0.92), borderWidth: 0.5,
  })

  const colW = cw(c) / 2
  let row = 0
  fields.forEach((f, i) => {
    const col = i % 2
    if (col === 0 && i > 0) row++
    const x = c.m.left + 12 + col * colW
    const yp = c.y - 12 - row * lh
    c.page.drawText(`${f.label}:`, { x, y: yp, size: fs, font: font(c, true), color: rgb(0.4, 0.4, 0.45) })
    const lw = font(c, true).widthOfTextAtSize(`${f.label}: `, fs)
    c.page.drawText(vals[f.field] || '-', { x: x + lw, y: yp, size: fs, font: font(c), color: rgb(0.1, 0.1, 0.12) })
  })

  return { ...c, y: c.y - boxH - 12 }
}

function drawSummaryCards(c: Ctx, driver: SettlementDriverData, doc: PDFDocument): Ctx {
  if (!c.tpl.summaryCards.enabled || c.tpl.summaryCards.style === 'none') return c
  c = need(c, 80, doc)

  const cardW = (cw(c) - 16) / 3
  const cardH = 60
  const cards = [
    { label: 'Total Income', value: krw(driver.incomeTotal), color: c.tpl.summaryCards.incomeColor, filled: false },
    { label: 'Total Deductions', value: krw(driver.deductionTotal), color: c.tpl.summaryCards.deductionColor, filled: false },
    { label: 'Net Amount', value: krw(driver.netAmount), color: c.tpl.summaryCards.netAmountColor, filled: true },
  ]

  cards.forEach((card, i) => {
    const x = c.m.left + i * (cardW + 8)
    const y = c.y - cardH

    if (card.filled) {
      c.page.drawRectangle({ x, y, width: cardW, height: cardH, color: hex(card.color) })
      c.page.drawText(card.label, { x: x + 10, y: y + cardH - 18, size: 8, font: font(c, true), color: rgb(1, 1, 1) })
      c.page.drawText(card.value, { x: x + 10, y: y + 10, size: 16, font: font(c, true), color: rgb(1, 1, 1) })
    } else {
      c.page.drawRectangle({ x, y, width: cardW, height: cardH, color: rgb(0.97, 0.97, 0.99), borderColor: rgb(0.92, 0.92, 0.95), borderWidth: 0.5 })
      // 좌측 컬러바
      c.page.drawRectangle({ x, y, width: 3, height: cardH, color: hex(card.color) })
      c.page.drawText(card.label, { x: x + 12, y: y + cardH - 18, size: 8, font: font(c, true), color: rgb(0.4, 0.4, 0.45) })
      c.page.drawText(card.value, { x: x + 12, y: y + 10, size: 16, font: font(c, true), color: hex(card.color) })
    }
  })

  return { ...c, y: c.y - cardH - 16 }
}

function drawSection(
  c: Ctx, title: string, titleColor: string, accentBar: string,
  items: SettlementItem[], values: Record<string, number>,
  showSubtotal: boolean, subtotalBgColor: string | undefined,
  subtotalLabel: string, doc: PDFDocument
): Ctx {
  c = need(c, 40, doc)

  // 제목 + 좌측 컬러바
  c.page.drawRectangle({ x: c.m.left, y: c.y - 2, width: 3, height: 16, color: hex(accentBar) })
  c.page.drawText(title, { x: c.m.left + 10, y: c.y, size: 12, font: font(c, true), color: hex(titleColor) })
  c = { ...c, y: c.y - 24 }

  // 테이블
  const tw = cw(c)
  const rh = c.tpl.tableStyle.bodyFontSize + 12
  const hh = c.tpl.tableStyle.headerFontSize + 14
  const showDetail = c.tpl.tableStyle.showDetailColumn
  const cols = showDetail ? [0.45, 0.3, 0.25] : [0.6, 0.4]
  const colLabels = showDetail ? ['항목명', '상세 내역', '금액'] : ['항목명', '금액']

  // 헤더
  c.page.drawRectangle({ x: c.m.left, y: c.y - hh, width: tw, height: hh, color: hex(c.tpl.tableStyle.headerBgColor) })
  let hx = c.m.left
  colLabels.forEach((label, i) => {
    const isLast = i === colLabels.length - 1
    c.page.drawText(label, {
      x: isLast ? hx + cols[i] * tw - font(c, true).widthOfTextAtSize(label, c.tpl.tableStyle.headerFontSize) - 8 : hx + 8,
      y: c.y - hh + 5, size: c.tpl.tableStyle.headerFontSize, font: font(c, true),
      color: hex(c.tpl.tableStyle.headerTextColor),
    })
    hx += cols[i] * tw
  })
  c = { ...c, y: c.y - hh }

  // 행
  const enabledItems = items.filter(it => it.enabled)
  let subtotal = 0
  enabledItems.forEach((item, idx) => {
    c = need(c, rh, doc)
    const val = values[item.field] ?? values[item.label] ?? 0
    subtotal += val

    if (c.tpl.tableStyle.zebraStriping && idx % 2 === 1 && c.tpl.tableStyle.alternateRowColor) {
      c.page.drawRectangle({ x: c.m.left, y: c.y - rh, width: tw, height: rh, color: hex(c.tpl.tableStyle.alternateRowColor) })
    }

    c.page.drawLine({ start: { x: c.m.left, y: c.y - rh }, end: { x: c.m.left + tw, y: c.y - rh }, thickness: 0.3, color: hex(c.tpl.tableStyle.borderColor) })

    let rx = c.m.left
    // 항목명
    c.page.drawText(item.label, { x: rx + 8, y: c.y - rh + 4, size: c.tpl.tableStyle.bodyFontSize, font: font(c, item.fontWeight === 'bold'), color: hex(item.fontColor || c.tpl.tableStyle.bodyTextColor) })
    rx += cols[0] * tw

    // 상세 (옵션)
    if (showDetail) {
      c.page.drawText(item.detail || '', { x: rx + 8, y: c.y - rh + 4, size: c.tpl.tableStyle.bodyFontSize, font: font(c), color: rgb(0.5, 0.5, 0.55) })
      rx += cols[1] * tw
    }

    // 금액 (우측 정렬)
    const valText = numStr(val, item.numberFormat)
    const valW = font(c, true).widthOfTextAtSize(valText, c.tpl.tableStyle.bodyFontSize)
    c.page.drawText(valText, { x: c.m.left + tw - valW - 8, y: c.y - rh + 4, size: c.tpl.tableStyle.bodyFontSize, font: font(c, true), color: hex(c.tpl.tableStyle.bodyTextColor) })

    c = { ...c, y: c.y - rh }
  })

  // 소계
  if (showSubtotal) {
    c = need(c, rh + 4, doc)
    if (subtotalBgColor) {
      c.page.drawRectangle({ x: c.m.left, y: c.y - rh, width: tw, height: rh, color: hex(subtotalBgColor) })
    }
    c.page.drawLine({ start: { x: c.m.left, y: c.y }, end: { x: c.m.left + tw, y: c.y }, thickness: 0.5, color: hex(c.tpl.tableStyle.borderColor) })

    const stLabel = subtotalLabel
    const stVal = krw(subtotal)
    const stLabelX = showDetail ? c.m.left + (cols[0] + cols[1]) * tw - font(c, true).widthOfTextAtSize(stLabel, 10) - 8 : c.m.left + cols[0] * tw - font(c, true).widthOfTextAtSize(stLabel, 10) - 8
    c.page.drawText(stLabel, { x: stLabelX, y: c.y - rh + 4, size: 10, font: font(c, true), color: hex(titleColor) })
    const stValW = font(c, true).widthOfTextAtSize(stVal, 12)
    c.page.drawText(stVal, { x: c.m.left + tw - stValW - 8, y: c.y - rh + 4, size: 12, font: font(c, true), color: hex(titleColor) })
    c = { ...c, y: c.y - rh }
  }

  return { ...c, y: c.y - 12 }
}

function drawTotal(c: Ctx, driver: SettlementDriverData, doc: PDFDocument): Ctx {
  if (!c.tpl.totalSection.enabled) return c
  const ts = c.tpl.totalSection
  const boxH = ts.showAmountInWords ? 70 : 55
  c = need(c, boxH + 16, doc)

  c.page.drawRectangle({
    x: c.m.left, y: c.y - boxH, width: cw(c), height: boxH,
    color: hex(ts.backgroundColor),
  })

  // 라벨 (좌측)
  c.page.drawText(ts.label, { x: c.m.left + 16, y: c.y - boxH + (ts.showAmountInWords ? 32 : 18), size: ts.fontSize - 4, font: font(c, true), color: hex(ts.fontColor) })

  // 금액 (우측)
  const amtText = krw(driver.netAmount)
  const amtW = font(c, true).widthOfTextAtSize(amtText, ts.fontSize)
  c.page.drawText(amtText, { x: c.w - c.m.right - amtW - 16, y: c.y - boxH + (ts.showAmountInWords ? 32 : 18), size: ts.fontSize, font: font(c, true), color: hex(ts.fontColor) })

  // 한글 금액
  if (ts.showAmountInWords) {
    const words = amountInWords(driver.netAmount)
    const wW = font(c).widthOfTextAtSize(words, 8)
    c.page.drawText(words, { x: c.w - c.m.right - wW - 16, y: c.y - boxH + 12, size: 8, font: font(c), color: hex(ts.fontColor) })
  }

  // 수식 표시
  if (ts.showFormula) {
    c.page.drawText('지급 수식: (A) - (B)', { x: c.w - c.m.right - 120, y: c.y - 12, size: 7, font: font(c), color: hex(ts.fontColor) })
  }

  return { ...c, y: c.y - boxH - 20 }
}

function drawFooter(c: Ctx, meta: SettlementMeta): Ctx {
  const { footer: ft } = c.tpl
  const f = font(c)
  const fs = 9

  if (ft.disclaimerText) {
    c.page.drawText(ft.disclaimerText, { x: c.m.left, y: c.y, size: 8, font: f, color: rgb(0.5, 0.5, 0.55) })
    c = { ...c, y: c.y - 14 }
  }

  if (ft.notes) {
    c.page.drawText(ft.notes, { x: c.m.left, y: c.y, size: 8, font: f, color: rgb(0.5, 0.5, 0.55) })
    c = { ...c, y: c.y - 14 }
  }

  if (ft.showCompanyInfo && ft.companyPhone) {
    c.page.drawText(`Tel: ${ft.companyPhone}`, { x: c.m.left, y: c.y, size: 8, font: f, color: rgb(0.5, 0.5, 0.55) })
    c = { ...c, y: c.y - 12 }
  }

  if (ft.showDate) {
    c.page.drawText(`발행일: ${meta.generatedAt}`, { x: c.m.left, y: c.y, size: fs, font: f, color: rgb(0.5, 0.5, 0.55) })
  }

  if (ft.showSignatureLine) {
    const lineY = c.y - 30
    c.page.drawText('확인:', { x: c.w - c.m.right - 180, y: lineY + 4, size: 9, font: f, color: rgb(0.4, 0.4, 0.45) })
    c.page.drawLine({ start: { x: c.w - c.m.right - 150, y: lineY }, end: { x: c.w - c.m.right, y: lineY }, thickness: 0.5, color: rgb(0.3, 0.3, 0.35) })

    if (ft.showStamp) {
      // 인감 원
      const cx = c.w - c.m.right - 40
      const cy = lineY - 20
      c.page.drawCircle({ x: cx, y: cy, size: 20, borderColor: rgb(0.8, 0.15, 0.15), borderWidth: 1.5 })
      c.page.drawText('인', { x: cx - 5, y: cy - 4, size: 12, font: font(c, true), color: rgb(0.8, 0.15, 0.15) })
    }
  }

  return c
}

/* ── Main Export ── */

export async function generateSettlementPdf(
  template: SettlementTemplate,
  driver: SettlementDriverData,
  meta: SettlementMeta
): Promise<Uint8Array> {
  const [w, h] = template.layout.paperSize === 'Letter' ? [612, 792] : [595.28, 841.89]
  const pdfDoc = await PDFDocument.create()
  const page = pdfDoc.addPage([w, h])
  const fonts = await loadKoreanFonts(pdfDoc)

  let c: Ctx = { page, fonts, y: h - template.layout.margins.top, m: template.layout.margins, w, h, tpl: template }

  // 운영사 로고 이미지 로드
  if (meta.logoUrl) {
    try {
      const logoRes = await fetch(meta.logoUrl)
      const logoBytes = new Uint8Array(await logoRes.arrayBuffer())
      const isPng = meta.logoUrl.endsWith('.png') || logoBytes[0] === 0x89
      c.logoImage = isPng
        ? await pdfDoc.embedPng(logoBytes)
        : await pdfDoc.embedJpg(logoBytes)
    } catch {
      // 로고 로드 실패 시 무시 — 로고 없이 진행
    }
  }

  c = drawHeader(c, meta, driver)
  c = drawDriverInfo(c, driver)
  c = drawSummaryCards(c, driver, pdfDoc)

  if (template.incomeSection.enabled) {
    c = drawSection(c, template.incomeSection.title, template.incomeSection.titleColor,
      template.incomeSection.accentBarColor, template.incomeSection.items, driver.incomeItems,
      template.incomeSection.showSubtotal, template.incomeSection.subtotalBgColor,
      '수익 합계', pdfDoc)
  }

  if (template.deductionSection.enabled) {
    c = drawSection(c, template.deductionSection.title, template.deductionSection.titleColor,
      template.deductionSection.accentBarColor, template.deductionSection.items, driver.deductionItems,
      template.deductionSection.showSubtotal, template.deductionSection.subtotalBgColor,
      '공제 합계', pdfDoc)
  }

  c = drawTotal(c, driver, pdfDoc)
  drawFooter(c, meta)

  return pdfDoc.save()
}

export async function generateBulkSettlementPdfs(
  template: SettlementTemplate,
  drivers: SettlementDriverData[],
  meta: SettlementMeta,
  onProgress?: (completed: number, total: number) => void
): Promise<Uint8Array[]> {
  const results: Uint8Array[] = []
  for (let i = 0; i < drivers.length; i++) {
    const bytes = await generateSettlementPdf(template, drivers[i], meta)
    results.push(bytes)
    onProgress?.(i + 1, drivers.length)
  }
  return results
}
