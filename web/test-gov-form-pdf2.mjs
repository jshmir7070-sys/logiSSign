import { PDFDocument, rgb } from 'pdf-lib'
import fontkit from '@pdf-lib/fontkit'
import fs from 'fs'
import path from 'path'

const WEB_DIR = '/sessions/magical-friendly-sagan/mnt/logiSSign/web'
const OUTPUT_DIR = '/sessions/magical-friendly-sagan/mnt/logiSSign'

const SAMPLE = {
  기사명: '홍길동',
  주민등록번호: '900101-1234567',
  주소: '서울특별시 강남구 테헤란로 123',
  전화번호: '010-1234-5678',
  택배사업자명: '롯데글로벌로지스(주)',
  대리점명: '강남대리점',
  대리점대표자: '김대표',
  대리점주소: '서울특별시 강남구 역삼동 456-7',
  대리점연락처: '02-1234-5678',
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
}

function splitDate(s) {
  if (!s) return { y: '', m: '', d: '' }
  const p = s.split(/[-/.]/)
  return p.length >= 3 ? { y: p[0], m: p[1], d: p[2] } : { y: s, m: '', d: '' }
}

async function test() {
  console.log('🔧 PDF 생성 테스트 (subset: false)...\n')
  
  const templateBytes = fs.readFileSync(path.join(WEB_DIR, 'public/contract-templates/form-permit-application.pdf'))
  const pdfDoc = await PDFDocument.load(templateBytes)
  
  pdfDoc.registerFontkit(fontkit)
  const fontBytes = fs.readFileSync(path.join(WEB_DIR, 'public/fonts/NotoSansKR-Regular.otf'))
  console.log('Font file size:', fontBytes.length)
  
  // subset: false 로 시도
  const font = await pdfDoc.embedFont(fontBytes, { subset: false })
  console.log('✅ Font embedded successfully (no subset)')
  
  const page = pdfDoc.getPages()[0]
  const { width, height } = page.getSize()
  console.log(`Page: ${width} x ${height}`)
  
  const d = SAMPLE
  const start = splitDate(d.계약시작일)
  const end = splitDate(d.계약종료일)
  const today = splitDate(d.계약일)
  const career = splitDate(d.경력시작)
  const careerEnd = splitDate(d.경력종료)

  // ① 신청인
  page.drawText(d.기사명, { x: 252, y: 648, size: 10, font, color: rgb(0,0,0) })
  page.drawText(d.주민등록번호, { x: 252, y: 624, size: 10, font, color: rgb(0,0,0) })
  page.drawText(d.주소, { x: 252, y: 600, size: 9, font, color: rgb(0,0,0) })
  page.drawText(d.전화번호, { x: 480, y: 580, size: 9, font, color: rgb(0,0,0) })
  
  // ② 전속운송계약
  page.drawText(d.택배사업자명, { x: 252, y: 542, size: 9, font, color: rgb(0,0,0) })
  page.drawText(d.대리점명, { x: 252, y: 521, size: 9, font, color: rgb(0,0,0) })
  page.drawText(d.대리점대표자, { x: 252, y: 500, size: 9, font, color: rgb(0,0,0) })
  page.drawText(d.대리점주소, { x: 252, y: 479, size: 9, font, color: rgb(0,0,0) })
  page.drawText(d.대리점연락처, { x: 252, y: 458, size: 9, font, color: rgb(0,0,0) })
  page.drawText(d.전속계약기간, { x: 310, y: 437, size: 9, font, color: rgb(0,0,0) })
  
  page.drawText(start.y.slice(2), { x: 440, y: 437, size: 9, font, color: rgb(0,0,0) })
  page.drawText(start.m, { x: 468, y: 437, size: 9, font, color: rgb(0,0,0) })
  page.drawText(start.d, { x: 490, y: 437, size: 9, font, color: rgb(0,0,0) })
  page.drawText(end.y.slice(2), { x: 440, y: 420, size: 9, font, color: rgb(0,0,0) })
  page.drawText(end.m, { x: 468, y: 420, size: 9, font, color: rgb(0,0,0) })
  page.drawText(end.d, { x: 490, y: 420, size: 9, font, color: rgb(0,0,0) })
  
  page.drawText(d.경력기간, { x: 310, y: 402, size: 9, font, color: rgb(0,0,0) })
  page.drawText(career.y.slice(2), { x: 446, y: 402, size: 9, font, color: rgb(0,0,0) })
  page.drawText(career.m, { x: 478, y: 402, size: 9, font, color: rgb(0,0,0) })
  page.drawText(careerEnd.y.slice(2), { x: 510, y: 402, size: 9, font, color: rgb(0,0,0) })
  page.drawText(careerEnd.m, { x: 540, y: 402, size: 9, font, color: rgb(0,0,0) })
  
  // ③ 차량정보 + 체크
  page.drawText('✓', { x: 268, y: 370, size: 10, font, color: rgb(0,0,0) })  // 경유
  page.drawText(d.차명, { x: 200, y: 349, size: 9, font, color: rgb(0,0,0) })
  page.drawText(d.연식, { x: 430, y: 349, size: 9, font, color: rgb(0,0,0) })
  page.drawText(d.최대적재량, { x: 210, y: 329, size: 9, font, color: rgb(0,0,0) })
  page.drawText('✓', { x: 398, y: 329, size: 10, font, color: rgb(0,0,0) })  // 탑형
  
  // ④ 운전면허
  page.drawText(d.면허번호, { x: 200, y: 293, size: 9, font, color: rgb(0,0,0) })
  page.drawText('✓', { x: 300, y: 272, size: 10, font, color: rgb(0,0,0) })  // 1종 보통
  
  // ⑤ 자격
  page.drawText(d.자격증번호, { x: 200, y: 248, size: 9, font, color: rgb(0,0,0) })
  page.drawText(d.자격취득일, { x: 430, y: 248, size: 9, font, color: rgb(0,0,0) })
  
  // 하단
  page.drawText(today.y.slice(2), { x: 232, y: 195, size: 10, font, color: rgb(0,0,0) })
  page.drawText(today.m, { x: 282, y: 195, size: 10, font, color: rgb(0,0,0) })
  page.drawText(today.d, { x: 322, y: 195, size: 10, font, color: rgb(0,0,0) })
  page.drawText(d.택배사업자명, { x: 340, y: 172, size: 9, font, color: rgb(0,0,0) })
  page.drawText(d.대리점대표자, { x: 340, y: 155, size: 9, font, color: rgb(0,0,0) })
  page.drawText(d.기사명, { x: 340, y: 138, size: 9, font, color: rgb(0,0,0) })
  
  const bytes = await pdfDoc.save()
  const out = path.join(OUTPUT_DIR, 'test-form1-output.pdf')
  fs.writeFileSync(out, bytes)
  console.log(`✅ Form 1 saved: ${out} (${bytes.length} bytes)`)
}

test().catch(console.error)
