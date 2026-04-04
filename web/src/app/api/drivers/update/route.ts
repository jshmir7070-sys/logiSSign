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
 * service_role로 기사 정보 업데이트 (RLS 우회)
 * 인증된 agency_admin만 자기 소속 기사 수정 가능
 */
export async function POST(request: NextRequest) {
  const { auth, error: authError } = await authenticateRequest(request)
  if (authError || !auth) return authError!

  try {
    const body = await request.json()
    const { driverId, ...fields } = body

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

    // 허용 필드만 추출 (보안)
    const allowed = [
      'employee_code', 'address', 'email', 'delivery_area', 'camp_name',
      'is_business_owner', 'business_reg_number', 'representative_name',
      'business_address', 'business_type', 'business_category',
      'vat_included', 'tax_type', 'fresh_incentive_pct', 'extra_incentive_pct',
      'rate_mode', 'flat_rate', 'rate_percentage',
      'vehicle_number', 'vehicle_type', 'vehicle_year', 'vehicle_vin',
      'vehicle_mileage', 'vehicle_owner', 'vehicle_rent_monthly', 'vehicle_deposit',
      'vehicle_insurance_by', 'bank_name', 'bank_account', 'bank_holder',
      'custom_values',
    ]
    const safeFields: Record<string, unknown> = {}
    for (const key of allowed) {
      if (key in fields) safeFields[key] = fields[key]
    }

    const { error: updateErr } = await supabaseAdmin
      .from('drivers')
      .update(safeFields)
      .eq('id', driverId)

    if (updateErr) {
      console.error('[drivers/update] error:', updateErr.message)
      return NextResponse.json({ error: updateErr.message }, { status: 500 })
    }

    return NextResponse.json({ updated: true })
  } catch (err) {
    console.error('[drivers/update] unexpected:', err)
    return NextResponse.json({ error: '기사 정보 업데이트 실패' }, { status: 500 })
  }
}
