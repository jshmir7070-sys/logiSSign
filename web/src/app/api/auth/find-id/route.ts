import { NextRequest, NextResponse } from 'next/server'
import { getClientIp } from '@/lib/get-ip'
import { rateLimitPublic } from '@/lib/rate-limit'
import {
  findAccountIdByNameAndPhone,
  maskRecoveryEmail,
  type RecoveryAccountType,
} from '@/services/account-recovery.service'
import {
  generateVerificationCode,
  issueVerificationCode,
  verifyVerificationCode,
} from '@/services/verification-code.service'
import { sendSms } from '@/services/sms.service'

const PURPOSE_BY_ACCOUNT: Record<RecoveryAccountType, 'agency_find_id' | 'admin_find_id' | 'driver_find_id'> = {
  agency: 'agency_find_id',
  admin: 'admin_find_id',
  driver: 'driver_find_id',
}

export async function POST(request: NextRequest) {
  const ip = getClientIp(request)
  const limited = await rateLimitPublic(ip, 'find-id')
  if (limited) return limited

  try {
    const body = await request.json()
    const action = body?.action as 'send' | 'verify' | undefined
    const accountType = (body?.accountType as RecoveryAccountType | undefined) ?? 'agency'
    const name = String(body?.name ?? '').trim()
    const phone = String(body?.phone ?? '').trim()
    const code = String(body?.code ?? '').trim()

    if (!['agency', 'admin', 'driver'].includes(accountType)) {
      return NextResponse.json({ error: '지원하지 않는 계정 유형입니다.' }, { status: 400 })
    }

    if (!name || !phone) {
      return NextResponse.json({ error: '이름과 휴대폰 번호를 입력해주세요.' }, { status: 400 })
    }

    const account = await findAccountIdByNameAndPhone({ accountType, name, phone })
    if (!account) {
      await new Promise((resolve) => setTimeout(resolve, 200 + Math.random() * 300))
      return NextResponse.json(
        { error: '입력한 정보와 일치하는 계정을 찾을 수 없습니다.' },
        { status: 404 }
      )
    }

    const purpose = PURPOSE_BY_ACCOUNT[accountType]

    if (action === 'send') {
      const verificationCode = generateVerificationCode()
      const issued = await issueVerificationCode({
        verificationKey: account.lookupKey,
        purpose,
        phone: account.phone,
        code: verificationCode,
        payload: { email: account.email },
      })

      if (!issued.issued) {
        const waitSeconds = issued.waitSeconds ?? 60
        return NextResponse.json(
          { error: `${waitSeconds}초 후 다시 시도해주세요.` },
          { status: 429 }
        )
      }

      const smsResult = await sendSms({
        to: account.phone,
        text: `[logiSSign] 아이디 찾기 인증번호: ${verificationCode} (5분 내 입력)`,
      })

      if (!smsResult.sent) {
        return NextResponse.json(
          { error: 'SMS 발송에 실패했습니다. 잠시 후 다시 시도해주세요.' },
          { status: 500 }
        )
      }

      return NextResponse.json({ sent: true, expiresIn: 300 })
    }

    if (action === 'verify') {
      if (!code) {
        return NextResponse.json({ error: '인증번호를 입력해주세요.' }, { status: 400 })
      }

      const result = await verifyVerificationCode({
        verificationKey: account.lookupKey,
        purpose,
        code,
      })

      if (!result.valid) {
        return NextResponse.json({ error: result.error }, { status: 400 })
      }

      return NextResponse.json({
        verified: true,
        email: maskRecoveryEmail(account.email),
      })
    }

    return NextResponse.json({ error: '잘못된 요청입니다.' }, { status: 400 })
  } catch {
    return NextResponse.json(
      { error: '서버 오류가 발생했습니다. 잠시 후 다시 시도해주세요.' },
      { status: 500 }
    )
  }
}
