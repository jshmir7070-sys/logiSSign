/**
 * 정산서 템플릿 타입 정의
 * SettlementTemplate — 에디터에서 구성하고 PDF 렌더러에서 소비한다.
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

  title: {
    text: string                // 동적 변수: {{year}}, {{month}}, {{agency_name}}
    fontSize: number
    fontColor: string           // HEX
    fontWeight: 'normal' | 'bold'
    alignment: 'left' | 'center' | 'right'
    logo?: {
      url: string
      width: number
      height: number
      position: 'left' | 'right' | 'center'
    }
  }

  driverInfo: {
    enabled: boolean
    fields: Array<{
      field: string             // name, id, phone, region, period
      label: string
      enabled: boolean
    }>
  }

  incomeSection: {
    enabled: boolean
    title: string
    titleColor: string
    items: SettlementItem[]
    showSubtotal: boolean
  }

  deductionSection: {
    enabled: boolean
    title: string
    titleColor: string
    items: SettlementItem[]
    showSubtotal: boolean
  }

  totalSection: {
    enabled: boolean
    label: string
    fontSize: number
    fontColor: string
    fontWeight: 'normal' | 'bold'
    backgroundColor?: string
  }

  footer: {
    notes: string
    showSignatureLine: boolean
    showDate: boolean
    showStamp: boolean
    stampImageUrl?: string
  }

  tableStyle: {
    headerBgColor: string
    headerTextColor: string
    headerFontSize: number
    bodyFontSize: number
    bodyTextColor: string
    borderColor: string
    alternateRowColor?: string
    zebraStriping: boolean
  }
}

export interface SettlementItem {
  id: string
  label: string
  field: string               // 매핑된 엑셀 컬럼명
  enabled: boolean
  formula?: string
  fontColor?: string
  fontWeight?: 'normal' | 'bold'
  numberFormat: 'currency' | 'number' | 'percentage'
}

/** 정산서 렌더링에 전달할 기사별 데이터 */
export interface SettlementDriverData {
  name: string
  id?: string
  phone?: string
  region?: string
  period?: string
  incomeItems: Record<string, number>    // { "기본운임": 500000, "인센티브": 20000 }
  deductionItems: Record<string, number> // { "수수료": 16500, "보험료": 15000 }
  incomeTotal: number
  deductionTotal: number
  netAmount: number
}

/** 정산서 메타데이터 */
export interface SettlementMeta {
  agencyName: string
  year: number
  month: number
  generatedAt: string
}

/* ── Default Templates ── */

export const DEFAULT_TEMPLATE: SettlementTemplate = {
  id: 'standard',
  name: '기본 정산서',
  layout: {
    paperSize: 'A4',
    orientation: 'portrait',
    margins: { top: 40, right: 40, bottom: 40, left: 40 },
  },
  title: {
    text: '{{year}}년 {{month}}월 정산서',
    fontSize: 20,
    fontColor: '#1a1a1a',
    fontWeight: 'bold',
    alignment: 'center',
  },
  driverInfo: {
    enabled: true,
    fields: [
      { field: 'name', label: '기사명', enabled: true },
      { field: 'id', label: '사번', enabled: true },
      { field: 'period', label: '정산기간', enabled: true },
    ],
  },
  incomeSection: {
    enabled: true,
    title: '수익 내역',
    titleColor: '#1a56db',
    items: [],
    showSubtotal: true,
  },
  deductionSection: {
    enabled: true,
    title: '차감 내역',
    titleColor: '#dc2626',
    items: [],
    showSubtotal: true,
  },
  totalSection: {
    enabled: true,
    label: '실 수령액',
    fontSize: 16,
    fontColor: '#1a1a1a',
    fontWeight: 'bold',
    backgroundColor: '#f0f9ff',
  },
  footer: {
    notes: '',
    showSignatureLine: true,
    showDate: true,
    showStamp: false,
  },
  tableStyle: {
    headerBgColor: '#f1f5f9',
    headerTextColor: '#374151',
    headerFontSize: 10,
    bodyFontSize: 10,
    bodyTextColor: '#1f2937',
    borderColor: '#e2e8f0',
    zebraStriping: true,
    alternateRowColor: '#f8fafc',
  },
}

export const PRESET_TEMPLATES: Array<{ id: string; name: string; description: string; template: SettlementTemplate }> = [
  {
    id: 'standard',
    name: '기본 정산서',
    description: '수익/차감 분리 기본형',
    template: DEFAULT_TEMPLATE,
  },
  {
    id: 'detailed',
    name: '상세 정산서',
    description: '항목별 상세 내역 포함',
    template: {
      ...DEFAULT_TEMPLATE,
      id: 'detailed',
      name: '상세 정산서',
      driverInfo: {
        enabled: true,
        fields: [
          { field: 'name', label: '기사명', enabled: true },
          { field: 'id', label: '사번', enabled: true },
          { field: 'phone', label: '연락처', enabled: true },
          { field: 'region', label: '배송지역', enabled: true },
          { field: 'period', label: '정산기간', enabled: true },
        ],
      },
    },
  },
  {
    id: 'compact',
    name: '간편 정산서',
    description: '핵심 항목만 요약',
    template: {
      ...DEFAULT_TEMPLATE,
      id: 'compact',
      name: '간편 정산서',
      driverInfo: {
        enabled: true,
        fields: [
          { field: 'name', label: '기사명', enabled: true },
          { field: 'id', label: '사번', enabled: true },
          { field: 'period', label: '정산기간', enabled: false },
        ],
      },
      footer: { notes: '', showSignatureLine: false, showDate: true, showStamp: false },
    },
  },
  {
    id: 'branded',
    name: '브랜드 정산서',
    description: '로고 + 컬러 커스텀',
    template: {
      ...DEFAULT_TEMPLATE,
      id: 'branded',
      name: '브랜드 정산서',
      title: {
        ...DEFAULT_TEMPLATE.title,
        fontColor: '#7B2FF7',
      },
      tableStyle: {
        ...DEFAULT_TEMPLATE.tableStyle,
        headerBgColor: '#7B2FF7',
        headerTextColor: '#ffffff',
      },
      totalSection: {
        ...DEFAULT_TEMPLATE.totalSection,
        fontColor: '#7B2FF7',
        backgroundColor: '#f5f0ff',
      },
    },
  },
  {
    id: 'coupang',
    name: '쿠팡 대리점 정산서',
    description: '쿠팡 물류 정산 최적화',
    template: {
      ...DEFAULT_TEMPLATE,
      id: 'coupang',
      name: '쿠팡 대리점 정산서',
      incomeSection: {
        ...DEFAULT_TEMPLATE.incomeSection,
        title: '쿠팡 정산 수익',
        items: [
          { id: 'base', label: '기본배송료', field: 'delivery_amount', enabled: true, numberFormat: 'currency' },
          { id: 'fresh', label: '프레쉬백 인센티브', field: 'fresh_incentive', enabled: true, numberFormat: 'currency' },
          { id: 'extra', label: '추가 인센티브', field: 'extra_incentive', enabled: true, numberFormat: 'currency' },
        ],
      },
      deductionSection: {
        ...DEFAULT_TEMPLATE.deductionSection,
        title: '차감 내역',
        items: [
          { id: 'damage', label: '분실파손', field: 'damage_deduction', enabled: true, numberFormat: 'currency' },
          { id: 'fee', label: '수수료', field: 'fee', enabled: true, numberFormat: 'currency' },
          { id: 'insurance', label: '보험료', field: 'insurance', enabled: true, numberFormat: 'currency' },
        ],
      },
    },
  },
]
