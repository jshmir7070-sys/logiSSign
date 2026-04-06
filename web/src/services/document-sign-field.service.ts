/**
 * 문서 서명 필드 서비스
 *
 * 외부 문서(PDF) 위에 체크박스, 도장, 서명, 날짜, 텍스트 필드를 배치하고
 * 기사의 서명 응답을 관리하며, 최종 서명 완료 PDF를 생성한다.
 *
 * 플로우:
 *  1. 대리점: PDF 업로드 → 필드 배치(에디터) → 기사에게 전송
 *  2. 기사: 문서 열람 → 필드별 서명/체크/날인 → 제출
 *  3. 시스템: 원본 PDF + 응답 → 서명 완료 PDF 생성
 */

import { createBrowserSupabaseClient } from '@/lib/supabase'
import { PDFDocument, rgb } from 'pdf-lib'

/* ══════════════════════ Types ══════════════════════ */

export type SignFieldType = 'checkbox' | 'signature' | 'seal' | 'date' | 'text'

export interface SignField {
  id: string
  document_file_id: string
  field_type: SignFieldType
  page_number: number
  x: number          // % (0~100)
  y: number          // % (0~100)
  width: number      // % (0~100)
  height: number     // % (0~100)
  label: string | null
  required: boolean
  sort_order: number
  default_value: string | null
  created_at: string
}

export interface SignFieldInput {
  field_type: SignFieldType
  page_number: number
  x: number
  y: number
  width: number
  height: number
  label?: string
  required?: boolean
  sort_order?: number
  default_value?: string
}

export interface SignResponse {
  id: string
  delivery_id: string
  field_id: string
  driver_id: string
  value: string | null
  image_data: string | null
  signed_at: string
}

/* ══════════════════════ 필드 배치 (대리점용) ══════════════════════ */

/** 문서의 서명 필드 목록 조회 */
export async function getSignFields(documentFileId: string): Promise<SignField[]> {
  const supabase = createBrowserSupabaseClient()
  const { data } = await supabase
    .from('document_sign_fields')
    .select('*')
    .eq('document_file_id', documentFileId)
    .order('page_number')
    .order('sort_order')
  return (data ?? []) as SignField[]
}

/** 서명 필드 일괄 저장 (기존 삭제 후 재삽입) */
export async function saveSignFields(
  documentFileId: string,
  fields: SignFieldInput[],
): Promise<{ error: string | null }> {
  const supabase = createBrowserSupabaseClient()

  // 기존 필드 삭제
  await supabase
    .from('document_sign_fields')
    .delete()
    .eq('document_file_id', documentFileId)

  if (fields.length === 0) return { error: null }

  // 새 필드 삽입
  const rows = fields.map((f, i) => ({
    document_file_id: documentFileId,
    field_type: f.field_type,
    page_number: f.page_number,
    x: f.x,
    y: f.y,
    width: f.width,
    height: f.height,
    label: f.label ?? null,
    required: f.required ?? true,
    sort_order: f.sort_order ?? i,
    default_value: f.default_value ?? null,
  }))

  const { error } = await supabase.from('document_sign_fields').insert(rows)
  return { error: error?.message ?? null }
}

/** 개별 필드 추가 */
export async function addSignField(
  documentFileId: string,
  field: SignFieldInput,
): Promise<{ data: SignField | null; error: string | null }> {
  const supabase = createBrowserSupabaseClient()
  const { data, error } = await supabase
    .from('document_sign_fields')
    .insert({
      document_file_id: documentFileId,
      ...field,
    })
    .select()
    .single()
  return { data: data as SignField | null, error: error?.message ?? null }
}

/** 개별 필드 삭제 */
export async function removeSignField(fieldId: string): Promise<{ error: string | null }> {
  const supabase = createBrowserSupabaseClient()
  const { error } = await supabase.from('document_sign_fields').delete().eq('id', fieldId)
  return { error: error?.message ?? null }
}

/* ══════════════════════ 서명 응답 (기사용) ══════════════════════ */

/** 기사의 서명 응답 조회 */
export async function getSignResponses(deliveryId: string): Promise<SignResponse[]> {
  const supabase = createBrowserSupabaseClient()
  const { data } = await supabase
    .from('document_sign_responses')
    .select('*')
    .eq('delivery_id', deliveryId)
  return (data ?? []) as SignResponse[]
}

/** 기사가 필드별 응답 제출 */
export async function submitSignResponse(input: {
  deliveryId: string
  fieldId: string
  driverId: string
  value?: string
  imageData?: string
}): Promise<{ error: string | null }> {
  const supabase = createBrowserSupabaseClient()
  const { error } = await supabase
    .from('document_sign_responses')
    .upsert({
      delivery_id: input.deliveryId,
      field_id: input.fieldId,
      driver_id: input.driverId,
      value: input.value ?? null,
      image_data: input.imageData ?? null,
      signed_at: new Date().toISOString(),
    }, { onConflict: 'delivery_id,field_id' })
  return { error: error?.message ?? null }
}

/** 모든 필수 필드가 응답되었는지 확인 */
export async function checkAllRequiredFieldsSigned(
  deliveryId: string,
  documentFileId: string,
): Promise<{ complete: boolean; missing: string[] }> {
  const [fields, responses] = await Promise.all([
    getSignFields(documentFileId),
    getSignResponses(deliveryId),
  ])

  const respondedFieldIds = new Set(responses.map(r => r.field_id))
  const missing: string[] = []

  for (const f of fields) {
    if (f.required && !respondedFieldIds.has(f.id)) {
      missing.push(f.label || f.field_type)
    }
  }

  return { complete: missing.length === 0, missing }
}

/* ══════════════════════ 서명 완료 PDF 생성 ══════════════════════ */

/**
 * 원본 PDF 위에 서명/도장/체크/텍스트를 오버레이하여 최종 PDF 생성
 *
 * @param originalPdfBytes - 원본 PDF 바이너리
 * @param fields - 필드 위치 정보
 * @param responses - 기사 응답 데이터
 * @returns 서명 완료 PDF 바이너리 (Uint8Array)
 */
export async function generateSignedDocumentPdf(
  originalPdfBytes: Uint8Array,
  fields: SignField[],
  responses: SignResponse[],
): Promise<Uint8Array> {
  const pdfDoc = await PDFDocument.load(originalPdfBytes)
  const pages = pdfDoc.getPages()

  // 응답을 fieldId로 인덱싱
  const responseMap = new Map(responses.map(r => [r.field_id, r]))

  // 체크마크 색상
  const checkColor = rgb(0.1, 0.1, 0.8)      // 진한 파란색
  const textColor = rgb(0.05, 0.05, 0.05)     // 거의 검정
  const sealColor = rgb(0.77, 0.17, 0.17)     // 인감 빨간색 #C42B2B

  for (const field of fields) {
    const response = responseMap.get(field.id)
    if (!response) continue

    const pageIdx = field.page_number - 1
    if (pageIdx < 0 || pageIdx >= pages.length) continue
    const page = pages[pageIdx]

    const { width: pageW, height: pageH } = page.getSize()

    // % → 실제 좌표 변환
    const fx = (field.x / 100) * pageW
    const fy = pageH - ((field.y / 100) * pageH) - ((field.height / 100) * pageH)  // PDF는 좌하단 원점
    const fw = (field.width / 100) * pageW
    const fh = (field.height / 100) * pageH

    switch (field.field_type) {
      case 'checkbox': {
        if (response.value === 'true') {
          // ✓ 체크마크 그리기
          const fontSize = Math.min(fh * 0.85, fw * 0.85)
          page.drawText('✓', {
            x: fx + fw * 0.15,
            y: fy + fh * 0.15,
            size: fontSize,
            color: checkColor,
          })
        }
        break
      }

      case 'signature':
      case 'seal': {
        // base64 이미지를 PDF에 삽입
        if (response.image_data) {
          try {
            const imgBytes = base64ToBytes(response.image_data)
            const isPng = imgBytes[0] === 0x89 && imgBytes[1] === 0x50
            const img = isPng
              ? await pdfDoc.embedPng(imgBytes)
              : await pdfDoc.embedJpg(imgBytes)

            // 필드 영역 안에 비율 유지하며 삽입
            const imgAspect = img.width / img.height
            const fieldAspect = fw / fh
            let drawW = fw
            let drawH = fh
            if (imgAspect > fieldAspect) {
              drawH = fw / imgAspect
            } else {
              drawW = fh * imgAspect
            }
            const drawX = fx + (fw - drawW) / 2
            const drawY = fy + (fh - drawH) / 2

            page.drawImage(img, {
              x: drawX,
              y: drawY,
              width: drawW,
              height: drawH,
            })
          } catch {
            // 이미지 삽입 실패 시 텍스트 fallback
            page.drawText('[서명]', { x: fx + 2, y: fy + fh * 0.3, size: 8, color: sealColor })
          }
        }
        break
      }

      case 'date': {
        const dateStr = response.value || new Date().toLocaleDateString('ko-KR')
        const fontSize = Math.min(fh * 0.6, 12)
        page.drawText(dateStr, {
          x: fx + 2,
          y: fy + fh * 0.25,
          size: fontSize,
          color: textColor,
        })
        break
      }

      case 'text': {
        if (response.value) {
          const fontSize = Math.min(fh * 0.6, 11)
          page.drawText(response.value, {
            x: fx + 2,
            y: fy + fh * 0.25,
            size: fontSize,
            color: textColor,
          })
        }
        break
      }
    }
  }

  return pdfDoc.save()
}

/* ══════════════════════ 전체 서명 완료 처리 ══════════════════════ */

/**
 * 문서 서명 완료 처리 — 응답 검증 → PDF 생성 → 업로드 → 상태 업데이트
 */
export async function finalizeDocumentSigning(
  deliveryId: string,
): Promise<{ signedPdfUrl: string | null; error: string | null }> {
  const supabase = createBrowserSupabaseClient()

  try {
    // 1. delivery 정보 조회
    const { data: delivery } = await supabase
      .from('document_deliveries')
      .select('id, document_file_id, driver_id')
      .eq('id', deliveryId)
      .single()

    if (!delivery) throw new Error('전송 기록을 찾을 수 없습니다')

    const docFileId = delivery.document_file_id
    if (!docFileId) throw new Error('문서 파일이 없습니다')

    // 2. 필수 필드 완료 확인
    const { complete, missing } = await checkAllRequiredFieldsSigned(deliveryId, docFileId)
    if (!complete) {
      throw new Error(`미완료 필드: ${missing.join(', ')}`)
    }

    // 3. 원본 PDF 다운로드
    const { data: docFile } = await supabase
      .from('document_files')
      .select('file_url')
      .eq('id', docFileId)
      .single()

    if (!docFile?.file_url) throw new Error('원본 파일 URL이 없습니다')

    let sourceUrl = docFile.file_url
    if (!sourceUrl.startsWith('http')) {
      const { data: signedData, error: signedError } = await supabase.storage
        .from('documents')
        .createSignedUrl(sourceUrl, 3600)

      if (signedError || !signedData?.signedUrl) {
        throw new Error(signedError?.message ?? 'signed URL ?앹꽦 ?ㅽ뙣')
      }

      sourceUrl = signedData.signedUrl
    }

    const pdfResponse = await fetch(sourceUrl)
    if (!pdfResponse.ok) throw new Error('PDF 다운로드 실패')
    const originalPdfBytes = new Uint8Array(await pdfResponse.arrayBuffer())

    // 4. 필드 + 응답 조회
    const [fields, responses] = await Promise.all([
      getSignFields(docFileId),
      getSignResponses(deliveryId),
    ])

    // 5. 서명 완료 PDF 생성
    const signedPdfBytes = await generateSignedDocumentPdf(originalPdfBytes, fields, responses)

    // 6. Supabase Storage 업로드
    const ts = Date.now()
    const path = `signed-documents/${deliveryId}_${ts}.pdf`
    const blob = new Blob([signedPdfBytes as BlobPart], { type: 'application/pdf' })

    const { error: uploadErr } = await supabase.storage
      .from('documents')
      .upload(path, blob, { contentType: 'application/pdf', upsert: true })

    if (uploadErr) throw new Error(`업로드 실패: ${uploadErr.message}`)

    const { data: urlData } = await supabase.storage.from('documents').createSignedUrl(path, 60 * 60 * 24 * 365)
    const signedPdfUrl = urlData?.signedUrl ?? null

    // 7. 상태 업데이트
    await supabase
      .from('document_deliveries')
      .update({
        status: 'signed',
        signed_at: new Date().toISOString(),
      })
      .eq('id', deliveryId)

    return { signedPdfUrl, error: null }
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : '서명 처리 실패'
    return { signedPdfUrl: null, error: msg }
  }
}

/* ══════════════════════ 유틸리티 ══════════════════════ */

/** base64 (data URI 가능) → Uint8Array */
function base64ToBytes(b64: string): Uint8Array {
  const raw = b64.includes(',') ? b64.split(',')[1] : b64
  const binary = atob(raw)
  const bytes = new Uint8Array(binary.length)
  for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i)
  return bytes
}

/* ══════════════════════ 필드 타입 메타 (UI용) ══════════════════════ */

export const FIELD_TYPE_META: Record<SignFieldType, {
  label: string
  icon: string
  color: string
  defaultWidth: number
  defaultHeight: number
}> = {
  checkbox: {
    label: '체크박스',
    icon: '☑',
    color: '#2563EB',
    defaultWidth: 3,
    defaultHeight: 3,
  },
  signature: {
    label: '자필서명',
    icon: '✍',
    color: '#7C3AED',
    defaultWidth: 15,
    defaultHeight: 6,
  },
  seal: {
    label: '도장날인',
    icon: '🔴',
    color: '#DC2626',
    defaultWidth: 8,
    defaultHeight: 8,
  },
  date: {
    label: '날짜',
    icon: '📅',
    color: '#059669',
    defaultWidth: 12,
    defaultHeight: 3,
  },
  text: {
    label: '텍스트',
    icon: '📝',
    color: '#D97706',
    defaultWidth: 20,
    defaultHeight: 3,
  },
}
