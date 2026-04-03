import { NextRequest, NextResponse } from 'next/server'
import { sendSms } from '@/services/sms.service'
import { authenticateAdmin } from '@/lib/api-auth'
import { smsSendSchema, validateInput } from '@/lib/api-schemas'

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
    const rawBody = await request.json()
    const { data: body, error: validationError } = validateInput(smsSendSchema, rawBody)
    if (validationError || !body) {
      return NextResponse.json(
        { error: validationError ?? '잘못된 요청입니다' },
        { status: 400 }
      )
    }

    const { to, text, from } = body

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
