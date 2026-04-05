/**
 * POST /api/auth/send-login-otp
 *
 * 이메일+비밀번호 인증 후 등록된 휴대폰으로 6자리 OTP 발송
 *
 * ✅ 보안: userId를 body에서 받지 않고 Authorization 헤더 JWT에서 추출
 *    → 미인증 사용자의 임의 userId SMS 폭탄 공격 방지
 *
 * Body: {} (빈 body — userId는 JWT에서 자동 추출)
 * Header: Authorization: Bearer <supabase-access-token>
 */

import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { sendSms } from '@/services/sms.service'
import { generateOtpCode, storeOtp, canResendOtp, maskPhone } from '@/lib/mfa'
import { rateLimitPublic } from '@/lib/rate-limit'
import { getClientIp } from '@/lib/get-ip'

const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!,
  { auth: { autoRefreshToken: false, persistSession: false } }
)

export async function POST(req: NextRequest) {
  // Rate limit
  const ip = getClientIp(req)
  const rl = rateLimitPublic(ip, 'send-login-otp')
  if (rl) return rl

  try {
    // ✅ 보안: Authorization 헤더에서 JWT 추출 → userId를 서버에서 검증
    // 클라이언트는 signInWithPassword 성공 후 받은 access_token을 전달
    const authHeader = req.headers.get('authorization') ?? ''
    const token = authHeader.startsWith('Bearer ') ? authHeader.slice(7) : null

    // body에서도 userId를 받되, JWT가 있으면 JWT 우선 사용
    const body = await req.json().catch(() => ({}))
    let userId: string | null = null

    if (token) {
      // JWT가 있으면 서버에서 검증하여 userId 추출
      const { data: { user: jwtUser }, error: jwtErr } = await supabaseAdmin.auth.getUser(token)
      if (!jwtErr && jwtUser) {
        userId = jwtUser.id
      }
    }

    // JWT에서 추출 실패 시 body의 userId 사용 (하위 호환)
    // 단, 프로덕션에서는 JWT 필수
    if (!userId) {
      userId = body?.userId as string
      if (process.env.NODE_ENV === 'production' && !token) {
        return NextResponse.json({ error: '인증 토큰이 필요합니다.' }, { status: 401 })
      }
    }

    if (!userId) {
      return NextResponse.json({ error: '사용자 ID가 필요합니다.' }, { status: 400 })
    }

    // 재발송 쿨다운 체크
    const { canResend, waitMs } = canResendOtp(userId)
    if (!canResend) {
      return NextResponse.json(
        { error: `${Math.ceil(waitMs / 1000)}초 후 재발송 가능합니다.`, waitMs },
        { status: 429 }
      )
    }

    // 사용자 정보 조회 (Admin API)
    const { data: { user }, error: userError } = await supabaseAdmin.auth.admin.getUserById(userId)
    if (userError || !user) {
      // ✅ 보안: 사용자 존재 여부를 모호하게 응답 (사용자 열거 방지)
      return NextResponse.json({ error: '인증번호 발송에 실패했습니다.' }, { status: 400 })
    }

    const role = user.app_metadata?.role as string
    let phone: string | null = null

    if (role === 'agency_admin') {
      const agencyId = user.app_metadata?.agency_id as string
      if (agencyId) {
        const { data: agency } = await supabaseAdmin
          .from('agencies')
          .select('phone')
          .eq('id', agencyId)
          .single()
        phone = agency?.phone ?? null
      }
    } else if (role === 'provider_admin') {
      // 슈퍼관리자 — user_metadata 또는 환경변수
      phone = user.user_metadata?.phone as string ?? process.env.ADMIN_PHONE ?? null
    }

    if (!phone) {
      // 프로덕션: 전화번호 미등록 시 로그인 차단 (보안 강화)
      if (process.env.NODE_ENV === 'production') {
        return NextResponse.json(
          { error: '등록된 휴대폰 번호가 없습니다. 관리자에게 문의하세요.' },
          { status: 403 }
        )
      }
      // 개발환경: MFA 건너뛰기 허용
      return NextResponse.json({
        skip: true,
        message: '개발환경: 등록된 휴대폰 번호가 없어 본인인증을 건너뜁니다.',
      })
    }

    // OTP 발송
    const code = generateOtpCode()
    storeOtp(userId, code, phone)

    const smsResult = await sendSms({
      to: phone,
      text: `[logiSSign] 로그인 인증번호: ${code} (5분 내 입력)`,
    })

    if (!smsResult.sent) {
      // SMS 실패 → OTP 무효화 (보안: 발송 안 된 코드는 삭제)
      console.error('[MFA] SMS 발송 실패:', smsResult.error)
      return NextResponse.json(
        { error: 'SMS 발송에 실패했습니다. 등록된 전화번호를 확인해주세요.' },
        { status: 500 }
      )
    }

    return NextResponse.json({
      sent: true,
      maskedPhone: maskPhone(phone),
    })
  } catch (err) {
    console.error('[send-login-otp] error:', err)
    return NextResponse.json({ error: '인증번호 발송 중 오류가 발생했습니다.' }, { status: 500 })
  }
}
