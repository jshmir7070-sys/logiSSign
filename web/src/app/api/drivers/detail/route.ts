import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { authenticateRequest } from '@/lib/api-auth'
import { rateLimitAuth } from '@/lib/rate-limit'
import { getClientIp } from '@/lib/get-ip'
import { decryptDriverPii } from '@/services/pii.service'

const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!,
  { auth: { autoRefreshToken: false, persistSession: false } }
)

export async function GET(request: NextRequest) {
  const ip = getClientIp(request)
  const limited = await rateLimitAuth(ip, '/api/drivers/detail')
  if (limited) return limited

  const { auth, error: authError } = await authenticateRequest(request)
  if (authError || !auth) return authError!

  const { searchParams } = new URL(request.url)
  const driverId = searchParams.get('driverId')
  if (!driverId) {
    return NextResponse.json({ error: 'driverId가 필요합니다.' }, { status: 400 })
  }

  const { data: driver, error } = await supabaseAdmin
    .from('drivers')
    .select(`
      id, agency_id, name, phone, employee_code, delivery_area, camp_name, address, email, status,
      is_business_owner, vat_included, fresh_incentive_pct, extra_incentive_pct, tax_type,
      birth_date, business_reg_number, representative_name, business_address, business_type, business_category,
      vehicle_number, vehicle_type, vehicle_year, vehicle_vin, vehicle_mileage,
      vehicle_owner, vehicle_rent_monthly, vehicle_deposit, vehicle_insurance_by,
      bank_name, bank_account, bank_holder,
      rate_mode, flat_rate, rate_percentage, custom_values
    `)
    .eq('id', driverId)
    .single()

  if (error || !driver) {
    return NextResponse.json({ error: '기사 정보를 찾을 수 없습니다.' }, { status: 404 })
  }

  if (auth.role !== 'provider_admin' && driver.agency_id !== auth.agencyId) {
    return NextResponse.json({ error: '권한이 없습니다.' }, { status: 403 })
  }

  const decryptedDriver = await decryptDriverPii(driver)
  return NextResponse.json({ data: decryptedDriver, error: null })
}
