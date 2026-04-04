/**
 * POST /api/auth/send-login-otp
 *
 * 이메일+비밀번호 인증 후 등록된 휴대폰으로 6자리 OTP 발송
 * Body: { userId: string }  (클라이언트에서 signInWithPassword 성공 후 호출)
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
    const body = await req.json()
    const userId = body?.userId as string

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
      return NextResponse.json({ error: '사용자를 찾을 수 없습니다.' }, { status: 404 })
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
      // 등록된 전화번호가 없으면 MFA 건너뛰기 (setup 안내)
      return NextResponse.json({
        skip: true,
        message: '등록된 휴대폰 번호가 없어 본인인증을 건너뜁니다. 설정에서 등록해주세요.',
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
      // SMS 실패 시에도 OTP는 저장됨 → 개발환경에서는 콘솔 확인 가능
      console.warn('[MFA] SMS 발송 실패:', smsResult.error, '코드:', code)
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
