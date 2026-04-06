import { describe, expect, it } from 'vitest'
import { DEFAULT_TEMPLATE } from '@/types/settlement-template'
import {
  buildRenderableSettlementTemplate,
  buildSettlementDriverData,
  type SettlementPdfSource,
} from '@/services/settlement-rendering.service'

const source: SettlementPdfSource = {
  driverName: '홍길동',
  employeeCode: 'DRV-001',
  phone: '010-1111-2222',
  region: '서울 강남',
  companyName: '로지사인 테스트',
  vehicleNumber: '12가3456',
  yearMonth: '2026-04',
  deliveryCount: 120,
  deliveryAmount: 960000,
  returnCount: 12,
  returnAmount: 72000,
  pickupCount: 8,
  pickupAmount: 40000,
  freshIncentive: 25000,
  extraIncentive: 15000,
  totalAmount: 1112000,
  totalDeduction: 93000,
  vatAmount: 12000,
  netAmount: 1019000,
  deductionDetail: {
    보험료: 30000,
    원천징수: 33000,
    화물사고: 30000,
  },
}

describe('settlement-rendering.service', () => {
  it('hydrates empty template sections from settlement data', () => {
    const template = buildRenderableSettlementTemplate(
      {
        ...DEFAULT_TEMPLATE,
        incomeSection: { ...DEFAULT_TEMPLATE.incomeSection, items: [] },
        deductionSection: { ...DEFAULT_TEMPLATE.deductionSection, items: [] },
      },
      source
    )

    expect(template.incomeSection.items.map((item) => item.field)).toContain('delivery_amount')
    expect(template.incomeSection.items.map((item) => item.field)).toContain('return_amount')
    expect(template.deductionSection.items.length).toBe(3)
  })

  it('maps template labels to settlement values for custom send PDFs', () => {
    const template = {
      ...DEFAULT_TEMPLATE,
      incomeSection: {
        ...DEFAULT_TEMPLATE.incomeSection,
        items: [
          { id: 'i1', label: '배송매출', field: '배송매출', enabled: true, numberFormat: 'currency' as const },
          { id: 'i2', label: '추가 인센티브', field: '추가 인센티브', enabled: true, numberFormat: 'currency' as const },
        ],
      },
      deductionSection: {
        ...DEFAULT_TEMPLATE.deductionSection,
        items: [
          { id: 'd1', label: '보험료', field: '보험료', enabled: true, numberFormat: 'currency' as const },
          { id: 'd2', label: '총 차감', field: '총 차감', enabled: true, numberFormat: 'currency' as const },
        ],
      },
    }

    const driver = buildSettlementDriverData(source, template)

    expect(driver.incomeItems['배송매출']).toBe(960000)
    expect(driver.incomeItems['추가 인센티브']).toBe(15000)
    expect(driver.deductionItems['보험료']).toBe(30000)
    expect(driver.deductionItems['총 차감']).toBe(93000)
  })
})
