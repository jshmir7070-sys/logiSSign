import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!,
  { auth: { autoRefreshToken: false, persistSession: false } }
)

/**
 * POST /api/auth/verify-invite
 * 초대코드 검증 — 인증 불필요 (가입 전 호출)
 * service_role로 agencies 조회하여 RLS 우회
 */
export async function POST(request: NextRequest) {
  try {
    const { inviteCode } = await request.json()
    if (!inviteCode || typeof inviteCode !== 'string') {
      return NextResponse.json({ error: '초대코드를 입력하세요' }, { status: 400 })
    }

    const { data, error } = await supabaseAdmin
      .from('agencies')
      .select('id, name')
      .eq('invite_code', inviteCode.trim().toUpperCase())
      .single()

    if (error || !data) {
      return NextResponse.json({ error: '유효하지 않은 초대코드입니다' }, { status: 404 })
    }

    return NextResponse.json({ id: data.id, name: data.name })
  } catch {
    return NextResponse.json({ error: '초대코드 검증 실패' }, { status: 500 })
  }
}
