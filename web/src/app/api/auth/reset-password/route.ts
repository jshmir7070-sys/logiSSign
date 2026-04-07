import { NextRequest, NextResponse } from 'next/server'
import { createAdminSupabaseClient } from '@/lib/supabase'
import { getClientIp } from '@/lib/get-ip'
import { rateLimitPublic } from '@/lib/rate-limit'
import {
  findAccountForPasswordReset,
  type RecoveryAccountType,
} from '@/services/account-recovery.service'
import {
  consumeVerifiedCode,
  generateVerificationCode,
  issueVerificationCode,
  verifyVerificationCode,
} from '@/services/verification-code.service'
import { sendSms } from '@/services/sms.service'

const PURPOSE_BY_ACCOUNT: Record<
  RecoveryAccountType,
  'agency_reset_password' | 'admin_reset_password' | 'driver_reset_password'
> = {
  agency: 'agency_reset_password',
  admin: 'admin_reset_password',
  driver: 'driver_reset_password',
}

function validatePassword(password: string) {
  if (password.length < 8) return '비밀번호는 8자 이상이어야 합니다.'
  if (!/[a-z]/.test(password)) return '영문 소문자를 포함해야 합니다.'
  if (!/[A-Z]/.test(password)) return '영문 대문자를 포함해야 합니다.'
  if (!/[0-9]/.test(password)) return '숫자를 포함해야 합니다.'
  if (!/[^a-zA-Z0-9]/.test(password)) return '특수문자를 포함해야 합니다.'
  return null
}

export async function POST(request: NextRequest) {
  const ip = getClientIp(request)
  const limited = await rateLimitPublic(ip, 'reset-password')
  if (limited) return limited

  try {
    const body = await request.json()
    const action = body?.action as 'send' | 'verify' | 'reset' | undefined
    const accountType = (body?.accountType as RecoveryAccountType | undefined) ?? 'agency'
    const email = String(body?.email ?? '').trim().toLowerCase()
    const name = String(body?.name ?? '').trim()
    const phone = String(body?.phone ?? '').trim()
    const code = String(body?.code ?? '').trim()
    const newPassword = String(body?.newPassword ?? '')

    if (!['agency', 'admin', 'driver'].includes(accountType)) {
      return NextResponse.json({ error: '지원하지 않는 계정 유형입니다.' }, { status: 400 })
    }

    if (!email || !phone) {
      return NextResponse.json({ error: '이메일과 휴대폰 번호를 입력해주세요.' }, { status: 400 })
    }

    const account = await findAccountForPasswordReset({
      accountType,
      email,
      name: name || undefined,
      phone,
    })

    if (!account) {
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
        payload: { userId: account.userId, email: account.email },
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
        text: `[logiSSign] 비밀번호 재설정 인증번호: ${verificationCode} (5분 내 입력)`,
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
        mode: 'mark-verified',
      })

      if (!result.valid) {
        return NextResponse.json({ error: result.error }, { status: 400 })
      }

      return NextResponse.json({ verified: true })
    }

    if (action === 'reset') {
      const passwordError = validatePassword(newPassword)
      if (passwordError) {
        return NextResponse.json({ error: passwordError }, { status: 400 })
      }

      const verification = await consumeVerifiedCode({
        verificationKey: account.lookupKey,
        purpose,
      })

      if (!verification.valid) {
        return NextResponse.json({ error: verification.error }, { status: 400 })
      }

      const supabase = createAdminSupabaseClient()
      const { error } = await supabase.auth.admin.updateUserById(account.userId, {
        password: newPassword,
      })

      if (error) {
        return NextResponse.json(
          { error: '비밀번호 변경에 실패했습니다. 관리자에게 문의해주세요.' },
          { status: 500 }
        )
      }

      return NextResponse.json({ success: true })
    }

    return NextResponse.json({ error: '잘못된 요청입니다.' }, { status: 400 })
  } catch {
    return NextResponse.json(
      { error: '서버 오류가 발생했습니다. 잠시 후 다시 시도해주세요.' },
      { status: 500 }
    )
  }
}
