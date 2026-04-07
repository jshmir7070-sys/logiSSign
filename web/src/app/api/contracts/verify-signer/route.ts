import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { getClientIp } from '@/lib/get-ip'
import { maskPhone } from '@/lib/mfa'
import { rateLimitPublic } from '@/lib/rate-limit'
import { sendSms } from '@/services/sms.service'
import {
  generateVerificationCode,
  issueVerificationCode,
} from '@/services/verification-code.service'

const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!,
  { auth: { autoRefreshToken: false, persistSession: false } }
)

export async function POST(req: NextRequest) {
  const ip = getClientIp(req)
  const rl = await rateLimitPublic(ip, 'verify-signer')
  if (rl) return rl

  try {
    const body = await req.json()
    const { contractId, driverId } = body as { contractId?: string; driverId?: string }

    if (!contractId || !driverId) {
      return NextResponse.json({ error: 'contractId와 driverId가 필요합니다.' }, { status: 400 })
    }

    const { data: contract } = await supabaseAdmin
      .from('contracts')
      .select('id, status, driver_id')
      .eq('id', contractId)
      .single()

    if (!contract) {
      return NextResponse.json({ error: '계약서를 찾을 수 없습니다.' }, { status: 404 })
    }

    if (contract.driver_id !== driverId) {
      return NextResponse.json({ error: '본인 계약서만 확인할 수 있습니다.' }, { status: 403 })
    }

    if (contract.status === 'signed') {
      return NextResponse.json({ error: '이미 서명된 계약서입니다.' }, { status: 400 })
    }

    const { data: driver } = await supabaseAdmin
      .from('drivers')
      .select('phone, name')
      .eq('id', driverId)
      .single()

    if (!driver?.phone) {
      return NextResponse.json({ error: '기사 휴대폰 번호가 등록되어 있지 않습니다.' }, { status: 400 })
    }

    const signerKey = `sign_${contractId}_${driverId}`
    const code = generateVerificationCode()
    const issueResult = await issueVerificationCode({
      verificationKey: signerKey,
      purpose: 'contract_signer',
      phone: driver.phone,
      code,
      payload: { contractId, driverId },
    })

    if (!issueResult.issued) {
      const waitSeconds = issueResult.waitSeconds ?? 60
      return NextResponse.json(
        { error: `${waitSeconds}초 후 다시 시도해주세요.`, waitMs: waitSeconds * 1000 },
        { status: 429 }
      )
    }

    const smsResult = await sendSms({
      to: driver.phone,
      text: `[logiSSign] 전자계약 서명 인증번호: ${code} (5분 내 입력)`,
    })

    if (!smsResult.sent) {
      return NextResponse.json(
        { error: 'SMS 발송에 실패했습니다. 휴대폰 번호를 확인해주세요.' },
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
