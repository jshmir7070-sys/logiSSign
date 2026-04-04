import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { authenticateRequest } from '@/lib/api-auth'
import { BINDING_FIELDS } from '@/lib/binding-fields'

/** 계약 기간 계산 (일/월/년 단위 자동 표시) */
function calcDuration(start: string, end: string): string {
  const s = new Date(start)
  const e = new Date(end)
  const diffMs = e.getTime() - s.getTime()
  if (diffMs <= 0) return '당일'
  const diffDays = Math.round(diffMs / (1000 * 60 * 60 * 24))
  if (diffDays < 31) return `${diffDays}일`
  const diffMonths = (e.getFullYear() - s.getFullYear()) * 12 + (e.getMonth() - s.getMonth())
  if (diffMonths % 12 === 0 && diffMonths >= 12) return `${diffMonths / 12}년`
  if (diffMonths >= 12) {
    const years = Math.floor(diffMonths / 12)
    const months = diffMonths % 12
    return months > 0 ? `${years}년 ${months}개월` : `${years}년`
  }
  return `${diffMonths}개월`
}

const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!,
  { auth: { autoRefreshToken: false, persistSession: false } }
)

/**
 * POST /api/contracts/bind
 *
 * 계약서 변수 자동 바인딩 — driverId + agencyId만 넘기면
 * 레지스트리(binding-fields.ts)의 전체 번호 필드를 DB에서 자동 조회
 *
 * Body: { driverId, agencyId, principalId?, periodStart?, periodEnd? }
 * Returns: {
 *   bindingData: Record<string, string>,     // {{변수}} → 값
 *   fields: { id, label, value, source }[],  // 번호별 상세
 *   meta: { total, filled, empty, emptyIds }
 * }
 */
export async function POST(request: NextRequest) {
  const { auth, error: authError } = await authenticateRequest(request)
  if (authError || !auth) return authError!

  try {
    const body = await request.json()
    const { driverId, agencyId, principalId, periodStart, periodEnd } = body

    if (!driverId || !agencyId) {
      return NextResponse.json({ error: 'driverId, agencyId 필수' }, { status: 400 })
    }

    // ── DB 조회 (병렬) ──
    const [driverRes, agencyRes, ratesRes, routeRes, deductionsRes] = await Promise.all([
      supabaseAdmin.from('drivers').select('*').eq('id', driverId).single(),
      supabaseAdmin.from('agencies').select('*').eq('id', agencyId).single(),
      supabaseAdmin.from('driver_rates').select('package_type, unit_price, rate_type').eq('driver_id', driverId).eq('is_active', true),
      supabaseAdmin.from('driver_route_rates').select('route_code, delivery_rate, return_rate').eq('driver_id', driverId).eq('is_active', true),
      supabaseAdmin.from('driver_deductions').select('name, amount, deduction_type').eq('driver_id', driverId).eq('is_active', true),
    ])

    const d = driverRes.data as Record<string, unknown> | null
    const a = agencyRes.data as Record<string, unknown> | null
    if (!d) return NextResponse.json({ error: '기사를 찾을 수 없습니다' }, { status: 404 })
    if (!a) return NextResponse.json({ error: '대리점을 찾을 수 없습니다' }, { status: 404 })

    // 단가 맵
    const rateMap: Record<string, number> = {}
    ;(ratesRes.data || []).forEach((r: { package_type: string; unit_price: number }) => {
      rateMap[r.package_type] = r.unit_price
    })

    // 노선별 단가 텍스트
    const routeText = (routeRes.data || [])
      .map((r: { route_code: string; delivery_rate: number; return_rate: number }) =>
        `${r.route_code}: 배송 ${r.delivery_rate?.toLocaleString()}원 / 반품 ${(r.return_rate || r.delivery_rate)?.toLocaleString()}원`
      ).join('\n') || ''

    // 공제 텍스트
    const deductionText = (deductionsRes.data || [])
      .map((dd: { name: string; amount: number; deduction_type: string }) =>
        `${dd.name}: ${dd.deduction_type === 'percentage' ? dd.amount + '%' : dd.amount.toLocaleString() + '원'}`
      ).join('\n') || ''

    // 보험 (원청사 설정)
    let insEmpD = '', insEmpE = '', insIndD = '', insIndE = ''
    if (principalId) {
      const { data: principal } = await supabaseAdmin.from('principals').select('field_config').eq('id', principalId).single()
      const ds = (principal?.field_config as Record<string, unknown>)?.deduction_section as Record<string, { enabled?: boolean; split_mode?: string }> | undefined
      if (ds?.employment_insurance?.enabled) {
        const s = ds.employment_insurance.split_mode === 'split_50_50'
        insEmpD = s ? '50%' : '0%'; insEmpE = s ? '50%' : '100%'
      }
      if (ds?.industrial_insurance?.enabled) {
        const s = ds.industrial_insurance.split_mode === 'split_50_50'
        insIndD = s ? '50%' : '0%'; insIndE = s ? '50%' : '100%'
      }
    }

    // ── 헬퍼 ──
    const str = (v: unknown) => v != null ? String(v) : ''
    const fmt = (v: unknown) => v && Number(v) ? Number(v).toLocaleString() + '원' : ''
    const pct = (v: unknown) => v != null && Number(v) ? Number(v) + '%' : ''
    const fmtDate = (v: string | null | undefined) => v ? new Date(v).toLocaleDateString('ko-KR') : ''
    const cv = (d.custom_values || {}) as Record<string, string>

    const taxLabel = d.is_business_owner
      ? (d.tax_type === 'vat_invoice' ? '세금계산서 발행' : d.tax_type === 'manual_reverse' ? '수기 역발행' : str(d.tax_type))
      : '3.3% 원천징수'

    const rateModeLabel = d.rate_mode === 'route' ? '노선별 단가' : d.rate_mode === 'percentage' ? '수수료율' : '고정 단가'

    // ── 번호별 값 resolve ──
    const resolveMap: Record<string, string> = {
      // D: 기사
      D001: str(d.name), D002: str(d.phone), D003: str(d.address),
      D004: str(d.birth_date), D005: str(d.employee_code), D006: str(d.delivery_area),
      D007: str(d.camp_name), D008: str(d.email), D009: '',
      D100: str(d.representative_name) || str(d.name),
      D101: str(d.business_reg_number), D102: str(d.business_address) || str(d.address),
      D103: str(d.business_type), D104: str(d.business_category),
      D105: d.is_business_owner ? '사업자' : '개인',
      D200: str(d.vehicle_type), D201: str(d.vehicle_type), D202: str(d.vehicle_type),
      D203: str(d.vehicle_year), D204: str(d.vehicle_number), D205: str(d.vehicle_vin),
      D206: d.vehicle_mileage ? Number(d.vehicle_mileage).toLocaleString() + 'km' : '',
      D207: cv.max_load || '', D208: cv.fuel_type || '',
      D209: d.vehicle_owner === 'company' ? '회사차' : '자차',
      D210: fmt(d.vehicle_rent_monthly), D211: fmt(d.vehicle_deposit),
      D212: d.vehicle_insurance_by === 'lessor' ? '임대인' : '임차인',
      D300: str(d.license_number), D301: cv.license_type || '',
      D302: cv.cert_number || '', D303: cv.cert_date || '',
      D304: cv.career_period || '', D305: cv.career_start || '', D306: cv.career_end || '',
      // R: 정산
      R001: rateModeLabel,
      R002: fmt(rateMap['배송'] || d.flat_rate), R003: fmt(rateMap['반품']),
      R004: fmt(rateMap['집하']), R005: routeText,
      R006: fmt(d.flat_rate), R007: pct(d.rate_percentage),
      R008: pct(d.fresh_incentive_pct), R009: pct(d.extra_incentive_pct),
      R010: deductionText,
      R100: d.vat_included ? '포함가 (VAT 포함)' : '별도 (VAT 별도)',
      R101: taxLabel,
      R102: insEmpD, R103: insEmpE, R104: insIndD, R105: insIndE,
      R110: str(d.bank_name), R111: str(d.bank_account), R112: str(d.bank_holder),
      // A: 대리점
      A001: str(a.name), A002: str(a.business_number), A003: str(a.owner_name),
      A004: str(a.phone),
      A005: a.address ? (str(a.address) + (a.address_detail ? ' ' + str(a.address_detail) : '')) : '',
      A006: str(a.email), A007: str(a.business_type), A008: str(a.business_category),
      A009: str(a.name),
      // C: 계약
      C001: fmtDate(periodStart) || new Date().toLocaleDateString('ko-KR'),
      C002: fmtDate(periodEnd) || '',
      C003: new Date().toLocaleDateString('ko-KR'),
      C004: periodStart && periodEnd ? calcDuration(periodStart, periodEnd) : '',
      // S: 기타
      S001: '',
    }

    // ── bindingData ({{변수}} 호환) + fields (번호별 상세) ──
    const bindingData: Record<string, string> = {}
    const fields: { id: string; label: string; value: string; source: string; group: string }[] = []

    for (const f of BINDING_FIELDS) {
      const value = resolveMap[f.id] ?? ''
      bindingData[f.templateVar] = value
      fields.push({ id: f.id, label: f.label, value, source: f.source, group: f.group })
    }

    const filled = fields.filter(f => f.value).length
    const emptyFields = fields.filter(f => !f.value)

    return NextResponse.json({
      bindingData,
      fields,
      meta: {
        total: fields.length,
        filled,
        empty: emptyFields.length,
        emptyIds: emptyFields.map(f => `${f.id}(${f.label})`),
        driverRates: ratesRes.data?.length || 0,
        routeRates: routeRes.data?.length || 0,
        deductions: deductionsRes.data?.length || 0,
      },
    })
  } catch (err) {
    console.error('[contracts/bind] error:', err)
    return NextResponse.json({ error: '바인딩 데이터 생성 실패' }, { status: 500 })
  }
}
