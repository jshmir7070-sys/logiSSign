import { PDFDocument, rgb } from 'pdf-lib'
import fontkit from '@pdf-lib/fontkit'
import { loadKoreanFonts } from '@/lib/pdf-fonts'
import { createAdminSupabaseClient } from '@/lib/supabase'
import { createSignedStorageUrl } from '@/lib/storage-reference'
import { getAuditCertificateData, type AuditCertificateData } from './verification.service'

export async function generateAuditCertificatePdf(
  contractId: string
): Promise<{ url: string | null; error: string | null }> {
  const supabase = createAdminSupabaseClient()

  try {
    const { data, error } = await getAuditCertificateData(contractId)
    if (error || !data) {
      throw new Error(error ?? '감사증명서 데이터를 불러올 수 없습니다')
    }

    const pdfBytes = await buildAuditPdf(data)
    const fileName = `audit/${contractId}_audit_${Date.now()}.pdf`

    const { error: uploadError } = await supabase.storage
      .from('contracts')
      .upload(fileName, pdfBytes, { contentType: 'application/pdf', upsert: true })

    if (uploadError) {
      throw new Error(`감사증명서 업로드 실패: ${uploadError.message}`)
    }

    const { url } = await createSignedStorageUrl(supabase, 'contracts', fileName, 60 * 60)

    await supabase
      .from('contract_signatures')
      .update({ audit_certificate_url: fileName })
      .eq('contract_id', contractId)

    return { url, error: null }
  } catch (error) {
    return {
      url: null,
      error: error instanceof Error ? error.message : '감사증명서 생성 실패',
    }
  }
}

async function buildAuditPdf(data: AuditCertificateData): Promise<Uint8Array> {
  const doc = await PDFDocument.create()
  doc.registerFontkit(fontkit)

  const { regular: font, bold } = await loadKoreanFonts(doc)
  const mono = font

  const pageWidth = 595
  const pageHeight = 842
  const margin = 48
  const contentWidth = pageWidth - margin * 2
  const lineGap = 4

  let page = doc.addPage([pageWidth, pageHeight])
  let y = pageHeight - margin

  const addPage = () => {
    page = doc.addPage([pageWidth, pageHeight])
    y = pageHeight - margin
  }

  const ensureSpace = (height: number) => {
    if (y - height < margin) addPage()
  }

  const wrapText = (text: string, size: number, activeFont = font, width = contentWidth) => {
    const words = (text || '-').split(' ')
    const lines: string[] = []
    let current = ''

    for (const word of words) {
      const next = current ? `${current} ${word}` : word
      const nextWidth = activeFont.widthOfTextAtSize(next, size)
      if (nextWidth <= width) {
        current = next
        continue
      }

      if (current) lines.push(current)
      current = word

      if (activeFont.widthOfTextAtSize(current, size) <= width) continue

      let fragment = ''
      for (const char of current) {
        const candidate = fragment + char
        if (activeFont.widthOfTextAtSize(candidate, size) <= width) {
          fragment = candidate
          continue
        }
        if (fragment) lines.push(fragment)
        fragment = char
      }
      current = fragment
    }

    if (current) lines.push(current)
    return lines.length > 0 ? lines : ['-']
  }

  const drawParagraph = (
    text: string,
    opts: {
      size?: number
      activeFont?: typeof font
      color?: [number, number, number]
      x?: number
      width?: number
    } = {}
  ) => {
    const {
      size = 9,
      activeFont = font,
      color = [0.2, 0.2, 0.2],
      x = margin,
      width = contentWidth,
    } = opts

    const lines = wrapText(text, size, activeFont, width)
    ensureSpace(lines.length * (size + lineGap))
    for (const line of lines) {
      page.drawText(line, {
        x,
        y,
        size,
        font: activeFont,
        color: rgb(color[0], color[1], color[2]),
      })
      y -= size + lineGap
    }
  }

  const drawDivider = () => {
    ensureSpace(12)
    page.drawLine({
      start: { x: margin, y },
      end: { x: pageWidth - margin, y },
      thickness: 0.7,
      color: rgb(0.82, 0.82, 0.82),
    })
    y -= 12
  }

  const drawHeading = (title: string) => {
    drawParagraph(title, { size: 11, activeFont: bold, color: [0.12, 0.12, 0.12] })
    y -= 2
  }

  const drawKV = (label: string, value: string, monoValue = false) => {
    const valueFont = monoValue ? mono : font
    const labelX = margin
    const valueX = margin + 150
    const valueWidth = pageWidth - margin - valueX
    const valueLines = wrapText(value || '-', 8, valueFont, valueWidth)

    ensureSpace(Math.max(14, valueLines.length * 12))
    page.drawText(label, {
      x: labelX,
      y,
      size: 8,
      font: bold,
      color: rgb(0.4, 0.4, 0.4),
    })

    let valueY = y
    for (const line of valueLines) {
      page.drawText(line, {
        x: valueX,
        y: valueY,
        size: 8,
        font: valueFont,
        color: rgb(0.16, 0.16, 0.16),
      })
      valueY -= 12
    }

    y = valueY - 2
  }

  let qrImage: Awaited<ReturnType<typeof doc.embedPng>> | null = null
  try {
    const response = await fetch(data.qrCodeUrl)
    if (response.ok) {
      const bytes = new Uint8Array(await response.arrayBuffer())
      qrImage = await doc.embedPng(bytes)
    }
  } catch {
    qrImage = null
  }

  drawParagraph('AUDIT TRAIL CERTIFICATE', {
    size: 18,
    activeFont: bold,
    color: [0.1, 0.1, 0.1],
  })
  drawParagraph('감사추적 인증서', {
    size: 12,
    activeFont: bold,
    color: [0.32, 0.32, 0.32],
  })
  y -= 6
  drawDivider()

  if (qrImage) {
    const qrSize = 80
    ensureSpace(qrSize + 8)
    page.drawImage(qrImage, {
      x: pageWidth - margin - qrSize,
      y: y - qrSize + 10,
      width: qrSize,
      height: qrSize,
    })
  }

  drawHeading('인증 정보')
  drawKV('문서번호', data.documentNumber, true)
  drawKV('검증코드', data.verificationCode, true)
  drawKV('문서명', data.title)
  drawKV('대리점', data.agencyName)
  drawKV('검증 URL', data.verificationUrl, true)

  y -= 4
  drawDivider()
  drawHeading('서명자 정보')
  drawKV('이름', data.signerName)
  drawKV('전화번호', maskPhone(data.signerPhone))
  drawKV(
    '본인확인',
    data.identityProvider
      ? `${data.identityProvider.toUpperCase()} (${formatDateTime(data.identityVerifiedAt)})`
      : '미실시'
  )
  drawKV('서명일시', formatDateTime(data.signedAt))
  drawKV('서명 IP', data.signerIp || '-')
  drawKV('브라우저', truncate(data.signerUserAgent, 80))

  y -= 4
  drawDivider()
  drawHeading('동의 항목')
  for (const [label, agreed] of [
    ['계약 동의', data.consents.contract],
    ['개인정보 수집·이용 동의', data.consents.privacy_collect],
    ['고유식별정보 처리 동의', data.consents.privacy_id],
    ['개인정보 제3자 제공 동의', data.consents.privacy_3rd],
    ['고유식별정보 제3자 제공 동의', data.consents.privacy_3rd_id],
  ] as const) {
    drawKV(label, agreed ? '동의' : '미동의')
  }

  y -= 4
  drawDivider()
  drawHeading('무결성 검증')
  drawKV('원본 해시 (SHA-256)', data.contentHash, true)
  if (data.signedPdfHash) drawKV('서명 PDF 해시 (SHA-256)', data.signedPdfHash, true)
  drawKV('타임스탬프 해시 (SHA-256)', data.timestampHash, true)
  drawKV('감사추적 최종 해시', data.auditFinalHash, true)

  y -= 4
  drawDivider()
  drawHeading('감사추적 이력')

  if (data.auditEntries.length === 0) {
    drawParagraph('기록된 감사추적 항목이 없습니다.', {
      size: 8,
      color: [0.5, 0.5, 0.5],
    })
  } else {
    const columns = [margin, margin + 32, margin + 170, margin + 325]
    ensureSpace(18)
    page.drawText('#', { x: columns[0], y, size: 7, font: bold, color: rgb(0.4, 0.4, 0.4) })
    page.drawText('시각', { x: columns[1], y, size: 7, font: bold, color: rgb(0.4, 0.4, 0.4) })
    page.drawText('동작', { x: columns[2], y, size: 7, font: bold, color: rgb(0.4, 0.4, 0.4) })
    page.drawText('주체', { x: columns[3], y, size: 7, font: bold, color: rgb(0.4, 0.4, 0.4) })
    y -= 12

    for (let index = 0; index < data.auditEntries.length; index += 1) {
      const entry = data.auditEntries[index]
      const hashText = entry.hash ? `hash: ${entry.hash.slice(0, 32)}...` : ''
      ensureSpace(hashText ? 20 : 10)

      page.drawText(String(index + 1), {
        x: columns[0],
        y,
        size: 7,
        font,
        color: rgb(0.3, 0.3, 0.3),
      })
      page.drawText(formatDateTime(entry.timestamp), {
        x: columns[1],
        y,
        size: 7,
        font: mono,
        color: rgb(0.3, 0.3, 0.3),
      })
      page.drawText(actionLabel(entry.action), {
        x: columns[2],
        y,
        size: 7,
        font,
        color: rgb(0.2, 0.2, 0.2),
      })
      page.drawText(entry.actor ?? '-', {
        x: columns[3],
        y,
        size: 7,
        font,
        color: rgb(0.3, 0.3, 0.3),
      })
      y -= 10

      if (hashText) {
        page.drawText(hashText, {
          x: columns[1],
          y,
          size: 5,
          font: mono,
          color: rgb(0.58, 0.58, 0.58),
        })
        y -= 10
      }
    }
  }

  y -= 6
  drawDivider()
  drawHeading('법적 고지')
  for (const line of [
    '본 문서는 전자서명 및 전자문서 관련 법령에 근거하여 생성된 감사증명서입니다.',
    '문서와 서명에 대한 해시값, 검증코드, 감사추적 이력을 함께 제공합니다.',
    '하단 검증 URL 또는 QR 코드를 통해 진위 여부를 다시 확인할 수 있습니다.',
    `검증 URL: ${data.verificationUrl}`,
  ]) {
    drawParagraph(line, { size: 7, color: [0.45, 0.45, 0.45] })
  }

  y -= 12
  drawParagraph(`logiSSign 전자계약 시스템 | 발급: ${new Date().toLocaleString('ko-KR')}`, {
    size: 7,
    color: [0.5, 0.5, 0.5],
  })

  return doc.save()
}

function maskPhone(phone: string): string {
  if (!phone || phone.length < 8) return phone || '-'
  return `${phone.slice(0, 3)}-****-${phone.slice(-4)}`
}

function truncate(text: string, max: number): string {
  if (!text) return '-'
  return text.length <= max ? text : `${text.slice(0, max)}...`
}

function formatDateTime(value: string | null | undefined): string {
  return value ? new Date(value).toLocaleString('ko-KR') : '-'
}

function actionLabel(action: string): string {
  const labels: Record<string, string> = {
    contract_created: '계약 생성',
    contract_sent: '계약 발송',
    contract_viewed: '계약 열람',
    identity_verified: '본인확인 완료',
    consent_agreed: '동의 완료',
    signature_drawn: '서명 입력',
    contract_signed: '계약 서명 완료',
    pdf_generated: 'PDF 생성',
    verification_assigned: '검증코드 발급',
    audit_certificate_generated: '감사증명서 생성',
  }
  return labels[action] ?? action
}
