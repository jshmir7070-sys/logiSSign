import { PDFDocument, rgb } from 'pdf-lib'
import fontkit from '@pdf-lib/fontkit'
import { loadKoreanFonts } from '@/lib/pdf-fonts'
import { createBrowserSupabaseClient } from '@/lib/supabase'

/**
 * 교육 이수증 PDF 생성 + 기사에게 전송
 */
export async function generateCertificatePdf(
  recordId: string
): Promise<{ url: string | null; error: string | null }> {
  const supabase = createBrowserSupabaseClient()

  try {
    // 1. 이수 기록 + 과목 + 기사 정보 조회
    const { data: record, error: recErr } = await supabase
      .from('education_records')
      .select('*, education_courses(*), drivers(name, phone, employee_code)')
      .eq('id', recordId)
      .single()

    if (recErr || !record) throw new Error('이수 기록을 찾을 수 없습니다')

    const rec = record as unknown as {
      id: string
      certificate_number: string
      completed_at: string
      total_study_sec: number
      quiz_score: number
      education_courses: { title: string; category: string; required_minutes: number; year: number }
      drivers: { name: string; phone: string; employee_code: string | null }
    }

    if (!rec.certificate_number || !rec.completed_at) {
      throw new Error('이수 완료되지 않은 기록입니다')
    }

    const course = rec.education_courses
    const driver = rec.drivers

    // 2. PDF 생성
    const pdfDoc = await PDFDocument.create()
    pdfDoc.registerFontkit(fontkit)
    const { regular: font, bold: boldFont } = await loadKoreanFonts(pdfDoc)

    const page = pdfDoc.addPage([595, 841]) // A4
    const { width, height } = page.getSize()
    const centerX = width / 2

    // 제목
    page.drawText('교 육 이 수 증', {
      x: centerX - 80, y: height - 120,
      size: 24, font: boldFont, color: rgb(0, 0.29, 0.78),
    })

    // 이수증 번호
    page.drawText(`이수증 번호: ${rec.certificate_number}`, {
      x: centerX - 90, y: height - 160,
      size: 10, font, color: rgb(0.4, 0.4, 0.4),
    })

    // 구분선
    page.drawLine({
      start: { x: 60, y: height - 180 },
      end: { x: width - 60, y: height - 180 },
      thickness: 1, color: rgb(0.8, 0.8, 0.8),
    })

    // 본문
    const leftCol = 100
    const rightCol = 250
    let y = height - 220

    const rows = [
      ['성    명', driver.name],
      ['사    번', driver.employee_code ?? '-'],
      ['연 락 처', driver.phone],
      ['', ''],
      ['교육과목', course.title],
      ['교육연도', `${course.year}년`],
      ['법정시간', `${course.required_minutes}분`],
      ['학습시간', `${Math.ceil(rec.total_study_sec / 60)}분`],
      ['퀴즈점수', `${rec.quiz_score}점`],
      ['이수일자', new Date(rec.completed_at).toLocaleDateString('ko-KR')],
    ]

    for (const [label, value] of rows) {
      if (!label) { y -= 15; continue }
      page.drawText(label, { x: leftCol, y, size: 11, font, color: rgb(0.3, 0.3, 0.3) })
      page.drawText(value, { x: rightCol, y, size: 11, font: boldFont, color: rgb(0, 0, 0) })
      y -= 25
    }

    // 하단 문구
    y -= 30
    page.drawLine({
      start: { x: 60, y },
      end: { x: width - 60, y },
      thickness: 1, color: rgb(0.8, 0.8, 0.8),
    })
    y -= 30

    page.drawText(
      '위 사람은 관련 법령에 따른 교육과정을 이수하였음을 증명합니다.',
      { x: centerX - 170, y, size: 11, font, color: rgb(0, 0, 0) }
    )

    y -= 50
    page.drawText(
      new Date(rec.completed_at).toLocaleDateString('ko-KR', { year: 'numeric', month: 'long', day: 'numeric' }),
      { x: centerX - 50, y, size: 12, font, color: rgb(0, 0, 0) }
    )

    y -= 60
    page.drawText('DeliSign 교육관리시스템', {
      x: centerX - 60, y, size: 10, font, color: rgb(0.5, 0.5, 0.5),
    })

    // 3. PDF 저장
    const pdfBytes = await pdfDoc.save()
    const fileName = `certificates/${rec.certificate_number}.pdf`

    const { error: uploadErr } = await supabase.storage
      .from('education')
      .upload(fileName, pdfBytes, { contentType: 'application/pdf', upsert: true })

    if (uploadErr) throw new Error('PDF 업로드 실패: ' + uploadErr.message)

    const { data: urlData } = supabase.storage.from('education').getPublicUrl(fileName)
    const pdfUrl = urlData?.publicUrl ?? null

    // 4. 이수 기록에 URL 저장
    if (pdfUrl) {
      await supabase
        .from('education_records')
        .update({ certificate_url: pdfUrl } as never)
        .eq('id', recordId)
    }

    return { url: pdfUrl, error: null }
  } catch (err) {
    return { url: null, error: err instanceof Error ? err.message : 'PDF 생성 실패' }
  }
}
