/**
 * 도장(인장) 생성 및 관리 서비스 — 모두싸인 스타일
 *
 * 플로우: 종류선택(일반/법인/업로드) → 한글/한문 → 이름입력 → [만들기]
 *         → 6~8개 디자인 미리보기 → 선택 → 등록
 *
 * Canvas API 기반 도장 생성 + Supabase Storage 저장
 */

import { createBrowserSupabaseClient } from '@/lib/supabase'

/* ══════════════════════ Types ══════════════════════ */

export type SealCategory = 'personal' | 'corporate' | 'upload'   // 일반 / 법인 / 업로드
export type SealScript = 'hangul' | 'hanja'                       // 한글 / 한문
export type SealShape = 'circle' | 'square' | 'oval' | 'rounded_square'
export type SealOwnerType = 'agency' | 'driver'

export interface SealVariant {
  id: string
  shape: SealShape
  fontFamily: string
  fontLabel: string
  dataUri: string            // 미리보기 base64 PNG
}

export interface SealRecord {
  id: string
  owner_type: SealOwnerType
  owner_id: string
  category: SealCategory
  script: SealScript
  seal_image_url: string
  seal_data_uri?: string
  name_text: string
  created_at: string
  is_default: boolean
}

export interface GenerateVariantsOptions {
  name: string
  category: SealCategory
  script: SealScript
  size?: number              // px (default 200)
  representativeName?: string  // 법인도장 중앙에 표시할 대표자명 (자동으로 +인)
  useHanja?: boolean           // true면 한자 변환 후 렌더링
  hanjaOverride?: string       // 사용자가 직접 선택한 한자 (우선 사용)
  showDot?: boolean            // 개인도장 글자 사이 점(·) 표시 (기본: true)
}

/* ══════════════════════ Font Loading ══════════════════════ */

const GOOGLE_FONTS_URL =
  'https://fonts.googleapis.com/css2?' +
  'family=Noto+Serif+KR:wght@700;900' +         // 해서체 느낌 (명조 세리프)
  '&family=Nanum+Myeongjo:wght@700;800' +       // 고인체 (나눔명조 굵게)
  '&family=Gowun+Batang:wght@700' +             // 예서체 느낌 (고운바탕)
  '&family=Nanum+Brush+Script' +                 // 궁서/붓글씨 느낌
  '&family=Nanum+Gothic:wght@700;800;900' +     // 둥근체 (고딕)
  '&family=Noto+Sans+KR:wght@700;900' +         // 인전체풍 (산세리프 굵게)
  '&family=Do+Hyeon' +                           // 전통 현판 느낌
  '&family=Gothic+A1:wght@700;900' +             // 현대 고인체풍
  '&family=Gowun+Dodum' +                        // 고운돋움 (깔끔한 돋움)
  '&family=Hahmlet:wght@700;900' +               // 함렛 (세리프 현대 클래식)
  '&family=Gaegu:wght@700' +                     // 개구 (손글씨 느낌)
  '&family=Sunflower:wght@700' +                 // 해바라기 (둥근 현대)
  '&family=Jua' +                                // 주아 (둥글둥글 귀여운)
  '&family=Song+Myung' +                         // 송명 (전통 송명체)
  '&family=Stylish' +                            // 스타일리시 (캘리 느낌)
  '&family=Gamja+Flower' +                       // 감자꽃 (손글씨)
  '&family=East+Sea+Dokdo' +                     // 동해독도 (붓글씨 강렬)
  '&family=Poor+Story' +                         // 푸어스토리 (자유분방)
  '&family=Gugi' +                               // 구기 (기하학적 현대)
  '&family=Dongle:wght@700' +                    // 동글 (둥근 손글씨)
  '&family=IBM+Plex+Sans+KR:wght@600;700' +     // IBM플렉스 (현대 세련)
  '&family=Black+Han+Sans' +                     // 블랙한산스 (두꺼운 고딕)
  '&family=Dokdo' +                              // 독도 (강렬한 붓)
  '&family=Hi+Melody' +                          // 하이멜로디 (손글씨)
  '&family=Yeon+Sung' +                          // 연성 (연필 손글씨)
  '&display=swap'

let _fontsLoaded = false

/** Google Fonts 링크를 head에 삽입 (한 번만) */
export function ensureSealFontsLoaded(): void {
  if (_fontsLoaded || typeof document === 'undefined') return
  _fontsLoaded = true
  const link = document.createElement('link')
  link.rel = 'stylesheet'
  link.href = GOOGLE_FONTS_URL
  document.head.appendChild(link)
}

/* ══════════════════════ Constants ══════════════════════ */

export const SEAL_CATEGORY_OPTIONS: { value: SealCategory; label: string; desc: string }[] = [
  { value: 'personal', label: '일반 도장', desc: '개인 인감 스타일' },
  { value: 'corporate', label: '법인 도장', desc: '법인 인감 스타일 (테두리 + 직함)' },
  { value: 'upload', label: '업로드', desc: '실물 도장 스캔 이미지 업로드' },
]

export const SEAL_SCRIPT_OPTIONS: { value: SealScript; label: string }[] = [
  { value: 'hangul', label: '한글' },
  { value: 'hanja', label: '한문(한자)' },
]

// 도장 색상 (전통 인감 빨간색)
const SEAL_COLOR = '#C42B2B'
const SEAL_COLOR_LIGHT = '#D94444'
const SEAL_COLOR_DARK = '#9A1F1F'

/* ══════════════════════ 한글 → 한자 변환 ══════════════════════ */

/**
 * 한글 음절 → 대표 한자 매핑 (성씨 + 일반 이름자 포함)
 * 동음이의어가 많으므로 가장 보편적인 한자를 기본값으로 사용.
 * 사용자가 직접 선택할 수 있도록 다중 후보도 제공.
 */
const HANGUL_TO_HANJA: Record<string, string[]> = {
  '강': ['姜', '康', '强'], '고': ['高', '古', '顧'], '곽': ['郭'], '구': ['具', '丘', '邱'],
  '권': ['權', '勸'], '금': ['琴', '金'], '기': ['奇', '紀', '基', '起', '氣'], '김': ['金'],
  '나': ['羅', '那'], '남': ['南', '男', '楠'], '노': ['盧', '魯'], '도': ['都', '道', '度'],
  '류': ['柳', '劉'], '마': ['馬', '磨'], '문': ['文', '門'], '민': ['閔', '民', '敏', '旻', '珉'],
  '박': ['朴'], '반': ['潘'], '방': ['方', '房', '邦'], '배': ['裵', '裴'],
  '백': ['白', '百'], '변': ['卞', '邊'], '봉': ['奉', '鳳', '峰'], '빈': ['彬', '賓', '斌'],
  '사': ['史', '謝', '思', '士', '四'], '서': ['徐', '西', '書', '瑞', '序'], '석': ['石', '昔', '錫', '碩'], '선': ['宣', '善', '先', '仙'],
  '설': ['薛', '雪'], '성': ['成', '星', '聖', '城', '誠'], '소': ['蘇', '邵', '昭', '小', '素'], '손': ['孫'],
  '송': ['宋', '松', '頌'], '신': ['申', '辛', '愼', '信', '新', '伸'], '심': ['沈', '沁'], '안': ['安', '顏'],
  '양': ['梁', '楊'], '엄': ['嚴'], '여': ['余', '呂'], '연': ['延', '燕', '蓮', '妍', '淵', '然'],
  '염': ['廉'], '오': ['吳', '伍', '五', '午'], '왕': ['王', '旺'], '용': ['龍', '容', '勇', '鎔'],
  '우': ['禹', '于', '牛', '宇', '佑', '祐', '雨', '友'], '원': ['元', '圓', '袁', '源', '遠', '園', '院'], '위': ['魏', '韋', '偉', '緯', '瑋'], '유': ['劉', '兪', '柳'],
  '윤': ['尹', '潤', '允', '倫'], '이': ['李', '異'], '임': ['林', '任'], '인': ['印', '仁', '寅', '忍'],
  '장': ['張', '章', '蔣', '壯', '長'], '전': ['全', '田', '錢', '典', '前'], '정': ['鄭', '丁', '程', '正', '貞', '靜', '淨', '廷', '晶'], '제': ['諸', '帝', '濟', '齊'],
  '조': ['趙', '曺', '朝', '兆'], '주': ['朱', '周', '州', '柱', '珠', '炷'], '지': ['池', '智', '志', '枝', '知', '至'], '진': ['陳', '秦', '晋', '眞', '珍', '振'],
  '차': ['車', '次'], '채': ['蔡', '采', '彩', '菜'], '천': ['千', '天', '泉'], '최': ['崔'],
  '추': ['秋', '鄒'], '탁': ['卓'], '태': ['太', '泰', '兌'], '편': ['片'],
  '표': ['表', '彪'], '하': ['河', '夏', '何', '荷', '賀'], '한': ['韓', '漢', '翰'], '함': ['咸'],
  '허': ['許'], '현': ['玄', '賢', '炫', '鉉', '顯'], '홍': ['洪', '紅', '弘', '泓'], '황': ['黃', '皇'],
  '형': ['邢', '刑', '亨', '炯', '衡', '螢'], '가': ['佳', '嘉', '家'], '건': ['健', '建', '乾'], '경': ['景', '京', '慶', '敬', '耕'],
  '광': ['光', '廣', '匡'], '교': ['校', '交', '敎'], '국': ['國', '菊'], '근': ['根', '勤', '近'],
  '다': ['多', '茶'], '단': ['丹', '端'], '달': ['達', '月'], '대': ['大', '代', '臺'],
  '덕': ['德', '悳'], '동': ['東', '洞', '冬', '棟'], '두': ['斗', '杜'], '라': ['羅', '螺'],
  '래': ['來', '萊'], '량': ['良', '亮'], '련': ['蓮', '連'], '령': ['令', '嶺'],
  '로': ['路', '魯', '露'], '록': ['祿', '綠', '鹿'], '론': ['論', '崙'], '루': ['樓', '累'],
  '리': ['利', '理', '李', '里'], '린': ['麟', '隣'], '만': ['萬', '滿'], '매': ['梅', '每'],
  '명': ['明', '命', '銘'], '모': ['母', '慕', '模'], '목': ['木', '牧', '睦'], '무': ['武', '茂', '務'],
  '미': ['美', '微'], '범': ['範', '凡', '法'], '병': ['炳', '秉', '丙', '兵'], '보': ['寶', '普', '輔'],
  '복': ['福', '復'], '본': ['本'], '부': ['富', '夫', '扶'], '산': ['山', '産'],
  '상': ['尙', '祥', '商', '相', '尚'], '새': ['塞'], '생': ['生'], '섭': ['燮', '涉'],
  '세': ['世', '洗', '細'], '속': ['速'], '솔': ['率', '松'], '수': ['秀', '壽', '洙', '守', '樹'],
  '숙': ['淑', '叔', '肅'], '순': ['順', '純', '舜', '淳'], '승': ['承', '勝', '昇'], '시': ['時', '始', '詩'],
  '식': ['植', '式'], '아': ['雅', '亞', '娥'], '악': ['岳'], '애': ['愛', '哀'],
  '야': ['野', '夜'], '열': ['烈', '悅'], '영': ['英', '永', '榮', '映', '瑛', '泳'], '예': ['藝', '禮', '叡', '睿'],
  '옥': ['玉', '沃'], '완': ['完', '浣'], '요': ['堯', '要'], '욱': ['旭', '昱', '郁'],
  '운': ['雲', '云', '運'], '웅': ['雄', '熊'], '월': ['月', '越'], '율': ['律', '栗'],
  '은': ['恩', '銀', '隱', '殷'], '을': ['乙'], '음': ['蔭'], '의': ['義', '宜', '儀'],
  '일': ['一', '日', '逸'], '자': ['子', '慈', '自'], '재': ['宰', '在', '載', '才', '材'], '저': ['貯'],
  '적': ['適'], '종': ['宗', '鍾', '種', '鐘'], '좌': ['佐'], '준': ['俊', '準', '峻', '濬'],
  '중': ['中', '重', '仲'], '증': ['曾'], '찬': ['燦', '贊', '粲'], '창': ['昌', '彰', '蒼', '倉'],
  '철': ['哲', '鐵', '喆'], '청': ['清', '靑', '晴'], '초': ['初', '超', '草'], '충': ['忠', '沖'],
  '치': ['致', '治'], '택': ['澤', '擇'], '판': ['判'], '평': ['平', '坪'],
  '풍': ['豊', '風'], '필': ['弼', '筆'], '학': ['鶴', '學'], '해': ['海', '該', '奚'],
  '향': ['香', '享', '鄕'], '헌': ['憲', '獻'], '혁': ['赫', '奕', '革'], '혜': ['惠', '慧', '蕙'],
  '호': ['浩', '湖', '虎', '好', '豪'], '화': ['花', '和', '華', '化', '火'], '환': ['歡', '煥', '桓', '環'], '회': ['會', '回'],
  '효': ['孝', '曉', '效'], '훈': ['勳', '薰', '訓'], '휘': ['輝', '揮', '暉'], '흥': ['興'],
  '희': ['熙', '喜', '禧', '羲', '希'],
}

/**
 * 한글 이름 → 한자 변환 (각 글자의 대표 한자 사용)
 * @returns 변환된 한자 문자열. 매핑이 없으면 원래 한글 유지.
 */
export function hangulToHanja(name: string): string {
  return name.split('').map((ch) => {
    const candidates = HANGUL_TO_HANJA[ch]
    return candidates ? candidates[0] : ch
  }).join('')
}

/**
 * 한글 글자 → 한자 후보 목록 반환 (UI에서 사용자 선택용)
 */
export function getHanjaCandidates(char: string): string[] {
  return HANGUL_TO_HANJA[char] ?? []
}

/**
 * 인감도장 서체 — 실무 8종
 *
 * 한글 서체 (4종):
 *  고인체  — 나눔명조 Bold + 전통 도장 느낌
 *  해서체  — Noto Serif KR Bold. 깔끔한 정자 바른체
 *  궁서체  — 나눔 붓글씨. 부드럽고 우아한 붓글씨 느낌
 *  둥근체  — 나눔고딕 Bold. 현대적이고 부드러운 느낌
 *
 * 한자풍 서체 (4종):
 *  고인체  — 나눔명조 800 + 자간조정. 가장 보편적
 *  해서체  — Noto Serif KR 900. 정자체, 누구나 읽기 쉬움
 *  예서체  — 고운바탕 700. 수평 획 강조, 고급스러운 인상
 *  인전체  — Gothic A1 900. 획이 균일, 장식적 느낌
 */
/** ── 전통 인감 스타일 (명조/세리프 계열) ── */
const CLASSIC_SEAL_FONTS: { family: string; label: string; weight: string }[] = [
  { family: '"Noto Serif KR", "Batang", serif', label: '해서체', weight: '900' },
  { family: '"Nanum Myeongjo", "Batang", serif', label: '고인체', weight: '800' },
  { family: '"Gowun Batang", "Batang", serif', label: '예서체', weight: '700' },
  { family: '"Hahmlet", "Batang", serif', label: '함렛체', weight: '900' },
  { family: '"Song Myung", "Batang", serif', label: '송명체', weight: '400' },
]

/** ── 붓글씨/캘리그라피 스타일 ── */
const BRUSH_SEAL_FONTS: { family: string; label: string; weight: string }[] = [
  { family: '"Nanum Brush Script", cursive', label: '궁서체', weight: '400' },
  { family: '"East Sea Dokdo", cursive', label: '동해독도', weight: '400' },
  { family: '"Dokdo", cursive', label: '독도체', weight: '400' },
  { family: '"Stylish", cursive', label: '캘리체', weight: '400' },
  { family: '"Gaegu", cursive', label: '개구체', weight: '700' },
]

/** ── 현대/고딕 스타일 ── */
const MODERN_SEAL_FONTS: { family: string; label: string; weight: string }[] = [
  { family: '"Gothic A1", "Malgun Gothic", sans-serif', label: '인전체', weight: '900' },
  { family: '"Nanum Gothic", "Malgun Gothic", sans-serif', label: '둥근체', weight: '900' },
  { family: '"Black Han Sans", "Malgun Gothic", sans-serif', label: '블랙한산', weight: '400' },
  { family: '"Do Hyeon", sans-serif', label: '도현체', weight: '400' },
  { family: '"Gugi", sans-serif', label: '구기체', weight: '400' },
  { family: '"Noto Sans KR", "Malgun Gothic", sans-serif', label: '노토산스', weight: '900' },
]

// 한글/한자 구분 없이 전체 폰트 풀 (전통 + 붓글씨 + 현대)
const HANGUL_FONTS = [...CLASSIC_SEAL_FONTS, ...BRUSH_SEAL_FONTS.slice(0, 2), ...MODERN_SEAL_FONTS.slice(0, 2)]
const HANJA_FONTS = [...CLASSIC_SEAL_FONTS, ...BRUSH_SEAL_FONTS.slice(0, 2), ...MODERN_SEAL_FONTS.slice(0, 2)]

/** 전체 폰트 목록 (중복 제거) — UI에서 폰트 이름 표시용 */
export const ALL_SEAL_FONTS = [...CLASSIC_SEAL_FONTS, ...BRUSH_SEAL_FONTS, ...MODERN_SEAL_FONTS]

// 도장 모양 (인감도장은 원형이 기본, 사각도 포함)
const SHAPES: { shape: SealShape; label: string }[] = [
  { shape: 'circle', label: '원형' },
  { shape: 'square', label: '사각' },
  { shape: 'oval', label: '타원' },
  { shape: 'rounded_square', label: '둥근사각' },
]

/* ══════════════════════ 한국 표준 도장 사이즈 ══════════════════════ */

export type SealSizeId = 'personal_small' | 'personal_medium' | 'personal_large' | 'personal_xl'
  | 'corporate_standard' | 'corporate_large' | 'corporate_extra'

export interface SealSizeOption {
  id: SealSizeId
  label: string
  desc: string
  diameterMm: number         // 실제 직경 (mm)
  canvasPx: number           // 렌더링 캔버스 크기 (px)
  category: 'personal' | 'corporate' | 'both'
}

/**
 * 한국 도장 표준 사이즈
 *
 * 개인인감: 보통 9~18mm (관공서 인감 등록은 7~30mm 허용, 통상 15mm)
 * 법인인감: 법원 등기소 기준 18mm (변경 불가)
 * 사용인감: 15~18mm
 * 직인: 20~25mm
 */
export const SEAL_SIZE_OPTIONS: SealSizeOption[] = [
  // ── 개인도장 사이즈 ──
  { id: 'personal_small',  label: '소형 (9mm)',  desc: '막도장 · 간편용',         diameterMm: 9,  canvasPx: 150, category: 'personal' },
  { id: 'personal_medium', label: '중형 (12mm)', desc: '일반 서명용',             diameterMm: 12, canvasPx: 200, category: 'personal' },
  { id: 'personal_large',  label: '대형 (15mm)', desc: '인감 · 계약서용 (표준)',   diameterMm: 15, canvasPx: 250, category: 'personal' },
  { id: 'personal_xl',     label: '특대 (18mm)', desc: '인감증명용',              diameterMm: 18, canvasPx: 300, category: 'personal' },

  // ── 법인도장 사이즈 ──
  { id: 'corporate_standard', label: '법인인감 (18mm)', desc: '법원 등기 표준',            diameterMm: 18, canvasPx: 300, category: 'corporate' },
  { id: 'corporate_large',    label: '사용인감 (21mm)', desc: '법인 사용인감',              diameterMm: 21, canvasPx: 350, category: 'corporate' },
  { id: 'corporate_extra',    label: '직인 (25mm)',     desc: '회사 직인 · 관인',           diameterMm: 25, canvasPx: 400, category: 'corporate' },
]

/** 카테고리별 기본 사이즈 ID */
export const DEFAULT_SEAL_SIZE: Record<'personal' | 'corporate', SealSizeId> = {
  personal: 'personal_large',      // 개인: 15mm (계약서 표준)
  corporate: 'corporate_standard', // 법인: 18mm (등기 표준)
}

/** 카테고리에 해당하는 사이즈 목록 반환 */
export function getSealSizesForCategory(category: 'personal' | 'corporate'): SealSizeOption[] {
  return SEAL_SIZE_OPTIONS.filter(s => s.category === category || s.category === 'both')
}

/** ID로 사이즈 옵션 조회 */
export function getSealSizeById(id: SealSizeId): SealSizeOption | undefined {
  return SEAL_SIZE_OPTIONS.find(s => s.id === id)
}

// 법인도장 중앙 텍스트 프리셋 (실무 기준) — 기본값: 대표자인
const CORPORATE_TITLES = ['대표자인', '대표이사인', '대표이사印', '대표이사之印']

/** 법인도장 직함 한자 변환 매핑 */
const CORPORATE_TITLE_HANJA: Record<string, string> = {
  '대표자인': '代表者印',
  '대표이사인': '代表理事印',
  '대표이사印': '代表理事印',
  '대표이사之印': '代表理事之印',
}

/** 법인도장 직함을 한자로 변환. 매핑에 없으면 글자 단위로 시도 */
function corporateTitleToHanja(title: string): string {
  if (CORPORATE_TITLE_HANJA[title]) return CORPORATE_TITLE_HANJA[title]
  // 글자 단위 변환 시도
  return title.split('').map(ch => {
    const candidates = getHanjaCandidates(ch)
    return candidates.length > 0 ? candidates[0] : ch
  }).join('')
}

/* ══════════════════════ 도장 이미지 생성 (Canvas) ══════════════════════ */

/**
 * 이름 입력 → 8개 도장 variant를 한번에 생성하여 반환
 * 모두싸인 스타일: 원형/사각 × 폰트 조합
 */
export function generateSealVariants(options: GenerateVariantsOptions): SealVariant[] {
  ensureSealFontsLoaded()
  const { name, category, size = 200, representativeName, useHanja = false, hanjaOverride, showDot = true } = options
  const variants: SealVariant[] = []

  // 한자 변환: 사용자 직접 지정 > 자동 변환 > 한글 원문
  const displayName = hanjaOverride
    ? hanjaOverride
    : useHanja
      ? hangulToHanja(name)
      : name

  // 법인도장: 중앙 텍스트 커스텀 (기본: "대표자인")
  // 한자 모드일 때 직함도 한자로 변환
  const rawTitle = representativeName ? representativeName.trim() : undefined
  const repTitle = useHanja
    ? (rawTitle ? corporateTitleToHanja(rawTitle) : undefined)
    : rawTitle

  // 전통5 + 붓글씨5 + 현대6 = 16종 중 중복 제거하여 전체 사용
  const allFonts = ALL_SEAL_FONTS
  const combos: { shape: SealShape; font: typeof allFonts[0]; titleIdx?: number; titleOverride?: string; intaglio?: boolean; strokeLabel?: string; extraStroke?: number }[] = []

  if (category === 'corporate') {
    for (const f of allFonts) {
      combos.push({ shape: 'circle', font: f, titleOverride: repTitle, titleIdx: 0 })
    }
  } else {
    // 개인도장: 전체 폰트 각 1개
    for (const f of allFonts) {
      combos.push({ shape: 'circle', font: f })
    }
  }

  for (let i = 0; i < combos.length; i++) {
    const { shape, font, titleIdx, titleOverride, strokeLabel, extraStroke } = combos[i]
    const dataUri = renderSealCanvas({
      name: displayName,
      category,
      shape,
      fontFamily: font.family,
      fontWeight: font.weight,
      size,
      corporateTitle: category === 'corporate'
        ? (() => {
            const baseTitle = titleOverride ?? CORPORATE_TITLES[titleIdx ?? 0]
            return useHanja ? corporateTitleToHanja(baseTitle) : baseTitle
          })()
        : undefined,
      intaglio: false,
      extraStroke,
      showDot: showDot,
    })
    variants.push({
      id: `${shape}_${font.label}_${i}`,
      shape,
      fontFamily: font.family,
      fontLabel: strokeLabel ?? font.label,
      dataUri,
    })
  }

  return variants
}

interface RenderSealOptions {
  name: string
  category: SealCategory
  shape: SealShape
  fontFamily: string
  fontWeight: string
  size: number
  corporateTitle?: string
  intaglio?: boolean
  extraStroke?: number
  showDot?: boolean          // 개인도장 글자 사이 점(·) 표시
}

/** 단일 도장 Canvas 렌더링 → data URI */
function renderSealCanvas(opts: RenderSealOptions): string {
  const { name, category, shape, fontFamily, fontWeight, size, corporateTitle, intaglio = false, extraStroke = 0, showDot = false } = opts
  const canvas = document.createElement('canvas')

  // 타원형은 가로가 더 길도록
  const w = shape === 'oval' ? Math.round(size * 1.3) : size
  const h = size
  canvas.width = w
  canvas.height = h
  const ctx = canvas.getContext('2d')!
  ctx.clearRect(0, 0, w, h)

  const cx = w / 2
  const cy = h / 2
  const pad = size * 0.06
  const outerLineW = size * 0.04    // 외곽선 굵기 (인감도장 느낌)
  const innerLineW = size * 0.025   // 내곽선 굵기

  ctx.fillStyle = SEAL_COLOR
  ctx.strokeStyle = SEAL_COLOR

  const chars = name.replace(/\s/g, '')

  if (intaglio) {
    // ── 음각(陰刻) 모드: 빨간 배경 + 흰 글자 + 새긴 듯한 효과 ──
    renderIntaglioSeal(ctx, chars, category, shape, fontFamily, fontWeight, w, h, pad, outerLineW, innerLineW, corporateTitle)
  } else if (category === 'corporate') {
    if (shape === 'circle') {
      drawCorporateCircleSeal(ctx, chars, fontFamily, fontWeight, cx, cy, size, pad, outerLineW, innerLineW, corporateTitle, showDot)
    } else {
      drawCorporateSquareSeal(ctx, chars, fontFamily, fontWeight, w, h, pad, outerLineW, innerLineW, corporateTitle, shape, showDot)
    }
  } else {
    if (shape === 'circle') {
      drawPersonalCircleSeal(ctx, chars, fontFamily, fontWeight, cx, cy, size, pad, outerLineW, showDot)
    } else if (shape === 'oval') {
      drawPersonalOvalSeal(ctx, chars, fontFamily, fontWeight, cx, cy, w, h, pad, outerLineW)
    } else {
      drawPersonalSquareSeal(ctx, chars, fontFamily, fontWeight, w, h, pad, outerLineW, shape)
    }
  }

  // 잉크 질감 효과
  addInkTexture(ctx, w, h)

  return canvas.toDataURL('image/png')
}

/* ────────────────── 양각 스타일 글자 헬퍼 ────────────────── */

/**
 * 양각(陽刻) 인감도장 글자 렌더링.
 * 가벼운 단일 stroke + fill. strokeRatio=0 이면 순수 fill만.
 */
function drawThickText(
  ctx: CanvasRenderingContext2D,
  text: string,
  x: number, y: number,
  fontSize: number,
  fontFamily: string,
  fontWeight: string,
  _strokeRatio = 0,  // 무시 — 양각 스타일은 순수 fill 기반
) {
  ctx.font = `${fontWeight} ${fontSize}px ${fontFamily}`
  ctx.textAlign = 'center'
  ctx.textBaseline = 'middle'
  ctx.fillStyle = SEAL_COLOR
  ctx.fillText(text, x, y)
}

/* ────────────────── 법인도장: 원형 (인감도장 스타일) ────────────────── */

/**
 * 한국 법인 인감도장 스타일:
 * - 이중 원형 테두리 (외곽 두꺼운 원 + 내곽 얇은 원)
 * - 외곽과 내곽 사이에 회사명 원호 배치 + ★ 구분자
 * - 중앙에 직함 (대표이사인) 큰 글씨 — 십자 구분선 + 2×2 배치
 */
function drawCorporateCircleSeal(
  ctx: CanvasRenderingContext2D,
  companyName: string,
  fontFamily: string,
  fontWeight: string,
  cx: number, cy: number,
  size: number, pad: number,
  outerLineW: number, innerLineW: number,
  corporateTitle?: string,
  showDot = false,
) {
  const outerR = (size / 2) - pad                     // 외곽 원 반지름
  const innerR = outerR * 0.55                          // 내곽 원 반지름 (약간 줄여서 링 영역 넓힘)

  // ── 1. 외곽 원 (두꺼운 테두리) ──
  ctx.lineWidth = outerLineW * 1.2
  ctx.strokeStyle = SEAL_COLOR
  ctx.beginPath()
  ctx.arc(cx, cy, outerR, 0, Math.PI * 2)
  ctx.stroke()

  // ── 2. 내곽 원 (얇은 테두리) ──
  ctx.lineWidth = innerLineW
  ctx.beginPath()
  ctx.arc(cx, cy, innerR, 0, Math.PI * 2)
  ctx.stroke()

  // ── 3. 외곽~내곽 사이에 회사명 원호 배치 (360도 균등, 구분자 없음) ──
  const ringR = (outerR + innerR) / 2                   // 텍스트가 따라갈 원호 반지름
  const nameChars = companyName.split('')
  const charAngleStep = (Math.PI * 2) / nameChars.length // 360도 / 글자수

  // 텍스트 크기 (외곽~내곽 간격의 72%)
  const ringTextSize = (outerR - innerR) * 0.72

  // 12시 방향(−π/2)부터 시계방향으로 글자만 균등 배치
  const startAngle = -Math.PI / 2

  for (let i = 0; i < nameChars.length; i++) {
    const angle = startAngle + charAngleStep * i
    drawCharOnArc(ctx, nameChars[i], cx, cy, ringR, angle, ringTextSize, fontFamily, fontWeight)
  }

  // ── 3.5 글자 사이 점(·) — 각 글자 사이 중간 지점에 작은 원 ──
  if (showDot && nameChars.length >= 2) {
    const dotR = ringTextSize * 0.12
    for (let i = 0; i < nameChars.length; i++) {
      const midAngle = startAngle + charAngleStep * (i + 0.5) // 글자 i와 i+1 사이
      const dx = cx + ringR * Math.cos(midAngle)
      const dy = cy + ringR * Math.sin(midAngle)
      drawDot(ctx, dx, dy, dotR)
    }
  }

  // ── 4. 중앙에 직함 글자 배치 ──
  // 법인인감 표준: 세로 2열 (우→좌 읽기)
  // "대표이사之印" → 우열: 대/표/이, 좌열: 사/之/印
  // "대표이사印"   → 우열: 대/표/이, 좌열: 사/印
  // "대표이사인"   → 우열: 대/표/이, 좌열: 사/인
  // "대표자인"     → 우열: 대/표, 좌열: 자/인
  const title = corporateTitle ?? '대표자인'
  const titleChars = title.split('')
  const len = titleChars.length

  if (len <= 2) {
    // 2글자: 세로 중앙
    const fs = innerR * 0.85
    const spacing = fs * 1.05
    const totalH = len * spacing
    const sy = cy - totalH / 2 + spacing / 2
    titleChars.forEach((ch, i) => drawThickText(ctx, ch, cx, sy + i * spacing, fs, fontFamily, fontWeight))
  } else if (len === 3) {
    // 3글자: 세로 중앙
    const fs = innerR * 0.65
    const spacing = fs * 1.08
    const totalH = len * spacing
    const sy = cy - totalH / 2 + spacing / 2
    titleChars.forEach((ch, i) => drawThickText(ctx, ch, cx, sy + i * spacing, fs, fontFamily, fontWeight))
  } else {
    // 4~6글자: 세로 2열 우→좌 읽기
    // 우측 열 글자수 = ceil(len/2), 좌측 열 = 나머지
    const rightCount = Math.ceil(len / 2)
    const leftCount = len - rightCount
    const rightChars = titleChars.slice(0, rightCount)
    const leftChars = titleChars.slice(rightCount)

    // 글자 크기 — 열당 글자수에 따라 조정
    const maxPerCol = Math.max(rightCount, leftCount)
    const fs = innerR * (maxPerCol <= 2 ? 0.62 : maxPerCol === 3 ? 0.52 : 0.44)
    const gx = innerR * 0.32
    const spacing = fs * 1.05

    // 우측 열 (세로 중앙 정렬)
    const rTotalH = rightCount * spacing
    const rStartY = cy - rTotalH / 2 + spacing / 2
    rightChars.forEach((ch, i) => drawThickText(ctx, ch, cx + gx, rStartY + i * spacing, fs, fontFamily, fontWeight))

    // 좌측 열 (세로 중앙 정렬)
    const lTotalH = leftCount * spacing
    const lStartY = cy - lTotalH / 2 + spacing / 2
    leftChars.forEach((ch, i) => drawThickText(ctx, ch, cx - gx, lStartY + i * spacing, fs, fontFamily, fontWeight))
  }
}

/** 원호 위에 글자 하나를 배치 (각도에 따라 회전) — 다중 stroke 전각풍 */
function drawCharOnArc(
  ctx: CanvasRenderingContext2D,
  char: string,
  cx: number, cy: number,
  r: number, angle: number,
  fontSize: number,
  fontFamily: string,
  fontWeight: string,
) {
  ctx.save()
  ctx.translate(cx + r * Math.cos(angle), cy + r * Math.sin(angle))
  ctx.rotate(angle + Math.PI / 2)
  ctx.font = `${fontWeight} ${fontSize}px ${fontFamily}`
  ctx.textAlign = 'center'
  ctx.textBaseline = 'middle'
  ctx.fillStyle = SEAL_COLOR
  ctx.fillText(char, 0, 0)
  ctx.restore()
}

/* ────────────────── 법인도장: 사각형 ────────────────── */

function drawCorporateSquareSeal(
  ctx: CanvasRenderingContext2D,
  companyName: string,
  fontFamily: string,
  fontWeight: string,
  w: number, h: number,
  pad: number,
  outerLineW: number, innerLineW: number,
  corporateTitle?: string,
  shape?: SealShape,
  showDot = false,
) {
  const cx = w / 2
  const cy = h / 2

  // 외곽 사각형 (두꺼운 테두리)
  ctx.lineWidth = outerLineW * 1.3
  ctx.strokeStyle = SEAL_COLOR
  if (shape === 'rounded_square') {
    drawRoundedRect(ctx, pad, pad, w - pad * 2, h - pad * 2, w * 0.1)
    ctx.stroke()
  } else {
    ctx.strokeRect(pad, pad, w - pad * 2, h - pad * 2)
  }

  // 중앙 가로선
  const innerPad = pad + outerLineW * 1.3 + w * 0.04
  ctx.lineWidth = innerLineW
  ctx.beginPath()
  ctx.moveTo(innerPad, cy)
  ctx.lineTo(w - innerPad, cy)
  ctx.stroke()

  // 위: 회사명 (두꺼운 전각풍)
  const topArea = cy - pad - outerLineW
  const displayName = showDot && companyName.length >= 2 ? companyName.split('').join('·') : companyName
  const topFs = Math.min(topArea * 0.58, (w - innerPad * 2) / Math.max(displayName.length, 2) * 1.05)
  drawThickText(ctx, displayName, cx, cy - topArea * 0.38, topFs, fontFamily, fontWeight, 0.08)

  // 아래: 직함 (두꺼운 전각풍)
  const title = corporateTitle ?? '대표자인'
  const btFs = topFs * 0.82
  drawThickText(ctx, title, cx, cy + topArea * 0.42, btFs, fontFamily, fontWeight, 0.08)
}

/* ────────────────── 일반도장: 원형 (인감도장 스타일) ────────────────── */

/**
 * 개인 인감도장 스타일:
 * - 원형 두꺼운 테두리
 * - 중앙에 이름 (전각풍 큰 글씨)
 * - 2글자: 세로 배치, 3글자: 삼각 배치, 4글자: 2×2 그리드
 */
/**
 * 글자 사이에 작은 원(·)을 그리는 헬퍼
 */
function drawDot(ctx: CanvasRenderingContext2D, x: number, y: number, radius: number) {
  ctx.fillStyle = SEAL_COLOR
  ctx.beginPath()
  ctx.arc(x, y, radius, 0, Math.PI * 2)
  ctx.fill()
}

function drawPersonalCircleSeal(
  ctx: CanvasRenderingContext2D,
  chars: string,
  fontFamily: string,
  fontWeight: string,
  cx: number, cy: number,
  size: number, pad: number,
  outerLineW: number,
  showDot = false,
) {
  const outerR = (size / 2) - pad

  // 외곽 원 (두꺼운 테두리 — 인감도장 느낌)
  ctx.lineWidth = outerLineW * 1.2
  ctx.strokeStyle = SEAL_COLOR
  ctx.beginPath()
  ctx.arc(cx, cy, outerR, 0, Math.PI * 2)
  ctx.stroke()

  const usableR = outerR - outerLineW

  // 개인 인감: 이름 + "印" 형태 (예: "주상하" → "주상하印")
  const sealChars = (chars + '印').split('')
  const len = sealChars.length
  const dotR = size * 0.018  // 점 반지름

  if (len <= 2) {
    // 2글자: 세로 배치
    const fs = usableR * 1.0
    const gap = fs * 0.50
    sealChars.forEach((ch, i) =>
      drawThickText(ctx, ch, cx, cy - gap + i * gap * 2, fs, fontFamily, fontWeight))
    // 점: 두 글자 사이 중앙
    if (showDot && len === 2) {
      drawDot(ctx, cx, cy, dotR)
    }
  } else if (len === 3) {
    // 3글자 (2글자이름+印): 세로 배치
    const fs = usableR * 0.72
    const spacing = fs * 1.05
    const totalH = len * spacing
    const sy = cy - totalH / 2 + spacing / 2
    sealChars.forEach((ch, i) =>
      drawThickText(ctx, ch, cx, sy + i * spacing, fs, fontFamily, fontWeight))
    // 점: 각 글자 사이
    if (showDot) {
      drawDot(ctx, cx, sy + spacing * 0.5, dotR)
      drawDot(ctx, cx, sy + spacing * 1.5, dotR)
    }
  } else if (len === 4) {
    // 4글자 (3글자이름+印): 2×2 그리드, 세로읽기 우→좌
    // "주상하印" → 우열: 주/상, 좌열: 하/印
    const fs = usableR * 0.68
    const gx = usableR * 0.34
    const gy = usableR * 0.34
    drawThickText(ctx, sealChars[0], cx + gx, cy - gy, fs, fontFamily, fontWeight)
    drawThickText(ctx, sealChars[1], cx + gx, cy + gy, fs, fontFamily, fontWeight)
    drawThickText(ctx, sealChars[2], cx - gx, cy - gy, fs, fontFamily, fontWeight)
    drawThickText(ctx, sealChars[3], cx - gx, cy + gy, fs, fontFamily, fontWeight)
    // 점: 중앙 (4글자 사이 교차점)
    if (showDot) {
      drawDot(ctx, cx, cy, dotR * 1.2)
    }
  } else {
    // 5글자+ (4글자이름+印): 세로 2열 우→좌
    const rightCount = Math.ceil(len / 2)
    const leftCount = len - rightCount
    const rightChars = sealChars.slice(0, rightCount)
    const leftChars = sealChars.slice(rightCount)
    const maxPerCol = Math.max(rightCount, leftCount)
    const fs = usableR * (maxPerCol <= 2 ? 0.62 : maxPerCol === 3 ? 0.52 : 0.44)
    const gx = usableR * 0.32
    const spacing = fs * 1.05

    const rTotalH = rightCount * spacing
    const rStartY = cy - rTotalH / 2 + spacing / 2
    rightChars.forEach((ch, i) =>
      drawThickText(ctx, ch, cx + gx, rStartY + i * spacing, fs, fontFamily, fontWeight))

    const lTotalH = leftCount * spacing
    const lStartY = cy - lTotalH / 2 + spacing / 2
    leftChars.forEach((ch, i) =>
      drawThickText(ctx, ch, cx - gx, lStartY + i * spacing, fs, fontFamily, fontWeight))

    // 점: 열 사이 중앙
    if (showDot) {
      drawDot(ctx, cx, cy, dotR * 1.2)
    }
  }
}

/* ────────────────── 일반도장: 타원형 ────────────────── */

function drawPersonalOvalSeal(
  ctx: CanvasRenderingContext2D,
  chars: string,
  fontFamily: string,
  fontWeight: string,
  cx: number, cy: number,
  w: number, h: number,
  pad: number,
  outerLineW: number,
) {
  // 외곽 타원 (두꺼운 테두리)
  ctx.lineWidth = outerLineW * 1.2
  ctx.strokeStyle = SEAL_COLOR
  ctx.beginPath()
  ctx.ellipse(cx, cy, cx - pad, cy - pad, 0, 0, Math.PI * 2)
  ctx.stroke()

  // 중앙에 가로 배치 (타원은 가로가 길므로)
  const maxW = (w - pad * 2) * 0.80
  const fs = Math.min(h * 0.55, maxW / Math.max(chars.length, 1) * 1.35)
  drawThickText(ctx, chars, cx, cy, fs, fontFamily, fontWeight, 0.20)
}

/* ────────────────── 일반도장: 사각형 ────────────────── */

function drawPersonalSquareSeal(
  ctx: CanvasRenderingContext2D,
  chars: string,
  fontFamily: string,
  fontWeight: string,
  w: number, h: number,
  pad: number,
  outerLineW: number,
  shape: SealShape,
) {
  const cx = w / 2
  const cy = h / 2

  // 외곽 사각형 (두꺼운 테두리)
  ctx.lineWidth = outerLineW * 1.3
  ctx.strokeStyle = SEAL_COLOR
  if (shape === 'rounded_square') {
    drawRoundedRect(ctx, pad, pad, w - pad * 2, h - pad * 2, w * 0.1)
    ctx.stroke()
  } else {
    ctx.strokeRect(pad, pad, w - pad * 2, h - pad * 2)
  }

  const usableW = w - pad * 2 - outerLineW * 2
  const usableH = h - pad * 2 - outerLineW * 2

  if (chars.length <= 2) {
    const fs = usableH * 0.68
    if (chars.length === 1) {
      drawThickText(ctx, chars, cx, cy, fs, fontFamily, fontWeight, 0.22)
    } else {
      drawThickText(ctx, chars[0], cx, cy - fs * 0.48, fs, fontFamily, fontWeight, 0.20)
      drawThickText(ctx, chars[1], cx, cy + fs * 0.48, fs, fontFamily, fontWeight, 0.20)
    }
  } else if (chars.length <= 4) {
    // 2×2 그리드 — 공간 꽉 채움
    const fs = Math.min(usableW * 0.48, usableH * 0.48)
    const gx = usableW * 0.24
    const gy = usableH * 0.24
    const grid = chars.length === 3 ? [chars[0], chars[1], chars[2], ''] : [chars[0], chars[1], chars[2], chars[3]]
    drawThickText(ctx, grid[0], cx + gx, cy - gy, fs, fontFamily, fontWeight, 0.20)
    drawThickText(ctx, grid[1], cx + gx, cy + gy, fs, fontFamily, fontWeight, 0.20)
    drawThickText(ctx, grid[2], cx - gx, cy - gy, fs, fontFamily, fontWeight, 0.20)
    if (grid[3]) drawThickText(ctx, grid[3], cx - gx, cy + gy, fs, fontFamily, fontWeight, 0.20)
  } else {
    // 5+ 줄바꿈
    const perLine = Math.ceil(chars.length / 2)
    const lines: string[] = []
    for (let i = 0; i < chars.length; i += perLine) lines.push(chars.slice(i, i + perLine))
    const fs = Math.min(usableH / lines.length * 0.85, usableW / perLine * 1.0)
    const totalH = lines.length * fs * 1.15
    const startY = cy - totalH / 2 + fs * 0.5
    lines.forEach((line, i) => drawThickText(ctx, line, cx, startY + i * fs * 1.15, fs, fontFamily, fontWeight, 0.20))
  }
}

/* ────────────────── 음각(陰刻) 도장 ────────────────── */

/**
 * 음각 인감도장: 빨간 바탕을 채우고 글자 부분을 파내는 스타일.
 * 한국 전통 인감의 전형적 형태. 글자가 흰색(종이)으로 남고 나머지가 빨간 잉크.
 */
function renderIntaglioSeal(
  ctx: CanvasRenderingContext2D,
  chars: string,
  category: SealCategory,
  shape: SealShape,
  fontFamily: string,
  fontWeight: string,
  w: number, h: number,
  pad: number,
  outerLineW: number,
  _innerLineW: number,
  corporateTitle?: string,
) {
  const cx = w / 2
  const cy = h / 2

  // 1. 전체를 빨간색으로 채운 도장 모양 그리기
  ctx.fillStyle = SEAL_COLOR
  if (shape === 'circle') {
    const r = (Math.min(w, h) / 2) - pad
    ctx.beginPath()
    ctx.arc(cx, cy, r, 0, Math.PI * 2)
    ctx.fill()
  } else if (shape === 'oval') {
    ctx.beginPath()
    ctx.ellipse(cx, cy, cx - pad, cy - pad, 0, 0, Math.PI * 2)
    ctx.fill()
  } else if (shape === 'rounded_square') {
    drawRoundedRect(ctx, pad, pad, w - pad * 2, h - pad * 2, w * 0.1)
    ctx.fill()
  } else {
    ctx.fillRect(pad, pad, w - pad * 2, h - pad * 2)
  }

  // 2. 글자를 "파내기" — destination-out 합성으로 글자 영역을 투명하게
  ctx.globalCompositeOperation = 'destination-out'

  const usableR = (Math.min(w, h) / 2) - pad - outerLineW

  if (category === 'corporate' && corporateTitle) {
    // 법인 음각: 중앙에 직함
    const title = corporateTitle
    const titleChars = title.split('')
    if (titleChars.length <= 3) {
      const fs = usableR * 0.78
      const spacing = fs * 1.05
      const totalH = titleChars.length * spacing
      const startY = cy - totalH / 2 + spacing / 2
      titleChars.forEach((ch, i) => drawThickText(ctx, ch, cx, startY + i * spacing, fs, fontFamily, fontWeight, 0.25))
    } else if (titleChars.length === 4) {
      const fs = usableR * 0.65
      const gx = usableR * 0.33
      const gy = usableR * 0.33
      drawThickText(ctx, titleChars[0], cx + gx, cy - gy, fs, fontFamily, fontWeight, 0.25)
      drawThickText(ctx, titleChars[1], cx + gx, cy + gy, fs, fontFamily, fontWeight, 0.25)
      drawThickText(ctx, titleChars[2], cx - gx, cy - gy, fs, fontFamily, fontWeight, 0.25)
      drawThickText(ctx, titleChars[3], cx - gx, cy + gy, fs, fontFamily, fontWeight, 0.25)
    } else {
      const fs = usableR * 0.50
      const gx = usableR * 0.30
      const spacing = fs * 0.95
      const col1 = titleChars.slice(0, 3)
      const startY1 = cy - spacing
      col1.forEach((ch, i) => drawThickText(ctx, ch, cx + gx, startY1 + i * spacing, fs, fontFamily, fontWeight, 0.25))
      const col2 = titleChars.slice(3)
      const startY2 = cy - spacing * 0.5
      col2.forEach((ch, i) => drawThickText(ctx, ch, cx - gx, startY2 + i * spacing, fs, fontFamily, fontWeight, 0.25))
    }
  } else {
    // 일반 음각: 이름 배치
    if (chars.length === 1) {
      drawThickText(ctx, chars, cx, cy, usableR * 1.4, fontFamily, fontWeight, 0.25)
    } else if (chars.length === 2) {
      const fs = usableR * 0.90
      drawThickText(ctx, chars[0], cx, cy - fs * 0.48, fs, fontFamily, fontWeight, 0.25)
      drawThickText(ctx, chars[1], cx, cy + fs * 0.48, fs, fontFamily, fontWeight, 0.25)
    } else if (chars.length === 3) {
      const fs = usableR * 0.70
      drawThickText(ctx, chars[0], cx, cy - fs * 0.52, fs, fontFamily, fontWeight, 0.25)
      drawThickText(ctx, chars[1], cx - fs * 0.48, cy + fs * 0.42, fs, fontFamily, fontWeight, 0.25)
      drawThickText(ctx, chars[2], cx + fs * 0.48, cy + fs * 0.42, fs, fontFamily, fontWeight, 0.25)
    } else {
      const fs = usableR * 0.62
      const gx = usableR * 0.32
      const gy = usableR * 0.32
      drawThickText(ctx, chars[0], cx + gx, cy - gy, fs, fontFamily, fontWeight, 0.25)
      drawThickText(ctx, chars[1], cx + gx, cy + gy, fs, fontFamily, fontWeight, 0.25)
      if (chars[2]) drawThickText(ctx, chars[2], cx - gx, cy - gy, fs, fontFamily, fontWeight, 0.25)
      if (chars[3]) drawThickText(ctx, chars[3], cx - gx, cy + gy, fs, fontFamily, fontWeight, 0.25)
    }
  }

  // 3. 합성 모드 원복
  ctx.globalCompositeOperation = 'source-over'

  // 4. 외곽 테두리 (음각도 약간의 테두리가 있으면 선명)
  ctx.strokeStyle = SEAL_COLOR_DARK
  ctx.lineWidth = outerLineW * 0.5
  if (shape === 'circle') {
    const r = (Math.min(w, h) / 2) - pad
    ctx.beginPath()
    ctx.arc(cx, cy, r, 0, Math.PI * 2)
    ctx.stroke()
  } else if (shape === 'rounded_square') {
    drawRoundedRect(ctx, pad, pad, w - pad * 2, h - pad * 2, w * 0.1)
    ctx.stroke()
  } else if (shape !== 'oval') {
    ctx.strokeRect(pad, pad, w - pad * 2, h - pad * 2)
  }
}

/** 인장 잉크 질감 (노이즈) — 실제 도장을 찍은 것 같은 효과 */
function addInkTexture(ctx: CanvasRenderingContext2D, w: number, h: number) {
  const imageData = ctx.getImageData(0, 0, w, h)
  const d = imageData.data

  for (let i = 0; i < d.length; i += 4) {
    if (d[i + 3] > 0) {
      const noise = Math.random()
      // 잉크 번짐 — 약간의 투명도 변화
      if (noise < 0.06) {
        // 잉크가 안 묻은 부분 (빈 구멍)
        d[i + 3] = Math.max(0, d[i + 3] - Math.floor(Math.random() * 120))
      } else if (noise < 0.12) {
        // 잉크 흐림
        d[i + 3] = Math.max(0, d[i + 3] - Math.floor(Math.random() * 50))
      } else if (noise < 0.18) {
        // 미세한 질감
        d[i + 3] = Math.max(0, d[i + 3] - Math.floor(Math.random() * 20))
      }

      // 가장자리 번짐 효과 (중앙에서 멀수록 번짐 증가)
      const px = (i / 4) % w
      const py = Math.floor((i / 4) / w)
      const distFromCenter = Math.sqrt(Math.pow(px - w / 2, 2) + Math.pow(py - h / 2, 2))
      const maxDist = Math.sqrt(Math.pow(w / 2, 2) + Math.pow(h / 2, 2))
      const edgeFactor = distFromCenter / maxDist

      if (edgeFactor > 0.8 && Math.random() < 0.3) {
        d[i + 3] = Math.max(0, d[i + 3] - Math.floor(Math.random() * 60))
      }
    }
  }

  ctx.putImageData(imageData, 0, 0)
}

/** 둥근 사각형 경로 */
function drawRoundedRect(ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, r: number) {
  ctx.beginPath()
  ctx.moveTo(x + r, y)
  ctx.lineTo(x + w - r, y)
  ctx.quadraticCurveTo(x + w, y, x + w, y + r)
  ctx.lineTo(x + w, y + h - r)
  ctx.quadraticCurveTo(x + w, y + h, x + w - r, y + h)
  ctx.lineTo(x + r, y + h)
  ctx.quadraticCurveTo(x, y + h, x, y + h - r)
  ctx.lineTo(x, y + r)
  ctx.quadraticCurveTo(x, y, x + r, y)
  ctx.closePath()
}

/* ══════════════════════ 업로드 도장: 배경 제거 ══════════════════════ */

/**
 * 업로드된 도장 이미지의 흰 배경을 투명하게 변환
 * (모두싸인처럼 흰 종이 위의 도장 스캔 → 배경 자동 제거)
 */
export function removeWhiteBackground(imageDataUri: string): Promise<string> {
  return new Promise((resolve) => {
    const img = new Image()
    img.onload = () => {
      const canvas = document.createElement('canvas')
      canvas.width = img.width
      canvas.height = img.height
      const ctx = canvas.getContext('2d')!
      ctx.drawImage(img, 0, 0)

      const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height)
      const d = imageData.data

      for (let i = 0; i < d.length; i += 4) {
        const r = d[i], g = d[i + 1], b = d[i + 2]
        // 밝은 색(흰색 계열)을 투명하게
        const brightness = (r + g + b) / 3
        if (brightness > 200) {
          // 완전 흰색에 가까울수록 완전 투명
          const alpha = Math.max(0, Math.min(255, (200 - brightness) * 5 + 255))
          d[i + 3] = Math.min(d[i + 3], Math.max(0, 255 - Math.floor((brightness - 180) * 3.4)))
        }
        // 회색 영역도 반투명 처리
        if (brightness > 160 && brightness <= 200) {
          d[i + 3] = Math.min(d[i + 3], Math.floor((200 - brightness) * 6.375))
        }
      }

      ctx.putImageData(imageData, 0, 0)
      resolve(canvas.toDataURL('image/png'))
    }
    img.src = imageDataUri
  })
}

/**
 * File → data URI
 */
export function fileToDataUri(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader()
    reader.onload = () => resolve(reader.result as string)
    reader.onerror = reject
    reader.readAsDataURL(file)
  })
}

/* ══════════════════════ Supabase Storage ══════════════════════ */

const SEAL_BUCKET = 'seals'
const DOC_BUCKET = 'documents'

function dataURItoBlob(dataURI: string): Blob {
  const [header, base64] = dataURI.split(',')
  const mime = header.match(/:(.*?);/)?.[1] ?? 'image/png'
  const bytes = atob(base64)
  const arr = new Uint8Array(bytes.length)
  for (let i = 0; i < bytes.length; i++) arr[i] = bytes.charCodeAt(i)
  return new Blob([arr], { type: mime })
}

/** 도장 이미지를 Storage에 업로드 → public URL */
export async function uploadSealImage(
  ownerType: SealOwnerType,
  ownerId: string,
  imageDataOrFile: string | File
): Promise<{ url: string; error: string | null }> {
  const supabase = createBrowserSupabaseClient()
  const ts = Date.now()
  const path = `${ownerType}/${ownerId}/seal_${ts}.png`

  const blob = typeof imageDataOrFile === 'string'
    ? dataURItoBlob(imageDataOrFile)
    : imageDataOrFile

  const { error } = await supabase.storage.from(SEAL_BUCKET).upload(path, blob, {
    contentType: 'image/png',
    upsert: true,
  })

  if (error) return { url: '', error: error.message }
  const { data: u } = supabase.storage.from(SEAL_BUCKET).getPublicUrl(path)
  return { url: u.publicUrl, error: null }
}

/* ══════════════════════ DB CRUD — seals ══════════════════════ */

export async function saveSealRecord(
  record: Omit<SealRecord, 'id' | 'created_at'>
): Promise<{ data: SealRecord | null; error: string | null }> {
  const supabase = createBrowserSupabaseClient()

  if (record.is_default) {
    await supabase
      .from('seals')
      .update({ is_default: false })
      .eq('owner_type', record.owner_type)
      .eq('owner_id', record.owner_id)
  }

  const { data, error } = await supabase
    .from('seals')
    .insert({
      owner_type: record.owner_type,
      owner_id: record.owner_id,
      category: record.category,
      script: record.script,
      seal_image_url: record.seal_image_url,
      seal_data_uri: record.seal_data_uri,
      name_text: record.name_text,
      is_default: record.is_default,
    })
    .select()
    .single()

  if (error) return { data: null, error: error.message }
  return { data: data as SealRecord, error: null }
}

export async function getSeals(
  ownerType: SealOwnerType,
  ownerId: string,
): Promise<SealRecord[]> {
  const supabase = createBrowserSupabaseClient()
  const { data } = await supabase
    .from('seals')
    .select('*')
    .eq('owner_type', ownerType)
    .eq('owner_id', ownerId)
    .order('created_at', { ascending: false })
  return (data ?? []) as SealRecord[]
}

export async function deleteSeal(sealId: string): Promise<{ error: string | null }> {
  const supabase = createBrowserSupabaseClient()
  const { error } = await supabase.from('seals').delete().eq('id', sealId)
  return { error: error?.message ?? null }
}

export async function setDefaultSeal(
  sealId: string,
  ownerType: SealOwnerType,
  ownerId: string,
): Promise<{ error: string | null }> {
  const supabase = createBrowserSupabaseClient()
  // 기존 default 해제
  await supabase
    .from('seals')
    .update({ is_default: false })
    .eq('owner_type', ownerType)
    .eq('owner_id', ownerId)
  // 새 default 설정
  const { error } = await supabase
    .from('seals')
    .update({ is_default: true })
    .eq('id', sealId)
  return { error: error?.message ?? null }
}

/* ══════════════════════ 문서파일 관리 (설정 페이지용) ══════════════════════ */

export interface DocumentFile {
  id: string
  agency_id: string
  title: string
  file_url: string
  file_type: string
  file_size: number | null
  status: string
  created_at: string | null
}

/** 대리점의 문서파일 목록 조회 */
export async function getDocumentFiles(agencyId: string): Promise<DocumentFile[]> {
  const supabase = createBrowserSupabaseClient()
  const { data } = await supabase
    .from('document_files')
    .select('*')
    .eq('agency_id', agencyId)
    .order('created_at', { ascending: false })
  return (data ?? []) as DocumentFile[]
}

/** 문서파일 스토리지 업로드 */
export async function uploadDocumentFile(
  agencyId: string,
  file: File
): Promise<{ url: string | null; error: string | null }> {
  const supabase = createBrowserSupabaseClient()
  const path = `documents/${agencyId}/${Date.now()}_${file.name}`
  const { error } = await supabase.storage.from('documents').upload(path, file)
  if (error) return { url: null, error: error.message }
  const { data: urlData } = supabase.storage.from('documents').getPublicUrl(path)
  return { url: urlData.publicUrl, error: null }
}

/** 문서파일 레코드 저장 */
export async function saveDocumentFile(input: {
  agency_id: string
  title: string
  file_url: string
  file_type: string
  file_size: number
  status: string
}): Promise<{ error: string | null }> {
  const supabase = createBrowserSupabaseClient()
  const { error } = await supabase.from('document_files').insert(input)
  return { error: error?.message ?? null }
}