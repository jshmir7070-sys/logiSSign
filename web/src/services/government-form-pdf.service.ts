/**
 * 관공서/통합물류협회 서류 PDF 생성 서비스
 * ─────────────────────────────────────────────
 * 원본 PDF를 템플릿으로 사용하여 변수 데이터를 정확한 좌표에 오버레이.
 * 관공서 제출용이므로 원본 레이아웃을 100% 유지.
 *
 * 지원 서류:
 *  1. 택배용 화물자동차 운송사업 신규허가 신청서 (별지1호)
 *  2. 택배용 화물자동차 전속 운송 계약서
 *  3. 통합물류협회 개인정보활용 동의서
 */

import { PDFDocument, rgb, PDFPage, PDFFont } from 'pdf-lib'
import { loadKoreanFonts } from '@/lib/pdf-fonts'
import type { ContractBindingData } from './contract.service'

/* ══════════════════════════════════════════════
   시스템 템플릿 ID → 원본 PDF 파일 매핑
   ══════════════════════════════════════════════ */

export const GOVERNMENT_FORM_TEMPLATE_IDS: Record<string, string> = {
  'a1b2c3d4-1111-4aaa-bbbb-000000000001': '/contract-templates/form-permit-application.pdf',
  'a1b2c3d4-2222-4aaa-bbbb-000000000002': '/contract-templates/form-exclusive-contract.pdf',
  'a1b2c3d4-3333-4aaa-bbbb-000000000003': '/contract-templates/form-privacy-consent.pdf',
}

/** 해당 templateId가 관공서 서류인지 확인 */
export function isGovernmentFormTemplate(templateId: string): boolean {
  return templateId in GOVERNMENT_FORM_TEMPLATE_IDS
}

/* ══════════════════════════════════════════════
   공통 유틸
   ══════════════════════════════════════════════ */

interface TextOverlay {
  text: string
  x: number
  y: number
  size?: number
  bold?: boolean
  maxWidth?: number
}

interface CheckboxOverlay {
  checked: boolean
  x: number
  y: number
  size?: number
}

/** 한글 폰트: 공통 모듈에서 로드 (@/lib/pdf-fonts) */

/** 텍스트 오버레이 그리기 */
function drawTextOverlays(
  page: PDFPage,
  overlays: TextOverlay[],
  fonts: { regular: PDFFont; bold: PDFFont },
  defaultSize = 9
) {
  for (const item of overlays) {
    if (!item.text) continue
    const font = item.bold ? fonts.bold : fonts.regular
    const size = item.size ?? defaultSize

    if (item.maxWidth) {
      // 긴 텍스트 잘라내기
      let displayText = item.text
      while (font.widthOfTextAtSize(displayText, size) > item.maxWidth && displayText.length > 1) {
        displayText = displayText.slice(0, -1)
      }
      page.drawText(displayText, { x: item.x, y: item.y, size, font, color: rgb(0, 0, 0) })
    } else {
      page.drawText(item.text, { x: item.x, y: item.y, size, font, color: rgb(0, 0, 0) })
    }
  }
}

/** 체크박스 오버레이 (✓ 표시) */
function drawCheckboxOverlays(
  page: PDFPage,
  checks: CheckboxOverlay[],
  font: PDFFont,
  defaultSize = 10
) {
  for (const item of checks) {
    if (item.checked) {
      page.drawText('✓', {
        x: item.x,
        y: item.y,
        size: item.size ?? defaultSize,
        font,
        color: rgb(0, 0, 0),
      })
    }
  }
}

/** 날짜를 "2025", "03", "15" 형태로 분리 */
function splitDate(dateStr: string): { year: string; month: string; day: string } {
  if (!dateStr) return { year: '', month: '', day: '' }
  const cleaned = dateStr.replace(/[^0-9-/.]/g, '')
  const parts = cleaned.split(/[-/.]/)
  if (parts.length >= 3) {
    return { year: parts[0], month: parts[1], day: parts[2] }
  }
  if (parts.length === 1 && parts[0].length === 8) {
    return { year: parts[0].slice(0, 4), month: parts[0].slice(4, 6), day: parts[0].slice(6, 8) }
  }
  return { year: dateStr, month: '', day: '' }
}

/* ══════════════════════════════════════════════
   1. 신규허가 신청서 (별지1호)
   ══════════════════════════════════════════════
   A4: 595.28 x 841.89 pt
   원본은 표 형식의 정형화된 관공서 양식 */

function buildPermitApplicationOverlays(data: ContractBindingData): {
  texts: TextOverlay[]
  checks: CheckboxOverlay[]
} {
  const start = splitDate(data.계약시작일)
  const end = splitDate(data.계약종료일)
  const career = splitDate(data.경력시작)
  const careerEnd = splitDate(data.경력종료)
  const today = splitDate(data.계약일 || new Date().toISOString().slice(0, 10))

  /*
   * 좌표는 pymupdf rawdict 문자 단위 실측값 (원점 = 좌하단, pt 단위)
   * 라벨 x1 + 5pt 여백 = 데이터 입력 시작 x
   * 날짜 필드: 원본 "20" 문자 끝 x + 2pt, "." 문자 끝 x + 2pt 방식
   */
  const texts: TextOverlay[] = [
    // ① 신청인
    { text: data.기사명, x: 248, y: 708, size: 10 },
    { text: data.주민등록번호, x: 246, y: 686, size: 10 },
    { text: data.주소, x: 270, y: 663, size: 9, maxWidth: 250 },
    { text: data.전화번호, x: 411, y: 635, size: 9 },

    // ② 전속운송계약
    { text: data.택배사업자명, x: 284, y: 607, size: 9, maxWidth: 250 },
    { text: data.대리점명, x: 270, y: 585, size: 9, maxWidth: 250 },
    { text: data.대리점대표자, x: 303, y: 563, size: 9 },
    { text: data.대리점주소, x: 281, y: 540, size: 9, maxWidth: 250 },
    { text: data.대리점연락처, x: 292, y: 518, size: 9 },
    { text: data.전속계약기간, x: 276, y: 491, size: 10 },

    // 계약 시작일: "20"(x=433~446) 뒤 연도, "."(x=462~466) 뒤 월, "."(x=482~486) 뒤 일
    { text: start.year?.slice(2), x: 448, y: 496, size: 10 },
    { text: start.month, x: 468, y: 496, size: 10 },
    { text: start.day, x: 488, y: 496, size: 10 },
    // 계약 종료일 (같은 x, y=473)
    { text: end.year?.slice(2), x: 448, y: 473, size: 10 },
    { text: end.month, x: 468, y: 473, size: 10 },
    { text: end.day, x: 488, y: 473, size: 10 },

    // 경력기간 년수 (underscore at x=308)
    { text: data.경력기간, x: 308, y: 439, size: 10 },
    // 경력시작 year(x=413 "_"), month(x=440 "_")
    { text: career.year?.slice(2), x: 415, y: 439, size: 10 },
    { text: career.month, x: 441, y: 439, size: 10 },
    // 경력종료 year(x=481 "_"), month(x=508 "_")
    { text: careerEnd.year?.slice(2), x: 483, y: 439, size: 10 },
    { text: careerEnd.month, x: 510, y: 439, size: 10 },

    // ③ 차량정보
    { text: data.차명, x: 199, y: 368, size: 9 },
    { text: data.연식, x: 385, y: 368, size: 9 },
    { text: data.최대적재량, x: 220, y: 346, size: 9 },

    // ④ 운전면허 (label "면허번호:" ends at x=218.6)
    { text: data.면허번호, x: 224, y: 323, size: 9 },

    // ⑤ 화물운송 종사자격 (label ends at x=229.6 / x=415.9)
    { text: data.자격증번호, x: 235, y: 257, size: 9 },
    { text: data.자격취득일, x: 421, y: 257, size: 9 },

    // 하단 제출일 "2 0    년     월     일"
    // "0"(x=239~246) 뒤 연도, "년"(x=270~282) 뒤 월, "월"(x=312~324) 뒤 일
    { text: today.year?.slice(2), x: 248, y: 188, size: 11 },
    { text: today.month, x: 290, y: 188, size: 11 },
    { text: today.day, x: 330, y: 188, size: 11 },

    // 택배서비스사업자명 (label ends at ~175)
    { text: data.택배사업자명, x: 178, y: 168, size: 10 },
    // 대표이사 (label at x=63.7)
    { text: data.대리점대표자, x: 118, y: 154, size: 10 },
    // 위 신청인
    { text: data.기사명, x: 130, y: 133, size: 10 },
  ]

  // 연료 체크박스 — pymupdf □ 실측 위치 (y=407)
  const fuelType = (data.연료종류 || '').toLowerCase()
  const checks: CheckboxOverlay[] = [
    { checked: fuelType.includes('lpg'), x: 196, y: 407, size: 10 },
    { checked: fuelType.includes('경유') || fuelType.includes('디젤'), x: 254, y: 407, size: 10 },
    { checked: fuelType.includes('전기'), x: 312, y: 407, size: 10 },
    { checked: fuelType.includes('휘발유') || fuelType.includes('가솔린'), x: 369, y: 407, size: 10 },
    { checked: !['lpg', '경유', '디젤', '전기', '휘발유', '가솔린'].some(f => fuelType.includes(f)) && !!fuelType, x: 437, y: 407, size: 10 },

    // 차량 형태 — □ at x=390.1, 433.0, y=346
    { checked: (data.차량형태 || '').includes('탑'), x: 392, y: 346, size: 10 },
    { checked: (data.차량형태 || '').includes('밴'), x: 435, y: 346, size: 10 },

    // 면허종류 1행 — □ at x=220.4, 302.6, 378.8, y=301
    { checked: (data.면허종류 || '').includes('1종 대형'), x: 222, y: 301, size: 10 },
    { checked: (data.면허종류 || '').includes('1종 보통'), x: 304, y: 301, size: 10 },
    { checked: (data.면허종류 || '').includes('2종 보통'), x: 380, y: 301, size: 10 },
    // 면허종류 2행 — □ at x=219.8, 377.2, y=286
    { checked: (data.면허종류 || '').includes('대형견인'), x: 221, y: 286, size: 10 },
    { checked: (data.면허종류 || '').includes('소형견인'), x: 379, y: 286, size: 10 },
  ]

  return { texts, checks }
}

/* ══════════════════════════════════════════════
   2. 전속 운송 계약서
   ══════════════════════════════════════════════ */

function buildExclusiveContractOverlays(data: ContractBindingData): {
  texts: TextOverlay[]
  checks: CheckboxOverlay[]
} {
  const start = splitDate(data.계약시작일)
  const end = splitDate(data.계약종료일)
  const today = splitDate(data.계약일 || new Date().toISOString().slice(0, 10))

  /*
   * 좌표: pymupdf rawdict 문자 단위 실측 (595.3 x 841.9)
   * 상단 당사자: "와 ___(이하 을)" / "및 ___(이하 병)" 빈칸 위치
   * 날짜: "20" char 끝 + 2pt, "년"/"월"/"일" char 끝 + 4pt
   */
  const texts: TextOverlay[] = [
    // 상단 당사자 — "와" ends x=216.6, blank→"을" x=317 / "및" ~x=395, blank→"병" x=466
    { text: data.대리점명, x: 222, y: 736, size: 8 },
    { text: data.기사명, x: 398, y: 736, size: 8 },

    // 제4조 계약기간: "20"(x=390~400) "년"(x=410~419) "월"(x=435~443) "일"(x=459~468)
    //                "부터 20"(x=489~498) "년"(x=514~522) "월"(x=538~547)
    { text: start.year?.slice(2), x: 401, y: 681, size: 8 },
    { text: start.month, x: 422, y: 681, size: 8 },
    { text: start.day, x: 447, y: 681, size: 8 },
    { text: end.year?.slice(2), x: 500, y: 681, size: 8 },
    { text: end.month, x: 526, y: 681, size: 8 },
    // 종료일 day는 다음 행 시작 (원본에 "3" placeholder가 있는 위치)
    { text: end.day, x: 302, y: 667, size: 8 },

    // 제6조 관할법원 — "경우에는"(~x=342) 과 "지방법원"(x=384) 사이
    { text: data.관할법원, x: 345, y: 487, size: 8 },

    // 계약일자: "20"(x=272~285) "년"(x=301~313) "월"(x=334~345) "일"(x=367~379)
    { text: today.year?.slice(2), x: 287, y: 211, size: 10 },
    { text: today.month, x: 318, y: 211, size: 10 },
    { text: today.day, x: 350, y: 211, size: 10 },

    // (갑) 회사명 — "회 사 명 :" ends x=107.2
    { text: data.택배사업자명, x: 112, y: 171, size: 8, maxWidth: 120 },
    // (갑) 대표이사 — "대 표 대표이사 :" ends x=151.2
    { text: data.대리점대표자 || data.대표이사, x: 155, y: 157, size: 8 },

    // (병) 성명 — "성    명 :" 끝 ~x=305
    { text: data.기사명, x: 310, y: 171, size: 8 },
    // (병) 주소
    { text: data.주소, x: 310, y: 157, size: 7, maxWidth: 95 },
    // (병) 생년월일 — "생년월일 :" ends x=327
    { text: data.생년월일, x: 330, y: 144, size: 8 },
    // (병) 연락처 — "연 락 처 :" ends ~x=330
    { text: data.전화번호, x: 335, y: 130, size: 8 },

    // (을) 대리점명 — "명 :" ends ~x=82
    { text: data.대리점명, x: 84, y: 102, size: 8 },
    // (을) 사업자번호 — "사업자번호 :" ends ~x=105
    { text: data.대리점사업자번호, x: 108, y: 88, size: 8 },
    // (을) 주소
    { text: data.대리점주소, x: 90, y: 74, size: 7, maxWidth: 150 },
    // (을) 대표자 — "대 표 자 :" ends ~x=95
    { text: data.대리점대표자, x: 98, y: 60, size: 8 },
  ]

  return { texts, checks: [] }
}

/* ══════════════════════════════════════════════
   3. 통합물류협회 개인정보활용 동의서
   ══════════════════════════════════════════════ */

function buildPrivacyConsentOverlays(data: ContractBindingData): {
  texts: TextOverlay[]
  checks: CheckboxOverlay[]
} {
  const today = splitDate(data.계약일 || new Date().toISOString().slice(0, 10))

  /*
   * 좌표: Form3은 이미지 기반 PDF → 그리드 오버레이에서 실측
   * 페이지: 595.2 x 841.4
   */
  const texts: TextOverlay[] = [
    // 하단 서명란 "20  년   월   일  성명 :  ___"
    { text: today.year?.slice(2), x: 72, y: 83, size: 10 },
    { text: today.month, x: 108, y: 83, size: 10 },
    { text: today.day, x: 140, y: 83, size: 10 },
    { text: data.기사명, x: 230, y: 83, size: 10 },
  ]

  // 동의 체크박스 — 우측 체크란 (이미지 기반이므로 그리드에서 실측)
  const checks: CheckboxOverlay[] = [
    // 4항 주민등록번호 행 — 허가 관련 동의 □
    { checked: true, x: 552, y: 348, size: 10 },
    // 4항 운전면허번호 행
    { checked: true, x: 552, y: 318, size: 10 },
    // 5항 국토교통부 등 (필수)
    { checked: true, x: 548, y: 225, size: 10 },
    // 5항 현대자동차 등 (선택)
    { checked: false, x: 548, y: 195, size: 10 },
  ]

  return { texts, checks }
}

/* ══════════════════════════════════════════════
   메인 PDF 생성 함수
   ══════════════════════════════════════════════ */

export async function generateGovernmentFormPdf(
  templateId: string,
  bindingData: Record<string, string>
): Promise<Uint8Array> {
  const templatePath = GOVERNMENT_FORM_TEMPLATE_IDS[templateId]
  if (!templatePath) {
    throw new Error(`Unknown government form template: ${templateId}`)
  }

  // 1. 원본 PDF 로드
  const templateResponse = await fetch(templatePath)
  if (!templateResponse.ok) {
    throw new Error(`Failed to load template PDF: ${templatePath}`)
  }
  const templateBytes = await templateResponse.arrayBuffer()
  const pdfDoc = await PDFDocument.load(templateBytes)

  // 2. 한글 폰트 로드
  const fonts = await loadKoreanFonts(pdfDoc)

  // 3. 첫 번째 페이지 가져오기 (모든 관공서 서류는 1페이지)
  const page = pdfDoc.getPages()[0]

  // 4. 템플릿별 오버레이 생성
  let overlays: { texts: TextOverlay[]; checks: CheckboxOverlay[] }

  switch (templateId) {
    case 'a1b2c3d4-1111-4aaa-bbbb-000000000001':
      overlays = buildPermitApplicationOverlays(bindingData)
      break
    case 'a1b2c3d4-2222-4aaa-bbbb-000000000002':
      overlays = buildExclusiveContractOverlays(bindingData)
      break
    case 'a1b2c3d4-3333-4aaa-bbbb-000000000003':
      overlays = buildPrivacyConsentOverlays(bindingData)
      break
    default:
      throw new Error(`No overlay mapping for template: ${templateId}`)
  }

  // 5. 텍스트 + 체크박스 오버레이 적용
  drawTextOverlays(page, overlays.texts, fonts)
  drawCheckboxOverlays(page, overlays.checks, fonts.regular)

  // 6. PDF 바이트 반환
  return pdfDoc.save()
}

/* ══════════════════════════════════════════════
   미리보기용: 바인딩 데이터로 PDF Blob URL 생성
   ══════════════════════════════════════════════ */

export async function previewGovernmentFormPdf(
  templateId: string,
  bindingData: Record<string, string>
): Promise<string> {
  const pdfBytes = await generateGovernmentFormPdf(templateId, bindingData)
  const blob = new Blob([pdfBytes as BlobPart], { type: 'application/pdf' })
  return URL.createObjectURL(blob)
}
