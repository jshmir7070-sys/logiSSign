/**
 * 관공서 서류 PDF 생성 테스트 스크립트
 * Node.js에서 직접 실행하여 PDF 좌표 확인
 */
import { PDFDocument, rgb } from 'pdf-lib'
import fontkit from '@pdf-lib/fontkit'
import fs from 'fs'
import path from 'path'

const WEB_DIR = '/sessions/magical-friendly-sagan/mnt/logiSSign/web'
const OUTPUT_DIR = '/sessions/magical-friendly-sagan/mnt/logiSSign'

// 샘플 바인딩 데이터
const SAMPLE_DATA = {
  기사명: '홍길동',
  주민등록번호: '900101-1234567',
  주소: '서울특별시 강남구 테헤란로 123',
  전화번호: '010-1234-5678',
  택배사업자명: '롯데글로벌로지스(주)',
  대리점명: '강남대리점',
  대리점대표자: '김대표',
  대리점주소: '서울특별시 강남구 역삼동 456-7',
  대리점연락처: '02-1234-5678',
  대리점사업자번호: '123-45-67890',
  전속계약기간: '2',
  계약시작일: '2025-04-01',
  계약종료일: '2027-03-31',
  경력기간: '3',
  경력시작: '2022-01-01',
  경력종료: '2024-12-31',
  연료종류: '경유',
  차명: '포터2',
  연식: '2024',
  최대적재량: '1000',
  차량형태: '탑형',
  면허번호: '서울-12-345678-90',
  면허종류: '1종 보통',
  자격증번호: 'HF-2023-12345',
  자격취득일: '2023-06-15',
  생년월일: '1990-01-01',
  관할법원: '서울중앙',
  계약일: '2025-04-01',
  사번: 'D001',
}

function splitDate(dateStr) {
  if (!dateStr) return { year: '', month: '', day: '' }
  const cleaned = dateStr.replace(/[^0-9-/.]/g, '')
  const parts = cleaned.split(/[-/.]/)
  if (parts.length >= 3) return { year: parts[0], month: parts[1], day: parts[2] }
  return { year: dateStr, month: '', day: '' }
}

async function generateForm1(data) {
  // 1. 신규허가 신청서
  const templatePath = path.join(WEB_DIR, 'public/contract-templates/form-permit-application.pdf')
  const templateBytes = fs.readFileSync(templatePath)
  const pdfDoc = await PDFDocument.load(templateBytes)

  pdfDoc.registerFontkit(fontkit)
  const regularFontBytes = fs.readFileSync(path.join(WEB_DIR, 'public/fonts/NotoSansKR-Regular.otf'))
  const boldFontBytes = fs.readFileSync(path.join(WEB_DIR, 'public/fonts/NotoSansKR-Bold.otf'))
  const font = await pdfDoc.embedFont(regularFontBytes, { subset: true })
  const boldFont = await pdfDoc.embedFont(boldFontBytes, { subset: true })

  const page = pdfDoc.getPages()[0]
  const { width, height } = page.getSize()
  console.log(`Form 1 page size: ${width} x ${height}`)

  const start = splitDate(data.계약시작일)
  const end = splitDate(data.계약종료일)
  const career = splitDate(data.경력시작)
  const careerEnd = splitDate(data.경력종료)
  const today = splitDate(data.계약일)

  const texts = [
    // ① 신청인
    { text: data.기사명, x: 252, y: 648, size: 10 },
    { text: data.주민등록번호, x: 252, y: 624, size: 10 },
    { text: data.주소, x: 252, y: 600, size: 9 },
    { text: data.전화번호, x: 480, y: 580, size: 9 },

    // ② 전속운송계약
    { text: data.택배사업자명, x: 252, y: 542, size: 9 },
    { text: data.대리점명, x: 252, y: 521, size: 9 },
    { text: data.대리점대표자, x: 252, y: 500, size: 9 },
    { text: data.대리점주소, x: 252, y: 479, size: 9 },
    { text: data.대리점연락처, x: 252, y: 458, size: 9 },
    { text: data.전속계약기간, x: 310, y: 437, size: 9 },

    // 계약 시작일/종료일
    { text: start.year?.slice(2), x: 440, y: 437, size: 9 },
    { text: start.month, x: 468, y: 437, size: 9 },
    { text: start.day, x: 490, y: 437, size: 9 },
    { text: end.year?.slice(2), x: 440, y: 420, size: 9 },
    { text: end.month, x: 468, y: 420, size: 9 },
    { text: end.day, x: 490, y: 420, size: 9 },

    // 경력기간
    { text: data.경력기간, x: 310, y: 402, size: 9 },
    { text: career.year?.slice(2), x: 446, y: 402, size: 9 },
    { text: career.month, x: 478, y: 402, size: 9 },
    { text: careerEnd.year?.slice(2), x: 510, y: 402, size: 9 },
    { text: careerEnd.month, x: 540, y: 402, size: 9 },

    // ③ 차량정보
    { text: data.차명, x: 200, y: 349, size: 9 },
    { text: data.연식, x: 430, y: 349, size: 9 },
    { text: data.최대적재량, x: 210, y: 329, size: 9 },

    // ④ 운전면허
    { text: data.면허번호, x: 200, y: 293, size: 9 },

    // ⑤ 화물운송 종사자격
    { text: data.자격증번호, x: 200, y: 248, size: 9 },
    { text: data.자격취득일, x: 430, y: 248, size: 9 },

    // 하단 제출일
    { text: today.year?.slice(2), x: 232, y: 195, size: 10 },
    { text: today.month, x: 282, y: 195, size: 10 },
    { text: today.day, x: 322, y: 195, size: 10 },

    // 택배서비스사업자명 / 대표이사 / 신청인
    { text: data.택배사업자명, x: 340, y: 172, size: 9 },
    { text: data.대리점대표자, x: 340, y: 155, size: 9 },
    { text: data.기사명, x: 340, y: 138, size: 9 },
  ]

  // 체크박스 — 경유
  const checks = [
    { text: '✓', x: 268, y: 370, size: 10 }, // 경유
    { text: '✓', x: 398, y: 329, size: 10 }, // 탑형
    { text: '✓', x: 300, y: 272, size: 10 }, // 1종 보통
  ]

  for (const item of texts) {
    if (!item.text) continue
    page.drawText(item.text, {
      x: item.x, y: item.y, size: item.size || 9,
      font, color: rgb(0, 0, 0),
    })
  }

  for (const item of checks) {
    page.drawText(item.text, {
      x: item.x, y: item.y, size: item.size || 10,
      font, color: rgb(0, 0, 0),
    })
  }

  const pdfBytes = await pdfDoc.save()
  const outPath = path.join(OUTPUT_DIR, 'test-form1-output.pdf')
  fs.writeFileSync(outPath, pdfBytes)
  console.log(`✅ Form 1 saved to: ${outPath}`)
  return outPath
}

async function generateForm2(data) {
  const templatePath = path.join(WEB_DIR, 'public/contract-templates/form-exclusive-contract.pdf')
  const templateBytes = fs.readFileSync(templatePath)
  const pdfDoc = await PDFDocument.load(templateBytes)

  pdfDoc.registerFontkit(fontkit)
  const regularFontBytes = fs.readFileSync(path.join(WEB_DIR, 'public/fonts/NotoSansKR-Regular.otf'))
  const font = await pdfDoc.embedFont(regularFontBytes, { subset: true })

  const page = pdfDoc.getPages()[0]
  const { width, height } = page.getSize()
  console.log(`Form 2 page size: ${width} x ${height}`)

  const start = splitDate(data.계약시작일)
  const end = splitDate(data.계약종료일)
  const today = splitDate(data.계약일)

  const texts = [
    // 상단 당사자
    { text: data.대리점명, x: 226, y: 788, size: 9 },
    { text: data.기사명, x: 378, y: 788, size: 9 },

    // 제4조 계약기간
    { text: start.year?.slice(2), x: 380, y: 658, size: 9 },
    { text: start.month, x: 422, y: 658, size: 9 },
    { text: start.day, x: 450, y: 658, size: 9 },
    { text: end.year?.slice(2), x: 498, y: 658, size: 9 },
    { text: end.month, x: 530, y: 658, size: 9 },
    { text: end.day, x: 555, y: 658, size: 9 },

    // 관할법원
    { text: data.관할법원, x: 370, y: 506, size: 9 },

    // 계약일자
    { text: today.year?.slice(2), x: 260, y: 142, size: 10 },
    { text: today.month, x: 320, y: 142, size: 10 },
    { text: today.day, x: 370, y: 142, size: 10 },

    // (갑) 회사명
    { text: data.택배사업자명, x: 112, y: 114, size: 9 },

    // (병) 성명, 주소, 생년월일, 연락처
    { text: data.기사명, x: 418, y: 114, size: 9 },
    { text: data.주소, x: 418, y: 98, size: 8 },
    { text: data.생년월일, x: 418, y: 82, size: 9 },
    { text: data.전화번호, x: 418, y: 66, size: 9 },

    // (을) 대리점
    { text: data.대리점명, x: 112, y: 50, size: 9 },
    { text: data.대리점사업자번호, x: 112, y: 34, size: 9 },
    { text: data.대리점주소, x: 112, y: 18, size: 8 },
    { text: data.대리점대표자, x: 112, y: 2, size: 9 },
  ]

  for (const item of texts) {
    if (!item.text) continue
    page.drawText(item.text, {
      x: item.x, y: item.y, size: item.size || 9,
      font, color: rgb(0, 0, 0),
    })
  }

  const pdfBytes = await pdfDoc.save()
  const outPath = path.join(OUTPUT_DIR, 'test-form2-output.pdf')
  fs.writeFileSync(outPath, pdfBytes)
  console.log(`✅ Form 2 saved to: ${outPath}`)
  return outPath
}

async function generateForm3(data) {
  const templatePath = path.join(WEB_DIR, 'public/contract-templates/form-privacy-consent.pdf')
  const templateBytes = fs.readFileSync(templatePath)
  const pdfDoc = await PDFDocument.load(templateBytes)

  pdfDoc.registerFontkit(fontkit)
  const regularFontBytes = fs.readFileSync(path.join(WEB_DIR, 'public/fonts/NotoSansKR-Regular.otf'))
  const font = await pdfDoc.embedFont(regularFontBytes, { subset: true })

  const page = pdfDoc.getPages()[0]
  const { width, height } = page.getSize()
  console.log(`Form 3 page size: ${width} x ${height}`)

  const today = splitDate(data.계약일)

  const texts = [
    { text: today.year?.slice(2), x: 55, y: 50, size: 10 },
    { text: today.month, x: 102, y: 50, size: 10 },
    { text: today.day, x: 138, y: 50, size: 10 },
    { text: data.기사명, x: 250, y: 50, size: 10 },
  ]

  const checks = [
    { text: '✓', x: 530, y: 295, size: 10 },
    { text: '✓', x: 530, y: 264, size: 10 },
    { text: '✓', x: 530, y: 232, size: 10 },
    { text: '✓', x: 530, y: 172, size: 10 },
  ]

  for (const item of texts) {
    if (!item.text) continue
    page.drawText(item.text, {
      x: item.x, y: item.y, size: item.size || 9,
      font, color: rgb(0, 0, 0),
    })
  }

  for (const item of checks) {
    page.drawText(item.text, {
      x: item.x, y: item.y, size: item.size || 10,
      font, color: rgb(0, 0, 0),
    })
  }

  const pdfBytes = await pdfDoc.save()
  const outPath = path.join(OUTPUT_DIR, 'test-form3-output.pdf')
  fs.writeFileSync(outPath, pdfBytes)
  console.log(`✅ Form 3 saved to: ${outPath}`)
  return outPath
}

async function main() {
  console.log('🔧 관공서 서류 PDF 생성 테스트 시작...\n')

  try {
    await generateForm1(SAMPLE_DATA)
    await generateForm2(SAMPLE_DATA)
    await generateForm3(SAMPLE_DATA)
    console.log('\n✅ 모든 서류 생성 완료!')
  } catch (err) {
    console.error('❌ 에러:', err)
  }
}

main()
