import { PDFDocument, rgb } from 'pdf-lib'
import fontkit from '@pdf-lib/fontkit'
import { loadKoreanFonts } from '@/lib/pdf-fonts'
import { createAdminSupabaseClient } from '@/lib/supabase'
import { createSignedStorageUrl } from '@/lib/storage-reference'
import {
  finalizeContractVerification,
} from './verification.service'
import { generateAuditCertificatePdf } from './audit-certificate.service'
import {
  isGovernmentFormTemplate,
  generateGovernmentFormPdf,
} from './government-form-pdf.service'
import { generateSignedDocumentPdf, type SignField, type SignResponse } from './document-sign-field.service'
import { buildContractPdfResponses } from './contract-pdf-field-response.service'
import type { ContractBindingData } from './contract.service'

/**
 * ?쒕챸 ?꾨즺??怨꾩빟??PDF ?앹꽦
 * - 怨꾩빟??蹂몃Ц ?띿뒪???뚮뜑留?
 * - ?쒕챸 ?대?吏 ?쎌엯
 * - content_hash 湲곕줉
 * - 문서번호 / 인증코드 / QR 肄붾뱶 ?쎌엯
 * - Supabase Storage???낅줈??
 * - contracts.signed_pdf_url ?낅뜲?댄듃
 * - 媛먯궗異붿쟻?몄쬆???먮룞 ?앹꽦
 */
export async function generateSignedPdf(contractId: string): Promise<{
  url: string | null
  error: string | null
}> {
  const supabase = createAdminSupabaseClient()

  try {
    // 1. 怨꾩빟??+ ?쒕챸 ?곗씠??議고쉶
    const { data: contract, error: contractErr } = await supabase
      .from('contracts')
      .select('id, template_id, title, content, content_hash, binding_data, signed_at, template_type, template_pdf_url, sign_fields, sign_field_responses, drivers(name, phone, employee_code)')
      .eq('id', contractId)
      .single()

    if (contractErr || !contract) throw new Error('계약서를 찾을 수 없습니다')

    const contractRec = contract as Record<string, unknown>

    // PDF ???怨꾩빟?쒖씤 寃쎌슦 ???먮낯 PDF + sign_fields ?ㅻ쾭?덉씠
    if (contractRec.template_type === 'pdf' && contractRec.template_pdf_url) {
      return generatePdfTypeSignedContract(contractId, contractRec, supabase)
    }

    // 愿怨듭꽌 ?쒕쪟??寃쎌슦 ?먮낯 PDF 湲곕컲 ?앹꽦
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

    // Consent ?곗씠??蹂꾨룄 議고쉶 (DB ?ㅽ궎留덉뿉 ?꾩쭅 諛섏쁺 ?꾩씪 ???덉쑝誘濡?
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

    // 2. PDF ?앹꽦
    const pdfDoc = await PDFDocument.create()
    pdfDoc.registerFontkit(fontkit)
    const { regular: font, bold: boldFont } = await loadKoreanFonts(pdfDoc)

    const pageWidth = 595  // A4
    const pageHeight = 841
    const margin = 50
    const lineHeight = 14
    const maxWidth = pageWidth - margin * 2

    // 蹂몃Ц ?띿뒪?몃? 以꾨컮轅?泥섎━
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

    // 蹂몃Ц
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

    // ?쒕챸 ?섏씠吏
    if (y < margin + 200) {
      currentPage = pdfDoc.addPage([pageWidth, pageHeight])
      y = pageHeight - margin
    }

    y -= 20
    currentPage.drawText('?'.repeat(60), {
      x: margin, y, size: 8, font, color: rgb(0.7, 0.7, 0.7),
    })
    y -= 25

    // ?숈쓽 ??ぉ 泥댄겕 ?곹깭
    const sig = signature as unknown as {
      signed_at: string
      signer_ip: string
      signature_image_base64: string
    }
    const consentLines = [
      `[${consentData.consent_contract ? 'V' : ' '}] 怨꾩빟 ?댁슜 ?숈쓽`,
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

    // ?쒕챸 ?대?吏 ?쎌엯
    if (sig.signature_image_base64) {
      try {
        // base64 ??Uint8Array
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

    // ?먥븧??吏꾩쐞?뺤씤 ?곗씠???앹꽦 (문서번호 + 인증코드 + ?댁떆) ?먥븧??
    const contentHash = (contract as { content_hash: string }).content_hash ?? ''
    const signedAt = sig.signed_at ?? new Date().toISOString()

    // ?꾩떆 PDF 諛붿씠??(QR ?쎌엯 ??濡??댁떆 怨꾩궛
    const tempPdfBytes = await pdfDoc.save()

    const { data: verification } = await finalizeContractVerification(
      contractId,
      contentHash,
      tempPdfBytes,
      signedAt
    )

    // ?먥븧??硫뷀??뺣낫 + QR 肄붾뱶 + 문서번호 ?섏씠吏 ?먥븧??
    // ???섏씠吏???몄쬆 ?뺣낫 ?쒖떆
    const certPage = pdfDoc.addPage([pageWidth, pageHeight])
    let certY = pageHeight - margin

    // 援щ텇??
    certPage.drawText('?'.repeat(60), {
      x: margin, y: certY, size: 8, font, color: rgb(0.7, 0.7, 0.7),
    })
    certY -= 20

    // 臾몄꽌 ?몄쬆 ?뺣낫 ?쒕ぉ
    certPage.drawText('DOCUMENT VERIFICATION / 문서 인증 정보', {
      x: margin, y: certY, size: 12, font: boldFont, color: rgb(0.15, 0.15, 0.15),
    })
    certY -= 25

    // QR 肄붾뱶 ?쎌엯 (?ㅻⅨ履??곷떒)
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
          certPage.drawText('QR濡?吏꾩쐞?뺤씤', {
            x: pageWidth - margin - 90, y: certY - 90, size: 7,
            font, color: rgb(0.5, 0.5, 0.5),
          })
        }
      } catch { /* QR 濡쒕뱶 ?ㅽ뙣 臾댁떆 */ }
    }

    // ?몄쬆 ?곸꽭
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
        // hash value (湲??띿뒪??
        certPage.drawText(item[1], {
          x: margin + 10, y: certY, size: 6.5, font, color: rgb(0.35, 0.35, 0.35),
        })
        certY -= 12
      }
    }

    certY -= 20

    // 踰뺤쟻 怨좎?
    certPage.drawText('?'.repeat(60), {
      x: margin, y: certY, size: 8, font, color: rgb(0.7, 0.7, 0.7),
    })
    certY -= 16

    const legalLines = [
      '본 문서는 전자서명법 및 전자문서 관련 법령에 근거하여 생성되었습니다.',
      '전자서명과 감사 기록을 포함한 문서 원본입니다.',
      '문서 하단 QR 코드 또는 인증코드를 통해 진위 여부를 확인할 수 있습니다.',
      '관계 법령에 따라 법적 효력을 갖습니다.',
    ]
    for (const ll of legalLines) {
      certPage.drawText(ll, {
        x: margin, y: certY, size: 7, font, color: rgb(0.5, 0.5, 0.5),
      })
      certY -= 11
    }

    certY -= 15
    certPage.drawText(`logiSSign 전자계약 서비스 | 발급: ${new Date().toLocaleString('ko-KR')}`, {
      x: margin, y: certY, size: 7, font, color: rgb(0.6, 0.6, 0.6),
    })

    // ?먥븧???뚰꽣留덊겕 ?쎌엯 (紐⑤뱺 ?섏씠吏) ?먥븧??
    const watermarkText = verification?.documentNumber ?? 'logiSSign'
    const allPages = pdfDoc.getPages()
    for (const pg of allPages) {
      const { width: pgW, height: pgH } = pg.getSize()

      // ?媛곸꽑 諛섑닾紐??뚰꽣留덊겕 "?먮낯 / ORIGINAL"
      pg.drawText('ORIGINAL', {
        x: pgW * 0.15,
        y: pgH * 0.45,
        size: 60,
        font,
        color: rgb(0.92, 0.92, 0.92),
        rotate: { type: 'degrees', angle: 45 } as never,
        opacity: 0.15,
      })

      // ?섎떒 문서번호 ?뚰꽣留덊겕
      pg.drawText(`${watermarkText}  |  logiSSign`, {
        x: margin,
        y: 20,
        size: 6,
        font,
        color: rgb(0.8, 0.8, 0.8),
        opacity: 0.5,
      })
    }

    // 3. 理쒖쥌 PDF 諛붿씠???앹꽦
    const pdfBytes = await pdfDoc.save()

    // Upload the generated PDF and store the durable storage path.
    const fileName = `signed/${contractId}_${Date.now()}.pdf`
    const { error: uploadErr } = await supabase.storage
      .from('contracts')
      .upload(fileName, pdfBytes, {
        contentType: 'application/pdf',
        upsert: true,
      })

    if (uploadErr) throw new Error('PDF 업로드 실패: ' + uploadErr.message)

    const { url: pdfUrl } = await createSignedStorageUrl(
      supabase,
      'contracts',
      fileName,
      60 * 60
    )

    const pdfHashBuffer = await crypto.subtle.digest('SHA-256', pdfBytes.buffer as ArrayBuffer)
    const pdfHash = Array.from(new Uint8Array(pdfHashBuffer))
      .map((b) => b.toString(16).padStart(2, '0'))
      .join('')

    await supabase
      .from('contracts')
      .update({
        signed_pdf_url: fileName,
        signed_pdf_hash: pdfHash,
      } as never)
      .eq('id', contractId)

    await supabase
      .from('contract_signatures')
      .update({ signed_pdf_hash: pdfHash } as never)
      .eq('contract_id', contractId)

    // 6. 媛먯궗異붿쟻?몄쬆???먮룞 ?앹꽦
    try {
      await generateAuditCertificatePdf(contractId)
    } catch { /* 媛먯궗異붿쟻?몄쬆???앹꽦 ?ㅽ뙣 ???쒕챸 PDF???곹뼢 ?놁쓬 */ }

    return { url: pdfUrl, error: null }
  } catch (err) {
    return { url: null, error: err instanceof Error ? err.message : 'PDF ?앹꽦 ?ㅽ뙣' }
  }
}

/** ?띿뒪?몃? 二쇱뼱吏??덈퉬??留욊쾶 以꾨컮轅?(?곷Ц/?쒓? ?쇳빀 ??? */
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

    // ?쒓?? font.widthOfTextAtSize媛 遺?뺥솗?섎?濡?湲?먮떦 怨좎젙 ?덈퉬 異붿젙
    let currentLine = ''
    const chars = Array.from(paragraph)

    for (const char of chars) {
      const testLine = currentLine + char
      // ?쒓? 臾몄옄 ?덈퉬 異붿젙: fontSize * 1.0, ?곷Ц: fontSize * 0.5
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
      // CJK characters ??roughly full-width
      width += fontSize * 1.0
    } else {
      // ASCII / Latin ??roughly half-width
      width += fontSize * 0.55
    }
  }
  return width
}

/* ?먥븧?먥븧?먥븧?먥븧?먥븧?먥븧?먥븧?먥븧?먥븧?먥븧?먥븧?먥븧?먥븧?먥븧?먥븧?먥븧?먥븧?먥븧?먥븧?먥븧?먥븧?먥븧?먥븧
   愿怨듭꽌 ?쒕쪟 ?꾩슜 ?쒕챸 PDF ?앹꽦
   ?? ?먮낯 PDF ?덉씠?꾩썐 ?좎? + ?쒕챸 ?대?吏 蹂꾨룄 ?섏씠吏
   ?먥븧?먥븧?먥븧?먥븧?먥븧?먥븧?먥븧?먥븧?먥븧?먥븧?먥븧?먥븧?먥븧?먥븧?먥븧?먥븧?먥븧?먥븧?먥븧?먥븧?먥븧?먥븧?먥븧 */

/* ?먥븧?먥븧?먥븧?먥븧?먥븧?먥븧?먥븧?먥븧?먥븧?먥븧?먥븧?먥븧?먥븧?먥븧?먥븧?먥븧?먥븧?먥븧?먥븧?먥븧?먥븧?먥븧?먥븧
   PDF ???怨꾩빟???쒕챸 ?꾨즺 PDF ?앹꽦
   ?? ?먮낯 PDF + sign_fields ?ㅻ쾭?덉씠 + ?몄쬆 ?뺣낫
   ?먥븧?먥븧?먥븧?먥븧?먥븧?먥븧?먥븧?먥븧?먥븧?먥븧?먥븧?먥븧?먥븧?먥븧?먥븧?먥븧?먥븧?먥븧?먥븧?먥븧?먥븧?먥븧?먥븧 */

async function generatePdfTypeSignedContract(
  contractId: string,
  contractRec: Record<string, unknown>,
  supabase: ReturnType<typeof createAdminSupabaseClient>
): Promise<{ url: string | null; error: string | null }> {
  try {
    const templatePdfRef = contractRec.template_pdf_url as string
    const signFields = (contractRec.sign_fields ?? []) as SignField[]
    const fieldResponses = (contractRec.sign_field_responses ?? {}) as Record<string, { value?: string; imageData?: string }>
    const contentHash = (contractRec.content_hash as string) ?? ''

    const { url: templatePdfUrl, error: templatePdfError } = await createSignedStorageUrl(
      supabase,
      'contracts',
      templatePdfRef,
      60 * 60
    )

    if (!templatePdfUrl) {
      throw new Error(templatePdfError ?? '?쒗뵆由?PDF URL ?앹꽦 ?ㅽ뙣')
    }

    const pdfRes = await fetch(templatePdfUrl)
    if (!pdfRes.ok) throw new Error('?쒗뵆由?PDF ?ㅼ슫濡쒕뱶 ?ㅽ뙣')
    const originalPdfBytes = new Uint8Array(await pdfRes.arrayBuffer())

    // 2. sender 기본 도장/서명 default_value까지 포함해 PDF 오버레이 응답 정규화
    const responses: SignResponse[] = await buildContractPdfResponses({
      signFields,
      fieldResponses,
      contractId,
      signedAt: (contractRec.signed_at as string) ?? new Date().toISOString(),
      supabase,
    })

    // 3. ?먮낯 PDF???꾨뱶 ?ㅻ쾭?덉씠 (document-sign-field.service???⑥닔 ?ъ궗??
    const signedPdfBytes = await generateSignedDocumentPdf(originalPdfBytes, signFields, responses)

    // 4. ?몄쬆 ?뺣낫 ?섏씠吏 異붽?
    const pdfDoc = await PDFDocument.load(signedPdfBytes)
    pdfDoc.registerFontkit(fontkit)
    const { regular: font, bold: boldFont } = await loadKoreanFonts(pdfDoc)

    const pageWidth = 595
    const pageHeight = 841
    const margin = 50

    // ?쒕챸 ?곗씠??議고쉶
    const { data: signature } = await supabase
      .from('contract_signatures')
      .select('signed_at, signer_ip')
      .eq('contract_id', contractId)
      .order('signed_at', { ascending: false })
      .limit(1)
      .single()

    const signedAt = (signature as Record<string, string> | null)?.signed_at ?? new Date().toISOString()
    const signerIp = (signature as Record<string, string> | null)?.signer_ip ?? '-'

    // 吏꾩쐞?뺤씤 ?곗씠???앹꽦
    const tempBytes = await pdfDoc.save()
    const { data: verification } = await finalizeContractVerification(
      contractId,
      contentHash,
      tempBytes,
      signedAt
    )

    // ?몄쬆 ?뺣낫 ?섏씠吏
    const certPage = pdfDoc.addPage([pageWidth, pageHeight])
    let certY = pageHeight - margin

    certPage.drawText('?'.repeat(60), {
      x: margin, y: certY, size: 8, font, color: rgb(0.7, 0.7, 0.7),
    })
    certY -= 20

    certPage.drawText('DOCUMENT VERIFICATION / 문서 인증 정보', {
      x: margin, y: certY, size: 12, font: boldFont, color: rgb(0.15, 0.15, 0.15),
    })
    certY -= 25

    // QR 肄붾뱶
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
        }
      } catch { /* QR 濡쒕뱶 ?ㅽ뙣 臾댁떆 */ }
    }

    const certLines: [string, string][] = [
      ['문서번호', verification?.documentNumber ?? '-'],
      ['인증코드', verification?.verificationCode ?? '-'],
      ['서명일시', new Date(signedAt).toLocaleString('ko-KR')],
      ['서명자 IP', signerIp],
      ['', ''],
      ['진위확인 URL', verification?.verificationUrl ?? '-'],
    ]

    for (const item of certLines) {
      if (item[0] === '' && item[1] === '') { certY -= 8; continue }
      if (item[0] && item[1]) {
        certPage.drawText(`${item[0]}:`, { x: margin, y: certY, size: 8, font: boldFont, color: rgb(0.35, 0.35, 0.35) })
        certPage.drawText(item[1], { x: margin + 160, y: certY, size: 8, font, color: rgb(0.2, 0.2, 0.2) })
        certY -= 14
      }
    }

    certY -= 20
    certPage.drawText('?'.repeat(60), { x: margin, y: certY, size: 8, font, color: rgb(0.7, 0.7, 0.7) })
    certY -= 16

    const legalLines = [
      '본 문서는 전자서명법 및 전자문서 관련 법령에 근거하여 생성되었습니다.',
      '전자서명과 감사 기록을 포함한 문서 원본입니다.',
    ]
    for (const ll of legalLines) {
      certPage.drawText(ll, { x: margin, y: certY, size: 7, font, color: rgb(0.5, 0.5, 0.5) })
      certY -= 11
    }

    certY -= 15
    certPage.drawText(`logiSSign 전자계약 서비스 | 발급: ${new Date().toLocaleString('ko-KR')}`, {
      x: margin, y: certY, size: 7, font, color: rgb(0.6, 0.6, 0.6),
    })

    // ?뚰꽣留덊겕
    const watermarkText = verification?.documentNumber ?? 'logiSSign'
    for (const pg of pdfDoc.getPages()) {
      const { width: pgW, height: pgH } = pg.getSize()
      pg.drawText('ORIGINAL', {
        x: pgW * 0.15, y: pgH * 0.45, size: 60, font,
        color: rgb(0.92, 0.92, 0.92),
        rotate: { type: 'degrees', angle: 45 } as never,
        opacity: 0.15,
      })
      pg.drawText(`${watermarkText}  |  logiSSign`, {
        x: margin, y: 20, size: 6, font, color: rgb(0.8, 0.8, 0.8), opacity: 0.5,
      })
    }

    // 5. 최종 PDF 저장 및 업로드
    const finalPdfBytes = await pdfDoc.save()
    const fileName = `signed/${contractId}_${Date.now()}.pdf`

    const { error: uploadErr } = await supabase.storage
      .from('contracts')
      .upload(fileName, finalPdfBytes, { contentType: 'application/pdf', upsert: true })

    if (uploadErr) throw new Error('PDF 업로드 실패: ' + uploadErr.message)

    const { url: pdfUrl } = await createSignedStorageUrl(
      supabase,
      'contracts',
      fileName,
      60 * 60
    )

    const pdfHashBuffer = await crypto.subtle.digest('SHA-256', (finalPdfBytes as Uint8Array).buffer as ArrayBuffer)
    const pdfHash = Array.from(new Uint8Array(pdfHashBuffer))
      .map((b) => b.toString(16).padStart(2, '0'))
      .join('')

    await supabase.from('contracts').update({
      signed_pdf_url: fileName,
      signed_pdf_hash: pdfHash,
    } as never).eq('id', contractId)

    await supabase.from('contract_signatures')
      .update({ signed_pdf_hash: pdfHash } as never)
      .eq('contract_id', contractId)

    try { await generateAuditCertificatePdf(contractId) } catch { /* 鍮꾩튂紐낆쟻 */ }

    return { url: pdfUrl, error: null }
  } catch (err) {
    return { url: null, error: err instanceof Error ? err.message : 'PDF 기반 계약서 생성 실패' }
  }
}

/* ?먥븧?먥븧?먥븧?먥븧?먥븧?먥븧?먥븧?먥븧?먥븧?먥븧?먥븧?먥븧?먥븧?먥븧?먥븧?먥븧?먥븧?먥븧?먥븧?먥븧?먥븧?먥븧?먥븧
   愿怨듭꽌 ?쒕쪟 ?꾩슜 ?쒕챸 PDF ?앹꽦
   ?? ?먮낯 PDF ?덉씠?꾩썐 ?좎? + ?쒕챸 ?대?吏 蹂꾨룄 ?섏씠吏
   ?먥븧?먥븧?먥븧?먥븧?먥븧?먥븧?먥븧?먥븧?먥븧?먥븧?먥븧?먥븧?먥븧?먥븧?먥븧?먥븧?먥븧?먥븧?먥븧?먥븧?먥븧?먥븧?먥븧 */

async function generateGovernmentFormSignedPdf(
  contractId: string,
  templateId: string,
  bindingData: ContractBindingData,
  supabase: ReturnType<typeof createAdminSupabaseClient>
): Promise<{ url: string | null; error: string | null }> {
  try {
    // ?쒕챸 ?곗씠??議고쉶
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

    // 1. 愿怨듭꽌 ?묒떇 PDF ?앹꽦 (?먮낯 ?덉씠?꾩썐 + ?곗씠???ㅻ쾭?덉씠)
    const formPdfBytes = await generateGovernmentFormPdf(templateId, bindingData)
    const pdfDoc = await PDFDocument.load(formPdfBytes)

    // 2. ?쒕챸 ?대?吏瑜??ы븿??遺濡??섏씠吏 異붽?
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

    // ?쒕챸 ?대?吏 ?쎌엯
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

    // ?쒕챸 硫뷀??곗씠??
    y -= 20
    const metaLines: [string, string][] = [
      ['서명일시', sig.signed_at ? new Date(sig.signed_at).toLocaleString('ko-KR') : '-'],
      ['서명자 IP', sig.signer_ip ?? '-'],
      ['臾몄꽌 ID', contractId],
    ]
    for (const [label, value] of metaLines) {
      sigPage.drawText(`${label}:`, { x: margin, y, size: 9, font: boldFont, color: rgb(0.3, 0.3, 0.3) })
      sigPage.drawText(value, { x: margin + 100, y, size: 9, font, color: rgb(0.2, 0.2, 0.2) })
      y -= 16
    }

    y -= 20
    sigPage.drawText('본 문서는 logiSSign 전자계약 서비스에서 전자서명된 원본입니다.', {
      x: margin, y, size: 8, font, color: rgb(0.5, 0.5, 0.5),
    })

    // 3. PDF ???諛??낅줈??
    const pdfBytes = await pdfDoc.save()
    const fileName = `signed/${contractId}_${Date.now()}.pdf`

    const { error: uploadErr } = await supabase.storage
      .from('contracts')
      .upload(fileName, pdfBytes, { contentType: 'application/pdf', upsert: true })

    if (uploadErr) throw new Error('PDF 업로드 실패: ' + uploadErr.message)

    const { url: pdfUrl } = await createSignedStorageUrl(
      supabase,
      'contracts',
      fileName,
      60 * 60
    )

    const pdfHashBuffer = await crypto.subtle.digest('SHA-256', (pdfBytes as Uint8Array).buffer as ArrayBuffer)
    const pdfHash = Array.from(new Uint8Array(pdfHashBuffer))
      .map((b) => b.toString(16).padStart(2, '0'))
      .join('')

    await supabase.from('contracts').update({
      signed_pdf_url: fileName,
      signed_pdf_hash: pdfHash,
    } as never).eq('id', contractId)

    await supabase.from('contract_signatures')
      .update({ signed_pdf_hash: pdfHash } as never)
      .eq('contract_id', contractId)

    // 감사증명서는 실패해도 서명 PDF 생성 자체는 유지한다.
    try { await generateAuditCertificatePdf(contractId) } catch { /* no-op */ }

    return { url: pdfUrl, error: null }
  } catch (err) {
    return { url: null, error: err instanceof Error ? err.message : '관공서 서류 PDF 생성 실패' }
  }
}


