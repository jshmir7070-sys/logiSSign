/**
 * 감사추적인증서 (Audit Trail Certificate) PDF 생성
 *
 * 계약서 서명 완료 후 생성되는 별도 문서로,
 * "누가, 언제, 어디서, 어떤 기기로, 어떤 과정을 거쳐 서명했는지"를
 * 기록하고 해시로 무결성을 보장합니다.
 */

import { PDFDocument, rgb } from 'pdf-lib'
import fontkit from '@pdf-lib/fontkit'
import { loadKoreanFonts } from '@/lib/pdf-fonts'
import { createAdminSupabaseClient } from '@/lib/supabase'
import { getAuditCertificateData, type AuditCertificateData } from './verification.service'



/* ══════════════════════════════════════════════
   감사추적인증서 PDF 생성
   ══════════════════════════════════════════════ */

export async function generateAuditCertificatePdf(
  contractId: string
): Promise<{ url: string | null; error: string | null }> {
  const supabase = createAdminSupabaseClient()

  try {
    const { data, error: dataErr } = await getAuditCertificateData(contractId)
    if (dataErr || !data) throw new Error(dataErr ?? '감사추적 데이터 조회 실패')

    const pdfBytes = await buildAuditPdf(data)

    // Storage 업로드
    const fileName = `audit/${contractId}_audit_${Date.now()}.pdf`
    const { error: uploadErr } = await supabase.storage
      .from('contracts')
      .upload(fileName, pdfBytes, { contentType: 'application/pdf', upsert: true })

    if (uploadErr) throw new Error('감사추적인증서 업로드 실패')

    const { data: urlData } = await supabase.storage.from('contracts').createSignedUrl(fileName, 60 * 60 * 24 * 365)
    const pdfUrl = urlData?.signedUrl ?? null

    // contract_signatures에 감사인증서 URL 저장
    if (pdfUrl) {
      await supabase
        .from('contract_signatures')
        .update({ audit_certificate_url: pdfUrl })
        .eq('contract_id', contractId)
    }

    return { url: pdfUrl, error: null }
  } catch (err) {
    return { url: null, error: err instanceof Error ? err.message : '감사추적인증서 생성 실패' }
  }
}

/* ══════════════════════════════════════════════
   PDF 빌드 (pdf-lib)
   ══════════════════════════════════════════════ */

async function buildAuditPdf(data: AuditCertificateData): Promise<Uint8Array> {
  const doc = await PDFDocument.create()
  doc.registerFontkit(fontkit)
  const { regular: font, bold } = await loadKoreanFonts(doc)
  const mono = font // NotoSansKR로 통일 (Courier는 한글 불가)

  const W = 595 // A4
  const H = 841
  const M = 50
  const maxW = W - M * 2

  let page = doc.addPage([W, H])
  let y = H - M

  // ── Helper functions ──
  const addPage = () => {
    page = doc.addPage([W, H])
    y = H - M
  }

  const checkY = (needed: number) => {
    if (y - needed < M) addPage()
  }

  const drawText = (text: string, opts: {
    size?: number; f?: typeof font; color?: [number, number, number]; x?: number
  } = {}) => {
    const { size = 9, f = font, color = [0.2, 0.2, 0.2], x = M } = opts
    checkY(size + 4)
    page.drawText(text, {
      x, y, size, font: f,
      color: rgb(color[0], color[1], color[2]),
    })
    y -= size + 4
  }

  const drawLine = () => {
    checkY(10)
    page.drawLine({
      start: { x: M, y },
      end: { x: W - M, y },
      thickness: 0.5,
      color: rgb(0.75, 0.75, 0.75),
    })
    y -= 10
  }

  const drawKV = (label: string, value: string, monoValue = false) => {
    checkY(14)
    page.drawText(label, { x: M, y, size: 8, font: bold, color: rgb(0.4, 0.4, 0.4) })
    page.drawText(value, {
      x: M + 140, y, size: 8,
      font: monoValue ? mono : font,
      color: rgb(0.15, 0.15, 0.15),
    })
    y -= 14
  }

  // ── QR 코드 이미지 로드 ──
  let qrImage: Awaited<ReturnType<typeof doc.embedJpg>> | null = null
  try {
    const qrRes = await fetch(data.qrCodeUrl)
    if (qrRes.ok) {
      const qrBytes = new Uint8Array(await qrRes.arrayBuffer())
      // Google Charts returns PNG
      qrImage = await doc.embedPng(qrBytes)
    }
  } catch { /* QR 로드 실패 시 무시 */ }

  // ═══════════════════════════════════════════
  // 페이지 1: 인증서 헤더 + 문서 정보
  // ═══════════════════════════════════════════

  // 타이틀
  drawText('AUDIT TRAIL CERTIFICATE', { size: 18, f: bold, color: [0.1, 0.1, 0.1] })
  drawText('감사추적인증서', { size: 12, f: bold, color: [0.3, 0.3, 0.3] })
  y -= 10
  drawLine()
  y -= 5

  // QR + 문서 정보 나란히
  if (qrImage) {
    const qrSize = 80
    page.drawImage(qrImage, { x: W - M - qrSize, y: y - qrSize + 10, width: qrSize, height: qrSize })
  }

  drawText('문서 정보', { size: 11, f: bold, color: [0.1, 0.1, 0.1] })
  y -= 6
  drawKV('문서번호:', data.documentNumber, true)
  drawKV('인증코드:', data.verificationCode, true)
  drawKV('계약서명:', data.title)
  drawKV('대리점:', data.agencyName)
  drawKV('진위확인 URL:', data.verificationUrl, true)

  y -= 10
  drawLine()
  y -= 5

  // 서명자 정보
  drawText('서명자 정보', { size: 11, f: bold, color: [0.1, 0.1, 0.1] })
  y -= 6
  drawKV('성명:', data.signerName)
  drawKV('연락처:', maskPhone(data.signerPhone))
  drawKV('본인인증:', data.identityProvider
    ? `${data.identityProvider.toUpperCase()} (${data.identityVerifiedAt ? new Date(data.identityVerifiedAt).toLocaleString('ko-KR') : '-'})`
    : '미인증')
  drawKV('서명일시:', data.signedAt ? new Date(data.signedAt).toLocaleString('ko-KR') : '-')
  drawKV('서명자 IP:', data.signerIp)
  drawKV('서명 환경:', truncate(data.signerUserAgent, 60))

  y -= 10
  drawLine()
  y -= 5

  // 동의 항목
  drawText('동의 항목', { size: 11, f: bold, color: [0.1, 0.1, 0.1] })
  y -= 6
  const consentLabels = [
    ['계약 내용 동의', data.consents.contract],
    ['개인정보 수집·이용 동의', data.consents.privacy_collect],
    ['고유식별정보 수집·이용 동의', data.consents.privacy_id],
    ['개인정보 제3자 제공 동의', data.consents.privacy_3rd],
    ['고유식별정보 제3자 제공 동의', data.consents.privacy_3rd_id],
  ] as const

  for (const [label, agreed] of consentLabels) {
    drawKV(`[${agreed ? 'V' : ' '}] ${label}`, agreed ? '동의함' : '미동의')
  }

  y -= 10
  drawLine()
  y -= 5

  // 무결성 검증
  drawText('문서 무결성 검증', { size: 11, f: bold, color: [0.1, 0.1, 0.1] })
  y -= 6
  drawKV('문서 내용 해시 (SHA-256):', '', true)
  drawText(data.contentHash, { size: 7, f: mono, color: [0.3, 0.3, 0.3], x: M + 10 })

  if (data.signedPdfHash) {
    drawKV('서명 PDF 해시 (SHA-256):', '', true)
    drawText(data.signedPdfHash, { size: 7, f: mono, color: [0.3, 0.3, 0.3], x: M + 10 })
  }

  drawKV('타임스탬프 해시 (SHA-256):', '', true)
  drawText(data.timestampHash, { size: 7, f: mono, color: [0.3, 0.3, 0.3], x: M + 10 })

  drawKV('감사추적 최종 해시:', '', true)
  drawText(data.auditFinalHash, { size: 7, f: mono, color: [0.3, 0.3, 0.3], x: M + 10 })

  y -= 10
  drawLine()
  y -= 5

  // ═══════════════════════════════════════════
  // 감사추적 이력 (Audit Trail Entries)
  // ═══════════════════════════════════════════

  drawText('감사추적 이력', { size: 11, f: bold, color: [0.1, 0.1, 0.1] })
  y -= 6

  if (data.auditEntries.length === 0) {
    drawText('(감사추적 항목 없음)', { size: 8, color: [0.5, 0.5, 0.5] })
  } else {
    // 테이블 헤더
    checkY(16)
    const colX = [M, M + 35, M + 175, M + 330]
    page.drawText('#', { x: colX[0], y, size: 7, font: bold, color: rgb(0.4, 0.4, 0.4) })
    page.drawText('일시', { x: colX[1], y, size: 7, font: bold, color: rgb(0.4, 0.4, 0.4) })
    page.drawText('액션', { x: colX[2], y, size: 7, font: bold, color: rgb(0.4, 0.4, 0.4) })
    page.drawText('수행자', { x: colX[3], y, size: 7, font: bold, color: rgb(0.4, 0.4, 0.4) })
    y -= 12

    for (let i = 0; i < data.auditEntries.length; i++) {
      const entry = data.auditEntries[i]
      checkY(24)

      page.drawText(String(i + 1), { x: colX[0], y, size: 7, font, color: rgb(0.3, 0.3, 0.3) })
      page.drawText(
        entry.timestamp ? new Date(entry.timestamp).toLocaleString('ko-KR') : '-',
        { x: colX[1], y, size: 7, font: mono, color: rgb(0.3, 0.3, 0.3) }
      )
      page.drawText(actionLabel(entry.action), { x: colX[2], y, size: 7, font, color: rgb(0.2, 0.2, 0.2) })
      page.drawText(entry.actor ?? '-', { x: colX[3], y, size: 7, font, color: rgb(0.3, 0.3, 0.3) })
      y -= 10

      // 해시 (작게)
      if (entry.hash) {
        page.drawText(`hash: ${entry.hash.slice(0, 32)}...`, {
          x: colX[1], y, size: 5, font: mono, color: rgb(0.6, 0.6, 0.6),
        })
        y -= 10
      }
    }
  }

  y -= 15
  drawLine()

  // 법적 고지
  y -= 5
  drawText('법적 고지', { size: 9, f: bold, color: [0.3, 0.3, 0.3] })
  y -= 4
  const legalLines = [
    '본 감사추적인증서는 전자서명법 제3조 및 전자문서 및 전자거래 기본법 제4조에 근거하여',
    '전자계약서의 서명 과정을 기록한 문서입니다.',
    '',
    '본 인증서에 기록된 해시값은 SHA-256 알고리즘으로 생성되었으며,',
    '해시 체인 방식으로 각 항목의 무결성이 보장됩니다.',
    '',
    '진위확인: 상단 QR 코드를 스캔하거나 인증코드를 입력하여 확인할 수 있습니다.',
    `진위확인 URL: ${data.verificationUrl}`,
  ]

  for (const line of legalLines) {
    drawText(line, { size: 7, color: [0.45, 0.45, 0.45] })
  }

  y -= 20
  drawText(`logiSSign 전자계약 시스템  |  발급일: ${new Date().toLocaleString('ko-KR')}`, {
    size: 7, color: [0.5, 0.5, 0.5],
  })

  return doc.save()
}

/* ── Helpers ── */

function maskPhone(phone: string): string {
  if (!phone || phone.length < 8) return phone
  return phone.slice(0, 3) + '-****-' + phone.slice(-4)
}

function truncate(text: string, max: number): string {
  if (!text || text.length <= max) return text || '-'
  return text.slice(0, max) + '...'
}

function actionLabel(action: string): string {
  const labels: Record<string, string> = {
    contract_created: '계약서 생성',
    contract_sent: '계약서 발송',
    contract_viewed: '계약서 열람',
    identity_verified: '본인인증 완료',
    consent_agreed: '동의 항목 체크',
    signature_drawn: '서명 작성',
    contract_signed: '전자서명 완료',
    pdf_generated: '서명 PDF 생성',
    verification_assigned: '인증코드 발급',
    audit_certificate_generated: '감사추적인증서 발급',
  }
  return labels[action] ?? action
}
