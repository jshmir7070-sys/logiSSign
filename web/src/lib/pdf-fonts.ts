/**
 * PDF 한글 폰트 로더
 * ─────────────────────
 * 서버사이드(API routes): fs.readFile로 public/fonts/ 에서 직접 로드
 * 클라이언트(브라우저): fetch('/fonts/...') 로 로드
 *
 * pdf-lib + fontkit 사용 시 CJK 폰트는 subset: false 필수
 * (CFF 인코딩 오류 방지)
 */

import { PDFDocument, type PDFFont } from 'pdf-lib'
import fontkit from '@pdf-lib/fontkit'

export interface KoreanFonts {
  regular: PDFFont
  bold: PDFFont
}

/** 서버/클라이언트 자동 판별하여 폰트 바이트 로드 */
async function loadFontBytes(filename: string): Promise<ArrayBuffer> {
  if (typeof window === 'undefined') {
    // 서버사이드: filesystem에서 직접 읽기
    const { readFile } = await import('fs/promises')
    const { join } = await import('path')
    const fontPath = join(process.cwd(), 'public', 'fonts', filename)
    const buffer = await readFile(fontPath)
    return buffer.buffer.slice(buffer.byteOffset, buffer.byteOffset + buffer.byteLength)
  } else {
    // 클라이언트: fetch
    const res = await fetch(`/fonts/${filename}`)
    if (!res.ok) throw new Error(`폰트 로드 실패: /fonts/${filename} (${res.status})`)
    return res.arrayBuffer()
  }
}

/**
 * PDFDocument에 한글 폰트를 등록하고 반환
 * 내부적으로 fontkit 등록 + NotoSansKR Regular/Bold embed
 */
export async function loadKoreanFonts(pdfDoc: PDFDocument): Promise<KoreanFonts> {
  pdfDoc.registerFontkit(fontkit)

  const [regularBytes, boldBytes] = await Promise.all([
    loadFontBytes('NotoSansKR-Regular.otf'),
    loadFontBytes('NotoSansKR-Bold.otf'),
  ])

  const regular = await pdfDoc.embedFont(regularBytes, { subset: false })
  const bold = await pdfDoc.embedFont(boldBytes, { subset: false })

  return { regular, bold }
}
