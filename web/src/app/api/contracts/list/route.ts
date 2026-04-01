import { getClientIp } from '@/lib/get-ip'
import { rateLimitAuth } from '@/lib/rate-limit'
import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { authenticateRequest } from '@/lib/api-auth'
import { apiError } from '@/lib/api-error'

const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!,
  { auth: { autoRefreshToken: false, persistSession: false } }
)

export async function GET(request: NextRequest) {
  const ip = getClientIp(request)
  const limited = rateLimitAuth(ip, '/api/contracts/list')
  if (limited) return limited

  const { auth, error: authError } = await authenticateRequest(request)
  if (authError) return authError

  // 인증된 사용자의 agencyId 사용 (쿼리 파라미터 무시)
  const agencyId = auth!.agencyId
  if (!agencyId) {
    return NextResponse.json({ data: [], error: '대리점 정보가 없습니다' }, { status: 403 })
  }

  try {
    const { searchParams } = new URL(request.url)
    const status = searchParams.get('status')

    let query = supabaseAdmin
      .from('contracts')
      .select('id, template_id, driver_id, title, status, sent_at, signed_at, signed_pdf_url, created_at, drivers(name)')
      .eq('agency_id', agencyId)
      .order('created_at', { ascending: false })

    if (status) {
      query = query.eq('status', status)
    }

    const { data, error } = await query

    if (error) {
      console.error('[ContractList] Query error:', error)
      return NextResponse.json({ data: null, error: error.message }, { status: 500 })
    }

    return NextResponse.json({ data, error: null })
  } catch (err) {
    console.error('[ContractList] Unexpected error:', err)
    return apiError('계약서 목록 조회 실패', 500)
  }
}
