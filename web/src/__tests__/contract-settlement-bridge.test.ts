/**
 * contract-settlement-bridge.service tests
 *
 * Tests the bridge that auto-creates driver_rates, driver_deductions,
 * and driver_contract_periods when a contract is signed.
 */
import { describe, it, expect, vi, beforeEach } from 'vitest'

/* ── Supabase mock plumbing ── */

// Chain builder: .from().select().eq().eq()...single() / .limit() / .insert()
function createChainMock() {
  const chain: Record<string, ReturnType<typeof vi.fn>> = {}

  chain.select = vi.fn().mockReturnValue(chain)
  chain.eq = vi.fn().mockReturnValue(chain)
  chain.limit = vi.fn().mockReturnValue(chain)
  chain.single = vi.fn().mockResolvedValue({ data: null, error: null })
  chain.insert = vi.fn().mockResolvedValue({ data: null, error: null })
  chain.in = vi.fn().mockReturnValue(chain)

  // Default: .limit() resolves like a query
  chain.limit.mockImplementation(() => {
    // Return a thenable so await works
    return { then: (fn: (v: { data: unknown[]; error: null }) => void) => fn({ data: [], error: null }) } as unknown as typeof chain
  })

  return chain
}

let fromHandlers: Record<string, ReturnType<typeof createChainMock>>

const mockCreateClient = vi.fn(() => ({
  from: (table: string) => {
    if (!fromHandlers[table]) {
      fromHandlers[table] = createChainMock()
    }
    return fromHandlers[table]
  },
}))

vi.mock('@supabase/supabase-js', () => ({
  createClient: (...args: unknown[]) => mockCreateClient(...args),
}))

/* ── Import under test (after mock) ── */

// eslint-disable-next-line @typescript-eslint/no-require-imports
let bridgeContractToSettlement: typeof import('@/services/contract-settlement-bridge.service').bridgeContractToSettlement

beforeEach(async () => {
  vi.resetModules()
  fromHandlers = {}

  // Re-import to get fresh module with fresh supabaseAdmin
  const mod = await import('@/services/contract-settlement-bridge.service')
  bridgeContractToSettlement = mod.bridgeContractToSettlement
})

/* ── Helpers ── */

/** Wire up the chain so .single() returns the given data */
function mockSingle(table: string, data: unknown) {
  if (!fromHandlers[table]) fromHandlers[table] = createChainMock()
  fromHandlers[table].single.mockResolvedValue({ data, error: null })
}

/** Wire up the chain so .limit(1) returns the given array */
function mockLimit(table: string, data: unknown[]) {
  if (!fromHandlers[table]) fromHandlers[table] = createChainMock()
  fromHandlers[table].limit.mockImplementation(() => ({
    then: (fn: (v: { data: unknown[]; error: null }) => void) => fn({ data, error: null }),
  }))
}

/* ── Tests ── */

describe('bridgeContractToSettlement', () => {
  const contractId = 'contract-1'
  const driverId = 'driver-1'
  const principalId = 'principal-1'
  const agencyId = 'agency-1'
  const templateId = 'template-1'

  it('creates driver_rates from principal defaults when contract has template + principal', async () => {
    // contract -> template chain
    mockSingle('contracts', { id: contractId, agency_id: agencyId, template_id: templateId })
    mockSingle('contract_templates', { id: templateId, principal_id: principalId })

    // No existing rates
    mockLimit('driver_rates', [])

    // Principal with field_config containing rate_section
    mockSingle('principals', {
      id: principalId,
      field_config: {
        rate_section: {
          '배송': { unit_price: 3500, rate_type: 'fixed' },
          '반품': { unit_price: 2000, rate_type: 'fixed' },
          '집하': { unit_price: 1500, rate_type: 'fixed' },
        },
      },
    })

    // No existing deductions
    mockLimit('driver_deductions', [])
    // No default deduction_items
    if (!fromHandlers['deduction_items']) fromHandlers['deduction_items'] = createChainMock()
    fromHandlers['deduction_items'].eq.mockReturnValue(fromHandlers['deduction_items'])
    fromHandlers['deduction_items'].limit.mockImplementation(() => ({
      then: (fn: (v: { data: unknown[]; error: null }) => void) => fn({ data: [], error: null }),
    }))

    const result = await bridgeContractToSettlement(contractId, driverId)

    expect(result.ratesCreated).toBe(3)
    expect(fromHandlers['driver_rates'].insert).toHaveBeenCalledWith(
      expect.arrayContaining([
        expect.objectContaining({
          driver_id: driverId,
          principal_id: principalId,
          package_type: '배송',
          unit_price: 3500,
          rate_type: 'fixed',
          is_active: true,
        }),
      ])
    )
  })

  it('creates driver_deductions from deduction_items when contract has template + principal', async () => {
    mockSingle('contracts', { id: contractId, agency_id: agencyId, template_id: templateId })
    mockSingle('contract_templates', { id: templateId, principal_id: principalId })

    // Existing rates (so we skip rate creation)
    mockLimit('driver_rates', [{ id: 'rate-existing' }])

    // No existing deductions
    mockLimit('driver_deductions', [])

    // Deduction items from principal
    if (!fromHandlers['deduction_items']) fromHandlers['deduction_items'] = createChainMock()
    // Override the final .eq() to return the data
    fromHandlers['deduction_items'].eq.mockReturnValue({
      ...fromHandlers['deduction_items'],
      then: (fn: (v: { data: unknown[]; error: null }) => void) => fn({
        data: [
          { name: '차량렌탈', amount: 500000, rate_type: 'fixed', rate_value: 500000, unit_label: '월' },
          { name: '보험료', amount: 30000, rate_type: 'fixed', rate_value: 30000, unit_label: '월' },
        ],
        error: null,
      }),
    })

    const result = await bridgeContractToSettlement(contractId, driverId)

    expect(result.deductionsCreated).toBe(2)
    expect(fromHandlers['driver_deductions'].insert).toHaveBeenCalledWith(
      expect.arrayContaining([
        expect.objectContaining({
          driver_id: driverId,
          principal_id: principalId,
          name: '차량렌탈',
          deduction_type: 'fixed',
          amount: 500000,
        }),
        expect.objectContaining({
          driver_id: driverId,
          principal_id: principalId,
          name: '보험료',
          deduction_type: 'fixed',
          amount: 30000,
        }),
      ])
    )
  })

  it('skips rate creation when existing driver_rates found (preserves manual overrides)', async () => {
    mockSingle('contracts', { id: contractId, agency_id: agencyId, template_id: templateId })
    mockSingle('contract_templates', { id: templateId, principal_id: principalId })

    // Existing rates present
    mockLimit('driver_rates', [{ id: 'rate-already-set' }])

    // Also existing deductions
    mockLimit('driver_deductions', [{ id: 'ded-already-set' }])

    const result = await bridgeContractToSettlement(contractId, driverId)

    expect(result.ratesCreated).toBe(0)
    expect(result.deductionsCreated).toBe(0)
    expect(result.skipped).toContain('기존 단가 있음 — 유지')
    expect(result.skipped).toContain('기존 공제항목 있음 — 유지')
    // insert should NOT have been called on driver_rates
    expect(fromHandlers['driver_rates'].insert).not.toHaveBeenCalled()
  })

  it('returns skip reason when contract has no template_id', async () => {
    mockSingle('contracts', { id: contractId, agency_id: agencyId, template_id: null })

    const result = await bridgeContractToSettlement(contractId, driverId)

    expect(result.ratesCreated).toBe(0)
    expect(result.deductionsCreated).toBe(0)
    expect(result.periodCreated).toBe(false)
    expect(result.skipped).toContain('template_id 없음')
  })

  it('returns skip reason when template has no principal_id (generic template)', async () => {
    mockSingle('contracts', { id: contractId, agency_id: agencyId, template_id: templateId })
    mockSingle('contract_templates', { id: templateId, principal_id: null })

    const result = await bridgeContractToSettlement(contractId, driverId)

    expect(result.ratesCreated).toBe(0)
    expect(result.deductionsCreated).toBe(0)
    expect(result.skipped).toContain('principal_id 없음 (범용 템플릿)')
  })

  it('creates driver_contract_periods record', async () => {
    mockSingle('contracts', { id: contractId, agency_id: agencyId, template_id: templateId })
    mockSingle('contract_templates', { id: templateId, principal_id: principalId })

    // Skip rates and deductions (both exist)
    mockLimit('driver_rates', [{ id: 'r1' }])
    mockLimit('driver_deductions', [{ id: 'd1' }])

    const result = await bridgeContractToSettlement(contractId, driverId)

    expect(result.periodCreated).toBe(true)
    expect(fromHandlers['driver_contract_periods'].insert).toHaveBeenCalledWith(
      expect.objectContaining({
        driver_id: driverId,
        agency_id: agencyId,
        contract_id: contractId,
        status: 'active',
        auto_renew: true,
        renewal_months: 12,
      })
    )
  })
})
