import { NextRequest, NextResponse } from 'next/server'
import { sendInviteCodeSms } from '@/services/sms.service'
import { createClient } from '@supabase/supabase-js'
import { authenticateAdmin } from '@/lib/api-auth'
import { smsInviteSchema, validateInput } from '@/lib/api-schemas'
import { rateLimitAuth } from '@/lib/rate-limit'
import { getClientIp } from '@/lib/get-ip'

const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!,  // ⚠️ service_role 필수: 초대코드 조회 시 RLS 우회 필요 (agency_id 기반 정책, 관리자는 auth.jwt에 agency_id 있음)
)

/**
 * POST /api/sms/invite
 * 기사 초대코드 + 앱 설치 링크 SMS 발송
 * ✅ 인증 필수: agency_admin 또는 provider_admin만 호출 가능
 *
 * Body:
 *  - driverPhone, driverName (필수)
 *  - inviteCode, agencyName (직접 전달) OR agencyId (DB에서 자동 조회)
 */
export async function POST(request: NextRequest) {
  const ip = getClientIp(request)
  const limited = rateLimitAuth(ip, '/api/sms/invite')
  if (limited) return limited

  // 인증 확인
  let auth;
  try {
    const result = await authenticateAdmin(request)
    if (result.error || !result.auth) return result.error!
    auth = result.auth
    console.log('[SMS Invite] auth:', auth.userId.slice(0,8), 'agencyId:', auth.agencyId)
  } catch (err) {
    console.error('[SMS Invite] auth 에러:', err)
    return NextResponse.json({ error: '인증 처리 중 오류' }, { status: 500 })
  }

  try {
    const rawBody = await request.json()
    const { data: body, error: validationError } = validateInput(smsInviteSchema, rawBody)
    if (validationError || !body) {
      return NextResponse.json(
        { error: validationError ?? '잘못된 요청입니다' },
        { status: 400 }
      )
    }

    const { driverPhone, driverName } = body
    let inviteCode = body.inviteCode
    let agencyName = body.agencyName
    // ✅ 보안: 클라이언트가 보낸 agencyId 대신 인증된 사용자의 agencyId 사용
    const agencyId = auth.agencyId

    // agencyId로 초대코드/대리점명 자동 조회
    if (!inviteCode || !agencyName) {
      const { data: agency } = await supabaseAdmin
        .from('agencies')
        .select('name, invite_code')
        .eq('id', agencyId)
        .single()

      if (!agency?.invite_code) {
        console.error('[SMS Invite] invite_code 없음 | agencyId:', agencyId, '| agency:', JSON.stringify(agency))
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
    console.error('[SMS Invite] 예외 발생:', err instanceof Error ? err.message : err)
    return NextResponse.json(
      { error: '초대 SMS 발송 처리 중 오류가 발생했습니다' },
      { status: 500 }
    )
  }
}
