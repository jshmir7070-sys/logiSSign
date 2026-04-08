import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { AuthenticationError, ValidationError } from '@/lib/app-error'
import { apiError } from '@/lib/api-error'
import { getClientIp } from '@/lib/get-ip'
import { generateMfaToken, MFA_COOKIE } from '@/lib/mfa'
import { rateLimitPublic } from '@/lib/rate-limit'
import { verifyVerificationCode } from '@/services/verification-code.service'

const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!,
  { auth: { autoRefreshToken: false, persistSession: false } }
)

async function resolveUserId(request: NextRequest, bodyUserId: string) {
  const authorization = request.headers.get('authorization') ?? ''
  const bearerToken = authorization.startsWith('Bearer ')
    ? authorization.slice(7).trim()
    : ''

  if (bearerToken) {
    const { data } = await supabaseAdmin.auth.getUser(bearerToken)
    if (!data.user) throw new AuthenticationError()
    if (data.user.id !== bodyUserId) {
      throw new AuthenticationError('인증 정보가 일치하지 않습니다.')
    }
    return data.user.id
  }

  if (bodyUserId) {
    return bodyUserId
  }

  throw new AuthenticationError()
}

export async function POST(request: NextRequest) {
  const ip = getClientIp(request)
  const limited = await rateLimitPublic(ip, 'verify-login-otp')
  if (limited) return limited

  try {
    const body = await request.json()
    const bodyUserId = body?.userId as string | undefined
    const code = body?.code as string | undefined

    if (!bodyUserId || !code) {
      throw new ValidationError('계정 ID와 인증번호가 필요합니다.')
    }

    const userId = await resolveUserId(request, bodyUserId)
    const result = await verifyVerificationCode({
      verificationKey: userId,
      purpose: 'login_mfa',
      code,
    })

    if (!result.valid) {
      return NextResponse.json({ error: result.error }, { status: 400 })
    }

    const mfaToken = await generateMfaToken(userId)
    const response = NextResponse.json({ verified: true })
    response.cookies.set(MFA_COOKIE, mfaToken, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax',
      path: '/',
    })

    return response
  } catch (error) {
    return apiError(error, 500, 'OTP 검증 중 오류가 발생했습니다.', request)
  }
}
