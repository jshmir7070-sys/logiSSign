import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { authenticateRequest } from '@/lib/api-auth'
import { rateLimitAuth } from '@/lib/rate-limit'
import { getClientIp } from '@/lib/get-ip'

const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!,
  { auth: { autoRefreshToken: false, persistSession: false } }
)

/**
 * POST /api/drivers/delete-item
 * 기사 관련 하위 데이터 삭제 (단가/공제/인센티브)
 * Body: { table: 'driver_rates'|'driver_deductions'|'driver_incentives', id: string }
 */
export async function POST(request: NextRequest) {
  const ip = getClientIp(request)
  const limited = rateLimitAuth(ip, '/api/drivers/delete-item')
  if (limited) return limited

  const { auth, error: authError } = await authenticateRequest(request)
  if (authError || !auth) return authError!

  try {
    const { table, id } = await request.json()

    const allowedTables = ['driver_rates', 'driver_deductions', 'driver_incentives', 'driver_route_rates']
    if (!allowedTables.includes(table) || !id) {
      return NextResponse.json({ error: '잘못된 요청' }, { status: 400 })
    }

    // 소속 기사의 데이터인지 확인
    const { data: item } = await supabaseAdmin
      .from(table)
      .select('driver_id')
      .eq('id', id)
      .single()

    if (!item) {
      return NextResponse.json({ error: '데이터를 찾을 수 없습니다' }, { status: 404 })
    }

    const { data: driver } = await supabaseAdmin
      .from('drivers')
      .select('agency_id')
      .eq('id', (item as { driver_id: string }).driver_id)
      .single()

    if (!driver || (driver as { agency_id: string }).agency_id !== auth.agencyId) {
      return NextResponse.json({ error: '권한이 없습니다' }, { status: 403 })
    }

    const { error } = await supabaseAdmin.from(table).delete().eq('id', id)
    if (error) {
      console.error('[DriverDeleteItem] 삭제 오류:', error.message)
      return NextResponse.json({ error: '데이터 삭제 처리 중 오류가 발생했습니다' }, { status: 500 })
    }

    return NextResponse.json({ deleted: true })
  } catch (err) {
    return NextResponse.json({ error: '삭제 실패' }, { status: 500 })
  }
}
