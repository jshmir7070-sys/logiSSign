/**
 * POST /api/auth/verify-login-otp
 *
 * OTP 검증 성공 → MFA 세션 쿠키 발급
 * Body: { userId: string, code: string }
 */

import { NextRequest, NextResponse } from 'next/server'
import { verifyOtp, generateMfaToken, MFA_COOKIE } from '@/lib/mfa'
import { rateLimitPublic } from '@/lib/rate-limit'
import { getClientIp } from '@/lib/get-ip'

export async function POST(req: NextRequest) {
  const ip = getClientIp(req)
  const rl = rateLimitPublic(ip, 'verify-login-otp')
  if (rl) return rl

  try {
    const body = await req.json()
    const userId = body?.userId as string
    const code = body?.code as string

    if (!userId || !code) {
      return NextResponse.json(
        { error: '사용자 ID와 인증번호가 필요합니다.' },
        { status: 400 }
      )
    }

    // OTP 검증
    const result = verifyOtp(userId, code)
    if (!result.valid) {
      return NextResponse.json({ error: result.error }, { status: 400 })
    }

    // MFA 토큰 생성
    const token = await generateMfaToken(userId)

    // 세션 쿠키로 설정 (maxAge 생략 → 브라우저 닫으면 삭제)
    const response = NextResponse.json({ verified: true })
    response.cookies.set(MFA_COOKIE, token, {
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
