/**
 * POST /api/auth/verify-login-otp
 *
 * OTP 검증 성공 → MFA 세션 쿠키 발급
 *
 * ✅ 보안: Authorization 헤더의 JWT에서 userId를 추출하여
 *    요청 body의 userId와 일치 여부 검증 (세션 하이재킹 방지)
 *
 * Body: { userId: string, code: string }
 * Header: Authorization: Bearer <supabase-access-token>
 */

import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { verifyOtp, generateMfaToken, MFA_COOKIE } from '@/lib/mfa'
import { rateLimitPublic } from '@/lib/rate-limit'
import { getClientIp } from '@/lib/get-ip'

const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!,
  { auth: { autoRefreshToken: false, persistSession: false } }
)

export async function POST(req: NextRequest) {
  const ip = getClientIp(req)
  const rl = rateLimitPublic(ip, 'verify-login-otp')
  if (rl) return rl

  try {
    const body = await req.json()
    const bodyUserId = body?.userId as string
    const code = body?.code as string

    if (!bodyUserId || !code) {
      return NextResponse.json(
        { error: '사용자 ID와 인증번호가 필요합니다.' },
        { status: 400 }
      )
    }

    // ✅ 보안: JWT에서 userId 추출하여 body의 userId와 일치 확인
    // 공격자가 타인의 userId + 추측 OTP로 MFA 우회 시도 방지
    const authHeader = req.headers.get('authorization') ?? ''
    const token = authHeader.startsWith('Bearer ') ? authHeader.slice(7) : null

    if (token) {
      const { data: { user: jwtUser } } = await supabaseAdmin.auth.getUser(token)
      if (jwtUser && jwtUser.id !== bodyUserId) {
        return NextResponse.json({ error: '인증 정보가 일치하지 않습니다.' }, { status: 403 })
      }
    } else if (process.env.NODE_ENV === 'production') {
      // 프로덕션에서는 JWT 필수
      return NextResponse.json({ error: '인증 토큰이 필요합니다.' }, { status: 401 })
    }

    // OTP 검증
    const result = verifyOtp(bodyUserId, code)
    if (!result.valid) {
      return NextResponse.json({ error: result.error }, { status: 400 })
    }

    // MFA 토큰 생성
    const mfaToken = await generateMfaToken(bodyUserId)

    // 세션 쿠키로 설정 (maxAge 생략 → 브라우저 닫으면 삭제)
    const response = NextResponse.json({ verified: true })
    response.cookies.set(MFA_COOKIE, mfaToken, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax',
      path: '/',
      // maxAge 없음 → 세션 쿠키 (브라우저 닫으면 삭제)
    })

    return response
  } catch (err) {
    console.error('[verify-login-otp] error:', err)
    return NextResponse.json(
      { error: 'OTP 검증 중 오류가 발생했습니다.' },
      { status: 500 }
    )
  }
}
