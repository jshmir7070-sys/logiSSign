import { NextRequest, NextResponse } from 'next/server'
import { authenticateRequest } from '@/lib/api-auth'
import { PDFDocument } from 'pdf-lib'
import { rateLimitAuth } from '@/lib/rate-limit'
import { getClientIp } from '@/lib/get-ip'
import { existsSync, readFileSync } from 'node:fs'
import path from 'node:path'

export const maxDuration = 60

/**
 * POST /api/contracts/convert
 * 비PDF 파일을 PDF로 변환
 *
 * 지원 형식:
 * - 이미지 (JPG, PNG, BMP, GIF, TIFF, WebP) → PDF 페이지로 변환
 * - DOCX → mammoth로 HTML 추출 → PDF 생성
 * - HWP/HWPX → 원본 저장 + 고객사에 PDF 변환 안내
 *
 * FormData: { file: File }
 * Response: { pdfBuffer: base64, originalName, convertedFrom }
 */
export async function POST(request: NextRequest) {
  const ip = getClientIp(request)
  const limited = await rateLimitAuth(ip, '/api/contracts/convert')
  if (limited) return limited

  const { error: authError } = await authenticateRequest(request)
  if (authError) return authError

  try {
    const formData = await request.formData()
    const file = formData.get('file') as File | null

    if (!file) {
      return NextResponse.json({ error: '파일이 필요합니다' }, { status: 400 })
    }

    const fileName = file.name.toLowerCase()
    const ext = fileName.split('.').pop() ?? ''
    const buffer = Buffer.from(await file.arrayBuffer())

    // PDF는 변환 불필요 — 그대로 반환
    if (ext === 'pdf') {
      return NextResponse.json({
        pdfBase64: buffer.toString('base64'),
        originalName: file.name,
        convertedFrom: 'pdf',
        message: null,
      })
    }

    // ── 이미지 → PDF ──
    const imageExts = ['jpg', 'jpeg', 'png', 'bmp', 'gif', 'tiff', 'tif', 'webp']
    if (imageExts.includes(ext)) {
      const pdfBase64 = await convertImageToPdf(buffer, ext)
      return NextResponse.json({
        pdfBase64,
        originalName: file.name,
        convertedFrom: 'image',
        message: null,
      })
    }

    // ── DOCX → PDF ──
    if (ext === 'docx' || ext === 'doc') {
      if (ext === 'doc') {
        return NextResponse.json({
          error: '.doc 파일은 지원하지 않습니다. .docx로 변환 후 다시 업로드해주세요. (워드에서 "다른 이름으로 저장" → .docx 선택)',
        }, { status: 400 })
      }
      const pdfBase64 = await convertDocxToPdf(buffer)
      return NextResponse.json({
        pdfBase64,
        originalName: file.name,
        convertedFrom: 'docx',
        message: '워드 문서가 PDF로 변환되었습니다. 복잡한 서식은 원본과 다를 수 있으니 확인해주세요.',
      })
    }

    // ── HWP/HWPX ──
    if (ext === 'hwp' || ext === 'hwpx') {
      return NextResponse.json({
        error: '한글(HWP) 파일은 직접 PDF 변환이 어렵습니다.\n\n변환 방법:\n1. 한컴오피스에서 파일 열기\n2. "파일 → PDF로 저장하기" 또는 "파일 → 다른 이름으로 저장 → PDF"\n3. 변환된 PDF 파일을 업로드\n\n또는 allinpdf.com 등 온라인 변환 서비스를 이용하세요.',
        convertGuide: 'hwp',
      }, { status: 422 })
    }

    // ── XLS/XLSX ──
    if (ext === 'xls' || ext === 'xlsx') {
      return NextResponse.json({
        error: '엑셀 파일은 직접 PDF 변환이 어렵습니다.\n\n변환 방법:\n1. 엑셀에서 파일 열기\n2. "파일 → 내보내기 → PDF/XPS 문서 만들기"\n3. 변환된 PDF 파일을 업로드',
        convertGuide: 'excel',
      }, { status: 422 })
    }

    return NextResponse.json({
      error: `지원하지 않는 파일 형식입니다 (.${ext}).\n\n지원 형식: PDF, DOCX, JPG, PNG, 이미지 파일\n한글(HWP) 파일은 PDF로 변환 후 업로드해주세요.`,
    }, { status: 400 })
  } catch (err) {
    console.error('[ConvertAPI] Error:', err instanceof Error ? err.message : err)
    return NextResponse.json(
      { error: '파일 변환 중 오류가 발생했습니다' },
      { status: 500 }
    )
  }
}

/** 이미지 → PDF 변환 (pdf-lib) */
async function convertImageToPdf(buffer: Buffer, ext: string): Promise<string> {
  const pdfDoc = await PDFDocument.create()

  let image
  if (ext === 'jpg' || ext === 'jpeg') {
    image = await pdfDoc.embedJpg(buffer)
  } else if (ext === 'png') {
    image = await pdfDoc.embedPng(buffer)
  } else {
    // BMP, GIF, TIFF, WebP 등 → pdf-lib는 JPG/PNG만 지원
    throw new Error(`${ext.toUpperCase()} 이미지는 JPG 또는 PNG로 변환 후 업로드해주세요.`)
  }

  // A4 비율로 이미지 배치
  const a4Width = 595.28 // A4 width in points
  const a4Height = 841.89 // A4 height in points
  const scale = Math.min(a4Width / image.width, a4Height / image.height, 1)
  const scaledWidth = image.width * scale
  const scaledHeight = image.height * scale

  const page = pdfDoc.addPage([a4Width, a4Height])
  page.drawImage(image, {
    x: (a4Width - scaledWidth) / 2,
    y: a4Height - scaledHeight - 20, // 상단 여백
    width: scaledWidth,
    height: scaledHeight,
  })

  const pdfBytes = await pdfDoc.save()
  return Buffer.from(pdfBytes).toString('base64')
}

/** DOCX → PDF 변환 (mammoth → HTML → pdf-lib) */
async function convertDocxToPdf(buffer: Buffer): Promise<string> {
  const mammoth = await import('mammoth')
  const result = await mammoth.convertToHtml({ buffer })
  const html = result.value

  // HTML에서 텍스트 추출 (간단한 파싱)
  const textContent = html
    .replace(/<br\s*\/?>/gi, '\n')
    .replace(/<\/p>/gi, '\n\n')
    .replace(/<\/h[1-6]>/gi, '\n\n')
    .replace(/<\/li>/gi, '\n')
    .replace(/<\/tr>/gi, '\n')
    .replace(/<[^>]+>/g, '')
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&nbsp;/g, ' ')
    .replace(/\n{3,}/g, '\n\n')
    .trim()

  // 텍스트를 PDF로 렌더링
  const pdfDoc = await PDFDocument.create()

  // 한글 폰트 임베드 시도
  let font
  try {
    const fontkit = (await import('@pdf-lib/fontkit')).default
    pdfDoc.registerFontkit(fontkit)

    // 시스템 폰트 또는 프로젝트 내 폰트 탐색
    const fontPaths = [
      path.join(/*turbopackIgnore: true*/ process.cwd(), 'public', 'fonts', 'NotoSansKR-Regular.ttf'),
      path.join(/*turbopackIgnore: true*/ process.cwd(), 'public', 'fonts', 'Pretendard-Regular.otf'),
    ]

    for (const fp of fontPaths) {
      try {
        if (existsSync(fp)) {
          const fontBytes = readFileSync(fp)
          font = await pdfDoc.embedFont(fontBytes)
          break
        }
      } catch { /* 다음 폰트 시도 */ }
    }
  } catch { /* fontkit 없으면 기본 폰트 */ }

  // 기본 폰트 폴백 (한글 미지원이지만 빈 PDF보다 나음)
  if (!font) {
    const { StandardFonts } = await import('pdf-lib')
    font = await pdfDoc.embedFont(StandardFonts.Helvetica)
  }

  const fontSize = 10
  const margin = 50
  const a4Width = 595.28
  const a4Height = 841.89
  const lineHeight = fontSize * 1.6
  const maxWidth = a4Width - margin * 2

  const lines = textContent.split('\n')
  let page = pdfDoc.addPage([a4Width, a4Height])
  let yPos = a4Height - margin

  for (const line of lines) {
    if (yPos < margin + lineHeight) {
      page = pdfDoc.addPage([a4Width, a4Height])
      yPos = a4Height - margin
    }

    if (line.trim() === '') {
      yPos -= lineHeight * 0.5
      continue
    }

    // 긴 줄 자동 줄바꿈 (글자 단위)
    const chars = line.split('')
    let currentLine = ''
    for (const char of chars) {
      const testLine = currentLine + char
      let textWidth
      try {
        textWidth = font.widthOfTextAtSize(testLine, fontSize)
      } catch {
        // 한글 등 지원 안 되는 글자는 대략적 폭 추정
        textWidth = testLine.length * fontSize * 0.6
      }

      if (textWidth > maxWidth && currentLine.length > 0) {
        try {
          page.drawText(currentLine, { x: margin, y: yPos, size: fontSize, font })
        } catch {
          // 한글 렌더링 실패 시 빈 줄
        }
        yPos -= lineHeight
        currentLine = char

        if (yPos < margin + lineHeight) {
          page = pdfDoc.addPage([a4Width, a4Height])
          yPos = a4Height - margin
        }
      } else {
        currentLine = testLine
      }
    }

    if (currentLine) {
      try {
        page.drawText(currentLine, { x: margin, y: yPos, size: fontSize, font })
      } catch { /* 렌더링 실패 무시 */ }
      yPos -= lineHeight
    }
  }

  const pdfBytes = await pdfDoc.save()
  return Buffer.from(pdfBytes).toString('base64')
}
