import { PDFDocument, rgb } from 'pdf-lib'
import fontkit from '@pdf-lib/fontkit'
import { loadKoreanFonts } from '@/lib/pdf-fonts'
import { createBrowserSupabaseClient } from '@/lib/supabase'
import {
  finalizeContractVerification,
  type DocumentVerification,
} from './verification.service'
import { generateAuditCertificatePdf } from './audit-certificate.service'
import {
  isGovernmentFormTemplate,
  generateGovernmentFormPdf,
} from './government-form-pdf.service'
import type { ContractBindingData } from './contract.service'

/**
 * 서명 완료된 계약서 PDF 생성
 * - 계약서 본문 텍스트 렌더링
 * - 서명 이미지 삽입
 * - content_hash 기록
 * - 문서번호 / 인증코드 / QR 코드 삽입
 * - Supabase Storage에 업로드
 * - contracts.signed_pdf_url 업데이트
 * - 감사추적인증서 자동 생성
 */
export async function generateSignedPdf(contractId: string): Promise<{
  url: string | null
  error: string | null
}> {
  const supabase = createBrowserSupabaseClient()

  try {
    // 1. 계약서 + 서명 데이터 조회
    const { data: contract, error: contractErr } = await supabase
      .from('contracts')
      .select('id, template_id, title, content, content_hash, binding_data, signed_at, drivers(name, phone, employee_code)')
      .eq('id', contractId)
      .single()

    if (contractErr || !contract) throw new Error('계약서를 찾을 수 없습니다')

    // 관공서 서류인 경우 원본 PDF 기반 생성
    const contractData = contract as unknown as {
      template_id: string | null
      title: string
      content: string
      content_hash: string
      binding_data: ContractBindingData | null
      signed_at: string | null
    }
    if (contractData.template_id && isGovernmentFormTemplate(contractData.template_id) && contractData.binding_data) {
      return generateGovernmentFormSignedPdf(contractId, contractData.template_id, contractData.binding_data, supabase)
    }

    const { data: signature, error: sigErr } = await supabase
      .from('contract_signatures')
      .select('signature_image_base64, signed_at, signer_ip')
      .eq('contract_id', contractId)
      .order('signed_at', { ascending: false })
      .limit(1)
      .single()

    if (sigErr || !signature) throw new Error('서명 데이터를 찾을 수 없습니다')

    // Consent 데이터 별도 조회 (DB 스키마에 아직 반영 전일 수 있으므로)
    let consentData = {
      consent_contract: false,
      consent_privacy_collect: false,
      consent_privacy_id: false,
      consent_privacy_3rd: false,
      consent_privacy_3rd_id: false,
    }
    try {
      const { data: consentRow } = await supabase
        .from('contract_signatures')
        .select('consent_contract, consent_privacy_collect, consent_privacy_id, consent_privacy_3rd, consent_privacy_3rd_id')
        .eq('contract_id', contractId)
        .order('signed_at', { ascending: false })
        .limit(1)
        .single()
      if (consentRow) {
        const cr = consentRow as unknown as Record<string, boolean>
        consentData = {
          consent_contract: cr.consent_contract ?? false,
          consent_privacy_collect: cr.consent_privacy_collect ?? false,
          consent_privacy_id: cr.consent_privacy_id ?? false,
          consent_privacy_3rd: cr.consent_privacy_3rd ?? false,
          consent_privacy_3rd_id: cr.consent_privacy_3rd_id ?? false,
        }
      }
    } catch { /* consent columns may not exist yet */ }

    // 2. PDF 생성
    const pdfDoc = await PDFDocument.create()
    pdfDoc.registerFontkit(fontkit)
    const { regular: font, bold: boldFont } = await loadKoreanFonts(pdfDoc)

    const pageWidth = 595  // A4
    const pageHeight = 841
    const margin = 50
    const lineHeight = 14
    const maxWidth = pageWidth - margin * 2

    // 본문 텍스트를 줄바꿈 처리
    const contentText = (contract as { content: string }).content ?? ''
    const lines = wrapText(contentText, font, 10, maxWidth)

    let currentPage = pdfDoc.addPage([pageWidth, pageHeight])
    let y = pageHeight - margin

    // 제목
    currentPage.drawText((contract as { title: string }).title ?? '계약서', {
      x: margin,
      y,
      size: 16,
      font: boldFont,
      color: rgb(0, 0, 0),
    })
    y -= 30

    // 본문
    for (const line of lines) {
      if (y < margin + 60) {
        currentPage = pdfDoc.addPage([pageWidth, pageHeight])
        y = pageHeight - margin
      }
      currentPage.drawText(line, {
        x: margin,
        y,
        size: 10,
        font,
        color: rgb(0, 0, 0),
      })
      y -= lineHeight
    }

    // 서명 페이지
    if (y < margin + 200) {
      currentPage = pdfDoc.addPage([pageWidth, pageHeight])
      y = pageHeight - margin
    }

    y -= 20
    currentPage.drawText('─'.repeat(60), {
      x: margin, y, size: 8, font, color: rgb(0.7, 0.7, 0.7),
    })
    y -= 25

    // 동의 항목 체크 상태
    const sig = signature as unknown as {
      signed_at: string
      signer_ip: string
      signature_image_base64: string
    }
    const consentLines = [
      `[${consentData.consent_contract ? 'V' : ' '}] 계약 내용 동의`,
      `[${consentData.consent_privacy_collect ? 'V' : ' '}] 개인정보 수집·이용 동의`,
      `[${consentData.consent_privacy_id ? 'V' : ' '}] 고유식별정보 수집·이용 동의`,
      `[${consentData.consent_privacy_3rd ? 'V' : ' '}] 개인정보 제3자 제공 동의`,
      `[${consentData.consent_privacy_3rd_id ? 'V' : ' '}] 고유식별정보 제3자 제공 동의`,
    ]

    currentPage.drawText('동의 항목:', {
      x: margin, y, size: 10, font: boldFont, color: rgb(0, 0, 0),
    })
    y -= 16

    for (const cl of consentLines) {
      currentPage.drawText(cl, {
        x: margin + 10, y, size: 9, font, color: rgb(0.2, 0.2, 0.2),
      })
      y -= 14
    }

    y -= 10

    // 서명 이미지 삽입
    if (sig.signature_image_base64) {
      try {
        // base64 → Uint8Array
        const base64Data = sig.signature_image_base64.replace(/^data:image\/\w+;base64,/, '')
        const imageBytes = Uint8Array.from(atob(base64Data), (c) => c.charCodeAt(0))

        // PNG or JPEG detection
        const isPng = sig.signature_image_base64.includes('image/png') ||
                      imageBytes[0] === 0x89 && imageBytes[1] === 0x50
        const image = isPng
          ? await pdfDoc.embedPng(imageBytes)
          : await pdfDoc.embedJpg(imageBytes)

        const imgWidth = 180
        const imgHeight = (image.height / image.width) * imgWidth

        currentPage.drawText('서명:', {
          x: margin, y, size: 10, font: boldFont, color: rgb(0, 0, 0),
        })
        y -= imgHeight + 5

        currentPage.drawImage(image, {
          x: margin + 10,
          y,
          width: imgWidth,
          height: imgHeight,
        })
        y -= 15
      } catch {
        currentPage.drawText('[서명 이미지 로드 실패]', {
          x: margin, y, size: 9, font, color: rgb(0.8, 0, 0),
        })
        y -= 14
      }
    }

    // ═══ 진위확인 데이터 생성 (문서번호 + 인증코드 + 해시) ═══
    const contentHash = (contract as { content_hash: string }).content_hash ?? ''
    const signedAt = sig.signed_at ?? new Date().toISOString()

    // 임시 PDF 바이트 (QR 삽입 전)로 해시 계산
    const tempPdfBytes = await pdfDoc.save()

    const { data: verification } = await finalizeContractVerification(
      contractId,
      contentHash,
      tempPdfBytes,
      signedAt
    )

    // ═══ 메타정보 + QR 코드 + 문서번호 페이지 ═══
    // 새 페이지에 인증 정보 표시
    const certPage = pdfDoc.addPage([pageWidth, pageHeight])
    let certY = pageHeight - margin

    // 구분선
    certPage.drawText('─'.repeat(60), {
      x: margin, y: certY, size: 8, font, color: rgb(0.7, 0.7, 0.7),
    })
    certY -= 20

    // 문서 인증 정보 제목
    certPage.drawText('DOCUMENT VERIFICATION / 문서 인증 정보', {
      x: margin, y: certY, size: 12, font: boldFont, color: rgb(0.15, 0.15, 0.15),
    })
    certY -= 25

    // QR 코드 삽입 (오른쪽 상단)
    if (verification?.qrCodeUrl) {
      try {
        const qrRes = await fetch(verification.qrCodeUrl)
        if (qrRes.ok) {
          const qrBytes = new Uint8Array(await qrRes.arrayBuffer())
          const qrImg = await pdfDoc.embedPng(qrBytes)
          certPage.drawImage(qrImg, {
            x: pageWidth - margin - 100,
            y: certY - 80,
            width: 100,
            height: 100,
          })
          certPage.drawText('QR로 진위확인', {
            x: pageWidth - margin - 90, y: certY - 90, size: 7,
            font, color: rgb(0.5, 0.5, 0.5),
          })
        }
      } catch { /* QR 로드 실패 무시 */ }
    }

    // 인증 상세
    const certLines: [string, string][] = [
      ['문서번호', verification?.documentNumber ?? '-'],
      ['인증코드', verification?.verificationCode ?? '-'],
      ['서명일시', sig.signed_at ? new Date(sig.signed_at).toLocaleString('ko-KR') : '-'],
      ['서명자 IP', sig.signer_ip ?? '-'],
      ['', ''],
      ['문서 내용 해시 (SHA-256)', ''],
      ['', contentHash],
      ['서명 PDF 해시 (SHA-256)', ''],
      ['', verification?.signedPdfHash ?? '-'],
      ['타임스탬프 해시 (SHA-256)', ''],
      ['', verification?.timestampHash ?? '-'],
      ['', ''],
      ['진위확인 URL', verification?.verificationUrl ?? '-'],
    ]

    for (const item of certLines) {
      if (item[0] === '' && item[1] === '') {
        certY -= 8
        continue
      }

      if (item[0] && item[1]) {
        // label: value
        certPage.drawText(`${item[0]}:`, {
          x: margin, y: certY, size: 8, font: boldFont, color: rgb(0.35, 0.35, 0.35),
        })
        certPage.drawText(item[1], {
          x: margin + 160, y: certY, size: 8, font, color: rgb(0.2, 0.2, 0.2),
        })
        certY -= 14
      } else if (!item[0] && item[1]) {
        // hash value (긴 텍스트)
        certPage.drawText(item[1], {
          x: margin + 10, y: certY, size: 6.5, font, color: rgb(0.35, 0.35, 0.35),
        })
        certY -= 12
      }
    }

    certY -= 20

    // 법적 고지
    certPage.drawText('─'.repeat(60), {
      x: margin, y: certY, size: 8, font, color: rgb(0.7, 0.7, 0.7),
    })
    certY -= 16

    const legalLines = [
      '이 문서는 전자서명법 제3조 및 전자문서 및 전자거래 기본법 제4조에 의거한',
      '법적 효력을 가진 전자서명 원본입니다.',
      '문서의 위변조 여부는 상단 QR 코드를 스캔하거나, 인증코드를 통해 확인할 수 있습니다.',
      '위변조 시 관련 법령에 따라 법적 책임을 집니다.',
    ]
    for (const ll of legalLines) {
      certPage.drawText(ll, {
        x: margin, y: certY, size: 7, font, color: rgb(0.5, 0.5, 0.5),
      })
      certY -= 11
    }

    certY -= 15
    certPage.drawText(`logiSSign 전자계약 시스템  |  발급: ${new Date().toLocaleString('ko-KR')}`, {
      x: margin, y: certY, size: 7, font, color: rgb(0.6, 0.6, 0.6),
    })

    // ═══ 워터마크 삽입 (모든 페이지) ═══
    const watermarkText = verification?.documentNumber ?? 'logiSSign'
    const allPages = pdfDoc.getPages()
    for (const pg of allPages) {
      const { width: pgW, height: pgH } = pg.getSize()

      // 대각선 반투명 워터마크 "원본 / ORIGINAL"
      pg.drawText('ORIGINAL', {
        x: pgW * 0.15,
        y: pgH * 0.45,
        size: 60,
        font,
        color: rgb(0.92, 0.92, 0.92),
        rotate: { type: 'degrees', angle: 45 } as never,
        opacity: 0.15,
      })

      // 하단 문서번호 워터마크
      pg.drawText(`${watermarkText}  |  logiSSign`, {
        x: margin,
        y: 20,
        size: 6,
        font,
        color: rgb(0.8, 0.8, 0.8),
        opacity: 0.5,
      })
    }

    // 3. 최종 PDF 바이트 생성
    const pdfBytes = await pdfDoc.save()

    // 4. Supabase Storage 업로드
    const fileName = `signed/${contractId}_${Date.now()}.pdf`
    const { error: uploadErr } = await supabase.storage
      .from('contracts')
      .upload(fileName, pdfBytes, {
        contentType: 'application/pdf',
        upsert: true,
      })

    if (uploadErr) throw new Error('PDF 업로드 실패: ' + uploadErr.message)

    // Public URL
    const { data: urlData } = supabase.storage
      .from('contracts')
      .getPublicUrl(fileName)

    const pdfUrl = urlData?.publicUrl ?? null

    // 5. contracts 테이블에 PDF URL 저장
    if (pdfUrl) {
      // 최종 PDF 해시 생성
      const pdfHashBuffer = await crypto.subtle.digest('SHA-256', pdfBytes.buffer as ArrayBuffer)
      const pdfHash = Array.from(new Uint8Array(pdfHashBuffer))
        .map((b) => b.toString(16).padStart(2, '0'))
        .join('')

      await supabase
        .from('contracts')
        .update({
          signed_pdf_url: pdfUrl,
          signed_pdf_hash: pdfHash,
        } as never)
        .eq('id', contractId)

      await supabase
        .from('contract_signatures')
        .update({ signed_pdf_hash: pdfHash } as never)
        .eq('contract_id', contractId)
    }

    // 6. 감사추적인증서 자동 생성
    try {
      await generateAuditCertificatePdf(contractId)
    } catch { /* 감사추적인증서 생성 실패 시 서명 PDF는 영향 없음 */ }

    return { url: pdfUrl, error: null }
  } catch (err) {
    return { url: null, error: err instanceof Error ? err.message : 'PDF 생성 실패' }
  }
}

/** 텍스트를 주어진 너비에 맞게 줄바꿈 (영문/한글 혼합 대응) */
function wrapText(
  text: string,
  _font: unknown,
  fontSize: number,
  maxWidth: number
): string[] {
  const result: string[] = []
  const paragraphs = text.split('\n')

  for (const paragraph of paragraphs) {
    if (!paragraph.trim()) {
      result.push('')
      continue
    }

    // 한글은 font.widthOfTextAtSize가 부정확하므로 글자당 고정 너비 추정
    let currentLine = ''
    const chars = Array.from(paragraph)

    for (const char of chars) {
      const testLine = currentLine + char
      // 한글 문자 너비 추정: fontSize * 1.0, 영문: fontSize * 0.5
      const estimatedWidth = estimateTextWidth(testLine, fontSize)

      if (estimatedWidth > maxWidth && currentLine) {
        result.push(currentLine)
        currentLine = char
      } else {
        currentLine = testLine
      }
    }

    if (currentLine) {
      result.push(currentLine)
    }
  }

  return result
}

function estimateTextWidth(text: string, fontSize: number): number {
  let width = 0
  for (const char of text) {
    const code = char.charCodeAt(0)
    if (code > 0x2E80) {
      // CJK characters — roughly full-width
      width += fontSize * 1.0
    } else {
      // ASCII / Latin — roughly half-width
      width += fontSize * 0.55
    }
  }
  return width
}

/* ══════════════════════════════════════════════
   관공서 서류 전용 서명 PDF 생성
   ── 원본 PDF 레이아웃 유지 + 서명 이미지 별도 페이지
   ══════════════════════════════════════════════ */

async function generateGovernmentFormSignedPdf(
  contractId: string,
  templateId: string,
  bindingData: ContractBindingData,
  supabase: ReturnType<typeof createBrowserSupabaseClient>
): Promise<{ url: string | null; error: string | null }> {
  try {
    // 서명 데이터 조회
    const { data: signature, error: sigErr } = await supabase
      .from('contract_signatures')
      .select('signature_image_base64, signed_at, signer_ip')
      .eq('contract_id', contractId)
      .order('signed_at', { ascending: false })
      .limit(1)
      .single()

    if (sigErr || !signature) throw new Error('서명 데이터를 찾을 수 없습니다')

    const sig = signature as unknown as {
      signed_at: string
      signer_ip: string
      signature_image_base64: string
    }

    // 1. 관공서 양식 PDF 생성 (원본 레이아웃 + 데이터 오버레이)
    const formPdfBytes = await generateGovernmentFormPdf(templateId, bindingData)
    const pdfDoc = await PDFDocument.load(formPdfBytes)

    // 2. 서명 이미지를 포함한 부록 페이지 추가
    pdfDoc.registerFontkit(fontkit)
    const { regular: font, bold: boldFont } = await loadKoreanFonts(pdfDoc)
    const pageWidth = 595
    const pageHeight = 842
    const margin = 50

    const sigPage = pdfDoc.addPage([pageWidth, pageHeight])
    let y = pageHeight - margin

    sigPage.drawText('Electronic Signature / 전자서명 확인', {
      x: margin, y, size: 14, font: boldFont, color: rgb(0.15, 0.15, 0.15),
    })
    y -= 30

    // 서명 이미지 삽입
    if (sig.signature_image_base64) {
      try {
        const base64Data = sig.signature_image_base64.replace(/^data:image\/\w+;base64,/, '')
        const imageBytes = Uint8Array.from(atob(base64Data), (c) => c.charCodeAt(0))
        const isPng = sig.signature_image_base64.includes('image/png') ||
                      (imageBytes[0] === 0x89 && imageBytes[1] === 0x50)
        const image = isPng
          ? await pdfDoc.embedPng(imageBytes)
          : await pdfDoc.embedJpg(imageBytes)

        const imgWidth = 200
        const imgHeight = (image.height / image.width) * imgWidth

        sigPage.drawText('Signature:', {
          x: margin, y, size: 10, font: boldFont, color: rgb(0, 0, 0),
        })
        y -= imgHeight + 10

        sigPage.drawImage(image, {
          x: margin + 10, y, width: imgWidth, height: imgHeight,
        })
        y -= 20
      } catch {
        sigPage.drawText('[서명 이미지 로드 실패]', {
          x: margin, y, size: 9, font, color: rgb(0.8, 0, 0),
        })
        y -= 14
      }
    }

    // 서명 메타데이터
    y -= 20
    const metaLines: [string, string][] = [
      ['서명일시', sig.signed_at ? new Date(sig.signed_at).toLocaleString('ko-KR') : '-'],
      ['서명자 IP', sig.signer_ip ?? '-'],
      ['문서 ID', contractId],
    ]
    for (const [label, value] of metaLines) {
      sigPage.drawText(`${label}:`, { x: margin, y, size: 9, font: boldFont, color: rgb(0.3, 0.3, 0.3) })
      sigPage.drawText(value, { x: margin + 100, y, size: 9, font, color: rgb(0.2, 0.2, 0.2) })
      y -= 16
    }

    y -= 20
    sigPage.drawText('이 문서는 logiSSign 전자계약 시스템에서 전자서명된 원본입니다.', {
      x: margin, y, size: 8, font, color: rgb(0.5, 0.5, 0.5),
    })

    // 3. PDF 저장 및 업로드
    const pdfBytes = await pdfDoc.save()
    const fileName = `signed/${contractId}_${Date.now()}.pdf`

    const { error: uploadErr } = await supabase.storage
      .from('contracts')
      .upload(fileName, pdfBytes, { contentType: 'application/pdf', upsert: true })

    if (uploadErr) throw new Error('PDF 업로드 실패: ' + uploadErr.message)

    const { data: urlData } = supabase.storage.from('contracts').getPublicUrl(fileName)
    const pdfUrl = urlData?.publicUrl ?? null

    if (pdfUrl) {
      const pdfHashBuffer = await crypto.subtle.digest('SHA-256', (pdfBytes as Uint8Array).buffer as ArrayBuffer)
      const pdfHash = Array.from(new Uint8Array(pdfHashBuffer))
        .map((b) => b.toString(16).padStart(2, '0'))
        .join('')

      await supabase.from('contracts').update({
        signed_pdf_url: pdfUrl,
        signed_pdf_hash: pdfHash,
      } as never).eq('id', contractId)

      await supabase.from('contract_signatures')
        .update({ signed_pdf_hash: pdfHash } as never)
        .eq('contract_id', contractId)
    }

    // 감사추적인증서 생성
    try { await generateAuditCertificatePdf(contractId) } catch { /* 비치명적 */ }

    return { url: pdfUrl, error: null }
  } catch (err) {
    return { url: null, error: err instanceof Error ? err.message : '관공서 서류 PDF 생성 실패' }
  }
}
