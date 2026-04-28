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
  hanjaOverride?: string       // 담당자가 직접 선택한 한자 (우선 사용)
  showDot?: boolean            // 개인도장 글자 사이 점(·) 표시 (기본: true)
  fontSizeScale?: number       // 글씨 크기 배율 (0.5~1.5, 기본 1.0)
  letterSpacingScale?: number  // 글자 간격 배율 (0.5~1.5, 기본 1.0)
  selectedFontIdx?: number     // 선택한 폰트 인덱스 (단일 폰트 모드)
}

/* ══════════════════════ Font Loading ══════════════════════ */

/* ── 폰트 URL: Google Fonts (도장 적합 3종) ── */
const GOOGLE_FONTS_URL =
  'https://fonts.googleapis.com/css2?' +
  'family=Noto+Serif+KR:wght@700;900' +
  '&family=Nanum+Myeongjo:wght@700;800' +
  '&family=Hahmlet:wght@700;900' +
  '&family=Nanum+Brush+Script' +
  '&family=Gothic+A1:wght@700;900' +
  '&display=swap'

/* ── 눈누 CDN: 도장 전용 지자체 무료 폰트 6종 ── */
const NOONNU_FONT_URLS = [
  'https://cdn.jsdelivr.net/gh/projectnoonnu/noonfonts_one@1.0/YiSunShinBoldB.woff',      // 이순신체 Bold
  'https://cdn.jsdelivr.net/gh/projectnoonnu/noonfonts_2105@1.0/WandohopeB.woff',          // 완도희망체 Bold
  'https://cdn.jsdelivr.net/gh/projectnoonnu/noonfonts_2105@1.0/JeongseonArGothicB.woff',  // 정선아리랑 고담 Bold
  'https://cdn.jsdelivr.net/gh/projectnoonnu/noonfonts_2312-1@1.0/SuseongBatang.woff2',    // 수성바탕체
  'https://cdn.jsdelivr.net/gh/projectnoonnu/noonfonts_2312-1@1.0/SuseongHyejeong.woff2',  // 수성혜정체
  'https://cdn.jsdelivr.net/gh/projectnoonnu/noonfonts_2001@1.0/GangwonEdu_OTFBoldA.woff', // 강원교육체 Bold
]

const NOONNU_FONT_FACES = `
@font-face { font-family: 'YiSunShinBold'; src: url('${NOONNU_FONT_URLS[0]}') format('woff'); font-weight: 700; font-display: swap; }
@font-face { font-family: 'WandohopeB'; src: url('${NOONNU_FONT_URLS[1]}') format('woff'); font-weight: 700; font-display: swap; }
@font-face { font-family: 'JeongseonArGothicB'; src: url('${NOONNU_FONT_URLS[2]}') format('woff'); font-weight: 700; font-display: swap; }
@font-face { font-family: 'SuseongBatang'; src: url('${NOONNU_FONT_URLS[3]}') format('woff2'); font-weight: 400; font-display: swap; }
@font-face { font-family: 'SuseongHyejeong'; src: url('${NOONNU_FONT_URLS[4]}') format('woff2'); font-weight: 400; font-display: swap; }
@font-face { font-family: 'GangwonEduBold'; src: url('${NOONNU_FONT_URLS[5]}') format('woff'); font-weight: 700; font-display: swap; }
@font-face { font-family: 'HJJeonseoA'; src: url('/fonts/HJ한전서A.ttf') format('truetype'); font-weight: 400; font-display: swap; }
@font-face { font-family: 'HJJeonseoB'; src: url('/fonts/HJ한전서B.ttf') format('truetype'); font-weight: 400; font-display: swap; }
`

let _fontsLoaded = false

/** Google Fonts + 눈누 CDN 폰트를 head에 삽입 (한 번만) */
export function ensureSealFontsLoaded(): void {
  if (_fontsLoaded || typeof document === 'undefined') return
  _fontsLoaded = true
  // Google Fonts
  const link = document.createElement('link')
  link.rel = 'stylesheet'
  link.href = GOOGLE_FONTS_URL
  document.head.appendChild(link)
  // 눈누 CDN @font-face
  const style = document.createElement('style')
  style.textContent = NOONNU_FONT_FACES
  document.head.appendChild(style)
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
const _SEAL_COLOR_LIGHT = '#D94444'
const SEAL_COLOR_DARK = '#9A1F1F'

/* ══════════════════════ 한글 → 한자 변환 ══════════════════════ */

/**
 * 한글 음절 → 대표 한자 매핑 (성씨 + 일반 이름자 포함)
 * 동음이의어가 많으므로 가장 보편적인 한자를 기본값으로 사용.
 * 담당자가 직접 선택할 수 있도록 다중 후보도 제공.
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
  // ── 천자문 + 인명용 확충 (195자 추가) ──
  '각': ['角', '覺', '閣', '刻'], '간': ['間', '干', '看', '簡', '諫'], '갈': ['葛', '渴', '褐'],
  '감': ['感', '甘', '鑑', '減', '監', '敢', '紺'], '갑': ['甲', '岬'], '개': ['開', '改', '介', '蓋', '凱', '慨'],
  '객': ['客'], '거': ['居', '去', '擧', '巨', '拒', '據'], '걸': ['傑', '乞'],
  '검': ['劍', '儉', '檢'], '겸': ['兼', '謙', '謙'], '계': ['界', '計', '季', '桂', '溪', '係', '繫', '啓', '戒'],
  '곡': ['曲', '穀', '谷', '哭'], '곤': ['坤', '困', '昆'], '골': ['骨'],
  '공': ['工', '功', '公', '共', '空', '恭', '貢', '攻'], '과': ['果', '科', '課', '過', '瓜'],
  '관': ['觀', '官', '管', '關', '冠', '慣', '貫', '館'], '괘': ['卦'],
  '군': ['君', '軍', '郡', '群'], '굴': ['窟', '屈', '掘'], '궁': ['宮', '弓', '窮', '躬'],
  '궐': ['闕', '蕨'], '귀': ['貴', '鬼', '龜', '歸'], '규': ['規', '奎', '圭', '揆', '葵'],
  '균': ['均', '菌', '鈞'], '극': ['極', '克', '劇', '隙'],
  '급': ['急', '及', '給', '級'], '긍': ['肯', '矜'], '긴': ['緊'], '길': ['吉'],
  '낙': ['落', '洛', '樂', '諾'], '난': ['難', '蘭', '亂', '暖'], '납': ['納', '蠟'],
  '낭': ['郎', '浪', '娘', '廊'], '내': ['內', '乃', '耐', '奈'],
  '녀': ['女'], '년': ['年'], '념': ['念', '捻'], '녕': ['寧'],
  '논': ['論'], '농': ['農', '濃', '弄'], '뇌': ['腦', '雷'], '능': ['能', '陵', '綾'],
  '니': ['尼', '泥'], '담': ['淡', '痰', '膽', '談', '擔'], '답': ['答', '踏'],
  '당': ['堂', '唐', '黨', '糖', '當'], '독': ['獨', '毒', '讀', '督'], '돈': ['敦', '頓', '豚'],
  '돌': ['突', '乭'], '둔': ['鈍', '屯', '遁'], '득': ['得', '德'], '등': ['等', '登', '燈', '藤', '騰'],
  '락': ['落', '洛', '樂'], '란': ['蘭', '亂', '卵', '欄'], '랄': ['辣'],
  '람': ['覽', '藍', '嵐'], '랑': ['郎', '浪', '朗', '廊'],
  '략': ['略', '掠'], '려': ['麗', '慮', '勵', '旅'], '력': ['力', '歷', '曆', '瀝'],
  '렬': ['烈', '列'], '렴': ['廉', '簾', '斂'], '렵': ['獵'], '례': ['禮', '例', '隷'],
  '롱': ['弄', '籠', '聾'], '뢰': ['雷', '賴', '瀨', '磊'], '료': ['料', '了', '療', '僚', '寮'],
  '룡': ['龍'], '륙': ['六', '陸'], '률': ['律', '率', '栗'], '륭': ['隆'],
  '름': ['凜'], '릉': ['陵', '凌', '綾'],
  '림': ['林', '臨', '霖'], '립': ['立', '笠'],
  '막': ['幕', '膜', '漠', '莫'], '말': ['末', '抹'], '망': ['望', '忘', '亡', '妄', '茫', '網'],
  '맥': ['麥', '脈'], '멸': ['滅'], '몰': ['沒', '歿'], '묘': ['妙', '廟', '墓', '描', '苗'],
  '묵': ['墨', '默', '黙'], '물': ['物', '勿'], '밀': ['密', '蜜'],
  '발': ['發', '拔', '髮'], '번': ['番', '繁', '煩', '樊'], '벌': ['伐', '罰', '蜂'],
  '법': ['法', '凡'], '벽': ['壁', '碧', '璧', '闢'], '별': ['別', '星'],
  '북': ['北'], '분': ['分', '奮', '粉', '盆', '噴', '憤'], '불': ['佛', '不', '弗'],
  '비': ['飛', '悲', '秘', '碑', '批', '比', '妃', '費', '非'], '빙': ['氷', '冰', '憑'],
  '삭': ['朔', '削'], '살': ['殺'], '삼': ['三', '參', '森', '杉'],
  '섬': ['島', '纖', '閃', '蟾'], '술': ['術', '述'], '숭': ['崇', '嵩'],
  '습': ['習', '濕', '拾', '襲'], '실': ['室', '實', '失'], '십': ['十', '拾'],
  '쌍': ['雙'],
  '알': ['謁', '斡'], '암': ['岩', '暗', '癌', '庵'], '압': ['壓', '鴨'],
  '앙': ['央', '昂', '仰', '殃'], '액': ['額', '液', '厄'], '약': ['約', '若', '弱', '藥', '躍'],
  '어': ['語', '魚', '御', '漁', '於'], '억': ['億', '憶', '抑'], '언': ['言', '彦', '堰'],
  '업': ['業'], '역': ['役', '域', '驛', '易', '逆', '譯'], '온': ['溫', '穩'],
  '옹': ['翁', '擁', '甕'], '와': ['瓦', '臥', '渦'], '외': ['外', '畏'],
  '욕': ['欲', '浴', '辱'], '울': ['鬱', '蔚'], '육': ['六', '育', '肉'],
  '읍': ['邑', '泣'], '익': ['益', '翼', '溢'], '입': ['入', '笠'],
  '작': ['作', '爵', '昨', '雀'], '잔': ['殘', '盞'], '잠': ['潛', '暫', '蠶'],
  '절': ['節', '絶', '折', '切'], '점': ['點', '占', '店', '漸'],
  '족': ['族', '足', '卒'], '존': ['存', '尊'], '죽': ['竹', '粥'],
  '즉': ['卽', '則'], '직': ['直', '職', '織'], '질': ['質', '秩'],
  '집': ['集', '執', '輯'], '징': ['徵', '懲'],
  '착': ['着', '錯'], '참': ['參', '慘', '慚', '斬'], '책': ['策', '冊', '責'],
  '처': ['處', '妻', '凄'], '첨': ['添', '尖', '沾', '瞻'], '체': ['體', '替', '滯'],
  '촉': ['促', '燭', '囑', '觸'], '총': ['總', '聰', '銃', '寵'],
  '축': ['祝', '築', '畜', '蓄', '縮'], '춘': ['春', '椿'], '출': ['出', '黜'],
  '취': ['取', '就', '醉', '吹', '趣'], '측': ['側', '測', '則'], '층': ['層'],
  '칙': ['則', '勅'], '친': ['親'], '칠': ['七', '漆'], '침': ['枕', '沈', '侵', '針', '寢'],
  '탄': ['炭', '彈', '嘆', '坦', '誕'], '탈': ['脫', '奪'], '탐': ['探', '貪', '耽'],
  '탕': ['湯', '蕩'], '토': ['土', '吐', '兎', '討'], '통': ['通', '統', '桶', '痛'],
  '퇴': ['退', '頹'], '투': ['投', '鬪', '透'],
  '파': ['波', '派', '破', '坡', '播'], '팔': ['八'], '패': ['敗', '牌', '貝'],
  '폐': ['廢', '肺', '弊', '閉', '幣'], '포': ['布', '浦', '包', '砲', '泡', '抱', '匍'],
  '폭': ['暴', '幅', '爆'], '피': ['皮', '彼', '被', '避', '疲'],
  '할': ['割'], '합': ['合', '閤', '陜'], '항': ['恒', '港', '航', '項', '抗', '降'],
  '핵': ['核'], '행': ['行', '幸', '杏', '衡'], '험': ['險', '驗', '儉'],
  '혈': ['血', '穴'], '혹': ['或', '惑', '酷'], '혼': ['婚', '混', '魂', '昏'],
  '홀': ['忽', '笏'], '확': ['確', '擴'], '활': ['活', '闊', '滑'],
  '획': ['劃', '畫', '獲'], '횡': ['橫', '宏'], '후': ['后', '厚', '侯', '候', '後'],
  '훼': ['毁', '燬'], '흉': ['凶', '胸', '兇'], '흑': ['黑'],
  '흠': ['欽', '欠'], '흡': ['吸', '恰'],
}

/**
 * 千字文 (천자문) — 周興嗣(주흥사) 撰, 6세기 중국 양나라.
 * 250 사구(四句) × 4字 = 1000자. 전통적으로 한자 입문 교본이자 인감·서예의 기준 자전.
 * 본 코퍼스는 표준 한국 한문 교육판 기준이며 모든 글자가 단 한 번만 등장하는 것이
 * 원칙(주흥사가 의도한 형식). 일부 판본 차이로 異체字가 존재할 수 있으나 Set 으로
 * 중복은 자동 처리된다.
 */
const THOUSAND_CHARACTER_CLASSIC = `
天地玄黃 宇宙洪荒 日月盈昃 辰宿列張
寒來暑往 秋收冬藏 閏餘成歲 律呂調陽
雲騰致雨 露結爲霜 金生麗水 玉出崑岡
劍號巨闕 珠稱夜光 果珍李柰 菜重芥薑
海鹹河淡 鱗潛羽翔 龍師火帝 鳥官人皇
始制文字 乃服衣裳 推位讓國 有虞陶唐
弔民伐罪 周發殷湯 坐朝問道 垂拱平章
愛育黎首 臣伏戎羌 遐邇壹體 率賓歸王
鳴鳳在樹 白駒食場 化被草木 賴及萬方
蓋此身髮 四大五常 恭惟鞠養 豈敢毀傷
女慕貞烈 男效才良 知過必改 得能莫忘
罔談彼短 靡恃己長 信使可覆 器欲難量
墨悲絲染 詩讚羔羊 景行維賢 克念作聖
德建名立 形端表正 空谷傳聲 虛堂習聽
禍因惡積 福緣善慶 尺璧非寶 寸陰是競
資父事君 曰嚴與敬 孝當竭力 忠則盡命
臨深履薄 夙興溫凊 似蘭斯馨 如松之盛
川流不息 淵澄取映 容止若思 言辭安定
篤初誠美 慎終宜令 榮業所基 籍甚無竟
學優登仕 攝職從政 存以甘棠 去而益詠
樂殊貴賤 禮別尊卑 上和下睦 夫唱婦隨
外受傅訓 入奉母儀 諸姑伯叔 猶子比兒
孔懷兄弟 同氣連枝 交友投分 切磨箴規
仁慈隱惻 造次弗離 節義廉退 顛沛匪虧
性靜情逸 心動神疲 守眞志滿 逐物意移
堅持雅操 好爵自縻 都邑華夏 東西二京
背邙面洛 浮渭據涇 宮殿盤鬱 樓觀飛驚
圖寫禽獸 畫綵仙靈 丙舍傍啓 甲帳對楹
肆筵設席 鼓瑟吹笙 升階納陛 弁轉疑星
右通廣內 左達承明 旣集墳典 亦聚群英
杜藁鍾隸 漆書壁經 府羅將相 路俠槐卿
戶封八縣 家給千兵 高冠陪輦 驅轂振纓
世祿侈富 車駕肥輕 策功茂實 勒碑刻銘
磻溪伊尹 佐時阿衡 奄宅曲阜 微旦孰營
桓公匡合 濟弱扶傾 綺迴漢惠 說感武丁
俊乂密勿 多士寔寧 晋楚更覇 趙魏困橫
假途滅虢 踐土會盟 何遵約法 韓弊煩刑
起翦頗牧 用軍最精 宣威沙漠 馳譽丹靑
九州禹跡 百郡秦幷 嶽宗恆岱 禪主云亭
雁門紫塞 鷄田赤城 昆池碣石 鉅野洞庭
曠遠綿邈 巖岫杳冥 治本於農 務玆稼穡
俶載南畝 我藝黍稷 稅熟貢新 勸賞黜陟
孟軻敦素 史魚秉直 庶幾中庸 勞謙謹勅
聆音察理 鑑貌辨色 貽厥嘉猷 勉其祗植
省躬譏誡 寵增抗極 殆辱近恥 林皋幸卽
兩疏見機 解組誰逼 索居閑處 沈默寂寥
求古尋論 散慮逍遙 欣奏累遣 慼謝歡招
渠荷的歷 園莽抽條 枇杷晩翠 梧桐早凋
陳根委翳 落葉飄颻 遊鵾獨運 凌摩絳霄
耽讀翫市 寓目囊箱 易輶攸畏 屬耳垣牆
具膳飡飯 適口充腸 飽飫烹宰 飢厭糟糠
親戚故舊 老少異糧 妾御績紡 侍巾帷房
紈扇圓潔 銀燭煒煌 晝眠夕寐 藍筍象牀
弦歌酒讌 接杯擧觴 矯手頓足 悅豫且康
嫡後嗣續 祭祀蒸嘗 稽顙再拜 悚懼恐惶
牋牒簡要 顧答審詳 骸垢想浴 執熱願凉
驢騾犢特 駭躍超驤 誅斬賊盜 捕獲叛亡
布射僚丸 嵇琴阮嘯 恬筆倫紙 鈞巧任釣
釋紛利俗 並皆佳妙 毛施淑姿 工嚬妍笑
年矢每催 曦暉朗曜 璇璣懸斡 晦魄環照
指薪修祜 永綏吉劭 矩步引領 俯仰廊廟
束帶矜莊 徘徊瞻眺 孤陋寡聞 愚蒙等誚
謂語助者 焉哉乎也
`

/** 千字文 한자 Set — O(1) 포함 여부 조회용 */
const THOUSAND_CHARACTER_SET: ReadonlySet<string> = new Set(
  THOUSAND_CHARACTER_CLASSIC.replace(/\s+/g, '').split(''),
)

/**
 * 千字文 1000자의 한국 한자음 매핑.
 * 형식: '한자:음[,음2]' (공백 구분, 두음법칙 변이는 콤마로 추가).
 * 예: '李:리,이' → 李 의 음은 '리' 이지만 두음법칙으로 '이' 도 동일 글자.
 *
 * 이 매핑이 있어야 한국어 입력(예: '천')에 대해 千字文에 있는 한자(天/川/千/賤/踐/凄)
 * 를 候補로 제시할 수 있다. 기존 인명용 HANGUL_TO_HANJA 후보가 부족한 케이스를 보강.
 */
const THOUSAND_KOREAN_RAW = `
天:천 地:지 玄:현 黃:황 宇:우 宙:주 洪:홍 荒:황
日:일 月:월 盈:영 昃:측 辰:진 宿:숙,수 列:렬,열 張:장
寒:한 來:래,내 暑:서 往:왕 秋:추 收:수 冬:동 藏:장
閏:윤 餘:여 成:성 歲:세 律:률,율 呂:려,여 調:조 陽:양
雲:운 騰:등 致:치 雨:우 露:로,노 結:결 爲:위 霜:상
金:금,김 生:생 麗:려,여 水:수 玉:옥 出:출 崑:곤 岡:강
劍:검 號:호 巨:거 闕:궐 珠:주 稱:칭 夜:야 光:광
果:과 珍:진 李:리,이 柰:내 菜:채 重:중 芥:개 薑:강
海:해 鹹:함 河:하 淡:담 鱗:린,인 潛:잠 羽:우 翔:상
龍:룡,용 師:사 火:화 帝:제 鳥:조 官:관 人:인 皇:황
始:시 制:제 文:문 字:자 乃:내 服:복 衣:의 裳:상
推:추 位:위 讓:양 國:국 有:유 虞:우 陶:도 唐:당
弔:조 民:민 伐:벌 罪:죄 周:주 發:발 殷:은 湯:탕
坐:좌 朝:조 問:문 道:도 垂:수 拱:공 平:평 章:장
愛:애 育:육 黎:려,여 首:수 臣:신 伏:복 戎:융 羌:강
遐:하 邇:이 壹:일 體:체 率:솔,률,율 賓:빈 歸:귀 王:왕
鳴:명 鳳:봉 在:재 樹:수 白:백 駒:구 食:식 場:장
化:화 被:피 草:초 木:목 賴:뢰,뇌 及:급 萬:만 方:방
蓋:개 此:차 身:신 髮:발 四:사 大:대 五:오 常:상
恭:공 惟:유 鞠:국 養:양 豈:기 敢:감 毀:훼 傷:상
女:녀,여 慕:모 貞:정 烈:렬,열 男:남 效:효 才:재 良:량,양
知:지 過:과 必:필 改:개 得:득 能:능 莫:막 忘:망
罔:망 談:담 彼:피 短:단 靡:미 恃:시 己:기 長:장
信:신 使:사 可:가 覆:복 器:기 欲:욕 難:난 量:량,양
墨:묵 悲:비 絲:사 染:염 詩:시 讚:찬 羔:고 羊:양
景:경 行:행 維:유 賢:현 克:극 念:념,염 作:작 聖:성
德:덕 建:건 名:명 立:립,입 形:형 端:단 表:표 正:정
空:공 谷:곡 傳:전 聲:성 虛:허 堂:당 習:습 聽:청
禍:화 因:인 惡:악 積:적 福:복 緣:연 善:선 慶:경
尺:척 璧:벽 非:비 寶:보 寸:촌 陰:음 是:시 競:경
資:자 父:부 事:사 君:군 曰:왈 嚴:엄 與:여 敬:경
孝:효 當:당 竭:갈 力:력,역 忠:충 則:즉,칙 盡:진 命:명
臨:림,임 深:심 履:리,이 薄:박 夙:숙 興:흥 溫:온 凊:청
似:사 蘭:란,난 斯:사 馨:형 如:여 松:송 之:지 盛:성
川:천 流:류,유 不:불,부 息:식 淵:연 澄:징 取:취 映:영
容:용 止:지 若:약 思:사 言:언 辭:사 安:안 定:정
篤:독 初:초 誠:성 美:미 慎:신 終:종 宜:의 令:령,영
榮:영 業:업 所:소 基:기 籍:적 甚:심 無:무 竟:경
學:학 優:우 登:등 仕:사 攝:섭 職:직 從:종 政:정
存:존 以:이 甘:감 棠:당 去:거 而:이 益:익 詠:영
樂:락,낙,악 殊:수 貴:귀 賤:천 禮:례,예 別:별 尊:존 卑:비
上:상 和:화 下:하 睦:목 夫:부 唱:창 婦:부 隨:수
外:외 受:수 傅:부 訓:훈 入:입 奉:봉 母:모 儀:의
諸:제 姑:고 伯:백 叔:숙 猶:유 子:자 比:비 兒:아
孔:공 懷:회 兄:형 弟:제 同:동 氣:기 連:련,연 枝:지
交:교 友:우 投:투 分:분 切:절 磨:마 箴:잠 規:규
仁:인 慈:자 隱:은 惻:측 造:조 次:차 弗:불 離:리,이
節:절 義:의 廉:렴,염 退:퇴 顛:전 沛:패 匪:비 虧:휴
性:성 靜:정 情:정 逸:일 心:심 動:동 神:신 疲:피
守:수 眞:진 志:지 滿:만 逐:축 物:물 意:의 移:이
堅:견 持:지 雅:아 操:조 好:호 爵:작 自:자 縻:미
都:도 邑:읍 華:화 夏:하 東:동 西:서 二:이 京:경
背:배 邙:망 面:면 洛:락,낙 浮:부 渭:위 據:거 涇:경
宮:궁 殿:전 盤:반 鬱:울 樓:루,누 觀:관 飛:비 驚:경
圖:도 寫:사 禽:금 獸:수 畫:화 綵:채 仙:선 靈:령,영
丙:병 舍:사 傍:방 啓:계 甲:갑 帳:장 對:대 楹:영
肆:사 筵:연 設:설 席:석 鼓:고 瑟:슬 吹:취 笙:생
升:승 階:계 納:납 陛:폐 弁:변 轉:전 疑:의 星:성
右:우 通:통 廣:광 內:내 左:좌 達:달 承:승 明:명
旣:기 集:집 墳:분 典:전 亦:역 聚:취 群:군 英:영
杜:두 藁:고 鍾:종 隸:례,예 漆:칠 書:서 壁:벽 經:경
府:부 羅:라 將:장 相:상 路:로,노 俠:협 槐:괴 卿:경
戶:호 封:봉 八:팔 縣:현 家:가 給:급 千:천 兵:병
高:고 冠:관 陪:배 輦:련,연 驅:구 轂:곡 振:진 纓:영
世:세 祿:록,녹 侈:치 富:부 車:차,거 駕:가 肥:비 輕:경
策:책 功:공 茂:무 實:실 勒:륵,늑 碑:비 刻:각 銘:명
磻:반 溪:계 伊:이 尹:윤 佐:좌 時:시 阿:아 衡:형
奄:엄 宅:택 曲:곡 阜:부 微:미 旦:단 孰:숙 營:영
桓:환 公:공 匡:광 合:합 濟:제 弱:약 扶:부 傾:경
綺:기 迴:회 漢:한 惠:혜 說:설,세 感:감 武:무 丁:정
俊:준 乂:예 密:밀 勿:물 多:다 士:사 寔:식 寧:녕,영
晋:진 楚:초 更:경 覇:패 趙:조 魏:위 困:곤 橫:횡
假:가 途:도 滅:멸 虢:괵 踐:천 土:토 會:회 盟:맹
何:하 遵:준 約:약 法:법 韓:한 弊:폐 煩:번 刑:형
起:기 翦:전 頗:파 牧:목 用:용 軍:군 最:최 精:정
宣:선 威:위 沙:사 漠:막 馳:치 譽:예 丹:단 靑:청
九:구 州:주 禹:우 跡:적 百:백 郡:군 秦:진 幷:병
嶽:악 宗:종 恆:항 岱:대 禪:선 主:주 云:운 亭:정
雁:안 門:문 紫:자 塞:새 鷄:계 田:전 赤:적 城:성
昆:곤 池:지 碣:갈 石:석 鉅:거 野:야 洞:동 庭:정
曠:광 遠:원 綿:면 邈:막 巖:암 岫:수 杳:묘 冥:명
治:치 本:본 於:어 農:농 務:무 玆:자 稼:가 穡:색
俶:숙 載:재 南:남 畝:묘 我:아 藝:예 黍:서 稷:직
稅:세 熟:숙 貢:공 新:신 勸:권 賞:상 黜:출 陟:척
孟:맹 軻:가 敦:돈 素:소 史:사 魚:어 秉:병 直:직
庶:서 幾:기 中:중 庸:용 勞:로,노 謙:겸 謹:근 勅:칙
聆:령,영 音:음 察:찰 理:리,이 鑑:감 貌:모 辨:변 色:색
貽:이 厥:궐 嘉:가 猷:유 勉:면 其:기 祗:지 植:식
省:성 躬:궁 譏:기 誡:계 寵:총 增:증 抗:항 極:극
殆:태 辱:욕 近:근 恥:치 林:림,임 皋:고 幸:행 卽:즉
兩:량,양 疏:소 見:견,현 機:기 解:해 組:조 誰:수 逼:핍
索:색 居:거 閑:한 處:처 沈:침 默:묵 寂:적 寥:료,요
求:구 古:고 尋:심 論:론,논 散:산 慮:려,여 逍:소 遙:요
欣:흔 奏:주 累:루,누 遣:견 慼:척 謝:사 歡:환 招:초
渠:거 荷:하 的:적 歷:력,역 園:원 莽:망 抽:추 條:조
枇:비 杷:파 晩:만 翠:취 梧:오 桐:동 早:조 凋:조
陳:진 根:근 委:위 翳:예 落:락,낙 葉:엽 飄:표 颻:요
遊:유 鵾:곤 獨:독 運:운 凌:릉,능 摩:마 絳:강 霄:소
耽:탐 讀:독 翫:완 市:시 寓:우 目:목 囊:낭 箱:상
易:역,이 輶:유 攸:유 畏:외 屬:속 耳:이 垣:원 牆:장
具:구 膳:선 飡:손,찬 飯:반 適:적 口:구 充:충 腸:장
飽:포 飫:어 烹:팽 宰:재 飢:기 厭:염 糟:조 糠:강
親:친 戚:척 故:고 舊:구 老:로,노 少:소 異:이 糧:량,양
妾:첩 御:어 績:적 紡:방 侍:시 巾:건 帷:유 房:방
紈:환 扇:선 圓:원 潔:결 銀:은 燭:촉 煒:위 煌:황
晝:주 眠:면 夕:석 寐:매 藍:람,남 筍:순 象:상 牀:상
弦:현 歌:가 酒:주 讌:연 接:접 杯:배 擧:거 觴:상
矯:교 手:수 頓:돈 足:족 悅:열 豫:예 且:차 康:강
嫡:적 後:후 嗣:사 續:속 祭:제 祀:사 蒸:증 嘗:상
稽:계 顙:상 再:재 拜:배 悚:송 懼:구 恐:공 惶:황
牋:전 牒:첩 簡:간 要:요 顧:고 答:답 審:심 詳:상
骸:해 垢:구 想:상 浴:욕 執:집 熱:열 願:원 凉:량,양
驢:려,여 騾:라 犢:독 特:특 駭:해 躍:약 超:초 驤:양
誅:주 斬:참 賊:적 盜:도 捕:포 獲:획 叛:반 亡:망
布:포 射:사 僚:료,요 丸:환 嵇:혜 琴:금 阮:완 嘯:소
恬:념,염 筆:필 倫:륜,윤 紙:지 鈞:균 巧:교 任:임 釣:조
釋:석 紛:분 利:리,이 俗:속 並:병 皆:개 佳:가 妙:묘
毛:모 施:시 淑:숙 姿:자 工:공 嚬:빈 妍:연 笑:소
年:년,연 矢:시 每:매 催:최 曦:희 暉:휘 朗:랑,낭 曜:요
璇:선 璣:기 懸:현 斡:알 晦:회 魄:백 環:환 照:조
指:지 薪:신 修:수 祜:호 永:영 綏:수 吉:길 劭:소
矩:구 步:보 引:인 領:령,영 俯:부 仰:앙 廊:랑,낭 廟:묘
束:속 帶:대 矜:긍 莊:장 徘:배 徊:회 瞻:첨 眺:조
孤:고 陋:루,누 寡:과 聞:문 愚:우 蒙:몽 等:등 誚:초
謂:위 語:어 助:조 者:자 焉:언 哉:재 乎:호 也:야
`

/** 한국 한자음 → 千字文 한자[] 역매핑 (런타임 파싱) */
const THOUSAND_CHAR_BY_READING: Record<string, string[]> = (() => {
  const map: Record<string, string[]> = {}
  for (const token of THOUSAND_KOREAN_RAW.split(/\s+/)) {
    if (!token.includes(':')) continue
    const [char, readingStr] = token.split(':')
    if (!char || !readingStr) continue
    for (const r of readingStr.split(',')) {
      const reading = r.trim()
      if (!reading) continue
      if (!map[reading]) map[reading] = []
      if (!map[reading].includes(char)) map[reading].push(char)
    }
  }
  return map
})()

/** 한국어 한 글자에 대응되는 千字文 한자 후보 목록 */
export function getThousandCharCandidates(koreanChar: string): string[] {
  return THOUSAND_CHAR_BY_READING[koreanChar] ?? []
}

/** 글자가 千字文 본문에 등장하는지 확인 */
export function isInThousandCharacterClassic(char: string): boolean {
  return THOUSAND_CHARACTER_SET.has(char)
}

/** 千字文 코퍼스 크기 — 디버깅/UI용 (정상 1000자, 판본별 999~1000) */
export function getThousandCharacterCount(): number {
  return THOUSAND_CHARACTER_SET.size
}

export interface HanjaConversionOptions {
  /** 千字文 본문에 등장하는 한자를 우선 선택 (천자문 모드) */
  preferThousandChar?: boolean
}

/**
 * 한글 이름 → 한자 변환.
 * preferThousandChar=true 면 千字文 1000자 매핑(THOUSAND_CHAR_BY_READING)에서
 * 먼저 찾고, 없으면 후보 중 천자문 등장 글자, 그것도 없으면 일반 사전 1순위.
 * @returns 변환된 한자 문자열. 매핑이 없으면 원래 한글 유지.
 */
export function hangulToHanja(name: string, options?: HanjaConversionOptions): string {
  const prefer = options?.preferThousandChar ?? false
  return name.split('').map((ch) => {
    if (prefer) {
      // 1순위: 千字文 음역 매핑에서 직접 찾기 (千字文 한자가 인명 사전에 없는 케이스 보강)
      const thousandCands = THOUSAND_CHAR_BY_READING[ch]
      if (thousandCands && thousandCands.length > 0) return thousandCands[0]
      // 2순위: 인명 사전 후보 중 千字文에 등장하는 글자
      const candidates = HANGUL_TO_HANJA[ch]
      if (candidates && candidates.length > 0) {
        const inClassic = candidates.find((c) => THOUSAND_CHARACTER_SET.has(c))
        if (inClassic) return inClassic
        return candidates[0]
      }
      return ch
    }
    const candidates = HANGUL_TO_HANJA[ch]
    return candidates && candidates.length > 0 ? candidates[0] : ch
  }).join('')
}

/**
 * 한글 글자 → 한자 후보 목록.
 * preferThousandChar=true 면 千字文 매핑 + 인명 사전 합집합을 千字文 글자 우선으로 정렬.
 */
export function getHanjaCandidates(char: string, options?: HanjaConversionOptions): string[] {
  const baseCandidates = HANGUL_TO_HANJA[char] ?? []
  if (!options?.preferThousandChar) return baseCandidates

  // 千字文 매핑에서 가져온 글자들을 앞에, 그 다음 인명 사전 후보 (중복 제거)
  const thousandCands = THOUSAND_CHAR_BY_READING[char] ?? []
  const seen = new Set<string>()
  const result: string[] = []
  for (const c of thousandCands) {
    if (!seen.has(c)) { seen.add(c); result.push(c) }
  }
  // 인명 사전 후보 중 千字文에 있는 것 먼저
  const baseInClassic = baseCandidates.filter((c) => THOUSAND_CHARACTER_SET.has(c) && !seen.has(c))
  for (const c of baseInClassic) {
    if (!seen.has(c)) { seen.add(c); result.push(c) }
  }
  // 나머지 인명 사전 후보
  for (const c of baseCandidates) {
    if (!seen.has(c)) { seen.add(c); result.push(c) }
  }
  return result
}

/**
 * 법인도장 직함 한글 → 한자 변환 사전.
 * 일반 인명용 HANGUL_TO_HANJA는 대→大, 자→子, 사→史 같이 의미가 다르므로
 * 직함 문맥에서 자주 쓰이는 관용 한자 조합을 별도로 매핑한다.
 */
const TITLE_PHRASE_HANJA: Record<string, string> = {
  // 표준 직함
  '대표자인': '代表者印',
  '대표이사인': '代表理事印',
  '대표이사印': '代表理事印',
  '대표이사之印': '代表理事之印',
  '대표인': '代表印',
  '대표자': '代表者',
  '대표이사': '代表理事',
  '대표': '代表',
  '회장인': '會長印',
  '회장': '會長',
  '사장인': '社長印',
  '사장': '社長',
  '부사장인': '副社長印',
  '부사장': '副社長',
  '전무이사': '專務理事',
  '상무이사': '常務理事',
  '이사장인': '理事長印',
  '이사장': '理事長',
  '이사인': '理事印',
  '이사': '理事',
  '감사인': '監査印',
  '감사': '監査',
  '직원': '職員',
  '본부장': '本部長',
  '지점장': '支店長',
  '실장': '室長',
  '팀장': '팀長',
  '부장': '部長',
  '차장': '次長',
  '과장': '課長',
  '주임': '主任',
}

/**
 * 직함 문맥에서 단일 글자가 어떤 한자에 우선 매핑돼야 하는지 (인명 매핑과 다른 케이스).
 */
const TITLE_CHAR_OVERRIDE: Record<string, string> = {
  '대': '代',
  '자': '者',
  '이': '理',
  '사': '事',
  '장': '長',
  '직': '職',
  '원': '員',
  '회': '會',
  '감': '監',
  '주': '主',
  '임': '任',
  '부': '部',
  '차': '次',
  '과': '課',
  '실': '室',
  '점': '店',
  '본': '本',
  '전': '專',
  '상': '常',
  '관': '管',
  '리': '理',
  // 인은 마지막 글자 처리에서 印 으로 강제 (별도 처리)
}

/**
 * 법인도장 직함 한자 변환 — 정확한 구문 매핑 우선, 실패 시 글자별 직함-우선 한자 매핑.
 * 마지막 글자가 "인"이면 항상 印 으로 변환 (도장 의미).
 */
export function corporateTitleToHanja(title: string): string {
  if (!title) return title
  const exact = TITLE_PHRASE_HANJA[title]
  if (exact) return exact

  // 글자별 변환
  const chars = title.split('')
  const lastIdx = chars.length - 1
  return chars
    .map((ch, idx) => {
      // 마지막 글자가 "인"이면 무조건 印
      if (idx === lastIdx && ch === '인') return '印'
      // 직함 문맥 우선 매핑
      const override = TITLE_CHAR_OVERRIDE[ch]
      if (override) return override
      // 그 외엔 일반 인명 한자 1순위
      const candidates = HANGUL_TO_HANJA[ch]
      return candidates ? candidates[0] : ch
    })
    .join('')
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
/**
 * 도장 전용 폰트 — stamp.seedtype.com 스타일
 * 지자체 무료 폰트 6종 + Google Fonts 3종 = 총 9종
 */
export interface SealFont {
  family: string
  label: string
  weight: string
  /** 한자 전서체 / 인전 스타일 — 천자문 모드 자동 추천 대상 */
  hanjaPreferred?: boolean
}

export const ALL_SEAL_FONTS: SealFont[] = [
  // ── 한전서체 (전서체 — 전통 인감 전용, 한자에 가장 적합) ──
  { family: '"HJJeonseoA", "Batang", serif',          label: '한전서체A',       weight: '400', hanjaPreferred: true },
  { family: '"HJJeonseoB", "Batang", serif',          label: '한전서체B',       weight: '400', hanjaPreferred: true },
  // ── 지자체 도장 전용 폰트 (눈누 CDN, 상업용 무료) ──
  { family: '"YiSunShinBold", "Batang", serif',       label: '이순신체',        weight: '700' },
  { family: '"WandohopeB", "Batang", serif',          label: '완도희망체',      weight: '700' },
  { family: '"JeongseonArGothicB", sans-serif',       label: '정선아리랑',      weight: '700' },
  { family: '"SuseongBatang", "Batang", serif',       label: '수성바탕체',      weight: '400' },
  { family: '"SuseongHyejeong", "Batang", serif',     label: '수성혜정체',      weight: '400' },
  { family: '"GangwonEduBold", sans-serif',           label: '강원도체',        weight: '700' },
  // ── Google Fonts — 한글 인감 적합 (확장) ──
  { family: '"Noto Serif KR", "Batang", serif',       label: '해서체',          weight: '900' },
  { family: '"Nanum Myeongjo", "Batang", serif',      label: '고인체',          weight: '800', hanjaPreferred: true },
  { family: '"Nanum Brush Script", cursive',          label: '나눔손글씨',      weight: '400' },
  { family: '"Nanum Pen Script", cursive',            label: '나눔펜체',        weight: '400' },
  { family: '"Hahmlet", "Batang", serif',             label: '함렛체',          weight: '900' },
  { family: '"Gowun Batang", "Batang", serif',        label: '고운바탕(예서풍)', weight: '700', hanjaPreferred: true },
  { family: '"Black Han Sans", sans-serif',           label: '검은고딕체',      weight: '400' },
  { family: '"Gaegu", cursive',                       label: '개구체',          weight: '700' },
]

/**
 * 천자문 모드: 한자 변환과 함께 켜면 전서체 계열을 자동 선택해 전통 인감 느낌을 살린다.
 * @returns 천자문 모드 활성화 시 권장 fontIdx, 비활성화 시 null
 */
export function getThousandCharacterFontIdx(): number {
  return ALL_SEAL_FONTS.findIndex((f) => f.hanjaPreferred)
}

// 도장 모양 (인감도장은 원형이 기본, 사각도 포함)
const _SHAPES: { shape: SealShape; label: string }[] = [
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
// 위 corporateTitleToHanja 정의는 TITLE_PHRASE_HANJA + TITLE_CHAR_OVERRIDE 기반
// 통합 버전(상단)에서 처리. 이전 4-항목 매핑은 그쪽으로 이관됨.

/* ══════════════════════ 도장 이미지 생성 (Canvas) ══════════════════════ */

/**
 * 이름 입력 → 8개 도장 variant를 한번에 생성하여 반환
 * 모두싸인 스타일: 원형/사각 × 폰트 조합
 */
export function generateSealVariants(options: GenerateVariantsOptions): SealVariant[] {
  ensureSealFontsLoaded()
  const { name, category, size = 200, representativeName, useHanja = false, hanjaOverride, showDot = true, fontSizeScale = 1.0, letterSpacingScale = 1.0, selectedFontIdx } = options
  const variants: SealVariant[] = []

  // 한자 변환: 담당자 직접 지정 > 자동 변환 > 한글 원문
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

  // 단일 폰트 모드 (selectedFontIdx) 또는 전체 폰트 모드
  const fontsToUse = selectedFontIdx != null && selectedFontIdx >= 0 && selectedFontIdx < ALL_SEAL_FONTS.length
    ? [ALL_SEAL_FONTS[selectedFontIdx]]
    : ALL_SEAL_FONTS
  const combos: { shape: SealShape; font: typeof fontsToUse[0]; titleIdx?: number; titleOverride?: string; intaglio?: boolean; strokeLabel?: string; extraStroke?: number }[] = []

  if (category === 'corporate') {
    for (const f of fontsToUse) {
      combos.push({ shape: 'circle', font: f, titleOverride: repTitle, titleIdx: 0 })
    }
  } else {
    for (const f of fontsToUse) {
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
      fontSizeScale,
      letterSpacingScale,
      useHanja,
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

export interface RenderSealOptions {
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
  fontSizeScale?: number     // 글씨 크기 배율 (0.5~1.5, 기본 1.0)
  letterSpacingScale?: number // 글자 간격 배율 (0.5~1.5, 기본 1.0)
  useHanja?: boolean         // 한자 모드 여부 (印/인 선택에 사용)
}

/** 단일 도장 Canvas 렌더링 → data URI (실시간 미리보기에서도 사용) */
export function renderSealCanvas(opts: RenderSealOptions): string {
  const { name, category, shape, fontFamily, fontWeight, size, corporateTitle: rawCorporateTitle, intaglio = false, extraStroke: _extraStroke = 0, showDot = false, fontSizeScale = 1.0, letterSpacingScale = 1.0, useHanja = false } = opts
  // 한자 모드일 때 법인 직함도 한자로 변환 (예: "대표자인" → "代表者印").
  // rawCorporateTitle 이 비어 있는 케이스는 내부 default "대표자인" 이 적용되므로
  // 그 default 도 미리 변환된 상태로 넘겨야 한다.
  const effectiveCorporateTitle = rawCorporateTitle ?? (category === 'corporate' ? '대표자인' : undefined)
  const corporateTitle = useHanja && category === 'corporate' && effectiveCorporateTitle
    ? corporateTitleToHanja(effectiveCorporateTitle)
    : effectiveCorporateTitle
  const canvas = document.createElement('canvas')

  // 타원형은 세로가 더 길도록 (전통 한국 인감 형태 — 세로 타원)
  const w = shape === 'oval' ? size : size
  const h = shape === 'oval' ? Math.round(size * 1.3) : size
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
      drawCorporateCircleSeal(ctx, chars, fontFamily, fontWeight, cx, cy, size, pad, outerLineW, innerLineW, corporateTitle, showDot, fontSizeScale, letterSpacingScale)
    } else {
      drawCorporateSquareSeal(ctx, chars, fontFamily, fontWeight, w, h, pad, outerLineW, innerLineW, corporateTitle, shape, showDot, fontSizeScale)
    }
  } else {
    // 개인도장: 원형/사각형은 이름+"인"(한글) 또는 이름+"印"(한자), 타원형은 이름만
      const sealSuffix = useHanja ? '印' : '인'
      if (shape === 'circle') {
      drawPersonalCircleSeal(ctx, chars, fontFamily, fontWeight, cx, cy, size, pad, outerLineW, showDot, fontSizeScale, letterSpacingScale, sealSuffix)
    } else if (shape === 'oval') {
      drawPersonalOvalSeal(ctx, chars, fontFamily, fontWeight, cx, cy, w, h, pad, outerLineW, fontSizeScale, letterSpacingScale)
    } else {
      drawPersonalSquareSeal(ctx, chars, fontFamily, fontWeight, w, h, pad, outerLineW, shape, fontSizeScale, sealSuffix)
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
  _showDot = false,
  fontSizeScale = 1.0,
  _letterSpacingScale = 1.0,
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

  // ── 3. 외곽~내곽 사이에 회사명 원호 배치 ──
  // 규칙: 총 등분 = 글자수 + 1(12시 점). 최소 7등분 (글자 적어도 예쁘게).
  // 예: "홍" → 7등분(·홍·····), "주식회사홍" → 7등분(·주식회사홍·), "주식회사로지싸인" → 9등분
  const ringR = (outerR + innerR) / 2
  const nameChars = companyName.split('')
  const ringTextSize = (outerR - innerR) * 0.72 * fontSizeScale
  const dotR = ringTextSize * 0.15

  const MIN_SLOTS = 7
  const totalSlots = Math.max(nameChars.length + 1, MIN_SLOTS) // +1은 12시 점
  const slotAngle = (Math.PI * 2) / totalSlots
  const startAngle = -Math.PI / 2 // 12시 방향

  // 슬롯 배치: [0]=12시 점, [1..N]=글자, [N+1..]=빈 슬롯은 점
  // 전통 한국 인감 방향: 12시에서 우→좌(반시계 방향)로 읽힘.
  // 따라서 angle 을 i 만큼 빼서 (시계 반대방향) 배치한다.
  for (let i = 0; i < totalSlots; i++) {
    const angle = startAngle - slotAngle * i

    if (i === 0) {
      // 12시 방향: 항상 점(·)
      const dx = cx + ringR * Math.cos(angle)
      const dy = cy + ringR * Math.sin(angle)
      drawDot(ctx, dx, dy, dotR)
    } else if (i <= nameChars.length) {
      // 글자 슬롯 — 반시계 방향이므로 글자는 양 옆으로 누워있지 않게 회전 보정
      drawCharOnArc(ctx, nameChars[i - 1], cx, cy, ringR, angle, ringTextSize, fontFamily, fontWeight)
    } else {
      // 빈 슬롯: 점으로 채움 (글자수 부족 시)
      const dx = cx + ringR * Math.cos(angle)
      const dy = cy + ringR * Math.sin(angle)
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
  fontSizeScale = 1.0,
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
  const topFs = Math.min(topArea * 0.58, (w - innerPad * 2) / Math.max(displayName.length, 2) * 1.05) * fontSizeScale
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
  fontSizeScale = 1.0,
  letterSpacingScale = 1.0,
  sealSuffix = '인',
) {
  const outerR = (size / 2) - pad

  // 외곽 원 (두꺼운 테두리 — 인감도장 느낌)
  ctx.lineWidth = outerLineW * 1.2
  ctx.strokeStyle = SEAL_COLOR
  ctx.beginPath()
  ctx.arc(cx, cy, outerR, 0, Math.PI * 2)
  ctx.stroke()

  const usableR = outerR - outerLineW

  // 개인 인감: 이름 + "인"(한글) 또는 "印"(한자) (예: "홍길동" → "홍길동인" 또는 "洪吉東印")
  const sealChars = (chars + sealSuffix).split('')
  const len = sealChars.length
  const dotR = size * 0.018  // 점 반지름
  const fsScale = fontSizeScale
  const lsScale = letterSpacingScale

  if (len <= 2) {
    const fs = usableR * 1.0 * fsScale
    const gap = fs * 0.50 * lsScale
    sealChars.forEach((ch, i) =>
      drawThickText(ctx, ch, cx, cy - gap + i * gap * 2, fs, fontFamily, fontWeight))
    if (showDot && len === 2) {
      drawDot(ctx, cx, cy, dotR)
    }
  } else if (len === 3) {
    const fs = usableR * 0.72 * fsScale
    const spacing = fs * 1.05 * lsScale
    const totalH = len * spacing
    const sy = cy - totalH / 2 + spacing / 2
    sealChars.forEach((ch, i) =>
      drawThickText(ctx, ch, cx, sy + i * spacing, fs, fontFamily, fontWeight))
    if (showDot) {
      drawDot(ctx, cx, sy + spacing * 0.5, dotR)
      drawDot(ctx, cx, sy + spacing * 1.5, dotR)
    }
  } else if (len === 4) {
    const fs = usableR * 0.68 * fsScale
    const gx = usableR * 0.34 * lsScale
    const gy = usableR * 0.34 * lsScale
    drawThickText(ctx, sealChars[0], cx + gx, cy - gy, fs, fontFamily, fontWeight)
    drawThickText(ctx, sealChars[1], cx + gx, cy + gy, fs, fontFamily, fontWeight)
    drawThickText(ctx, sealChars[2], cx - gx, cy - gy, fs, fontFamily, fontWeight)
    drawThickText(ctx, sealChars[3], cx - gx, cy + gy, fs, fontFamily, fontWeight)
    if (showDot) {
      drawDot(ctx, cx, cy, dotR * 1.2)
    }
  } else {
    const rightCount = Math.ceil(len / 2)
    const leftCount = len - rightCount
    const rightChars = sealChars.slice(0, rightCount)
    const leftChars = sealChars.slice(rightCount)
    const maxPerCol = Math.max(rightCount, leftCount)
    const fs = usableR * (maxPerCol <= 2 ? 0.62 : maxPerCol === 3 ? 0.52 : 0.44) * fsScale
    const gx = usableR * 0.32 * lsScale
    const spacing = fs * 1.05 * lsScale

    const rTotalH = rightCount * spacing
    const rStartY = cy - rTotalH / 2 + spacing / 2
    rightChars.forEach((ch, i) =>
      drawThickText(ctx, ch, cx + gx, rStartY + i * spacing, fs, fontFamily, fontWeight))

    const lTotalH = leftCount * spacing
    const lStartY = cy - lTotalH / 2 + spacing / 2
    leftChars.forEach((ch, i) =>
      drawThickText(ctx, ch, cx - gx, lStartY + i * spacing, fs, fontFamily, fontWeight))

    if (showDot) {
      drawDot(ctx, cx, cy, dotR * 1.2)
    }
  }
}

/* ────────────────── 일반도장: 타원형 (세로 형태) ────────────────── */

/**
 * 세로 타원 인감 — 전통 한국 인감의 비공식 변형.
 * - 캔버스 비율: 세로(h) > 가로(w) — 위에서 1.3:1 비율로 설정됨
 * - 글자: 印/인 접미사 없이 이름만 (사용자 지정)
 * - 배치: 세로 1열 (위에서 아래로). 한 글자씩 차곡차곡.
 *   2~3자는 큼직하게, 4자 이상은 글자 크기를 줄여 한 열에 모두 배치.
 */
function drawPersonalOvalSeal(
  ctx: CanvasRenderingContext2D,
  chars: string,
  fontFamily: string,
  fontWeight: string,
  cx: number, cy: number,
  w: number, h: number,
  pad: number,
  outerLineW: number,
  fontSizeScale = 1.0,
  letterSpacingScale = 1.0,
) {
  // 외곽 타원 (세로가 긴 형태) — radiusX < radiusY 가 되도록 명시
  const rx = (w / 2) - pad
  const ry = (h / 2) - pad
  ctx.lineWidth = outerLineW * 1.2
  ctx.strokeStyle = SEAL_COLOR
  ctx.beginPath()
  ctx.ellipse(cx, cy, rx, ry, 0, 0, Math.PI * 2)
  ctx.stroke()

  // 印/인 없이 이름만 — 세로 1열 배치
  const nameChars = chars.split('')
  const len = nameChars.length
  if (len === 0) return

  // 세로 가용 영역 — 외곽선 안쪽
  const usableH = ry * 2 - outerLineW * 2
  const usableW = rx * 2 - outerLineW * 2

  // 글자 크기: 글자수가 많을수록 작아지도록. 가용 가로 대비도 제한
  // 1자 → 폰트 크기 = ry * 1.0, 2자 → ry * 0.6, 3자 → ry * 0.5, 4자+ → ry * 0.42 등
  const sizeScaleByCount = len === 1 ? 1.0 : len === 2 ? 0.65 : len === 3 ? 0.52 : 0.42
  const fsByHeight = ry * sizeScaleByCount * fontSizeScale
  const fsByWidth = usableW * 0.78 * fontSizeScale  // 글자 가로 폭이 타원 가로를 넘지 않도록
  const fs = Math.min(fsByHeight, fsByWidth)

  if (len === 1) {
    drawThickText(ctx, nameChars[0], cx, cy, fs, fontFamily, fontWeight)
    return
  }

  // 다자 케이스: 세로로 균등 배치
  const spacing = fs * 1.05 * letterSpacingScale
  const totalH = len * spacing
  // 타원 안에서 세로로 중앙 정렬 — 시작 y 는 cy - totalH/2 + spacing/2
  let startY = cy - totalH / 2 + spacing / 2
  // 타원 내부에 안 들어가면 spacing 축소
  if (totalH > usableH) {
    const safeSpacing = (usableH - fs * 0.2) / len
    startY = cy - (safeSpacing * len) / 2 + safeSpacing / 2
    nameChars.forEach((ch, i) =>
      drawThickText(ctx, ch, cx, startY + i * safeSpacing, fs, fontFamily, fontWeight))
    return
  }

  nameChars.forEach((ch, i) =>
    drawThickText(ctx, ch, cx, startY + i * spacing, fs, fontFamily, fontWeight))
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
  fontSizeScale = 1.0,
  sealSuffix = '인',
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

  // 사각형에도 이름 + "인"/"印" 추가
  const sealChars = chars + sealSuffix
  const usableW = w - pad * 2 - outerLineW * 2
  const usableH = h - pad * 2 - outerLineW * 2

  if (sealChars.length <= 2) {
    const fs = usableH * 0.68 * fontSizeScale
    if (sealChars.length === 1) {
      drawThickText(ctx, sealChars, cx, cy, fs, fontFamily, fontWeight, 0.22)
    } else {
      drawThickText(ctx, sealChars[0], cx, cy - fs * 0.48, fs, fontFamily, fontWeight, 0.20)
      drawThickText(ctx, sealChars[1], cx, cy + fs * 0.48, fs, fontFamily, fontWeight, 0.20)
    }
  } else if (sealChars.length <= 4) {
    // 2×2 그리드 — 공간 꽉 채움
    const fs = Math.min(usableW * 0.48, usableH * 0.48)
    const gx = usableW * 0.24
    const gy = usableH * 0.24
    const grid = sealChars.length === 3 ? [sealChars[0], sealChars[1], sealChars[2], ''] : [sealChars[0], sealChars[1], sealChars[2], sealChars[3]]
    drawThickText(ctx, grid[0], cx + gx, cy - gy, fs, fontFamily, fontWeight, 0.20)
    drawThickText(ctx, grid[1], cx + gx, cy + gy, fs, fontFamily, fontWeight, 0.20)
    drawThickText(ctx, grid[2], cx - gx, cy - gy, fs, fontFamily, fontWeight, 0.20)
    if (grid[3]) drawThickText(ctx, grid[3], cx - gx, cy + gy, fs, fontFamily, fontWeight, 0.20)
  } else {
    // 5+ 줄바꿈
    const perLine = Math.ceil(sealChars.length / 2)
    const lines: string[] = []
    for (let i = 0; i < sealChars.length; i += perLine) lines.push(sealChars.slice(i, i + perLine))
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
          const _alpha = Math.max(0, Math.min(255, (200 - brightness) * 5 + 255))
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
const _DOC_BUCKET = 'documents'

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
  recipients?: { id: string }[]
}

/** 대리점의 문서파일 목록 조회 */
export async function getDocumentFiles(agencyId: string): Promise<DocumentFile[]> {
  const supabase = createBrowserSupabaseClient()
  const { data } = await supabase
    .from('document_files')
    .select('*')
    .eq('agency_id', agencyId)
    .order('created_at', { ascending: false })
  const docs = (data ?? []) as DocumentFile[]

  return Promise.all(
    docs.map(async (doc) => {
      if (!doc.file_url || doc.file_url.startsWith('http')) {
        return doc
      }

      const { data: signedData } = await supabase.storage
        .from('documents')
        .createSignedUrl(doc.file_url, 3600)

      return {
        ...doc,
        file_url: signedData?.signedUrl ?? doc.file_url,
      }
    })
  )
}

/** 문서파일 스토리지 업로드 */
export async function uploadDocumentFile(
  agencyId: string,
  file: File
): Promise<{ path: string | null; error: string | null }> {
  const supabase = createBrowserSupabaseClient()
  const safeName = file.name.replace(/[^a-zA-Z0-9._-]/g, '_')
  const path = `${agencyId}/${Date.now()}_${safeName}`
  const { error } = await supabase.storage.from('documents').upload(path, file)
  if (error) return { path: null, error: error.message }
  return { path, error: null }
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
