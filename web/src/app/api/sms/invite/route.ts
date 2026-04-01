import { NextRequest, NextResponse } from 'next/server'
import { sendInviteCodeSms } from '@/services/sms.service'
import { createClient } from '@supabase/supabase-js'

const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
)

/**
 * POST /api/sms/invite
 * 기사 초대코드 + 앱 설치 링크 SMS 발송
 *
 * Body:
 *  - driverPhone, driverName (필수)
 *  - inviteCode, agencyName (직접 전달) OR agencyId (DB에서 자동 조회)
 */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const { driverPhone, driverName } = body
    let { inviteCode, agencyName } = body
    const { agencyId } = body

    if (!driverPhone || !driverName) {
      return NextResponse.json(
        { error: '필수 파라미터 누락 (driverPhone, driverName)' },
        { status: 400 }
      )
    }

    // agencyId로 초대코드/대리점명 자동 조회
    if (agencyId && (!inviteCode || !agencyName)) {
      const { data: agency } = await supabaseAdmin
        .from('agencies')
        .select('name, invite_code')
        .eq('id', agencyId)
        .single()

      if (!agency?.invite_code) {
        return NextResponse.json(
          { error: '대리점 초대코드가 설정되지 않았습니다. 설정 > 대리점 정보에서 초대코드를 확인하세요.' },
          { status: 400 }
        )
      }

      inviteCode = agency.invite_code
      agencyName = agency.name
    }

    if (!inviteCode || !agencyName) {
      return NextResponse.json(
        { error: '초대코드 또는 대리점명이 없습니다 (inviteCode, agencyName 또는 agencyId 필요)' },
        { status: 400 }
      )
    }

    const result = await sendInviteCodeSms(driverPhone, driverName, inviteCode, agencyName)

    if (!result.sent) {
      return NextResponse.json({ error: result.error }, { status: 500 })
    }

    return NextResponse.json({ sent: true, messageId: result.messageId })
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : 'SMS 발송 실패' },
      { status: 500 }
    )
  }
}
