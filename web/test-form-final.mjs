import { PDFDocument, rgb } from 'pdf-lib'
import fontkit from '@pdf-lib/fontkit'
import fs from 'fs'
import path from 'path'

const WEB_DIR = '/sessions/magical-friendly-sagan/mnt/logiSSign/web'
const OUTPUT_DIR = '/sessions/magical-friendly-sagan/mnt/logiSSign'

const D = {
  기사명:'홍길동', 주민등록번호:'900101-1234567', 주소:'서울특별시 강남구 테헤란로 123',
  전화번호:'010-1234-5678', 택배사업자명:'롯데글로벌로지스(주)', 대리점명:'강남대리점',
  대리점대표자:'김대표', 대리점주소:'서울특별시 강남구 역삼동 456-7',
  대리점연락처:'02-1234-5678', 대리점사업자번호:'123-45-67890',
  전속계약기간:'2', 계약시작일:'2025-04-01', 계약종료일:'2027-03-31',
  경력기간:'3', 경력시작:'2022-01-01', 경력종료:'2024-12-31',
  연료종류:'경유', 차명:'포터2', 연식:'2024', 최대적재량:'1000', 차량형태:'탑형',
  면허번호:'서울-12-345678-90', 면허종류:'1종 보통',
  자격증번호:'HF-2023-12345', 자격취득일:'2023-06-15',
  생년월일:'1990-01-01', 관할법원:'서울중앙', 계약일:'2025-04-01',
}

function sd(s) { if(!s) return {y:'',m:'',d:''}; const p=s.split(/[-/.]/); return p.length>=3?{y:p[0],m:p[1],d:p[2]}:{y:s,m:'',d:''} }

async function gen(templateFile, outputName, drawFn) {
  const tb = fs.readFileSync(path.join(WEB_DIR, 'public/contract-templates/', templateFile))
  const pdf = await PDFDocument.load(tb)
  pdf.registerFontkit(fontkit)
  const fb = fs.readFileSync(path.join(WEB_DIR, 'public/fonts/NotoSansKR-Regular.otf'))
  const f = await pdf.embedFont(fb, { subset: false })
  const pg = pdf.getPages()[0]
  drawFn(pg, f)
  const bytes = await pdf.save()
  fs.writeFileSync(path.join(OUTPUT_DIR, outputName), bytes)
  console.log(`✅ ${outputName} (${bytes.length} bytes)`)
}

function t(pg,f,text,x,y,sz=9) { if(text) pg.drawText(text, {x,y,size:sz,font:f,color:rgb(0,0,0)}) }

// Form 1
await gen('form-permit-application.pdf', 'test-form1-v2.pdf', (pg,f) => {
  const s=sd(D.계약시작일), e=sd(D.계약종료일), c=sd(D.경력시작), ce=sd(D.경력종료), td=sd(D.계약일)
  // ① 신청인
  t(pg,f,D.기사명,260,712,10); t(pg,f,D.주민등록번호,260,692,10); t(pg,f,D.주소,260,668); t(pg,f,D.전화번호,490,648)
  // ② 전속운송계약
  t(pg,f,D.택배사업자명,295,608); t(pg,f,D.대리점명,295,586); t(pg,f,D.대리점대표자,310,566)
  t(pg,f,D.대리점주소,295,546); t(pg,f,D.대리점연락처,300,526); t(pg,f,D.전속계약기간,335,498)
  t(pg,f,s.y.slice(2),492,498); t(pg,f,s.m,512,498); t(pg,f,s.d,532,498)
  t(pg,f,e.y.slice(2),492,478); t(pg,f,e.m,512,478); t(pg,f,e.d,532,478)
  t(pg,f,D.경력기간,335,452); t(pg,f,c.y.slice(2),472,452); t(pg,f,c.m,500,452); t(pg,f,ce.y.slice(2),528,452); t(pg,f,ce.m,556,452)
  // ③ 연료 체크 + 차량
  t(pg,f,'✓',312,420,10) // 경유
  t(pg,f,D.차명,235,380); t(pg,f,D.연식,462,380); t(pg,f,D.최대적재량,240,358)
  t(pg,f,'✓',438,358,10) // 탑형
  // ④ 면허
  t(pg,f,D.면허번호,226,336); t(pg,f,'✓',327,314,10) // 1종 보통
  // ⑤ 자격
  t(pg,f,D.자격증번호,260,270); t(pg,f,D.자격취득일,448,270)
  // 하단
  t(pg,f,td.y.slice(2),192,198,10); t(pg,f,td.m,262,198,10); t(pg,f,td.d,320,198,10)
  t(pg,f,D.택배사업자명,345,178); t(pg,f,D.대리점대표자,310,162); t(pg,f,D.기사명,310,145)
})

// Form 2
await gen('form-exclusive-contract.pdf', 'test-form2-v2.pdf', (pg,f) => {
  const s=sd(D.계약시작일), e=sd(D.계약종료일), td=sd(D.계약일)
  t(pg,f,D.대리점명,268,742); t(pg,f,D.기사명,455,742)
  t(pg,f,s.y.slice(2),422,692,8); t(pg,f,s.m,450,692,8); t(pg,f,s.d,474,692,8)
  t(pg,f,e.y.slice(2),514,692,8); t(pg,f,e.m,544,692,8); t(pg,f,e.d,308,680,8)
  t(pg,f,D.관할법원,345,508)
  t(pg,f,td.y.slice(2),268,218,10); t(pg,f,td.m,322,218,10); t(pg,f,td.d,380,218,10)
  t(pg,f,D.택배사업자명,115,183); t(pg,f,D.기사명,430,183); t(pg,f,D.주소,430,166,8)
  t(pg,f,D.생년월일,430,148); t(pg,f,D.전화번호,430,132)
  t(pg,f,D.대리점명,120,110); t(pg,f,D.대리점사업자번호,148,94)
  t(pg,f,D.대리점주소,110,78,8); t(pg,f,D.대리점대표자,120,62)
})

// Form 3
await gen('form-privacy-consent.pdf', 'test-form3-v2.pdf', (pg,f) => {
  const td=sd(D.계약일)
  t(pg,f,td.y.slice(2),55,82,10); t(pg,f,td.m,108,82,10); t(pg,f,td.d,152,82,10); t(pg,f,D.기사명,260,82,10)
  t(pg,f,'✓',555,325,10); t(pg,f,'✓',555,278,10); t(pg,f,'✓',555,242,10); t(pg,f,'✓',555,155,10)
})

console.log('\n✅ 모든 서류 생성 완료!')
