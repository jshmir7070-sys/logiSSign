/**
 * 계약서→정산 브릿지 서비스
 *
 * 계약서 서명 완료 후:
 *  1. 기사의 driver_rates가 없으면 → 원청사(principal) 기본 단가에서 복사
 *  2. 기사의 driver_deductions가 없으면 → 원청사 기본 공제항목에서 복사
 *  3. driver_contract_periods에 계약 기간 기록
 *
 * 이미 단가/공제가 설정된 기사는 건드리지 않음 (수동 설정 우선)
 */

import { createClient } from '@supabase/supabase-js'

const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!,
  { auth: { autoRefreshToken: false, persistSession: false } }
)

interface BridgeResult {
  ratesCreated: number
  deductionsCreated: number
  periodCreated: boolean
  skipped: string[]
}

/**
 * 서명 완료 후 정산 데이터 자동 연결
 *
 * contract → template → principal 체인을 따라
 * 기사의 정산 기본 설정을 자동으로 생성
 */
export async function bridgeContractToSettlement(
  contractId: string,
  driverId: string
): Promise<BridgeResult> {
  const result: BridgeResult = {
    ratesCreated: 0,
    deductionsCreated: 0,
    periodCreated: false,
    skipped: [],
  }

  // 1. contract → template → principal 체인 조회
  const { data: contract } = await supabaseAdmin
    .from('contracts')
    .select('id, agency_id, template_id')
    .eq('id', contractId)
    .single()

  if (!contract?.template_id) {
    result.skipped.push('template_id 없음')
    return result
  }

  const { data: template } = await supabaseAdmin
    .from('contract_templates')
    .select('id, principal_id')
    .eq('id', contract.template_id)
    .single()

  if (!template?.principal_id) {
    result.skipped.push('principal_id 없음 (범용 템플릿)')
    return result
  }

  const principalId = template.principal_id
  const agencyId = contract.agency_id

  // 2. 기존 driver_rates 확인 → 없으면 원청사 기본값에서 복사
  const { data: existingRates } = await supabaseAdmin
    .from('driver_rates')
    .select('id')
    .eq('driver_id', driverId)
    .eq('principal_id', principalId)
    .eq('is_active', true)
    .limit(1)

  if (!existingRates || existingRates.length === 0) {
    // 원청사 field_config에서 기본 단가 조회
    const { data: principal } = await supabaseAdmin
      .from('principals')
      .select('id, field_config')
      .eq('id', principalId)
      .single()

    if (principal?.field_config) {
      const config = principal.field_config as Record<string, unknown>
      const rateSection = config.rate_section as Record<string, unknown> | undefined

      if (rateSection) {
        const rateRows: {
          driver_id: string
          principal_id: string
          package_type: string
          unit_price: number
          rate_type: string
          is_active: boolean
        }[] = []

        // 배송/반품/집하 기본 단가 추출
        const packageTypes = ['배송', '반품', '집하'] as const
        for (const pt of packageTypes) {
          const rateConfig = rateSection[pt] as { unit_price?: number; rate_type?: string } | undefined
          if (rateConfig?.unit_price && rateConfig.unit_price > 0) {
            rateRows.push({
              driver_id: driverId,
              principal_id: principalId,
              package_type: pt,
              unit_price: rateConfig.unit_price,
              rate_type: rateConfig.rate_type ?? 'fixed',
              is_active: true,
            })
          }
        }

        if (rateRows.length > 0) {
          const { error } = await supabaseAdmin
            .from('driver_rates')
            .insert(rateRows)

          if (!error) {
            result.ratesCreated = rateRows.length
          }
        }
      }
    }

    if (result.ratesCreated === 0) {
      result.skipped.push('원청사 기본 단가 없음 — 수동 설정 필요')
    }
  } else {
    result.skipped.push('기존 단가 있음 — 유지')
  }

  // 3. 기존 driver_deductions 확인 → 없으면 원청사 기본 공제항목에서 복사
  const { data: existingDeductions } = await supabaseAdmin
    .from('driver_deductions')
    .select('id')
    .eq('driver_id', driverId)
    .eq('principal_id', principalId)
    .eq('is_active', true)
    .limit(1)

  if (!existingDeductions || existingDeductions.length === 0) {
    const { data: defaultItems } = await supabaseAdmin
      .from('deduction_items')
      .select('name, amount, rate_type, rate_value, unit_label')
      .eq('principal_id', principalId)
      .eq('is_active', true)

    if (defaultItems && defaultItems.length > 0) {
      const deductionRows = defaultItems.map((item) => ({
        driver_id: driverId,
        principal_id: principalId,
        name: item.name,
        deduction_type: item.rate_type ?? 'fixed',
        amount: Number(item.rate_value) || item.amount,
        unit_label: item.unit_label ?? '',
        is_active: true,
      }))

      const { error } = await supabaseAdmin
        .from('driver_deductions')
        .insert(deductionRows)

      if (!error) {
        result.deductionsCreated = deductionRows.length
      }
    }

    if (result.deductionsCreated === 0) {
      result.skipped.push('원청사 기본 공제항목 없음')
    }
  } else {
    result.skipped.push('기존 공제항목 있음 — 유지')
  }

  // 4. driver_contract_periods에 계약 기간 기록
  if (agencyId) {
    const { error } = await supabaseAdmin
      .from('driver_contract_periods')
      .insert({
        driver_id: driverId,
        agency_id: agencyId,
        contract_id: contractId,
        period_start: new Date().toISOString().split('T')[0],
        status: 'active',
        auto_renew: true,
        renewal_months: 12,
      })

    if (!error) {
      result.periodCreated = true
    }
  }

  return result
}
