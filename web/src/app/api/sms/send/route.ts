import { NextRequest, NextResponse } from 'next/server'
import { sendSms } from '@/services/sms.service'
import { authenticateAdmin } from '@/lib/api-auth'

/**
 * POST /api/sms/send
 * 서버사이드 SMS 발송 (API 키를 클라이언트에 노출하지 않음)
 * ✅ 인증 필수: agency_admin 또는 provider_admin만 호출 가능
 */
export async function POST(request: NextRequest) {
  // 인증 확인
  const { auth, error: authError } = await authenticateAdmin(request)
  if (authError || !auth) return authError!

  try {
    const { to, text, from } = await request.json()

    if (!to || !text) {
      return NextResponse.json(
        { error: '수신번호(to)와 메시지(text)는 필수입니다' },
        { status: 400 }
      )
    }

    const result = await sendSms({ to, text, from })

    if (!result.sent) {
      return NextResponse.json(
        { error: result.error ?? 'SMS 발송 실패' },
        { status: 500 }
      )
    }

    return NextResponse.json({
      sent: true,
      messageId: result.messageId,
    })
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : 'Internal Server Error' },
      { status: 500 }
    )
  }
}
