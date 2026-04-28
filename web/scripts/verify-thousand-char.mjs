import { readFileSync } from 'node:fs'

const raw = readFileSync('src/services/seal.service.ts', 'utf8')

// THOUSAND_CHARACTER_CLASSIC 추출
const corpusMatch = raw.match(/THOUSAND_CHARACTER_CLASSIC = `([\s\S]*?)`/)
const corpusChars = [...new Set([...corpusMatch[1].replace(/\s+/g, '')])]

// THOUSAND_KOREAN_RAW 추출
const mappingMatch = raw.match(/THOUSAND_KOREAN_RAW = `([\s\S]*?)`/)
const tokens = mappingMatch[1].split(/\s+/).filter((t) => t.includes(':'))

const byChar = new Map()
const byReading = {}
for (const t of tokens) {
  const [c, rs] = t.split(':')
  if (!c || !rs) continue
  byChar.set(c, rs.split(','))
  for (const r of rs.split(',')) {
    if (!byReading[r]) byReading[r] = []
    if (!byReading[r].includes(c)) byReading[r].push(c)
  }
}

console.log('━━━━━━━━━━ 千字文 매핑 검증 ━━━━━━━━━━')
console.log('千字文 본문 유니크 글자 수:', corpusChars.length)
console.log('한국 한자음 매핑된 글자 수:', byChar.size)
console.log('한국어 음의 종류 수:', Object.keys(byReading).length)

const missing = corpusChars.filter((c) => !byChar.has(c))
console.log('매핑 누락 글자 수:', missing.length)
if (missing.length > 0) {
  console.log('누락 예시:', missing.slice(0, 30).join(' '))
}

const testReadings = [
  '김','이','박','최','정','강','조','윤','장','임','한','오','서','신','권','황','안','송',
  '류','전','홍','문','양','손','배','백','허','유','남','심','하','성','차','주','우','구',
  '민','진','지','엄','채','원','천','방','공','현','함','변','염','여','추','도','소','민',
  '석','선','설','길','연','위','표','명','기','왕','금','옥','육','인','맹','제','모','국',
  '어','은','용','예','경','봉','사','부','가','복','태','목','형','두','감','음','동','온',
  '호','범','좌','삼','매','평','대'
]
const noMatch = testReadings.filter((r) => !byReading[r] || byReading[r].length === 0)
console.log('')
console.log('흔한 한국 이름 ' + testReadings.length + '개 음 중 千字文 매핑 없는 음:', noMatch.length)
if (noMatch.length > 0) console.log('  ', noMatch.join(' '))

console.log('')
console.log('샘플 후보:')
for (const r of ['천', '인', '김', '이', '정', '박', '대', '자', '회']) {
  const cands = byReading[r] || []
  console.log(`  ${r} (${cands.length}자):`, cands.join(' '))
}
