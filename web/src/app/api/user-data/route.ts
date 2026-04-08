/**
 * 개인정보 처리 API
 * GET  /api/user-data  : 내 데이터 내려받기(JSON)
 * POST /api/user-data  : 내 데이터 삭제 요청 접수
 */

import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { authenticateRequest } from '@/lib/api-auth'
import { getClientIp } from '@/lib/get-ip'
import { rateLimitAuth } from '@/lib/rate-limit'

const supabaseAdmin = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!, {
  auth: { autoRefreshToken: false, persistSession: false },
})

/**
 * GET /api/user-data
 * 로그인한 계정이 자신의 개인정보와 운영 데이터를 JSON으로 내려받습니다.
 */
export async function GET(request: NextRequest) {
  const ip = getClientIp(request)
  const limited = await rateLimitAuth(ip, '/api/user-data')
  if (limited) return limited

  const { auth, error } = await authenticateRequest(request)
  if (error || !auth) return error!

  try {
    const {
      data: { user },
    } = await supabaseAdmin.auth.admin.getUserById(auth.userId)

    if (!user) {
      return NextResponse.json({ error: '계정 정보를 찾을 수 없습니다.' }, { status: 404 })
    }

    const { data: agency } = await supabaseAdmin
      .from('agencies')
      .select('name, owner_name, phone, business_number, address, plan, created_at')
      .eq('id', auth.agencyId)
      .single()

    const { data: drivers } = await supabaseAdmin
      .from('drivers')
      .select('id, name, phone, status, created_at')
      .eq('agency_id', auth.agencyId)

    const { data: contracts } = await supabaseAdmin
      .from('contracts')
      .select('id, title, status, created_at')
      .eq('agency_id', auth.agencyId)

    const { data: settlements } = await supabaseAdmin
      .from('settlements')
      .select('id, driver_id, year_month, total_income, total_deduction, net_amount, status, created_at')
      .eq('agency_id', auth.agencyId)

    const { data: consents } = await supabaseAdmin
      .from('user_consents')
      .select('consent_type, agreed, agreed_at, revoked_at')
      .eq('user_id', auth.userId)

    const exportData = {
      exported_at: new Date().toISOString(),
      account: {
        id: user.id,
        email: user.email,
        role: user.app_metadata?.role,
        created_at: user.created_at,
      },
      agency: agency || null,
      drivers: drivers || [],
      contracts: (contracts || []).map((contract) => ({
        id: contract.id,
        title: contract.title,
        status: contract.status,
        created_at: contract.created_at,
      })),
      settlements: settlements || [],
      consents: consents || [],
    }

    return new NextResponse(JSON.stringify(exportData, null, 2), {
      status: 200,
      headers: {
        'Content-Type': 'application/json',
        'Content-Disposition': `attachment; filename="logissign_data_export_${new Date().toISOString().slice(0, 10)}.json"`,
      },
    })
  } catch (exportError) {
    console.error('[user-data export] error:', exportError)
    return NextResponse.json({ error: '데이터 내려받기에 실패했습니다.' }, { status: 500 })
  }
}

/**
 * POST /api/user-data
 * 로그인한 계정의 개인정보 삭제 요청을 접수합니다.
 */
export async function POST(request: NextRequest) {
  const ip = getClientIp(request)
  const limited = await rateLimitAuth(ip, '/api/user-data')
  if (limited) return limited

  const { auth, error } = await authenticateRequest(request)
  if (error || !auth) return error!

  try {
    const body = await request.json()
    const { action } = body as { action: string }

    if (action === 'delete_request') {
      const { error: insertError } = await supabaseAdmin.from('data_deletion_requests').insert({
        user_id: auth.userId,
        agency_id: auth.agencyId,
        request_type: 'delete_all',
        status: 'pending',
        target_data: { scope: 'all_personal_data' },
      })

      if (insertError) {
        return NextResponse.json({ error: `삭제 요청을 등록하지 못했습니다: ${insertError.message}` }, { status: 500 })
      }

      return NextResponse.json({
        success: true,
        message: '개인정보 삭제 요청이 접수되었습니다. 최대 30일 이내에 처리됩니다.',
      })
    }

    return NextResponse.json({ error: '지원하지 않는 action입니다.' }, { status: 400 })
  } catch {
    return NextResponse.json({ error: '요청 처리 중 오류가 발생했습니다.' }, { status: 500 })
  }
}
