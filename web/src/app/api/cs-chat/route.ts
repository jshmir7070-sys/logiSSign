import { NextRequest, NextResponse } from 'next/server'
import { authenticateRequest } from '@/lib/api-auth'
import {
  type CsCategory,
  LLM_FALLBACK_CATEGORIES,
  detectCategory,
  fetchLlmFallback,
} from '@/lib/cs-chat'
import { createAdminSupabaseClient } from '@/lib/supabase'
import { getClientIp } from '@/lib/get-ip'
import { rateLimitAuth } from '@/lib/rate-limit'

const supabaseAdmin = createAdminSupabaseClient()

interface CsChatRequest {
  message: string
  category: CsCategory
}

const ENTERPRISE_DRIVER_THRESHOLD = 150

/**
 * 카테고리별 자동 응답 + 실시간 데이터 조회
 * Pro 이상(150명+)은 전담 에이전트 안내
 */

const CATEGORY_RESPONSES: Record<CsCategory, string[]> = {
  payment: [
    '결제 관련 문의를 확인하겠습니다.\n\n자주 묻는 결제 문의:\n• 결제 실패 시 → 설정 > 결제 관리에서 카드 정보를 확인해주세요\n• 가상계좌 입금 → 발급 후 24시간 내 입금이 필요합니다\n• 환불 요청 → 미사용 기간에 대해 일할 계산 환불됩니다\n• 플랜 변경 → 즉시 적용되며 차액은 일할 정산됩니다',
    '결제 수단 변경은 설정 > 결제 관리에서 가능합니다.\n카드 결제 실패가 반복되면 카드사에 온라인 결제 한도를 확인해주세요.\n\n해결되지 않으면 상세 내용을 남겨주시면 담당자가 확인 후 연락드리겠습니다.',
  ],
  contract: [
    '계약서 관련 문의를 도와드리겠습니다.\n\n• 계약서 발송 실패 → 기사 휴대폰 번호가 정확한지 확인해주세요\n• 서명 독촉 → 계약서 목록에서 "재발송" 버튼을 눌러주세요\n• 만료된 계약 → 계약서 관리에서 재발송이 가능합니다\n• 템플릿 수정 → 계약서 관리 > 템플릿 만들기에서 편집하세요',
    '전자서명 관련 법적 효력 문의:\n로지사인의 전자서명은 전자문서 및 전자거래 기본법에 따라 법적 효력이 있습니다.\n감사추적(Audit Trail)이 자동 기록되어 서명 시점과 서명자를 증빙할 수 있습니다.',
  ],
  settlement: [
    '정산 관련 문의를 확인합니다.\n\n• 엑셀 업로드 오류 → 운송사 원본 엑셀 형식을 그대로 업로드해주세요\n• 단가 불일치 → 거래처/정산 기준 관리에서 단가 설정을 확인해주세요\n• 정산서 재생성 → 생성 이력에서 해당 건을 삭제 후 다시 생성하세요\n• 세금계산서 발행 → 정산 완료 후 세금계산서 탭에서 발행 가능합니다',
    '정산 업로드 팁:\n1. 운송사에서 받은 엑셀을 수정 없이 그대로 업로드\n2. 사번 매칭이 안 되면 기사 관리에서 사번을 확인/수정\n3. 거래처별 단가가 다르면 거래처 관리에서 각각 설정\n\n복잡한 정산 구조는 "정산 직접 편집" 기능을 활용해보세요.',
  ],
  driver: [
    '기사 관리 관련 문의입니다.\n\n• 기사 등록 → 기사 관리 > 신규 등록에서 이름/연락처/사번 입력\n• 앱 연동 → 기사에게 초대 SMS 발송 후 앱 설치/로그인 안내\n• 기사 삭제 → 계약 해지 후 기사 상세에서 비활성화 처리\n• 기사 수 초과 → 현재 플랜의 기사 한도를 확인해주세요',
    '기사 앱 연동이 안 될 때:\n1. 기사 휴대폰 번호가 정확한지 확인\n2. 초대 SMS가 발송되었는지 기사 상세에서 확인\n3. 기사가 앱 설치 후 해당 번호로 로그인했는지 확인\n4. 여전히 안 되면 기사 정보를 알려주시면 직접 확인해드립니다.',
  ],
  plan: [
    '플랜/요금 관련 문의입니다.\n\n현재 플랜별 기사 한도:\n• Free: 5명 (포인트 차감형)\n• Basic: 30명 (₩49,900/월)\n• Standard: 80명 (₩99,000/월)\n• Pro: 150명 (₩199,000/월)\n• Enterprise: 무제한 (별도 문의)\n\n연간 결제 시 최대 40% 할인됩니다.\n플랜 변경은 설정 > 결제 관리에서 가능합니다.',
    '플랜 업그레이드 시 참고사항:\n• 즉시 적용되며 기존 결제 금액은 일할 정산\n• 다운그레이드 시 기사 수가 한도를 초과하면 초과분 비용 발생\n• Enterprise 플랜은 전담 매니저 배정 + 맞춤 기능 제공\n\n150명 이상 기사를 운영하시면 Enterprise 플랜을 추천드립니다.',
  ],
  account: [
    '계정/설정 관련 문의입니다.\n\n• 비밀번호 변경 → 로그인 화면 > 비밀번호 재설정\n• 관리자 추가 → 설정 > 관리자 계정에서 추가 (플랜별 한도 있음)\n• 업체 정보 수정 → 설정 > 기본 정보에서 변경\n• 도장/서명 등록 → 설정 > 도장/서명에서 등록\n• 회원 탈퇴 → 고객센터로 문의해주세요',
  ],
  bug: [
    '오류/버그 신고를 접수합니다.\n\n빠른 해결을 위해 다음 정보를 함께 알려주세요:\n1. 어떤 화면에서 오류가 발생했는지\n2. 어떤 동작을 했을 때 발생하는지\n3. 오류 메시지가 있다면 정확한 내용\n4. 사용 중인 브라우저 (Chrome, Safari 등)\n\n접수된 오류는 개발팀이 우선 확인 후 처리 결과를 알려드리겠습니다.',
  ],
  feedback: [
    '소중한 의견 감사합니다!\n\n건의사항/피드백은 제품 개선에 직접 반영됩니다.\n구체적인 내용을 남겨주시면 담당팀이 검토 후 반영 여부를 안내드리겠습니다.\n\n자주 요청되는 기능은 우선순위를 높여 개발하고 있습니다.',
  ],
  other: [
    '문의 내용을 확인했습니다.\n\n카테고리를 선택하시면 더 정확한 답변을 드릴 수 있습니다:\n• 결제/요금 → 결제 관련\n• 계약서 → 계약 관련\n• 정산 → 정산 관련\n• 기사 관리 → 기사 관련\n\n해결되지 않는 문의는 상세 내용을 남겨주시면 담당자가 직접 확인 후 연락드리겠습니다.',
  ],
}


export async function POST(request: NextRequest) {
  const ip = getClientIp(request)
  const limited = await rateLimitAuth(ip, '/api/cs-chat')
  if (limited) return limited

  const { auth, error } = await authenticateRequest(request)
  if (error || !auth) {
    return error ?? NextResponse.json({ error: '인증이 필요합니다.' }, { status: 401 })
  }

  try {
    const body = (await request.json()) as CsChatRequest
    const { message, category: requestedCategory } = body

    if (!message?.trim()) {
      return NextResponse.json({ error: '메시지를 입력해주세요.' }, { status: 400 })
    }

    // 고객사 정보 조회
    const { data: agencyData } = await supabaseAdmin
      .from('agencies')
      .select('id, name, plan, status')
      .eq('id', auth.agencyId)
      .single()

    const plan = ((agencyData?.plan as string) || 'free').toLowerCase()
    const agencyName = (agencyData?.name as string) || '고객사'

    // 기사 수 조회
    const { count: driverCount } = await supabaseAdmin
      .from('drivers')
      .select('id', { count: 'exact', head: true })
      .eq('agency_id', auth.agencyId)

    const totalDrivers = driverCount ?? 0
    const isEnterprise = plan === 'enterprise' || totalDrivers > ENTERPRISE_DRIVER_THRESHOLD

    // 카테고리 결정 (명시 > 자동감지)
    const category = requestedCategory !== 'other' ? requestedCategory : detectCategory(message)

    // 응답 생성: 정형 카테고리는 캔드 응답, other/bug/feedback은 LLM 폴백 시도 후 실패 시 캔드 응답
    const cannedPool = CATEGORY_RESPONSES[category] ?? CATEGORY_RESPONSES.other
    const cannedResponse = cannedPool[Math.floor(Math.random() * cannedPool.length)]

    let response = cannedResponse
    let usedLlm = false
    if (LLM_FALLBACK_CATEGORIES.has(category)) {
      const llmResponse = await fetchLlmFallback({
        message,
        category,
        plan,
        driverCount: totalDrivers,
        agencyName,
      })
      if (llmResponse) {
        response = llmResponse
        usedLlm = true
      }
    }

    // 전담 에이전트 안내 (Enterprise / 150명 초과)
    if (isEnterprise) {
      response = `[전담 에이전트]\n${agencyName}님 전용 CS 에이전트가 응답합니다.\n기사 ${totalDrivers}명 운영 중 · ${plan.toUpperCase()} 플랜\n\n${response}\n\n━━━━━━━━━━━━━━━━\n전담 에이전트가 우선 처리 중입니다. 추가 문의를 이어서 입력해주세요.`
    }

    // 문의 기록 저장 (security_logs 테이블 활용)
    void supabaseAdmin.from('security_logs').insert({
      event_type: `cs_chat:${category}`,
      severity: category === 'bug' ? 'warning' : 'info',
      resource: `agency:${auth.agencyId}`,
      details: JSON.stringify({
        message: message.slice(0, 500),
        category,
        plan,
        driverCount: totalDrivers,
        isDedicated: isEnterprise,
        usedLlm,
      }),
    })

    return NextResponse.json({
      response,
      category,
      meta: {
        plan,
        driverCount: totalDrivers,
        isDedicatedSupport: isEnterprise,
        agencyName,
      },
    })
  } catch (fetchError) {
    return NextResponse.json(
      { error: fetchError instanceof Error ? fetchError.message : 'CS 챗봇 응답에 실패했습니다.' },
      { status: 500 },
    )
  }
}
