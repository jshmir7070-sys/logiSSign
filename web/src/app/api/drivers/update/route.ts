import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { authenticateRequest } from '@/lib/api-auth'

const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!,
  { auth: { autoRefreshToken: false, persistSession: false } }
)

/**
 * POST /api/drivers/update
 * service_role로 기사 정보 + 단가 + 공제 + 노선단가 일괄 업데이트 (RLS 우회)
 * 인증된 agency_admin만 자기 소속 기사 수정 가능
 */
export async function POST(request: NextRequest) {
  const { auth, error: authError } = await authenticateRequest(request)
  if (authError || !auth) return authError!

  try {
    const body = await request.json()
    const { driverId, driverRates, routeRates, deductions, ...fields } = body

    if (!driverId) {
      return NextResponse.json({ error: '기사 ID가 필요합니다' }, { status: 400 })
    }

    // 소속 기사인지 확인
    const { data: driver } = await supabaseAdmin
      .from('drivers')
      .select('id, agency_id')
      .eq('id', driverId)
      .single()

    if (!driver || driver.agency_id !== auth.agencyId) {
      return NextResponse.json({ error: '소속 기사가 아닙니다' }, { status: 403 })
    }

    // ── 1. 기사 기본 정보 업데이트 ──
    const allowed = [
      'employee_code', 'address', 'email', 'delivery_area', 'camp_name',
      'is_business_owner', 'business_reg_number', 'representative_name',
      'business_address', 'business_type', 'business_category',
      'vat_included', 'tax_type', 'fresh_incentive_pct', 'extra_incentive_pct',
      'rate_mode', 'flat_rate', 'rate_percentage',
      'vehicle_number', 'vehicle_type', 'vehicle_year', 'vehicle_vin',
      'vehicle_mileage', 'vehicle_owner', 'vehicle_rent_monthly', 'vehicle_deposit',
      'vehicle_insurance_by', 'bank_name', 'bank_account', 'bank_holder',
      'custom_values', 'birth_date',
      'status', 'resigned_at',  // 퇴사 처리
    ]
    // status 값 검증
    if (fields.status && !['active', 'resting', 'inactive'].includes(fields.status)) {
      return NextResponse.json({ error: '잘못된 상태 값입니다' }, { status: 400 })
    }
    const safeFields: Record<string, unknown> = {}
    for (const key of allowed) {
      if (key in fields) safeFields[key] = fields[key]
    }

    if (Object.keys(safeFields).length > 0) {
      const { error: updateErr } = await supabaseAdmin
        .from('drivers')
        .update(safeFields)
        .eq('id', driverId)
      if (updateErr) {
        console.error('[drivers/update] driver update error:', updateErr.message)
      }
    }

    // ── 2. 기사별 단가 (driver_rates) ──
    if (Array.isArray(driverRates) && driverRates.length > 0) {
      // 기존 삭제 후 재삽입
      await supabaseAdmin.from('driver_rates').delete().eq('driver_id', driverId)
      const rateRows = driverRates.map((r: { package_type: string; unit_price: number; rate_type: string }) => ({
        driver_id: driverId,
        principal_id: r.package_type === '배송' || r.package_type === '반품' || r.package_type === '집하'
          ? null : null, // principal_id는 별도 매핑 필요 시 추가
        package_type: r.package_type,
        unit_price: r.unit_price,
        rate_type: r.rate_type || 'fixed',
        is_active: true,
      }))
      const { error: rateErr } = await supabaseAdmin.from('driver_rates').insert(rateRows)
      if (rateErr) console.error('[drivers/update] rates error:', rateErr.message)
    }

    // ── 3. 노선별 단가 (driver_route_rates) ──
    if (Array.isArray(routeRates) && routeRates.length > 0) {
      await supabaseAdmin.from('driver_route_rates').delete().eq('driver_id', driverId)
      const routeRows = routeRates.map((r: { route_code: string; delivery_rate: number; return_rate: number }) => ({
        driver_id: driverId,
        route_code: r.route_code,
        unit_price: r.delivery_rate,
        delivery_rate: r.delivery_rate,
        return_rate: r.return_rate || r.delivery_rate,
        is_active: true,
      }))
      const { error: routeErr } = await supabaseAdmin.from('driver_route_rates').insert(routeRows)
      if (routeErr) console.error('[drivers/update] route rates error:', routeErr.message)
    }

    // ── 4. 공제 항목 (driver_deductions) ──
    if (Array.isArray(deductions) && deductions.length > 0) {
      await supabaseAdmin.from('driver_deductions').delete().eq('driver_id', driverId)
      const deductionRows = deductions.map((d: { name: string; amount: number; deduction_type: string }) => ({
        driver_id: driverId,
        name: d.name,
        amount: d.amount,
        deduction_type: d.deduction_type || 'fixed',
        is_active: true,
      }))
      const { error: dedErr } = await supabaseAdmin.from('driver_deductions').insert(deductionRows)
      if (dedErr) console.error('[drivers/update] deductions error:', dedErr.message)
    }

    return NextResponse.json({ updated: true })
  } catch (err) {
    console.error('[drivers/update] unexpected:', err)
    return NextResponse.json({ error: '기사 정보 업데이트 실패' }, { status: 500 })
  }
}
