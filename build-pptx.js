const pptxgen = require("pptxgenjs");

const pres = new pptxgen();
pres.layout = "LAYOUT_16x9";
pres.author = "logiSSign Team";
pres.title = "logiSSign (DeliSign) 사업계획서";

// --- DESIGN SYSTEM ---
const C = {
  bg: "0A1628",
  bgCard: "111D32",
  bgCard2: "162036",
  primary: "004AC6",
  primaryLight: "2563EB",
  accent: "00CEC9",
  accentDark: "00A8A3",
  text: "FFFFFF",
  textMuted: "8899B4",
  textDim: "5A6D8A",
  success: "10B981",
  warning: "F59E0B",
  danger: "EF4444",
  border: "1E3050",
  white: "FFFFFF",
  cardSurface: "0F1B2E",
};

const FONT = { h: "Arial Black", b: "Calibri", mono: "Consolas" };

// Helper: fresh shadow factory
const cardShadow = () => ({ type: "outer", blur: 8, offset: 3, angle: 135, color: "000000", opacity: 0.25 });

// Helper: add slide with common bg
function addSlide(slideNum, totalSlides) {
  const s = pres.addSlide();
  s.background = { color: C.bg };
  // Slide number
  if (slideNum) {
    s.addText(`${String(slideNum).padStart(2, "0")} / ${totalSlides}`, {
      x: 8.5, y: 5.15, w: 1.2, h: 0.35, fontSize: 9, fontFace: FONT.mono,
      color: C.textDim, align: "right",
    });
  }
  return s;
}

// Helper: Section title bar at top
function addHeader(s, label) {
  s.addShape(pres.shapes.RECTANGLE, { x: 0, y: 0, w: 10, h: 0.06, fill: { color: C.accent } });
  s.addText(label, {
    x: 0.6, y: 0.3, w: 8.5, h: 0.35, fontSize: 10, fontFace: FONT.b,
    color: C.accent, charSpacing: 3, bold: true, margin: 0,
  });
}

// Helper: Slide title
function addTitle(s, title, opts = {}) {
  s.addText(title, {
    x: opts.x || 0.6, y: opts.y || 0.65, w: opts.w || 8.8, h: 0.55,
    fontSize: opts.size || 28, fontFace: FONT.h, color: C.text, bold: true, margin: 0,
  });
}

// Helper: Card background
function addCard(s, x, y, w, h, color) {
  s.addShape(pres.shapes.RECTANGLE, {
    x, y, w, h, fill: { color: color || C.bgCard },
    shadow: cardShadow(),
  });
}

// Helper: accent left border on card
function addCardAccent(s, x, y, h, color) {
  s.addShape(pres.shapes.RECTANGLE, { x, y: y + 0.08, w: 0.05, h: h - 0.16, fill: { color: color || C.accent } });
}

// Helper: KPI stat
function addStat(s, x, y, number, label, color) {
  addCard(s, x, y, 2.0, 1.1);
  s.addText(number, { x, y: y + 0.12, w: 2.0, h: 0.5, fontSize: 26, fontFace: FONT.h, color: color || C.accent, align: "center", bold: true, margin: 0 });
  s.addText(label, { x, y: y + 0.6, w: 2.0, h: 0.35, fontSize: 10, fontFace: FONT.b, color: C.textMuted, align: "center", margin: 0 });
}

// Helper: bullet list
function addBullets(s, x, y, w, h, items, opts = {}) {
  const textArr = items.map((item, i) => ({
    text: item,
    options: {
      bullet: { code: "25B8" },
      fontSize: opts.fontSize || 13,
      fontFace: FONT.b,
      color: opts.color || C.textMuted,
      breakLine: i < items.length - 1,
      paraSpaceAfter: 6,
    },
  }));
  s.addText(textArr, { x, y, w, h, margin: 0 });
}

const TOTAL = 28;

// =====================================================
// SLIDE 1: COVER
// =====================================================
{
  const s = addSlide(null, TOTAL);
  // Dark gradient-like overlay with shapes
  s.addShape(pres.shapes.RECTANGLE, { x: 0, y: 0, w: 10, h: 5.625, fill: { color: C.bg } });
  // Decorative shapes
  s.addShape(pres.shapes.OVAL, { x: -1.5, y: -1, w: 5, h: 5, fill: { color: C.primary, transparency: 90 } });
  s.addShape(pres.shapes.OVAL, { x: 7, y: 3, w: 5, h: 5, fill: { color: C.accent, transparency: 90 } });
  // Top accent line
  s.addShape(pres.shapes.RECTANGLE, { x: 0, y: 0, w: 10, h: 0.06, fill: { color: C.accent } });
  // Content
  s.addText("BUSINESS PLAN 2026", {
    x: 0.8, y: 1.2, w: 8.4, h: 0.35, fontSize: 12, fontFace: FONT.b,
    color: C.accent, charSpacing: 5, margin: 0,
  });
  s.addText("logiSSign", {
    x: 0.8, y: 1.65, w: 8.4, h: 1.0, fontSize: 48, fontFace: FONT.h,
    color: C.text, bold: true, margin: 0,
  });
  s.addText("(DeliSign)", {
    x: 0.8, y: 2.55, w: 8.4, h: 0.5, fontSize: 22, fontFace: FONT.b,
    color: C.primaryLight, margin: 0,
  });
  // Divider
  s.addShape(pres.shapes.RECTANGLE, { x: 0.8, y: 3.2, w: 1.5, h: 0.04, fill: { color: C.accent } });
  s.addText("라스트마일 배송 정산/계약 SaaS 플랫폼", {
    x: 0.8, y: 3.45, w: 8.4, h: 0.4, fontSize: 16, fontFace: FONT.b,
    color: C.textMuted, margin: 0,
  });
  s.addText("사업계획서  |  2026.03.31", {
    x: 0.8, y: 4.1, w: 8.4, h: 0.35, fontSize: 11, fontFace: FONT.b,
    color: C.textDim, margin: 0,
  });
}

// =====================================================
// SLIDE 2: TABLE OF CONTENTS
// =====================================================
{
  const s = addSlide(2, TOTAL);
  addHeader(s, "TABLE OF CONTENTS");
  addTitle(s, "목차");

  const items = [
    ["01", "사업 개요", "문제 정의 / 솔루션 / 시장"],
    ["02", "플랫폼 기능 상세", "웹 포털 / 모바일 앱 / 관리자"],
    ["03", "기사앱 사용 설명서", "회원가입부터 전자서명까지"],
    ["04", "비즈니스 모델", "SaaS 구독 요금제"],
    ["05", "기술 아키텍처", "풀스택 기술 스택"],
    ["06", "개발 현황 및 로드맵", "마일스톤 / 일정"],
    ["07", "재무 계획", "매출 전망 / 투자"],
  ];

  items.forEach(([num, title, desc], i) => {
    const yy = 1.4 + i * 0.55;
    s.addText(num, { x: 0.6, y: yy, w: 0.55, h: 0.4, fontSize: 16, fontFace: FONT.h, color: C.accent, bold: true, margin: 0 });
    s.addText(title, { x: 1.3, y: yy, w: 3.5, h: 0.25, fontSize: 14, fontFace: FONT.b, color: C.text, bold: true, margin: 0 });
    s.addText(desc, { x: 1.3, y: yy + 0.22, w: 5, h: 0.2, fontSize: 10, fontFace: FONT.b, color: C.textDim, margin: 0 });
    if (i < items.length - 1) {
      s.addShape(pres.shapes.LINE, { x: 0.6, y: yy + 0.5, w: 8.5, h: 0, line: { color: C.border, width: 0.5 } });
    }
  });
}

// =====================================================
// SLIDE 3: PROBLEM
// =====================================================
{
  const s = addSlide(3, TOTAL);
  addHeader(s, "PROBLEM");
  addTitle(s, "라스트마일 배송 대리점의 현실");

  const problems = [
    ["수기 정산", "엑셀 수작업으로 매월 수십명 기사 정산\n오류 빈발, 정산 분쟁 반복", C.danger],
    ["종이 계약서", "서류 분실, 보관 비용 증가\n법적 분쟁 시 증거력 약화", C.warning],
    ["교육 미비", "법정 의무교육 이수 관리 부재\n미이수 시 과태료 위험", C.warning],
    ["비효율적 관리", "기사별 단가/공제가 모두 다름\n대리점주 과로 및 실수 유발", C.danger],
  ];

  problems.forEach(([title, desc, color], i) => {
    const col = i % 2;
    const row = Math.floor(i / 2);
    const xx = 0.6 + col * 4.5;
    const yy = 1.5 + row * 1.85;
    addCard(s, xx, yy, 4.1, 1.55);
    addCardAccent(s, xx, yy, 1.55, color);
    s.addText(title, { x: xx + 0.2, y: yy + 0.15, w: 3.6, h: 0.3, fontSize: 14, fontFace: FONT.b, color: C.text, bold: true, margin: 0 });
    s.addText(desc, { x: xx + 0.2, y: yy + 0.5, w: 3.6, h: 0.85, fontSize: 11, fontFace: FONT.b, color: C.textMuted, margin: 0 });
  });
}

// =====================================================
// SLIDE 4: SOLUTION
// =====================================================
{
  const s = addSlide(4, TOTAL);
  addHeader(s, "SOLUTION");
  addTitle(s, "logiSSign이 해결합니다");

  const solutions = [
    ["자동 정산", "엑셀 업로드 → 자동 계산 → 기사앱 발송\n오류 제로, 정산 시간 90% 단축"],
    ["전자계약", "법적 효력 전자서명 + 감사 추적\nPDF 자동 생성 및 안전 보관"],
    ["법정교육", "동영상 + 텍스트 + 퀴즈 학습\n자동 이수증 발급 및 관리"],
    ["통합 관리", "기사 등록, 정산, 계약, 세금계산서\n하나의 플랫폼에서 올인원 처리"],
  ];

  solutions.forEach(([title, desc], i) => {
    const xx = 0.6 + i * 2.3;
    addCard(s, xx, 1.5, 2.1, 2.8);
    s.addShape(pres.shapes.OVAL, { x: xx + 0.7, y: 1.7, w: 0.65, h: 0.65, fill: { color: C.primary, transparency: 60 } });
    s.addText(String(i + 1), { x: xx + 0.7, y: 1.74, w: 0.65, h: 0.58, fontSize: 18, fontFace: FONT.h, color: C.accent, align: "center", valign: "middle", margin: 0 });
    s.addText(title, { x: xx + 0.15, y: 2.55, w: 1.8, h: 0.3, fontSize: 13, fontFace: FONT.b, color: C.text, bold: true, align: "center", margin: 0 });
    s.addText(desc, { x: xx + 0.15, y: 2.95, w: 1.8, h: 1.1, fontSize: 10, fontFace: FONT.b, color: C.textMuted, align: "center", margin: 0 });
  });

  // Bottom accent
  s.addShape(pres.shapes.RECTANGLE, { x: 0.6, y: 4.6, w: 8.8, h: 0.55, fill: { color: C.bgCard } });
  s.addText("정산 자동화  +  전자계약  +  법정교육  =  올인원 SaaS", {
    x: 0.6, y: 4.6, w: 8.8, h: 0.55, fontSize: 13, fontFace: FONT.b,
    color: C.accent, align: "center", valign: "middle", bold: true, margin: 0,
  });
}

// =====================================================
// SLIDE 5: MARKET
// =====================================================
{
  const s = addSlide(5, TOTAL);
  addHeader(s, "MARKET OPPORTUNITY");
  addTitle(s, "시장 기회");

  // Stats row
  addStat(s, 0.6, 1.5, "28조", "택배/퀵 배송 시장 (2025)", C.accent);
  addStat(s, 2.85, 1.5, "15,000", "라스트마일 대리점 (전국)", C.primaryLight);
  addStat(s, 5.1, 1.5, "50만", "배송 기사 수", C.accent);
  addStat(s, 7.35, 1.5, "20~80", "대리점당 관리 기사 수", C.primaryLight);

  // TAM/SAM/SOM
  addCard(s, 0.6, 3.0, 8.8, 2.2);
  s.addText("시장 규모 분석", { x: 0.9, y: 3.15, w: 4, h: 0.3, fontSize: 14, fontFace: FONT.b, color: C.text, bold: true, margin: 0 });

  const markets = [
    ["TAM", "15,000 대리점 × ₩49,900/월", "연 약 90억원", C.accent],
    ["SAM", "수도권 + 광역시 7,000개소", "연 약 42억원", C.primaryLight],
    ["SOM", "초기 500 대리점 목표 (3년)", "연 약 4.8억원", C.success],
  ];

  markets.forEach(([label, desc, amount, color], i) => {
    const xx = 1.0 + i * 2.9;
    s.addText(label, { x: xx, y: 3.6, w: 2.5, h: 0.35, fontSize: 18, fontFace: FONT.h, color: color, bold: true, margin: 0 });
    s.addText(desc, { x: xx, y: 3.95, w: 2.5, h: 0.3, fontSize: 10, fontFace: FONT.b, color: C.textMuted, margin: 0 });
    s.addText(amount, { x: xx, y: 4.3, w: 2.5, h: 0.35, fontSize: 14, fontFace: FONT.b, color: color, bold: true, margin: 0 });
  });
}

// =====================================================
// SLIDE 6: COMPETITIVE ADVANTAGE
// =====================================================
{
  const s = addSlide(6, TOTAL);
  addHeader(s, "COMPETITIVE EDGE");
  addTitle(s, "차별화 포인트");

  const rows = [
    ["vs 엑셀/수작업", "자동화로 정산 시간 90% 단축", "90%", C.success],
    ["vs ERP 솔루션", "배송 대리점 특화 (학습 비용 1/10)", "1/10", C.accent],
    ["vs 기존 물류 SW", "기사앱+전자서명+교육 통합 유일 솔루션", "Only", C.primaryLight],
    ["vs 자체 개발", "초기 투자 없이 월구독 SaaS 시작", "₩0", C.warning],
  ];

  rows.forEach(([vs, desc, metric, color], i) => {
    const yy = 1.5 + i * 0.95;
    addCard(s, 0.6, yy, 7.5, 0.75);
    addCardAccent(s, 0.6, yy, 0.75, color);
    s.addText(vs, { x: 0.85, y: yy + 0.1, w: 2, h: 0.25, fontSize: 12, fontFace: FONT.b, color: C.text, bold: true, margin: 0 });
    s.addText(desc, { x: 0.85, y: yy + 0.38, w: 5, h: 0.25, fontSize: 11, fontFace: FONT.b, color: C.textMuted, margin: 0 });
    // Metric badge
    addCard(s, 8.3, yy + 0.1, 1.1, 0.55, C.primary);
    s.addText(metric, { x: 8.3, y: yy + 0.1, w: 1.1, h: 0.55, fontSize: 16, fontFace: FONT.h, color: C.text, align: "center", valign: "middle", bold: true, margin: 0 });
  });
}

// =====================================================
// SLIDE 7: PLATFORM OVERVIEW
// =====================================================
{
  const s = addSlide(7, TOTAL);
  addHeader(s, "PLATFORM");
  addTitle(s, "투 사이드 플랫폼 구성");

  // Three columns
  const cols = [
    ["웹 포털", "대리점 운영자용", ["대시보드 (KPI)", "기사 관리", "정산 생성/관리", "계약 발송/추적", "세금계산서", "매출 리포트"], C.primary],
    ["모바일 앱", "배송 기사용", ["정산 조회", "전자서명 계약", "법정교육 이수", "공지사항 확인", "프로필 관리", "알림 수신"], C.accent],
    ["관리자 대시보드", "SaaS 운영", ["대리점 관리", "구독/요금제 관리", "SaaS 지표 (MRR)", "빌링 관리", "서버 설정", "사용 통계"], C.primaryLight],
  ];

  cols.forEach(([title, sub, items, color], i) => {
    const xx = 0.4 + i * 3.2;
    addCard(s, xx, 1.5, 2.95, 3.7);
    s.addShape(pres.shapes.RECTANGLE, { x: xx, y: 1.5, w: 2.95, h: 0.55, fill: { color } });
    s.addText(title, { x: xx, y: 1.5, w: 2.95, h: 0.35, fontSize: 13, fontFace: FONT.b, color: C.text, bold: true, align: "center", margin: 0 });
    s.addText(sub, { x: xx, y: 1.82, w: 2.95, h: 0.22, fontSize: 9, fontFace: FONT.b, color: "CADCFC", align: "center", margin: 0 });
    addBullets(s, xx + 0.2, 2.2, 2.55, 2.8, items, { fontSize: 11 });
  });
}

// =====================================================
// SLIDE 8: WEB DASHBOARD
// =====================================================
{
  const s = addSlide(8, TOTAL);
  addHeader(s, "WEB PORTAL");
  addTitle(s, "대리점 운영자 대시보드");

  // KPI cards mockup
  const kpis = [
    ["₩28.4M", "이번달 정산액", C.accent],
    ["47", "활성 기사 수", C.primaryLight],
    ["3", "미서명 계약", C.warning],
    ["2", "미발행 세금계산서", C.danger],
  ];
  kpis.forEach(([val, label, color], i) => {
    const xx = 0.6 + i * 2.3;
    addCard(s, xx, 1.45, 2.05, 0.95);
    s.addText(val, { x: xx, y: 1.5, w: 2.05, h: 0.45, fontSize: 20, fontFace: FONT.h, color, align: "center", bold: true, margin: 0 });
    s.addText(label, { x: xx, y: 1.95, w: 2.05, h: 0.3, fontSize: 10, fontFace: FONT.b, color: C.textMuted, align: "center", margin: 0 });
  });

  // Feature cards
  const features = [
    ["6개월 추이 차트", "매출/비용/이익 트렌드\n월별 비교 분석"],
    ["기사별 정산 현황", "이름, 정산액, 공제액, 순지급액\n상태별 필터링"],
    ["최근 활동 로그", "계약/정산/등록 이벤트\n타임라인 형태 표시"],
    ["빠른 작업 버튼", "정산 생성, 계약 발송\n세금계산서 발행 바로가기"],
  ];
  features.forEach(([title, desc], i) => {
    const col = i % 2;
    const row = Math.floor(i / 2);
    const xx = 0.6 + col * 4.5;
    const yy = 2.7 + row * 1.3;
    addCard(s, xx, yy, 4.1, 1.1);
    addCardAccent(s, xx, yy, 1.1, C.accent);
    s.addText(title, { x: xx + 0.2, y: yy + 0.1, w: 3.5, h: 0.25, fontSize: 12, fontFace: FONT.b, color: C.text, bold: true, margin: 0 });
    s.addText(desc, { x: xx + 0.2, y: yy + 0.4, w: 3.5, h: 0.55, fontSize: 10, fontFace: FONT.b, color: C.textMuted, margin: 0 });
  });
}

// =====================================================
// SLIDE 9: SETTLEMENT SYSTEM
// =====================================================
{
  const s = addSlide(9, TOTAL);
  addHeader(s, "CORE FEATURE");
  addTitle(s, "정산 자동화 핵심 기능");

  // Left: 3-tier hierarchy
  addCard(s, 0.6, 1.5, 4.5, 3.7);
  s.addText("계층적 단가 체계", { x: 0.85, y: 1.6, w: 4, h: 0.3, fontSize: 13, fontFace: FONT.b, color: C.text, bold: true, margin: 0 });

  const tiers = [
    ["대리점 규칙", "settlement_rules", "기본 배송/반품/집하 단가 설정"],
    ["기사별 단가", "driver_rates", "기사마다 다른 단가 오버라이드"],
    ["노선별 단가", "driver_route_rates", "특정 노선 프리미엄 단가"],
  ];
  tiers.forEach(([label, table, desc], i) => {
    const yy = 2.1 + i * 0.9;
    s.addShape(pres.shapes.RECTANGLE, { x: 0.9, y: yy, w: 3.9, h: 0.7, fill: { color: i === 0 ? C.primary : C.bgCard2 } });
    s.addText(label, { x: 1.1, y: yy + 0.05, w: 2.5, h: 0.25, fontSize: 12, fontFace: FONT.b, color: C.text, bold: true, margin: 0 });
    s.addText(desc, { x: 1.1, y: yy + 0.32, w: 3.4, h: 0.25, fontSize: 9, fontFace: FONT.b, color: C.textMuted, margin: 0 });
    if (i < 2) {
      s.addText("▼ override", { x: 2.2, y: yy + 0.68, w: 1.5, h: 0.22, fontSize: 8, fontFace: FONT.mono, color: C.accent, align: "center", margin: 0 });
    }
  });

  // Right: Features
  addCard(s, 5.3, 1.5, 4.1, 3.7);
  s.addText("주요 기능", { x: 5.55, y: 1.6, w: 3.6, h: 0.3, fontSize: 13, fontFace: FONT.b, color: C.text, bold: true, margin: 0 });
  addBullets(s, 5.55, 2.0, 3.6, 3.0, [
    "엑셀 업로드: 쿠팡/CJ/한진 자동 파싱",
    "컬럼 매핑: 유연한 엑셀 형식 지원",
    "정산 항목: 배송건수, 기본급, 인센티브",
    "공제 계산: 보험/통신/유류비 자동 산출",
    "VAT 처리: 사업자/개인 자동 구분",
    "세금계산서: 사업자 기사 역발행 자동",
    "상태 관리: 임시저장→발송→확인완료",
  ], { fontSize: 11 });
}

// =====================================================
// SLIDE 10: CONTRACT MANAGEMENT
// =====================================================
{
  const s = addSlide(10, TOTAL);
  addHeader(s, "CONTRACTS");
  addTitle(s, "전자계약 관리 시스템");

  // Process flow
  addCard(s, 0.6, 1.5, 8.8, 1.3);
  s.addText("계약 처리 플로우", { x: 0.85, y: 1.55, w: 4, h: 0.25, fontSize: 11, fontFace: FONT.b, color: C.accent, bold: true, margin: 0 });

  const steps = ["템플릿\n선택", "변수\n자동채움", "기사에게\n발송", "기사가\n조회/서명", "서명PDF\n생성"];
  steps.forEach((label, i) => {
    const xx = 0.8 + i * 1.8;
    s.addShape(pres.shapes.OVAL, { x: xx, y: 2.0, w: 0.55, h: 0.55, fill: { color: C.primary } });
    s.addText(String(i + 1), { x: xx, y: 2.0, w: 0.55, h: 0.55, fontSize: 14, fontFace: FONT.h, color: C.text, align: "center", valign: "middle", margin: 0 });
    s.addText(label, { x: xx - 0.3, y: 2.0, w: 1.15, h: 0.55, fontSize: 9, fontFace: FONT.b, color: C.textMuted, align: "center", margin: 0 });
    if (i < 4) {
      s.addShape(pres.shapes.LINE, { x: xx + 0.6, y: 2.27, w: 1.15, h: 0, line: { color: C.accent, width: 1.5 } });
    }
  });

  // Feature cards below
  const cfeatures = [
    ["템플릿 시스템", "40+ 자동 변수 바인딩\n기사명, 단가, 보험 등"],
    ["카테고리별 계약", "택배사별 다른 조건\n자동 적용"],
    ["감사 추적", "IP, 디바이스, 동의내역\n시간 기록 자동 수집"],
    ["변경 요청", "단가/보험 변경 알림\n기사 수락/거부 관리"],
  ];
  cfeatures.forEach(([title, desc], i) => {
    const xx = 0.6 + i * 2.3;
    addCard(s, xx, 3.1, 2.1, 1.4);
    addCardAccent(s, xx, 3.1, 1.4, C.primaryLight);
    s.addText(title, { x: xx + 0.18, y: 3.2, w: 1.75, h: 0.25, fontSize: 12, fontFace: FONT.b, color: C.text, bold: true, margin: 0 });
    s.addText(desc, { x: xx + 0.18, y: 3.5, w: 1.75, h: 0.8, fontSize: 10, fontFace: FONT.b, color: C.textMuted, margin: 0 });
  });
}

// =====================================================
// SLIDE 11: DRIVER/CATEGORY MANAGEMENT
// =====================================================
{
  const s = addSlide(11, TOTAL);
  addHeader(s, "MANAGEMENT");
  addTitle(s, "기사 및 카테고리 관리");

  // Left
  addCard(s, 0.6, 1.5, 4.3, 3.6);
  s.addText("기사 관리", { x: 0.85, y: 1.6, w: 3.5, h: 0.3, fontSize: 14, fontFace: FONT.b, color: C.text, bold: true, margin: 0 });
  addBullets(s, 0.85, 2.0, 3.8, 2.8, [
    "기사 등록/수정/삭제 (CRUD)",
    "개인정보: 이름, 연락처, 주소",
    "차량 정보: 차량번호, 면허번호",
    "세금 유형: 사업자/개인/3.3% 원천징수",
    "상태 관리: 활동/휴식/비활성",
    "초대 코드: 기사가 앱에서 직접 가입",
  ], { fontSize: 11 });

  // Right
  addCard(s, 5.1, 1.5, 4.3, 3.6);
  s.addText("카테고리(주선사) 관리", { x: 5.35, y: 1.6, w: 3.5, h: 0.3, fontSize: 14, fontFace: FONT.b, color: C.text, bold: true, margin: 0 });
  addBullets(s, 5.35, 2.0, 3.8, 2.8, [
    "택배사별 카테고리 설정",
    "CJ, 쿠팡, 한진 등 개별 관리",
    "카테고리별 배송/반품/집하 단가",
    "카테고리별 공제 항목 설정",
    "보험료율 (고용/산재) 개별 설정",
    "엑셀 업로드 매핑 프리셋",
  ], { fontSize: 11 });
}

// =====================================================
// SLIDE 12: ADMIN DASHBOARD
// =====================================================
{
  const s = addSlide(12, TOTAL);
  addHeader(s, "SAAS ADMIN");
  addTitle(s, "SaaS 운영 관리");

  const admFeatures = [
    ["대리점 관리", "가입/활성/정지/해지 상태 추적\n대리점별 기사 수 및 이용 현황", C.primary],
    ["구독 관리", "Free / Basic / Standard / Enterprise\n요금제별 기능 제한 및 업그레이드", C.accent],
    ["SaaS 지표", "MRR, 대리점 수, 요금제 분포\n이탈률, 활성 사용자 수 추적", C.primaryLight],
    ["빌링 설정", "결제 주기: 월/1년/2년/3년\n결제 수단 관리 및 청구서", C.success],
  ];

  admFeatures.forEach(([title, desc, color], i) => {
    const col = i % 2;
    const row = Math.floor(i / 2);
    const xx = 0.6 + col * 4.6;
    const yy = 1.5 + row * 1.8;
    addCard(s, xx, yy, 4.2, 1.5);
    addCardAccent(s, xx, yy, 1.5, color);
    s.addText(title, { x: xx + 0.2, y: yy + 0.15, w: 3.5, h: 0.3, fontSize: 14, fontFace: FONT.b, color: C.text, bold: true, margin: 0 });
    s.addText(desc, { x: xx + 0.2, y: yy + 0.55, w: 3.5, h: 0.7, fontSize: 11, fontFace: FONT.b, color: C.textMuted, margin: 0 });
  });
}

// =====================================================
// SLIDE 13: MOBILE APP INTRO
// =====================================================
{
  const s = addSlide(13, TOTAL);
  // Section divider style
  s.addShape(pres.shapes.RECTANGLE, { x: 0, y: 0, w: 10, h: 5.625, fill: { color: C.primary, transparency: 70 } });
  s.addShape(pres.shapes.RECTANGLE, { x: 0, y: 0, w: 10, h: 0.06, fill: { color: C.accent } });
  s.addText("PART 3", { x: 0.8, y: 1.0, w: 8, h: 0.4, fontSize: 12, fontFace: FONT.b, color: C.accent, charSpacing: 5, margin: 0 });
  s.addText("기사앱 사용 설명서", { x: 0.8, y: 1.5, w: 8, h: 0.8, fontSize: 36, fontFace: FONT.h, color: C.text, bold: true, margin: 0 });
  s.addText("배송 기사를 위한 올인원 모바일 앱", { x: 0.8, y: 2.4, w: 8, h: 0.4, fontSize: 16, fontFace: FONT.b, color: C.textMuted, margin: 0 });

  // 5 tabs
  const tabs = [
    ["홈", "대시보드\n예상 정산액"],
    ["정산서", "월별 정산\n내역 조회"],
    ["계약", "전자서명\n계약 관리"],
    ["교육", "법정교육\n이수 관리"],
    ["프로필", "내 정보\n알림 설정"],
  ];
  tabs.forEach(([name, desc], i) => {
    const xx = 0.8 + i * 1.8;
    addCard(s, xx, 3.2, 1.6, 1.5);
    s.addText(name, { x: xx, y: 3.35, w: 1.6, h: 0.35, fontSize: 16, fontFace: FONT.h, color: C.accent, align: "center", bold: true, margin: 0 });
    s.addText(desc, { x: xx, y: 3.75, w: 1.6, h: 0.7, fontSize: 10, fontFace: FONT.b, color: C.textMuted, align: "center", margin: 0 });
  });
}

// =====================================================
// SLIDE 14: REGISTRATION
// =====================================================
{
  const s = addSlide(14, TOTAL);
  addHeader(s, "USER GUIDE");
  addTitle(s, "Step 1: 회원가입");

  const steps = [
    ["1", "초대코드 입력", "대리점에서 발급받은 초대코드 입력\n소속 대리점 자동 연결", C.accent],
    ["2", "개인정보 입력", "이름, 생년월일 입력\n기본 프로필 정보 등록", C.primaryLight],
    ["3", "휴대폰 인증", "SMS OTP 발송\n인증번호 6자리 입력 확인", C.accent],
    ["4", "비밀번호 설정", "비밀번호 6자리 이상 설정\n비밀번호 확인 입력", C.primaryLight],
    ["5", "가입 완료", "계정 생성 + 기사 프로필 등록\n자동 로그인 → 홈 화면 이동", C.success],
  ];

  steps.forEach(([num, title, desc, color], i) => {
    const yy = 1.45 + i * 0.78;
    // Step number circle
    s.addShape(pres.shapes.OVAL, { x: 0.7, y: yy + 0.05, w: 0.45, h: 0.45, fill: { color } });
    s.addText(num, { x: 0.7, y: yy + 0.05, w: 0.45, h: 0.45, fontSize: 16, fontFace: FONT.h, color: C.bg, align: "center", valign: "middle", margin: 0 });
    // Content
    s.addText(title, { x: 1.35, y: yy, w: 3, h: 0.25, fontSize: 13, fontFace: FONT.b, color: C.text, bold: true, margin: 0 });
    s.addText(desc, { x: 1.35, y: yy + 0.28, w: 5, h: 0.4, fontSize: 10, fontFace: FONT.b, color: C.textMuted, margin: 0 });
    if (i < 4) {
      s.addShape(pres.shapes.LINE, { x: 0.92, y: yy + 0.52, w: 0, h: 0.25, line: { color: C.border, width: 1 } });
    }
  });
}

// =====================================================
// SLIDE 15: LOGIN
// =====================================================
{
  const s = addSlide(15, TOTAL);
  addHeader(s, "USER GUIDE");
  addTitle(s, "Step 2: 로그인");

  addCard(s, 0.6, 1.5, 4.5, 3.5);
  s.addText("로그인 화면", { x: 0.85, y: 1.6, w: 3.5, h: 0.3, fontSize: 14, fontFace: FONT.b, color: C.text, bold: true, margin: 0 });
  addBullets(s, 0.85, 2.1, 4.0, 2.5, [
    "휴대폰 번호 입력 (010-XXXX-XXXX)",
    "비밀번호 입력 (보안 입력)",
    "로그인 버튼 터치",
    "자동 세션 유지 (재로그인 불필요)",
    "인증 실패 시 에러 알림 표시",
  ], { fontSize: 12 });

  addCard(s, 5.3, 1.5, 4.1, 3.5);
  s.addText("참고 사항", { x: 5.55, y: 1.6, w: 3.5, h: 0.3, fontSize: 14, fontFace: FONT.b, color: C.text, bold: true, margin: 0 });
  addBullets(s, 5.55, 2.1, 3.6, 2.5, [
    "Supabase Auth 기반 인증",
    "세션 자동 갱신 (토큰 관리)",
    "로그아웃: 프로필 탭 하단",
    "비밀번호 분실 시 재설정 가능",
  ], { fontSize: 12 });
}

// =====================================================
// SLIDE 16: HOME TAB
// =====================================================
{
  const s = addSlide(16, TOTAL);
  addHeader(s, "HOME TAB");
  addTitle(s, "홈 탭: 한눈에 보는 내 현황");

  // Main KPI
  addCard(s, 0.6, 1.5, 4.5, 1.6);
  s.addText("이번달 예상 정산액", { x: 0.85, y: 1.6, w: 3, h: 0.25, fontSize: 11, fontFace: FONT.b, color: C.textMuted, margin: 0 });
  s.addText("₩2,840,000", { x: 0.85, y: 1.9, w: 3.5, h: 0.5, fontSize: 28, fontFace: FONT.h, color: C.accent, bold: true, margin: 0 });
  // Sub metrics
  const subM = [["기본급", "₩2,200,000"], ["인센티브", "+₩740,000"], ["공제액", "-₩100,000"]];
  subM.forEach(([label, val], i) => {
    const xx = 0.85 + i * 1.4;
    s.addText(label, { x: xx, y: 2.45, w: 1.3, h: 0.2, fontSize: 9, fontFace: FONT.b, color: C.textDim, margin: 0 });
    s.addText(val, { x: xx, y: 2.65, w: 1.3, h: 0.25, fontSize: 11, fontFace: FONT.b, color: i === 1 ? C.success : i === 2 ? C.danger : C.text, bold: true, margin: 0 });
  });

  // Quick access grid
  addCard(s, 5.3, 1.5, 4.1, 1.6);
  s.addText("빠른 이동", { x: 5.55, y: 1.6, w: 3, h: 0.25, fontSize: 11, fontFace: FONT.b, color: C.textMuted, margin: 0 });
  const quicks = ["정산서", "세금계산서", "공지사항", "계약서"];
  quicks.forEach((label, i) => {
    const col = i % 2;
    const row = Math.floor(i / 2);
    const xx = 5.55 + col * 1.9;
    const yy = 1.95 + row * 0.5;
    s.addShape(pres.shapes.RECTANGLE, { x: xx, y: yy, w: 1.7, h: 0.4, fill: { color: C.bgCard2 } });
    s.addText(label, { x: xx, y: yy, w: 1.7, h: 0.4, fontSize: 11, fontFace: FONT.b, color: C.primaryLight, align: "center", valign: "middle", margin: 0 });
  });

  // Preview sections
  addCard(s, 0.6, 3.35, 4.5, 1.8);
  s.addText("최근 정산 내역", { x: 0.85, y: 3.45, w: 3, h: 0.25, fontSize: 12, fontFace: FONT.b, color: C.text, bold: true, margin: 0 });
  s.addText("2026년 3월  |  ₩2,840,000  |  미정산", { x: 0.85, y: 3.8, w: 4, h: 0.2, fontSize: 10, fontFace: FONT.b, color: C.textMuted, margin: 0 });
  s.addText("2026년 2월  |  ₩3,120,000  |  정산완료", { x: 0.85, y: 4.1, w: 4, h: 0.2, fontSize: 10, fontFace: FONT.b, color: C.textMuted, margin: 0 });

  addCard(s, 5.3, 3.35, 4.1, 1.8);
  s.addText("최근 공지사항", { x: 5.55, y: 3.45, w: 3, h: 0.25, fontSize: 12, fontFace: FONT.b, color: C.text, bold: true, margin: 0 });
  s.addText("3월 정산 안내사항  |  2026.03.25", { x: 5.55, y: 3.8, w: 3.6, h: 0.2, fontSize: 10, fontFace: FONT.b, color: C.textMuted, margin: 0 });
  s.addText("안전운전 가이드 업데이트  |  2026.03.20", { x: 5.55, y: 4.1, w: 3.6, h: 0.2, fontSize: 10, fontFace: FONT.b, color: C.textMuted, margin: 0 });
}

// =====================================================
// SLIDE 17: SETTLEMENT TAB
// =====================================================
{
  const s = addSlide(17, TOTAL);
  addHeader(s, "SETTLEMENT");
  addTitle(s, "정산서 탭: 월별 정산 내역");

  // Left: List view
  addCard(s, 0.6, 1.5, 4.5, 3.7);
  s.addText("정산 목록", { x: 0.85, y: 1.6, w: 3, h: 0.3, fontSize: 13, fontFace: FONT.b, color: C.text, bold: true, margin: 0 });
  addBullets(s, 0.85, 2.0, 4.0, 1.5, [
    "월 선택 드롭다운으로 조회 기간 변경",
    "정산 카드: 월별 총액 + 상태 뱃지",
    "상태: 미정산 / 확인중 / 정산완료",
    "카드 터치 → 확장: 기본급/인센티브/공제/총액",
  ], { fontSize: 11 });

  // Status badges mockup
  const statuses = [
    ["미정산", C.danger], ["확인중", C.warning], ["정산완료", C.success]
  ];
  statuses.forEach(([label, color], i) => {
    const xx = 0.9 + i * 1.4;
    s.addShape(pres.shapes.RECTANGLE, { x: xx, y: 3.8, w: 1.2, h: 0.35, fill: { color, transparency: 70 } });
    s.addText(label, { x: xx, y: 3.8, w: 1.2, h: 0.35, fontSize: 10, fontFace: FONT.b, color, align: "center", valign: "middle", bold: true, margin: 0 });
  });

  // Right: Detail view
  addCard(s, 5.3, 1.5, 4.1, 3.7);
  s.addText("상세 화면", { x: 5.55, y: 1.6, w: 3, h: 0.3, fontSize: 13, fontFace: FONT.b, color: C.text, bold: true, margin: 0 });
  const detailItems = [
    ["배송 건수", "150건"],
    ["기본금액", "₩2,200,000"],
    ["인센티브", "+₩740,000"],
    ["총 수입", "₩2,940,000"],
    ["공제(보험/통신/유류)", "-₩100,000"],
    ["최종 지급액", "₩2,840,000"],
  ];
  detailItems.forEach(([label, val], i) => {
    const yy = 2.0 + i * 0.45;
    s.addText(label, { x: 5.55, y: yy, w: 2.2, h: 0.25, fontSize: 11, fontFace: FONT.b, color: C.textMuted, margin: 0 });
    s.addText(val, { x: 7.5, y: yy, w: 1.7, h: 0.25, fontSize: 11, fontFace: FONT.b, color: i === 5 ? C.accent : i === 2 ? C.success : i === 4 ? C.danger : C.text, align: "right", bold: i >= 3, margin: 0 });
    if (i === 3) {
      s.addShape(pres.shapes.LINE, { x: 5.55, y: yy + 0.3, w: 3.6, h: 0, line: { color: C.border, width: 0.5 } });
    }
  });
}

// =====================================================
// SLIDE 18: CONTRACT TAB
// =====================================================
{
  const s = addSlide(18, TOTAL);
  addHeader(s, "CONTRACTS");
  addTitle(s, "계약 탭: 전자계약 서명");

  addCard(s, 0.6, 1.5, 4.5, 3.7);
  s.addText("계약 목록 화면", { x: 0.85, y: 1.6, w: 3.5, h: 0.3, fontSize: 13, fontFace: FONT.b, color: C.text, bold: true, margin: 0 });
  addBullets(s, 0.85, 2.0, 4.0, 2.0, [
    "미서명 계약: 서명 필요 알림 표시",
    "서명됨: 체크 아이콘 + 서명 날짜",
    "확인중: 운영사 검토 중 상태",
    "만료: 기한 초과 계약",
    "빈 상태: '계약서가 없습니다' 안내",
  ], { fontSize: 11 });

  // Contract statuses
  const cStatuses = [["미서명", C.textMuted], ["서명됨", C.success], ["확인중", C.warning], ["만료", C.danger]];
  cStatuses.forEach(([label, color], i) => {
    const xx = 0.9 + i * 1.05;
    s.addShape(pres.shapes.RECTANGLE, { x: xx, y: 4.3, w: 0.9, h: 0.3, fill: { color, transparency: 70 } });
    s.addText(label, { x: xx, y: 4.3, w: 0.9, h: 0.3, fontSize: 9, fontFace: FONT.b, color, align: "center", valign: "middle", margin: 0 });
  });

  addCard(s, 5.3, 1.5, 4.1, 3.7);
  s.addText("계약 상세 화면", { x: 5.55, y: 1.6, w: 3.5, h: 0.3, fontSize: 13, fontFace: FONT.b, color: C.text, bold: true, margin: 0 });
  addBullets(s, 5.55, 2.0, 3.6, 2.0, [
    "계약 본문: 위·수탁 표준계약서",
    "별지1: 개인정보 수집/이용 동의",
    "별지2: 제3자 제공 동의",
    "서명 후 PDF 다운로드 링크",
  ], { fontSize: 11 });

  // Amendment section
  s.addText("계약 변경 요청", { x: 5.55, y: 3.5, w: 3, h: 0.25, fontSize: 12, fontFace: FONT.b, color: C.warning, bold: true, margin: 0 });
  addBullets(s, 5.55, 3.8, 3.6, 1.0, [
    "단가 변경, 보험 변경 등 알림",
    "변경 전/후 비교 → 수락/거부",
  ], { fontSize: 10 });
}

// =====================================================
// SLIDE 19: E-SIGNATURE FLOW
// =====================================================
{
  const s = addSlide(19, TOTAL);
  addHeader(s, "E-SIGNATURE");
  addTitle(s, "전자서명 절차 (5단계)");

  const sigSteps = [
    ["1", "동의 항목 체크", "5개 항목: 계약내용, 개인정보수집,\n고유식별정보, 제3자제공, 고유식별 제3자", C.accent],
    ["2", "동의 방식 선택", "전체동의 한번에 또는\n개별항목 하나씩 체크", C.primaryLight],
    ["3", "본인인증 (선택)", "PASS: 통신사 본인확인\n카카오: 카카오톡 간편인증", C.accent],
    ["4", "서명 입력", "서명 패드에 직접 터치 드로잉\nSVG 기반 실시간 서명 캡처", C.primaryLight],
    ["5", "서명 제출", "계약 완료 + 서명 PDF 자동 생성\n감사 추적 데이터 수집 완료", C.success],
  ];

  sigSteps.forEach(([num, title, desc, color], i) => {
    const yy = 1.35 + i * 0.82;
    s.addShape(pres.shapes.OVAL, { x: 0.65, y: yy + 0.08, w: 0.4, h: 0.4, fill: { color } });
    s.addText(num, { x: 0.65, y: yy + 0.08, w: 0.4, h: 0.4, fontSize: 14, fontFace: FONT.h, color: C.bg, align: "center", valign: "middle", margin: 0 });
    s.addText(title, { x: 1.25, y: yy, w: 2.5, h: 0.25, fontSize: 13, fontFace: FONT.b, color: C.text, bold: true, margin: 0 });
    s.addText(desc, { x: 1.25, y: yy + 0.28, w: 4.5, h: 0.45, fontSize: 10, fontFace: FONT.b, color: C.textMuted, margin: 0 });
    if (i < 4) {
      s.addShape(pres.shapes.LINE, { x: 0.85, y: yy + 0.5, w: 0, h: 0.32, line: { color: C.border, width: 1 } });
    }
  });

  // Audit trail box
  addCard(s, 6.0, 1.35, 3.5, 3.9);
  s.addText("감사 추적 데이터", { x: 6.2, y: 1.45, w: 3, h: 0.3, fontSize: 12, fontFace: FONT.b, color: C.accent, bold: true, margin: 0 });
  addBullets(s, 6.2, 1.85, 3.1, 3.0, [
    "서명 이미지 (Base64 SVG)",
    "서명자 IP 주소 (자동 수집)",
    "디바이스 정보 (User Agent)",
    "서명 일시 (Timestamp)",
    "5개 동의 항목 기록 (Boolean)",
    "인증 방식 (PASS/카카오/앱인증)",
    "감사 로그 JSON 전체 기록",
  ], { fontSize: 10 });
  s.addText("* 전자문서법 준수 감사 추적", { x: 6.2, y: 4.8, w: 3, h: 0.2, fontSize: 9, fontFace: FONT.b, color: C.textDim, italic: true, margin: 0 });
}

// =====================================================
// SLIDE 20: EDUCATION TAB
// =====================================================
{
  const s = addSlide(20, TOTAL);
  addHeader(s, "EDUCATION");
  addTitle(s, "교육 탭: 법정 의무교육");

  // Left: Course list
  addCard(s, 0.6, 1.5, 4.5, 3.7);
  s.addText("교육 목록", { x: 0.85, y: 1.6, w: 3, h: 0.3, fontSize: 13, fontFace: FONT.b, color: C.text, bold: true, margin: 0 });
  addBullets(s, 0.85, 2.0, 4.0, 2.0, [
    "상태 뱃지: 이수완료 / 진행중(%) / 미수강",
    "이수 현황: 'X/Y 이수' 표시",
    "카테고리별 교육: 안전운전, 법규 등",
    "진행 중 과정 → 프로그레스 바 표시",
    "완료 시 이수증번호 + 완료일 표시",
  ], { fontSize: 11 });

  // Right: 3-step learning
  addCard(s, 5.3, 1.5, 4.1, 3.7);
  s.addText("3단계 학습 프로세스", { x: 5.55, y: 1.6, w: 3.5, h: 0.3, fontSize: 13, fontFace: FONT.b, color: C.text, bold: true, margin: 0 });

  const eduSteps = [
    ["1", "동영상 시청", "영상 플레이어 재생\n시청 시간 자동 기록", C.accent],
    ["2", "텍스트 읽기", "교육 자료 스크롤 읽기\n읽기 시간 자동 기록", C.primaryLight],
    ["3", "퀴즈 풀기", "객관식 문제 풀이\n합격점 이상 시 이수완료", C.success],
  ];
  eduSteps.forEach(([num, title, desc, color], i) => {
    const yy = 2.1 + i * 0.95;
    s.addShape(pres.shapes.OVAL, { x: 5.55, y: yy, w: 0.35, h: 0.35, fill: { color } });
    s.addText(num, { x: 5.55, y: yy, w: 0.35, h: 0.35, fontSize: 12, fontFace: FONT.h, color: C.bg, align: "center", valign: "middle", margin: 0 });
    s.addText(title, { x: 6.05, y: yy - 0.02, w: 2.5, h: 0.22, fontSize: 12, fontFace: FONT.b, color: C.text, bold: true, margin: 0 });
    s.addText(desc, { x: 6.05, y: yy + 0.22, w: 3, h: 0.55, fontSize: 10, fontFace: FONT.b, color: C.textMuted, margin: 0 });
  });

  // Anti-cheat note
  s.addShape(pres.shapes.RECTANGLE, { x: 5.55, y: 4.7, w: 3.6, h: 0.35, fill: { color: C.warning, transparency: 80 } });
  s.addText("학습 인증: 3-7분 랜덤 확인팝업 + 탭전환 감지", { x: 5.65, y: 4.72, w: 3.4, h: 0.3, fontSize: 9, fontFace: FONT.b, color: C.warning, margin: 0 });
}

// =====================================================
// SLIDE 21: NOTICE TAB
// =====================================================
{
  const s = addSlide(21, TOTAL);
  addHeader(s, "NOTICE");
  addTitle(s, "공지 탭: 대리점 공지");

  addCard(s, 0.6, 1.5, 5.5, 3.5);
  s.addText("공지사항 목록", { x: 0.85, y: 1.6, w: 3, h: 0.3, fontSize: 13, fontFace: FONT.b, color: C.text, bold: true, margin: 0 });

  // Category filter
  const cats = [["전체", C.textMuted], ["공지", C.primaryLight], ["가이드", C.success], ["업데이트", C.warning]];
  cats.forEach(([label, color], i) => {
    const xx = 0.9 + i * 1.2;
    s.addShape(pres.shapes.RECTANGLE, { x: xx, y: 2.05, w: 1.0, h: 0.3, fill: { color: i === 0 ? C.bgCard2 : C.bgCard } });
    s.addText(label, { x: xx, y: 2.05, w: 1.0, h: 0.3, fontSize: 10, fontFace: FONT.b, color, align: "center", valign: "middle", margin: 0 });
  });

  // Sample notices
  const notices = [
    ["3월 정산 안내사항", "공지", "2026.03.25", true],
    ["안전운전 가이드 업데이트", "가이드", "2026.03.20", true],
    ["앱 버전 2.1.0 업데이트", "업데이트", "2026.03.15", false],
    ["설 연휴 운영 안내", "공지", "2026.03.10", false],
  ];
  notices.forEach(([title, cat, date, unread], i) => {
    const yy = 2.55 + i * 0.55;
    if (unread) {
      s.addShape(pres.shapes.OVAL, { x: 0.9, y: yy + 0.12, w: 0.1, h: 0.1, fill: { color: C.danger } });
    }
    s.addText(title, { x: 1.15, y: yy, w: 3.2, h: 0.25, fontSize: 11, fontFace: FONT.b, color: C.text, bold: unread, margin: 0 });
    s.addText(`${cat}  |  ${date}`, { x: 1.15, y: yy + 0.25, w: 3, h: 0.2, fontSize: 9, fontFace: FONT.b, color: C.textDim, margin: 0 });
  });

  // Right: Features
  addCard(s, 6.4, 1.5, 3.0, 3.5);
  s.addText("기능", { x: 6.6, y: 1.6, w: 2.5, h: 0.3, fontSize: 13, fontFace: FONT.b, color: C.text, bold: true, margin: 0 });
  addBullets(s, 6.6, 2.0, 2.6, 2.5, [
    "카테고리 필터링",
    "읽지 않은 알림 표시",
    "카테고리별 색상 구분",
    "날짜순 정렬",
    "상세 내용 조회",
  ], { fontSize: 11 });
}

// =====================================================
// SLIDE 22: PROFILE TAB
// =====================================================
{
  const s = addSlide(22, TOTAL);
  addHeader(s, "PROFILE");
  addTitle(s, "프로필 탭: 내 정보 관리");

  // Profile mockup
  addCard(s, 0.6, 1.5, 4.5, 1.2);
  s.addShape(pres.shapes.OVAL, { x: 0.85, y: 1.65, w: 0.8, h: 0.8, fill: { color: C.primary } });
  s.addText("홍", { x: 0.85, y: 1.65, w: 0.8, h: 0.8, fontSize: 22, fontFace: FONT.h, color: C.text, align: "center", valign: "middle", margin: 0 });
  s.addText("홍길동", { x: 1.85, y: 1.7, w: 2, h: 0.3, fontSize: 16, fontFace: FONT.b, color: C.text, bold: true, margin: 0 });
  s.addText("로지스틱스 대리점", { x: 1.85, y: 2.02, w: 2, h: 0.25, fontSize: 11, fontFace: FONT.b, color: C.textMuted, margin: 0 });

  // Stats
  const stats = [["가입일", "2026.01.15"], ["계약상태", "활성"], ["미서명", "1건"]];
  stats.forEach(([label, val], i) => {
    const xx = 0.85 + i * 1.4;
    s.addText(label, { x: xx, y: 2.9, w: 1.2, h: 0.2, fontSize: 9, fontFace: FONT.b, color: C.textDim, align: "center", margin: 0 });
    s.addText(val, { x: xx, y: 3.1, w: 1.2, h: 0.25, fontSize: 12, fontFace: FONT.b, color: i === 1 ? C.success : i === 2 ? C.warning : C.text, align: "center", bold: true, margin: 0 });
  });

  // Menu items
  addCard(s, 0.6, 3.5, 4.5, 1.7);
  const menus = ["내 정보", "연락처", "차량번호", "서류 관리"];
  menus.forEach((label, i) => {
    const yy = 3.6 + i * 0.38;
    s.addText("▸  " + label, { x: 0.85, y: yy, w: 3, h: 0.3, fontSize: 11, fontFace: FONT.b, color: C.textMuted, margin: 0 });
  });

  // Right: Notifications + App info
  addCard(s, 5.3, 1.5, 4.1, 2.0);
  s.addText("알림 설정", { x: 5.55, y: 1.6, w: 3, h: 0.3, fontSize: 13, fontFace: FONT.b, color: C.text, bold: true, margin: 0 });
  const notifs = ["정산서 알림", "공지사항 알림", "계약 알림"];
  notifs.forEach((label, i) => {
    const yy = 2.0 + i * 0.4;
    s.addText(label, { x: 5.55, y: yy, w: 2.5, h: 0.3, fontSize: 11, fontFace: FONT.b, color: C.textMuted, margin: 0 });
    s.addShape(pres.shapes.RECTANGLE, { x: 8.4, y: yy + 0.05, w: 0.6, h: 0.22, fill: { color: C.success } });
    s.addText("ON", { x: 8.4, y: yy + 0.05, w: 0.6, h: 0.22, fontSize: 8, fontFace: FONT.b, color: C.text, align: "center", valign: "middle", margin: 0 });
  });

  addCard(s, 5.3, 3.75, 4.1, 1.45);
  s.addText("앱 정보", { x: 5.55, y: 3.85, w: 3, h: 0.3, fontSize: 13, fontFace: FONT.b, color: C.text, bold: true, margin: 0 });
  const appInfo = ["버전 정보", "이용약관", "개인정보처리방침"];
  appInfo.forEach((label, i) => {
    s.addText("▸  " + label, { x: 5.55, y: 4.2 + i * 0.3, w: 3, h: 0.25, fontSize: 11, fontFace: FONT.b, color: C.textMuted, margin: 0 });
  });
}

// =====================================================
// SLIDE 23: BUSINESS MODEL
// =====================================================
{
  const s = addSlide(23, TOTAL);
  addHeader(s, "BUSINESS MODEL");
  addTitle(s, "SaaS 구독 모델");

  const plans = [
    ["Free", "₩0", ["기본 기능", "기사 5명 제한", "정산 기본"], C.textMuted],
    ["Basic", "₩49,900", ["기사 30명", "정산 + 계약", "엑셀 업로드"], C.primaryLight],
    ["Standard", "₩99,900", ["기사 80명", "전체 기능", "법정교육 포함"], C.accent],
    ["Enterprise", "커스텀", ["무제한 기사", "전담 지원", "맞춤 개발"], C.success],
  ];

  plans.forEach(([name, price, features, color], i) => {
    const xx = 0.4 + i * 2.4;
    const isPopular = i === 2;
    addCard(s, xx, 1.5, 2.15, 3.2, isPopular ? C.primary : C.bgCard);
    if (isPopular) {
      s.addShape(pres.shapes.RECTANGLE, { x: xx + 0.4, y: 1.4, w: 1.35, h: 0.25, fill: { color: C.accent } });
      s.addText("POPULAR", { x: xx + 0.4, y: 1.4, w: 1.35, h: 0.25, fontSize: 8, fontFace: FONT.b, color: C.bg, align: "center", valign: "middle", bold: true, margin: 0 });
    }
    s.addText(name, { x: xx, y: 1.65, w: 2.15, h: 0.3, fontSize: 14, fontFace: FONT.h, color, align: "center", bold: true, margin: 0 });
    s.addText(price, { x: xx, y: 2.0, w: 2.15, h: 0.4, fontSize: 22, fontFace: FONT.h, color: C.text, align: "center", bold: true, margin: 0 });
    s.addText("/월", { x: xx + 1.3, y: 2.15, w: 0.5, h: 0.2, fontSize: 9, fontFace: FONT.b, color: C.textDim, margin: 0 });
    s.addShape(pres.shapes.LINE, { x: xx + 0.2, y: 2.5, w: 1.75, h: 0, line: { color: C.border, width: 0.5 } });
    features.forEach((feat, fi) => {
      s.addText("✓  " + feat, { x: xx + 0.15, y: 2.65 + fi * 0.35, w: 1.85, h: 0.28, fontSize: 10, fontFace: FONT.b, color: C.textMuted, margin: 0 });
    });
  });

  // Billing cycles
  s.addShape(pres.shapes.RECTANGLE, { x: 0.6, y: 4.9, w: 8.8, h: 0.45, fill: { color: C.bgCard } });
  s.addText("결제 주기:  월결제  |  1년 (10%↓)  |  2년 (15%↓)  |  3년 (20%↓)", {
    x: 0.6, y: 4.9, w: 8.8, h: 0.45, fontSize: 11, fontFace: FONT.b,
    color: C.textMuted, align: "center", valign: "middle", margin: 0,
  });
}

// =====================================================
// SLIDE 24: TECH ARCHITECTURE
// =====================================================
{
  const s = addSlide(24, TOTAL);
  addHeader(s, "TECHNOLOGY");
  addTitle(s, "기술 스택");

  const techGroups = [
    ["웹 프론트엔드", ["Next.js 14 (App Router)", "React 18", "TypeScript", "Tailwind CSS"], C.primaryLight],
    ["모바일", ["Expo SDK 54", "React Native 0.79", "Expo Router v5", "Zustand"], C.accent],
    ["백엔드", ["Supabase", "PostgreSQL", "Supabase Auth", "Edge Functions"], C.primary],
    ["보안/인프라", ["RLS 20+ 정책", "멀티테넌트 격리", "전자서명 감사로그", "26 테이블 DB"], C.success],
  ];

  techGroups.forEach(([title, items, color], i) => {
    const col = i % 2;
    const row = Math.floor(i / 2);
    const xx = 0.6 + col * 4.6;
    const yy = 1.5 + row * 1.9;
    addCard(s, xx, yy, 4.2, 1.6);
    addCardAccent(s, xx, yy, 1.6, color);
    s.addText(title, { x: xx + 0.2, y: yy + 0.1, w: 3.5, h: 0.3, fontSize: 14, fontFace: FONT.b, color, bold: true, margin: 0 });
    items.forEach((item, j) => {
      s.addText("▸  " + item, { x: xx + 0.2, y: yy + 0.45 + j * 0.27, w: 3.5, h: 0.22, fontSize: 11, fontFace: FONT.b, color: C.textMuted, margin: 0 });
    });
  });
}

// =====================================================
// SLIDE 25: DEVELOPMENT STATUS
// =====================================================
{
  const s = addSlide(25, TOTAL);
  addHeader(s, "STATUS");
  addTitle(s, "개발 진행 현황");

  // Milestone timeline
  const milestones = [
    ["M001", "Full-Stack Foundation", "2026.03.29", "19테이블 DB, 웹 정산/계약, 모바일 전자서명", true],
    ["M002", "All Pages Complete", "2026.03.29", "웹 30p, 모바일 5탭, 정산표시설정", true],
    ["M003", "Real Data Testing", "진행중", "실데이터 품질 게이트 평가", false],
  ];

  milestones.forEach(([code, name, date, desc, done], i) => {
    const yy = 1.5 + i * 1.1;
    // Timeline dot
    s.addShape(pres.shapes.OVAL, { x: 0.7, y: yy + 0.15, w: 0.3, h: 0.3, fill: { color: done ? C.success : C.warning } });
    if (i < 2) {
      s.addShape(pres.shapes.LINE, { x: 0.85, y: yy + 0.48, w: 0, h: 0.6, line: { color: C.border, width: 1.5 } });
    }
    s.addText(`${code}: ${name}`, { x: 1.2, y: yy, w: 5, h: 0.3, fontSize: 14, fontFace: FONT.b, color: C.text, bold: true, margin: 0 });
    s.addText(date, { x: 1.2, y: yy + 0.3, w: 2, h: 0.2, fontSize: 10, fontFace: FONT.b, color: done ? C.success : C.warning, margin: 0 });
    s.addText(desc, { x: 3.2, y: yy + 0.3, w: 5, h: 0.2, fontSize: 10, fontFace: FONT.b, color: C.textMuted, margin: 0 });
  });

  // Stats
  addStat(s, 0.6, 4.2, "0", "TS 에러", C.success);
  addStat(s, 2.85, 4.2, "28", "서비스 파일", C.accent);
  addStat(s, 5.1, 4.2, "35", "페이지 수", C.primaryLight);
  addStat(s, 7.35, 4.2, "26", "DB 테이블", C.accent);
}

// =====================================================
// SLIDE 26: ROADMAP
// =====================================================
{
  const s = addSlide(26, TOTAL);
  addHeader(s, "ROADMAP");
  addTitle(s, "2026 개발 로드맵");

  const quarters = [
    ["Q2 2026", "보안 강화 + 베타", ["M003 완료 (실데이터 테스트)", "보안 이슈 해결 (키관리, API인증)", "베타 테스트 (5개 대리점)"], C.danger],
    ["Q3 2026", "기능 완성", ["SMS/푸시 알림 연동", "본인인증 (PASS/카카오)", "결제 시스템 구축 (PortOne)"], C.warning],
    ["Q4 2026", "정식 출시", ["앱스토어 등록 (iOS/Android)", "초기 고객 확보 (50 대리점)", "고객 지원 체계 구축"], C.accent],
    ["Q1 2027", "성장", ["기능 고도화 (AI 정산 검증)", "마케팅 확대 (영업팀 구성)", "Server Component 최적화"], C.success],
  ];

  quarters.forEach(([q, subtitle, items, color], i) => {
    const xx = 0.4 + i * 2.4;
    addCard(s, xx, 1.5, 2.2, 3.5);
    s.addShape(pres.shapes.RECTANGLE, { x: xx, y: 1.5, w: 2.2, h: 0.5, fill: { color } });
    s.addText(q, { x: xx, y: 1.5, w: 2.2, h: 0.3, fontSize: 13, fontFace: FONT.h, color: C.text, align: "center", bold: true, margin: 0 });
    s.addText(subtitle, { x: xx, y: 1.78, w: 2.2, h: 0.2, fontSize: 9, fontFace: FONT.b, color: "CADCFC", align: "center", margin: 0 });
    addBullets(s, xx + 0.12, 2.15, 2.0, 2.5, items, { fontSize: 10 });
  });
}

// =====================================================
// SLIDE 27: FINANCIAL PROJECTION
// =====================================================
{
  const s = addSlide(27, TOTAL);
  addHeader(s, "FINANCIALS");
  addTitle(s, "매출 전망 (3개년)");

  // Bar chart
  s.addChart(pres.charts.BAR, [
    { name: "연 매출", labels: ["Year 1\n(2026)", "Year 2\n(2027)", "Year 3\n(2028)"], values: [30, 156, 480] }
  ], {
    x: 0.5, y: 1.4, w: 5.5, h: 3.2, barDir: "col",
    chartColors: [C.accent],
    chartArea: { fill: { color: C.bgCard }, roundedCorners: true },
    catAxisLabelColor: C.textMuted,
    valAxisLabelColor: C.textMuted,
    valGridLine: { color: C.border, size: 0.5 },
    catGridLine: { style: "none" },
    showValue: true,
    dataLabelPosition: "outEnd",
    dataLabelColor: C.accent,
    showLegend: false,
    showTitle: false,
    valAxisTitle: "백만원 (₩M)",
    valAxisTitleColor: C.textDim,
  });

  // Key metrics on right
  addCard(s, 6.3, 1.4, 3.2, 3.7);
  s.addText("핵심 지표", { x: 6.5, y: 1.5, w: 2.8, h: 0.3, fontSize: 13, fontFace: FONT.b, color: C.text, bold: true, margin: 0 });

  const metrics = [
    ["Year 1", "50 대리점", "₩30M", "₩49,900 ARPU"],
    ["Year 2", "200 대리점", "₩156M", "₩65,000 ARPU"],
    ["Year 3", "500 대리점", "₩480M", "₩80,000 ARPU"],
  ];
  metrics.forEach(([year, agencies, revenue, arpu], i) => {
    const yy = 1.95 + i * 0.95;
    s.addText(year, { x: 6.5, y: yy, w: 1.5, h: 0.22, fontSize: 11, fontFace: FONT.b, color: C.accent, bold: true, margin: 0 });
    s.addText(agencies, { x: 6.5, y: yy + 0.22, w: 2.8, h: 0.2, fontSize: 10, fontFace: FONT.b, color: C.textMuted, margin: 0 });
    s.addText(revenue, { x: 6.5, y: yy + 0.42, w: 2.8, h: 0.25, fontSize: 14, fontFace: FONT.h, color: C.text, bold: true, margin: 0 });
    s.addText(arpu, { x: 8.0, y: yy + 0.22, w: 1.3, h: 0.2, fontSize: 9, fontFace: FONT.b, color: C.textDim, align: "right", margin: 0 });
  });

  // BEP
  s.addShape(pres.shapes.RECTANGLE, { x: 6.5, y: 4.3, w: 2.8, h: 0.4, fill: { color: C.warning, transparency: 80 } });
  s.addText("BEP: Year 2 중반 (150 대리점)", { x: 6.55, y: 4.32, w: 2.7, h: 0.35, fontSize: 10, fontFace: FONT.b, color: C.warning, margin: 0 });
  s.addText("초기 투자: 약 3억원", { x: 6.55, y: 4.75, w: 2.7, h: 0.25, fontSize: 10, fontFace: FONT.b, color: C.textDim, margin: 0 });
}

// =====================================================
// SLIDE 28: CLOSING
// =====================================================
{
  const s = addSlide(null, TOTAL);
  s.addShape(pres.shapes.OVAL, { x: -2, y: -1, w: 6, h: 6, fill: { color: C.primary, transparency: 88 } });
  s.addShape(pres.shapes.OVAL, { x: 7, y: 2.5, w: 5, h: 5, fill: { color: C.accent, transparency: 88 } });
  s.addShape(pres.shapes.RECTANGLE, { x: 0, y: 0, w: 10, h: 0.06, fill: { color: C.accent } });

  s.addText("logiSSign과 함께\n배송 대리점의 미래를 바꿉니다", {
    x: 0.8, y: 1.0, w: 8.4, h: 1.4, fontSize: 30, fontFace: FONT.h,
    color: C.text, bold: true, margin: 0,
  });

  s.addShape(pres.shapes.RECTANGLE, { x: 0.8, y: 2.6, w: 1.5, h: 0.04, fill: { color: C.accent } });

  // 3 key points
  const closing = [
    ["정산 자동화 + 전자계약 + 법정교육", "= 올인원 SaaS 플랫폼"],
    ["배송 대리점 특화 + 기사앱 통합", "= 시장 유일의 통합 솔루션"],
    ["한국 15,000개 배송 대리점", "= 디지털 전환 파트너"],
  ];
  closing.forEach(([line1, line2], i) => {
    const yy = 2.9 + i * 0.7;
    s.addText(line1, { x: 0.8, y: yy, w: 8, h: 0.25, fontSize: 14, fontFace: FONT.b, color: C.text, bold: true, margin: 0 });
    s.addText(line2, { x: 0.8, y: yy + 0.28, w: 8, h: 0.25, fontSize: 13, fontFace: FONT.b, color: C.accent, margin: 0 });
  });

  s.addText("THANK YOU", {
    x: 0.8, y: 4.6, w: 8.4, h: 0.4, fontSize: 14, fontFace: FONT.b,
    color: C.textDim, charSpacing: 5, margin: 0,
  });
  s.addText("logiSSign  |  2026", {
    x: 0.8, y: 5.0, w: 8.4, h: 0.3, fontSize: 10, fontFace: FONT.b,
    color: C.textDim, margin: 0,
  });
}

// =====================================================
// WRITE FILE
// =====================================================
const outPath = process.argv[2] || "C:/Users/jshmi/Downloads/logiSSign/logiSSign_사업계획서.pptx";
pres.writeFile({ fileName: outPath }).then(() => {
  console.log("PPTX created: " + outPath);
}).catch(err => {
  console.error("Error:", err);
  process.exit(1);
});
