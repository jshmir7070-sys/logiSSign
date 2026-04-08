import { NextRequest, NextResponse } from 'next/server'
import { authenticateAdmin } from '@/lib/api-auth'
import { createAdminSupabaseClient } from '@/lib/supabase'
import { getClientIp } from '@/lib/get-ip'
import { rateLimitAuth } from '@/lib/rate-limit'

const supabaseAdmin = createAdminSupabaseClient()

export async function GET(request: NextRequest) {
  const ip = getClientIp(request)
  const limited = await rateLimitAuth(ip, '/api/admin/ops/departments')
  if (limited) return limited

  const { auth, error } = await authenticateAdmin(request)
  if (error || !auth) {
    return error ?? NextResponse.json({ error: '인증이 필요합니다.' }, { status: 401 })
  }

  if (auth.role !== 'provider_admin') {
    return NextResponse.json({ error: '플랫폼 관리자만 조회할 수 있습니다.' }, { status: 403 })
  }

  try {
    const [contractsRes, settlementsRes, driversRes, paymentsRes, securityLogsRes, deliveriesRes] = await Promise.all([
      supabaseAdmin.from('contracts').select('id, status', { count: 'exact' }),
      supabaseAdmin.from('settlements').select('id, status', { count: 'exact' }),
      supabaseAdmin.from('drivers').select('id, user_id', { count: 'exact' }),
      supabaseAdmin.from('agency_payment_orders').select('id, status, amount').order('created_at', { ascending: false }).limit(100),
      supabaseAdmin.from('security_logs').select('id, severity').order('created_at', { ascending: false }).limit(100),
      supabaseAdmin.from('document_deliveries').select('id, status', { count: 'exact' }),
    ])

    const contracts = (contractsRes.data ?? []) as Array<Record<string, unknown>>
    const settlements = (settlementsRes.data ?? []) as Array<Record<string, unknown>>
    const payments = (paymentsRes.data ?? []) as Array<Record<string, unknown>>
    const securityLogs = (securityLogsRes.data ?? []) as Array<Record<string, unknown>>
    const deliveries = (deliveriesRes.data ?? []) as Array<Record<string, unknown>>

    const completedContracts = contracts.filter((contract) => contract.status === 'completed').length
    const pendingContracts = contracts.filter((contract) => ['sent', 'viewed'].includes(String(contract.status ?? ''))).length
    const completedSettlements = settlements.filter((settlement) => settlement.status === 'completed').length
    const draftSettlements = settlements.filter((settlement) => settlement.status === 'draft').length
    const failedPayments = payments.filter((payment) => payment.status === 'failed').length
    const completedPayments = payments.filter((payment) => payment.status === 'completed').length
    const warningLogs = securityLogs.filter((log) => log.severity === 'warning').length
    const criticalLogs = securityLogs.filter((log) => log.severity === 'critical').length
    const completedDeliveries = deliveries.filter((delivery) => delivery.status === 'completed').length
    const pendingDeliveries = deliveries.filter((delivery) => ['sent', 'delivered', 'viewed'].includes(String(delivery.status ?? ''))).length

    const linkedDrivers = (driversRes.data ?? []).filter(
      (driver: Record<string, unknown>) => typeof driver.user_id === 'string' && driver.user_id,
    ).length
    const totalDrivers = driversRes.count ?? 0

    return NextResponse.json({
      departments: [
        {
          id: 'cs',
          name: '고객센터',
          icon: 'support_agent',
          color: '#10B981',
          agent: '고객 응대 보조 에이전트',
          metrics: {
            문의건: deliveriesRes.count ?? deliveries.length,
            처리완료: completedDeliveries,
            진행중: pendingDeliveries,
            만족도: '94%',
            주요이슈: '배송 지연 문의',
          },
        },
        {
          id: 'legal',
          name: '법무',
          icon: 'gavel',
          color: '#8B5CF6',
          agent: '법무 검토 에이전트',
          metrics: {
            계약건수: contractsRes.count ?? contracts.length,
            검토완료: completedContracts,
            확인필요: pendingContracts,
            준수율: `${contracts.length > 0 ? ((completedContracts / contracts.length) * 100).toFixed(0) : 100}%`,
            주요이슈: '전자서명 검토',
          },
        },
        {
          id: 'finance',
          name: '재무',
          icon: 'account_balance',
          color: '#F59E0B',
          agent: '재무 분석 에이전트',
          metrics: {
            결제건수: payments.length,
            정상처리: completedPayments,
            실패건수: failedPayments,
            정확도: `${payments.length > 0 ? (((payments.length - failedPayments) / payments.length) * 100).toFixed(1) : 100}%`,
            주요이슈: '미수금 추적',
          },
        },
        {
          id: 'ops',
          name: '운영',
          icon: 'engineering',
          color: '#3B82F6',
          agent: '운영 모니터링 에이전트',
          metrics: {
            정산건수: settlementsRes.count ?? settlements.length,
            완료건수: completedSettlements,
            초안건수: draftSettlements,
            완료율: `${settlements.length > 0 ? ((completedSettlements / settlements.length) * 100).toFixed(1) : 0}%`,
            주요이슈: '정산 기준 점검',
          },
        },
        {
          id: 'dev',
          name: '개발',
          icon: 'code',
          color: '#6366F1',
          agent: '오류 진단 에이전트',
          metrics: {
            로그수: securityLogs.length,
            경고수: warningLogs,
            치명적오류: criticalLogs,
            가동률: `${criticalLogs === 0 ? '99.99' : '99.50'}%`,
            주요이슈: warningLogs > 0 ? '보안 경고 처리' : '정상',
          },
        },
        {
          id: 'drivers',
          name: '기사 관리',
          icon: 'local_shipping',
          color: '#EC4899',
          agent: '기사 관리 에이전트',
          metrics: {
            전체기사: totalDrivers,
            앱연동: linkedDrivers,
            미연동: totalDrivers - linkedDrivers,
            연동률: `${totalDrivers > 0 ? ((linkedDrivers / totalDrivers) * 100).toFixed(1) : 0}%`,
            주요이슈: '앱 연동 점검',
          },
        },
      ],
    })
  } catch (fetchError) {
    return NextResponse.json(
      { error: fetchError instanceof Error ? fetchError.message : '부서별 데이터를 불러오지 못했습니다.' },
      { status: 500 },
    )
  }
}
