/**
 * POST /api/contracts/verify-signer
 *
 * 전자계약 서명 전 본인확인 (OTP)
 * 전자서명법 부인방지 요건 충족
 *
 * Flow:
 *   1. 기사가 서명 버튼 클릭
 *   2. → 이 API 호출 (contractId, driverId)
 *   3. ← OTP SMS 발송 + maskedPhone 반환
 *   4. 기사가 OTP 입력
 *   5. → /api/contracts/confirm-signature 호출 (contractId, driverId, otpCode)
 *   6. ← 서명 완료 + Sealed PDF 생성
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
  const ip = getClientIp(req)
  const rl = rateLimitPublic(ip, 'verify-signer')
  if (rl) return rl

  try {
    const body = await req.json()
    const { contractId, driverId } = body as { contractId?: string; driverId?: string }

    if (!contractId || !driverId) {
      return NextResponse.json({ error: 'contractId와 driverId가 필요합니다.' }, { status: 400 })
    }

    // 계약서 유효성 확인
    const { data: contract } = await supabaseAdmin
      .from('contracts')
      .select('id, status, driver_id')
      .eq('id', contractId)
      .single()

    if (!contract) {
      return NextResponse.json({ error: '계약서를 찾을 수 없습니다.' }, { status: 404 })
    }

    if (contract.status === 'signed') {
      return NextResponse.json({ error: '이미 서명이 완료된 계약서입니다.' }, { status: 400 })
    }

    // 기사 전화번호 조회
    const { data: driver } = await supabaseAdmin
      .from('drivers')
      .select('phone, name')
      .eq('id', driverId)
      .single()

    if (!driver?.phone) {
      return NextResponse.json({ error: '기사의 전화번호가 등록되지 않았습니다.' }, { status: 400 })
    }

    // 쿨다운 체크
    const signerKey = `sign_${contractId}_${driverId}`
    const { canResend, waitMs } = canResendOtp(signerKey)
    if (!canResend) {
      return NextResponse.json(
        { error: `${Math.ceil(waitMs / 1000)}초 후 재발송 가능합니다.`, waitMs },
        { status: 429 }
      )
    }

    // OTP 발송
    const code = generateOtpCode()
    storeOtp(signerKey, code, driver.phone)

    const smsResult = await sendSms({
      to: driver.phone,
      text: `[logiSSign] 전자계약 서명 인증번호: ${code} (5분 내 입력)`,
    })

    if (!smsResult.sent) {
      console.error('[Contract Verify] SMS 발송 실패:', smsResult.error)
      return NextResponse.json(
        { error: 'SMS 발송에 실패했습니다. 전화번호를 확인해주세요.' },
        { status: 500 }
      )
    }

    return NextResponse.json({
      sent: true,
      maskedPhone: maskPhone(driver.phone),
      signerKey,
    })
  } catch (err) {
    console.error('[verify-signer] error:', err)
    return NextResponse.json({ error: '본인확인 처리 중 오류가 발생했습니다.' }, { status: 500 })
  }
}
