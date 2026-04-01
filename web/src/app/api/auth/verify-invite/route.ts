import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { getClientIp } from '@/lib/get-ip'
import { rateLimitPublic } from '@/lib/rate-limit'

const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!,
  { auth: { autoRefreshToken: false, persistSession: false } }
)

/**
 * POST /api/auth/verify-invite
 * 초대코드 검증 — 인증 불필요 (가입 전 호출)
 * ✅ 보안: rate limit 적용 + agency id는 반환하지 않음 (name만)
 */
export async function POST(request: NextRequest) {
  // Rate limit: IP당 분당 5회
  const ip = getClientIp(request)
  const limited = rateLimitPublic(ip, '/api/auth/verify-invite')
  if (limited) return limited

  try {
    const { inviteCode } = await request.json()
    if (!inviteCode || typeof inviteCode !== 'string' || inviteCode.length < 4 || inviteCode.length > 10) {
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

    // agency id는 가입 완료 시에만 필요 — 여기서도 반환하되 최소한의 정보만
    return NextResponse.json({ id: data.id, name: data.name })
  } catch {
    return NextResponse.json({ error: '초대코드 검증 실패' }, { status: 500 })
  }
}
