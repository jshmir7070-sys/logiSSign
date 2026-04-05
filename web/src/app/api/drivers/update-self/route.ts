import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { createServerClient, type CookieOptions } from '@supabase/ssr'
import { rateLimitAuth } from '@/lib/rate-limit'
import { getClientIp } from '@/lib/get-ip'

const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!,
  { auth: { autoRefreshToken: false, persistSession: false } }
)

/**
 * POST /api/drivers/update-self
 * 기사 본인이 자기 개인정보 수정 (모바일 앱에서 호출)
 * 수정 가능 항목: 전화번호, 주소, 이메일, 은행계좌, 차량정보
 * 수정 불가 항목: 이름, 사번, 단가, 공제 (대리점만 수정 가능)
 */
export async function POST(request: NextRequest) {
  const ip = getClientIp(request)
  const limited = rateLimitAuth(ip, '/api/drivers/update-self')
  if (limited) return limited

  try {
    // 기사 본인 인증 (쿠키 기반)
    const supabase = createServerClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
      {
        cookies: {
          get(name: string) { return request.cookies.get(name)?.value },
          set() {},
          remove() {},
        },
      }
    )

    const { data: { user }, error: userError } = await supabase.auth.getUser()
    if (userError || !user) {
      return NextResponse.json({ error: '인증이 필요합니다' }, { status: 401 })
    }

    // user_id로 기사 조회
    const { data: driver } = await supabaseAdmin
      .from('drivers')
      .select('id, user_id')
      .eq('user_id', user.id)
      .single()

    if (!driver) {
      return NextResponse.json({ error: '기사 정보를 찾을 수 없습니다' }, { status: 404 })
    }

    const body = await request.json()

    // 기사 본인이 수정 가능한 필드만 (보안: 화이트리스트)
    const selfEditable = [
      'phone', 'address', 'email',
      'bank_name', 'bank_account', 'bank_holder',
      'vehicle_number', 'vehicle_type', 'vehicle_year', 'vehicle_vin',
    ]
    const safeFields: Record<string, unknown> = {}
    for (const key of selfEditable) {
      if (key in body) safeFields[key] = body[key]
    }

    if (Object.keys(safeFields).length === 0) {
      return NextResponse.json({ error: '수정할 항목이 없습니다' }, { status: 400 })
    }

    const { error: updateErr } = await supabaseAdmin
      .from('drivers')
      .update(safeFields)
      .eq('id', driver.id)

    if (updateErr) {
      return NextResponse.json({ error: updateErr.message }, { status: 500 })
    }

    return NextResponse.json({ updated: true, fields: Object.keys(safeFields) })
  } catch (err) {
    console.error('[drivers/update-self]', err)
    return NextResponse.json({ error: '수정 실패' }, { status: 500 })
  }
}
