import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { authenticateRequest } from '@/lib/api-auth'
import { BINDING_FIELDS } from '@/lib/binding-fields'
import { rateLimitAuth } from '@/lib/rate-limit'
import { getClientIp } from '@/lib/get-ip'
import { decryptAgencyPii, decryptDriverPii } from '@/services/pii.service'

const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!,
  { auth: { autoRefreshToken: false, persistSession: false } }
)

function calcDuration(start: string, end: string): string {
  const startDate = new Date(start)
  const endDate = new Date(end)
  if (Number.isNaN(startDate.getTime()) || Number.isNaN(endDate.getTime())) return ''

  const diffMs = endDate.getTime() - startDate.getTime()
  if (diffMs <= 0) return '당일'

  const diffDays = Math.round(diffMs / (1000 * 60 * 60 * 24))
  if (diffDays < 31) return `${diffDays}일`

  const diffMonths =
    (endDate.getFullYear() - startDate.getFullYear()) * 12 +
    (endDate.getMonth() - startDate.getMonth())

  if (diffMonths % 12 === 0 && diffMonths >= 12) {
    return `${diffMonths / 12}년`
  }

  if (diffMonths >= 12) {
    const years = Math.floor(diffMonths / 12)
    const months = diffMonths % 12
    return months > 0 ? `${years}년 ${months}개월` : `${years}년`
  }

  return `${diffMonths}개월`
}

type PrincipalFieldConfig = {
  deduction_section?: {
    employment_insurance?: { enabled?: boolean; split_mode?: string }
    industrial_insurance?: { enabled?: boolean; split_mode?: string }
  }
}

type PlainRecord = Record<string, unknown>

export async function POST(request: NextRequest) {
  const ip = getClientIp(request)
  const limited = rateLimitAuth(ip, '/api/contracts/bind')
  if (limited) return limited

  const { auth, error: authError } = await authenticateRequest(request)
  if (authError || !auth) return authError!

  try {
    const body = await request.json()
    const driverId = typeof body?.driverId === 'string' ? body.driverId : ''
    const principalId = typeof body?.principalId === 'string' ? body.principalId : ''
    const periodStart = typeof body?.periodStart === 'string' ? body.periodStart : ''
    const periodEnd = typeof body?.periodEnd === 'string' ? body.periodEnd : ''
    const agencyId = auth.agencyId

    if (!driverId) {
      return NextResponse.json({ error: 'driverId 필수' }, { status: 400 })
    }

    const [driverRes, agencyRes, ratesRes, routeRes, deductionsRes] = await Promise.all([
      supabaseAdmin.from('drivers').select('*').eq('id', driverId).single(),
      supabaseAdmin.from('agencies').select('*').eq('id', agencyId).single(),
      supabaseAdmin
        .from('driver_rates')
        .select('package_type, unit_price, rate_type')
        .eq('driver_id', driverId)
        .eq('is_active', true),
      supabaseAdmin
        .from('driver_route_rates')
        .select('route_code, delivery_rate, return_rate')
        .eq('driver_id', driverId)
        .eq('is_active', true),
      supabaseAdmin
        .from('driver_deductions')
        .select('name, amount, deduction_type')
        .eq('driver_id', driverId)
        .eq('is_active', true),
    ])

    const rawDriver = driverRes.data as PlainRecord | null
    const rawAgency = agencyRes.data as PlainRecord | null

    if (!rawDriver) {
      return NextResponse.json({ error: '기사를 찾을 수 없습니다' }, { status: 404 })
    }

    if (!rawAgency) {
      return NextResponse.json({ error: '대리점을 찾을 수 없습니다' }, { status: 404 })
    }

    const d = await decryptDriverPii(rawDriver)
    const a = await decryptAgencyPii(rawAgency)

    const rateMap: Record<string, number> = {}
    for (const rate of ratesRes.data ?? []) {
      rateMap[rate.package_type] = rate.unit_price
    }

    const routeText =
      (routeRes.data ?? [])
        .map(
          (route) =>
            `${route.route_code}: 배송 ${route.delivery_rate?.toLocaleString()}원 / 반품 ${(route.return_rate || route.delivery_rate)?.toLocaleString()}원`
        )
        .join('\n') || ''

    const deductionText =
      (deductionsRes.data ?? [])
        .map((deduction) =>
          `${deduction.name}: ${
            deduction.deduction_type === 'percentage'
              ? `${deduction.amount}%`
              : `${deduction.amount.toLocaleString()}원`
          }`
        )
        .join('\n') || ''

    let insEmpD = ''
    let insEmpE = ''
    let insIndD = ''
    let insIndE = ''

    if (principalId) {
      const { data: principal } = await supabaseAdmin
        .from('principals')
        .select('field_config')
        .eq('id', principalId)
        .single()

      const config = (principal?.field_config ?? {}) as PrincipalFieldConfig
      const deductionSection = config.deduction_section

      if (deductionSection?.employment_insurance?.enabled) {
        const split = deductionSection.employment_insurance.split_mode === 'split_50_50'
        insEmpD = split ? '50%' : '0%'
        insEmpE = split ? '50%' : '100%'
      }

      if (deductionSection?.industrial_insurance?.enabled) {
        const split = deductionSection.industrial_insurance.split_mode === 'split_50_50'
        insIndD = split ? '50%' : '0%'
        insIndE = split ? '50%' : '100%'
      }
    }

    const str = (value: unknown) => (value != null ? String(value) : '')
    const fmt = (value: unknown) =>
      value != null && value !== '' && !Number.isNaN(Number(value))
        ? `${Number(value).toLocaleString()}원`
        : ''
    const pct = (value: unknown) =>
      value != null && value !== '' && !Number.isNaN(Number(value)) ? `${Number(value)}%` : ''
    const fmtDate = (value: string | null | undefined) =>
      value ? new Date(value).toLocaleDateString('ko-KR') : ''
    const cv = (d.custom_values ?? {}) as Record<string, string>

    const taxLabel = d.is_business_owner
      ? d.tax_type === 'vat_invoice'
        ? '세금계산서 발행'
        : d.tax_type === 'manual_reverse'
          ? '역발행'
          : str(d.tax_type)
      : '3.3% 원천징수'

    const rateModeLabel =
      d.rate_mode === 'route'
        ? '노선별 단가'
        : d.rate_mode === 'percentage'
          ? '수수료율'
          : '고정 단가'

    const resolveMap: Record<string, string> = {
      D001: str(d.name),
      D002: str(d.phone),
      D003: str(d.address),
      D004: str(d.birth_date),
      D005: str(d.employee_code),
      D006: str(d.delivery_area),
      D007: str(d.camp_name),
      D008: str(d.email),
      D009: '',
      D100: str(d.representative_name) || str(d.name),
      D101: str(d.business_reg_number),
      D102: str(d.business_address) || str(d.address),
      D103: str(d.business_type),
      D104: str(d.business_category),
      D105: d.is_business_owner ? '사업자' : '개인',
      D200: str(d.vehicle_type),
      D201: str(d.vehicle_type),
      D202: str(d.vehicle_type),
      D203: str(d.vehicle_year),
      D204: str(d.vehicle_number),
      D205: str(d.vehicle_vin),
      D206:
        d.vehicle_mileage != null && d.vehicle_mileage !== ''
          ? `${Number(d.vehicle_mileage).toLocaleString()}km`
          : '',
      D207: cv.max_load || '',
      D208: cv.fuel_type || '',
      D209: d.vehicle_owner === 'company' ? '회사차' : '자차',
      D210: fmt(d.vehicle_rent_monthly),
      D211: fmt(d.vehicle_deposit),
      D212: d.vehicle_insurance_by === 'lessor' ? '리스사' : '차주',
      D300: str(d.license_number),
      D301: cv.license_type || '',
      D302: cv.cert_number || '',
      D303: cv.cert_date || '',
      D304: cv.career_period || '',
      D305: cv.career_start || '',
      D306: cv.career_end || '',
      R001: rateModeLabel,
      R002: fmt(rateMap['배송'] || d.flat_rate),
      R003: fmt(rateMap['반품']),
      R004: fmt(rateMap['집하']),
      R005: routeText,
      R006: fmt(d.flat_rate),
      R007: pct(d.rate_percentage),
      R008: pct(d.fresh_incentive_pct),
      R009: pct(d.extra_incentive_pct),
      R010: deductionText,
      R100: d.vat_included ? '포함가 (VAT 포함)' : '별도 (VAT 별도)',
      R101: taxLabel,
      R102: insEmpD,
      R103: insEmpE,
      R104: insIndD,
      R105: insIndE,
      R110: str(d.bank_name),
      R111: str(d.bank_account),
      R112: str(d.bank_holder),
      A001: str(a.name),
      A002: str(a.business_number),
      A003: str(a.owner_name),
      A004: str(a.phone),
      A005: a.address
        ? `${str(a.address)}${a.address_detail ? ` ${str(a.address_detail)}` : ''}`
        : '',
      A006: str(a.email),
      A007: str(a.business_type),
      A008: str(a.business_category),
      A009: str(a.name),
      C001: fmtDate(periodStart) || new Date().toLocaleDateString('ko-KR'),
      C002: fmtDate(periodEnd),
      C003: new Date().toLocaleDateString('ko-KR'),
      C004: periodStart && periodEnd ? calcDuration(periodStart, periodEnd) : '',
      S001: '',
    }

    const bindingData: Record<string, string> = {}
    const fields: { id: string; label: string; value: string; source: string; group: string }[] = []

    for (const field of BINDING_FIELDS) {
      const value = resolveMap[field.id] ?? ''
      bindingData[field.templateVar] = value
      fields.push({
        id: field.id,
        label: field.label,
        value,
        source: field.source,
        group: field.group,
      })
    }

    const filled = fields.filter((field) => field.value).length
    const emptyFields = fields.filter((field) => !field.value)

    return NextResponse.json({
      bindingData,
      fields,
      meta: {
        total: fields.length,
        filled,
        empty: emptyFields.length,
        emptyIds: emptyFields.map((field) => `${field.id}(${field.label})`),
        driverRates: ratesRes.data?.length || 0,
        routeRates: routeRes.data?.length || 0,
        deductions: deductionsRes.data?.length || 0,
      },
    })
  } catch (error) {
    console.error('[contracts/bind] error:', error)
    return NextResponse.json({ error: '바인딩 데이터 생성 실패' }, { status: 500 })
  }
}
