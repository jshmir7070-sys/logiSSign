import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

import { getClientIp } from '@/lib/get-ip'
import { rateLimitAuth } from '@/lib/rate-limit'

const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!,
  { auth: { autoRefreshToken: false, persistSession: false } },
)

export async function POST(request: NextRequest) {
  const ip = getClientIp(request)
  const limited = await rateLimitAuth(ip, '/api/contracts/viewed')
  if (limited) return limited

  try {
    const authHeader = request.headers.get('authorization') ?? ''
    const token = authHeader.startsWith('Bearer ') ? authHeader.slice(7).trim() : ''
    if (!token) {
      return NextResponse.json({ error: '인증 토큰이 필요합니다.' }, { status: 401 })
    }

    const {
      data: { user },
      error: authErr,
    } = await supabaseAdmin.auth.getUser(token)

    if (authErr || !user) {
      return NextResponse.json({ error: '유효하지 않은 인증입니다.' }, { status: 401 })
    }

    const body = await request.json()
    const contractId = typeof body?.contractId === 'string' ? body.contractId : ''
    const requestedDriverId = typeof body?.driverId === 'string' ? body.driverId : ''

    if (!contractId || !requestedDriverId) {
      return NextResponse.json({ error: 'contractId와 driverId가 필요합니다.' }, { status: 400 })
    }

    const metaRole = user.app_metadata?.role
    const metaDriverId = typeof user.app_metadata?.driver_id === 'string' ? user.app_metadata.driver_id : ''
    const metaAgencyId = typeof user.app_metadata?.agency_id === 'string' ? user.app_metadata.agency_id : ''
    if (metaRole !== 'driver' || !metaDriverId || !metaAgencyId || metaDriverId !== requestedDriverId) {
      return NextResponse.json({ error: '본인의 계약서만 열람 처리할 수 있습니다.' }, { status: 403 })
    }

    const { data: contract, error: contractErr } = await supabaseAdmin
      .from('contracts')
      .select('id, agency_id, driver_id, status')
      .eq('id', contractId)
      .single()

    if (contractErr || !contract) {
      return NextResponse.json({ error: '계약서를 찾을 수 없습니다.' }, { status: 404 })
    }

    if (contract.driver_id !== requestedDriverId || contract.agency_id !== metaAgencyId) {
      return NextResponse.json({ error: '본인의 계약서만 열람 처리할 수 있습니다.' }, { status: 403 })
    }

    if (contract.status !== 'sent') {
      return NextResponse.json({ viewed: contract.status === 'viewed', status: contract.status })
    }

    const { error: updateErr } = await supabaseAdmin
      .from('contracts')
      .update({ status: 'viewed', viewed_at: new Date().toISOString() })
      .eq('id', contractId)
      .eq('driver_id', requestedDriverId)
      .eq('status', 'sent')

    if (updateErr) {
      console.error('[ContractViewed] Status update failed:', updateErr)
      return NextResponse.json({ error: '계약서 열람 상태 업데이트에 실패했습니다.' }, { status: 500 })
    }

    return NextResponse.json({ viewed: true, status: 'viewed' })
  } catch (error) {
    console.error('[ContractViewed] Unexpected error:', error)
    return NextResponse.json({ error: '계약서 열람 처리 중 오류가 발생했습니다.' }, { status: 500 })
  }
}
