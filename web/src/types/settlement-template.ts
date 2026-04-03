/**
 * 정산서 템플릿 타입 정의
 * HTML 디자인 5종(Modern/Classic/Clean/Premium/Coupang) 참조 리뉴얼
 */

export interface SettlementTemplate {
  id: string
  name: string
  agency_id?: string

  layout: {
    paperSize: 'A4' | 'Letter'
    orientation: 'portrait' | 'landscape'
    margins: { top: number; right: number; bottom: number; left: number }
  }

  /** 헤더 영역 — 그라디언트/단색/이미지 배경 지원 */
  header: {
    style: 'gradient' | 'solid' | 'minimal'
    primaryColor: string         // 메인 색상 (그라디언트 시작/단색)
    secondaryColor?: string      // 그라디언트 끝 색상
    textColor: string            // 헤더 위 텍스트 색상
    showCompanyName: boolean
    showDocumentNumber: boolean
    showSubtitle: boolean        // "Official Statement" 같은 부제
    subtitleText?: string
  }

  title: {
    text: string                // {{year}}, {{month}}, {{agency_name}} 변수
    fontSize: number
    fontWeight: 'normal' | 'bold'
    alignment: 'left' | 'center' | 'right'
  }

  driverInfo: {
    enabled: boolean
    style: 'grid' | 'inline' | 'card'    // 그리드, 인라인, 카드 형태
    fields: Array<{
      field: string             // name, id, phone, region, period, delivery_count
      label: string
      enabled: boolean
    }>
  }

  /** 요약 카드 (Modern/Coupang 스타일) — 수익/차감/실수령 3칸 */
  summaryCards: {
    enabled: boolean
    style: 'cards' | 'inline' | 'none'
    incomeColor: string          // 수익 카드 악센트 (#059669)
    deductionColor: string       // 차감 카드 악센트 (#dc2626)
    netAmountStyle: 'filled' | 'outlined'  // 실수령 카드: 배경 채우기 / 테두리
    netAmountColor: string
  }

  incomeSection: {
    enabled: boolean
    title: string
    titleColor: string
    accentBarColor: string       // 좌측 컬러 바 (Clean/Modern 스타일)
    items: SettlementItem[]
    showSubtotal: boolean
    subtotalBgColor?: string
  }

  deductionSection: {
    enabled: boolean
    title: string
    titleColor: string
    accentBarColor: string
    items: SettlementItem[]
    showSubtotal: boolean
    subtotalBgColor?: string
  }

  totalSection: {
    enabled: boolean
    label: string
    style: 'dark' | 'colored' | 'simple'  // 네이비배경 / 프라이머리배경 / 단순
    fontSize: number
    fontColor: string
    backgroundColor: string
    showFormula: boolean          // "(A) - (B)" 같은 수식 표시
    showAmountInWords: boolean    // 한글 금액 표시 (금 ~원정)
  }

  footer: {
    notes: string
    showSignatureLine: boolean
    showDate: boolean
    showStamp: boolean
    stampImageUrl?: string
    showCompanyInfo: boolean      // 회사 주소/전화번호
    companyAddress?: string
    companyPhone?: string
    disclaimerText?: string       // 이의 제기 안내 문구
  }

  tableStyle: {
    style: 'bordered' | 'card' | 'minimal'  // 전통표/카드형/미니멀
    headerBgColor: string
    headerTextColor: string
    headerFontSize: number
    bodyFontSize: number
    bodyTextColor: string
    borderColor: string
    alternateRowColor?: string
    zebraStriping: boolean
    showDetailColumn: boolean     // "상세 내역" 컬럼 표시 (Classic)
    showNoteColumn: boolean       // "비고" 컬럼 표시 (Classic)
  }
}

export interface SettlementItem {
  id: string
  label: string
  field: string
  enabled: boolean
  formula?: string
  detail?: string               // 상세 설명 ("450건 x 8,000원")
  fontColor?: string
  fontWeight?: 'normal' | 'bold'
  numberFormat: 'currency' | 'number' | 'percentage'
}

export interface SettlementDriverData {
  name: string
  id?: string
  phone?: string
  region?: string
  period?: string
  deliveryCount?: number
  companyName?: string
  vehicleNumber?: string
  incomeItems: Record<string, number>
  deductionItems: Record<string, number>
  incomeTotal: number
  deductionTotal: number
  netAmount: number
}

export interface SettlementMeta {
  agencyName: string
  year: number
  month: number
  generatedAt: string
  documentNumber?: string
}

/* ══════════════════════════════════════════════
   5종 프리셋 (HTML 디자인 참조)
   ══════════════════════════════════════════════ */

const BASE_DRIVER_FIELDS = [
  { field: 'name', label: '기사명', enabled: true },
  { field: 'id', label: '사번', enabled: true },
  { field: 'period', label: '정산기간', enabled: true },
]

const EXTENDED_DRIVER_FIELDS = [
  ...BASE_DRIVER_FIELDS,
  { field: 'region', label: '배송구간', enabled: true },
  { field: 'deliveryCount', label: '총 배송건수', enabled: true },
]

/** 1. Modern — 그라디언트 헤더 + 요약 카드 + 카드형 테이블 */
const MODERN_TEMPLATE: SettlementTemplate = {
  id: 'modern',
  name: '모던',
  layout: { paperSize: 'A4', orientation: 'portrait', margins: { top: 0, right: 40, bottom: 40, left: 40 } },
  header: {
    style: 'gradient',
    primaryColor: '#7B2FF7',
    secondaryColor: '#5B1FD7',
    textColor: '#ffffff',
    showCompanyName: true,
    showDocumentNumber: false,
    showSubtitle: true,
    subtitleText: 'Official Statement',
  },
  title: { text: '{{year}}년 {{month}}월 정산 명세서', fontSize: 24, fontWeight: 'bold', alignment: 'left' },
  driverInfo: { enabled: true, style: 'inline', fields: BASE_DRIVER_FIELDS },
  summaryCards: {
    enabled: true,
    style: 'cards',
    incomeColor: '#059669',
    deductionColor: '#dc2626',
    netAmountStyle: 'filled',
    netAmountColor: '#7B2FF7',
  },
  incomeSection: {
    enabled: true, title: 'Income Section', titleColor: '#059669',
    accentBarColor: '#059669', items: [], showSubtotal: true, subtotalBgColor: '#ecfdf5',
  },
  deductionSection: {
    enabled: true, title: 'Deduction Section', titleColor: '#dc2626',
    accentBarColor: '#dc2626', items: [], showSubtotal: true, subtotalBgColor: '#fef2f2',
  },
  totalSection: {
    enabled: true, label: 'Final Net Settlement', style: 'colored', fontSize: 20,
    fontColor: '#ffffff', backgroundColor: '#7B2FF7', showFormula: false, showAmountInWords: false,
  },
  footer: {
    notes: '', showSignatureLine: true, showDate: true, showStamp: true,
    showCompanyInfo: false, disclaimerText: '',
  },
  tableStyle: {
    style: 'card', headerBgColor: '#f8fafc', headerTextColor: '#64748b',
    headerFontSize: 9, bodyFontSize: 10, bodyTextColor: '#1e293b',
    borderColor: '#f1f5f9', zebraStriping: false,
    alternateRowColor: '#fafafa', showDetailColumn: false, showNoteColumn: false,
  },
}

/** 2. Classic — 전통적 정산서 + 격식 있는 서명란 */
const CLASSIC_TEMPLATE: SettlementTemplate = {
  id: 'classic',
  name: '클래식',
  layout: { paperSize: 'A4', orientation: 'portrait', margins: { top: 50, right: 50, bottom: 50, left: 50 } },
  header: {
    style: 'minimal',
    primaryColor: '#1a1a2e',
    textColor: '#1a1a2e',
    showCompanyName: true,
    showDocumentNumber: true,
    showSubtitle: false,
  },
  title: { text: '{{year}}년 {{month}}월 정산서', fontSize: 22, fontWeight: 'bold', alignment: 'center' },
  driverInfo: { enabled: true, style: 'grid', fields: EXTENDED_DRIVER_FIELDS },
  summaryCards: { enabled: false, style: 'none', incomeColor: '', deductionColor: '', netAmountStyle: 'filled', netAmountColor: '' },
  incomeSection: {
    enabled: true, title: '수익 내역', titleColor: '#1a56db',
    accentBarColor: '#1a56db', items: [], showSubtotal: true, subtotalBgColor: '#eff6ff',
  },
  deductionSection: {
    enabled: true, title: '차감 및 공제 내역', titleColor: '#dc2626',
    accentBarColor: '#dc2626', items: [], showSubtotal: true, subtotalBgColor: '#fef2f2',
  },
  totalSection: {
    enabled: true, label: '실지급액', style: 'dark', fontSize: 18,
    fontColor: '#ffffff', backgroundColor: '#1a1a2e', showFormula: true, showAmountInWords: true,
  },
  footer: {
    notes: '본 정산서의 내용에 이의가 있을 경우 지급일로부터 3일 이내에 운영팀으로 문의하시기 바랍니다.',
    showSignatureLine: true, showDate: true, showStamp: true,
    showCompanyInfo: true, companyAddress: '', companyPhone: '',
    disclaimerText: '본 문서는 전자적으로 생성되었으며, LogiSign의 공식적인 정산 기록임을 보증합니다.',
  },
  tableStyle: {
    style: 'bordered', headerBgColor: '#f1f5f9', headerTextColor: '#1e293b',
    headerFontSize: 10, bodyFontSize: 10, bodyTextColor: '#374151',
    borderColor: '#d1d5db', zebraStriping: false,
    showDetailColumn: true, showNoteColumn: true,
  },
}

/** 3. Clean — 미니멀 화이트 + 좌측 컬러바 */
const CLEAN_TEMPLATE: SettlementTemplate = {
  id: 'clean',
  name: '심플',
  layout: { paperSize: 'A4', orientation: 'portrait', margins: { top: 50, right: 50, bottom: 50, left: 50 } },
  header: {
    style: 'minimal',
    primaryColor: '#6100d6',
    textColor: '#1a1a2e',
    showCompanyName: true,
    showDocumentNumber: true,
    showSubtitle: true,
    subtitleText: 'CLEAN SETTLEMENT',
  },
  title: { text: '{{year}}년 {{month}}월 정산서', fontSize: 28, fontWeight: 'bold', alignment: 'left' },
  driverInfo: { enabled: true, style: 'card', fields: EXTENDED_DRIVER_FIELDS },
  summaryCards: { enabled: false, style: 'none', incomeColor: '', deductionColor: '', netAmountStyle: 'filled', netAmountColor: '' },
  incomeSection: {
    enabled: true, title: '수익 내역', titleColor: '#059669',
    accentBarColor: '#059669', items: [], showSubtotal: true, subtotalBgColor: '#ecfdf5',
  },
  deductionSection: {
    enabled: true, title: '차감 내역', titleColor: '#e11d48',
    accentBarColor: '#e11d48', items: [], showSubtotal: true, subtotalBgColor: '#fff1f2',
  },
  totalSection: {
    enabled: true, label: '실수령액', style: 'dark', fontSize: 18,
    fontColor: '#ffffff', backgroundColor: '#1a1a2e', showFormula: false, showAmountInWords: false,
  },
  footer: {
    notes: '', showSignatureLine: true, showDate: true, showStamp: true,
    showCompanyInfo: true, disclaimerText: '',
  },
  tableStyle: {
    style: 'card', headerBgColor: '#ffffff', headerTextColor: '#94a3b8',
    headerFontSize: 9, bodyFontSize: 10, bodyTextColor: '#1e293b',
    borderColor: '#f1f5f9', zebraStriping: false,
    showDetailColumn: true, showNoteColumn: false,
  },
}

/** 4. Premium — 딥네이비 + 골드 악센트 + 중앙 로고 */
const PREMIUM_TEMPLATE: SettlementTemplate = {
  id: 'premium',
  name: '프리미엄',
  layout: { paperSize: 'A4', orientation: 'portrait', margins: { top: 50, right: 50, bottom: 50, left: 50 } },
  header: {
    style: 'minimal',
    primaryColor: '#0F2B46',
    textColor: '#0F2B46',
    showCompanyName: true,
    showDocumentNumber: true,
    showSubtitle: false,
  },
  title: { text: '정 산 서', fontSize: 32, fontWeight: 'bold', alignment: 'center' },
  driverInfo: { enabled: true, style: 'card', fields: EXTENDED_DRIVER_FIELDS },
  summaryCards: { enabled: false, style: 'none', incomeColor: '', deductionColor: '', netAmountStyle: 'filled', netAmountColor: '' },
  incomeSection: {
    enabled: true, title: '수익 항목 (Incomes)', titleColor: '#0F2B46',
    accentBarColor: '#0F2B46', items: [], showSubtotal: true, subtotalBgColor: '#f0fdf4',
  },
  deductionSection: {
    enabled: true, title: '공제 항목 (Deductions)', titleColor: '#0F2B46',
    accentBarColor: '#b91c1c', items: [], showSubtotal: true, subtotalBgColor: '#fef2f2',
  },
  totalSection: {
    enabled: true, label: 'TOTAL PAYOUT AMOUNT', style: 'colored', fontSize: 18,
    fontColor: '#ffffff', backgroundColor: '#0F2B46', showFormula: false, showAmountInWords: true,
  },
  footer: {
    notes: '본 정산서는 귀하와의 계약에 의거하여 산정되었습니다.',
    showSignatureLine: true, showDate: true, showStamp: true,
    showCompanyInfo: true, companyPhone: '1588-0000',
    disclaimerText: '기한 내 이의 제기가 없을 시 본 정산 내용에 동의한 것으로 간주됩니다.',
  },
  tableStyle: {
    style: 'bordered', headerBgColor: '#0F2B46', headerTextColor: '#ffffff',
    headerFontSize: 9, bodyFontSize: 10, bodyTextColor: '#1e293b',
    borderColor: '#e2e8f0', zebraStriping: true, alternateRowColor: '#fdfaf5',
    showDetailColumn: false, showNoteColumn: false,
  },
}

/** 5. Coupang — 물류 블루 + 통계 그리드 + 실용적 레이아웃 */
const SMART_TEMPLATE: SettlementTemplate = {
  id: 'coupang',
  name: '스마트',
  layout: { paperSize: 'A4', orientation: 'portrait', margins: { top: 40, right: 40, bottom: 40, left: 40 } },
  header: {
    style: 'solid',
    primaryColor: '#314FA1',
    textColor: '#ffffff',
    showCompanyName: true,
    showDocumentNumber: true,
    showSubtitle: false,
  },
  title: { text: '배송 정산서', fontSize: 26, fontWeight: 'bold', alignment: 'left' },
  driverInfo: { enabled: true, style: 'inline', fields: BASE_DRIVER_FIELDS },
  summaryCards: {
    enabled: true,
    style: 'cards',
    incomeColor: '#314FA1',
    deductionColor: '#314FA1',
    netAmountStyle: 'filled',
    netAmountColor: '#314FA1',
  },
  incomeSection: {
    enabled: true, title: '수입 항목 (Income)', titleColor: '#314FA1',
    accentBarColor: '#314FA1', items: [], showSubtotal: true,
  },
  deductionSection: {
    enabled: true, title: '공제 항목 (Deductions)', titleColor: '#5d5c74',
    accentBarColor: '#ba1a1a', items: [], showSubtotal: true,
  },
  totalSection: {
    enabled: true, label: '최종 실지급액', style: 'colored', fontSize: 18,
    fontColor: '#ffffff', backgroundColor: '#314FA1', showFormula: false, showAmountInWords: false,
  },
  footer: {
    notes: '', showSignatureLine: true, showDate: true, showStamp: true,
    showCompanyInfo: true, disclaimerText: '',
  },
  tableStyle: {
    style: 'bordered', headerBgColor: '#314FA1', headerTextColor: '#ffffff',
    headerFontSize: 9, bodyFontSize: 10, bodyTextColor: '#1e293b',
    borderColor: '#e2e8f0', zebraStriping: false,
    showDetailColumn: false, showNoteColumn: false,
  },
}

export const DEFAULT_TEMPLATE = MODERN_TEMPLATE

export const PRESET_TEMPLATES: Array<{ id: string; name: string; description: string; icon: string; template: SettlementTemplate }> = [
  { id: 'modern', name: '모던', description: '그라디언트 헤더 · 카드형 요약', icon: 'view_quilt', template: MODERN_TEMPLATE },
  { id: 'classic', name: '클래식', description: '전통 정산서 · 격식 서명란', icon: 'auto_awesome_motion', template: CLASSIC_TEMPLATE },
  { id: 'clean', name: '심플', description: '미니멀 화이트 · 컬러바 악센트', icon: 'grid_view', template: CLEAN_TEMPLATE },
  { id: 'premium', name: '프리미엄', description: '딥네이비 · 골드 프리미엄', icon: 'diamond', template: PREMIUM_TEMPLATE },
  { id: 'smart', name: '스마트', description: '블루 통계형 · 데이터 중심 실용 레이아웃', icon: 'local_shipping', template: SMART_TEMPLATE },
]
