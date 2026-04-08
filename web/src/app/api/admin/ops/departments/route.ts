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
    const [
      contractsRes,
      settlementsRes,
      driversRes,
      paymentsRes,
      securityLogsRes,
      deliveriesRes,
      taxInvoicesRes,
      taxSendLogsRes,
      checklistRes,
    ] = await Promise.all([
      supabaseAdmin.from('contracts').select('id, status', { count: 'exact' }),
      supabaseAdmin.from('settlements').select('id, status', { count: 'exact' }),
      supabaseAdmin.from('drivers').select('id, user_id', { count: 'exact' }),
      supabaseAdmin.from('agency_payment_orders').select('id, status, amount').order('created_at', { ascending: false }).limit(100),
      supabaseAdmin.from('security_logs').select('id, severity').order('created_at', { ascending: false }).limit(100),
      supabaseAdmin.from('document_deliveries').select('id, status', { count: 'exact' }),
      supabaseAdmin.from('tax_invoices').select('id, status, invoice_type', { count: 'exact' }),
      supabaseAdmin.from('tax_invoice_send_logs').select('id, success, channel').order('created_at', { ascending: false }).limit(200),
      // `admin_checklist_states` is added by a later migration and may lag behind generated DB types.
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      (supabaseAdmin as any).from('admin_checklist_states').select('scope_type, value').in('scope_type', ['team', 'user']),
    ])

    const contracts = (contractsRes.data ?? []) as Array<Record<string, unknown>>
    const settlements = (settlementsRes.data ?? []) as Array<Record<string, unknown>>
    const payments = (paymentsRes.data ?? []) as Array<Record<string, unknown>>
    const securityLogs = (securityLogsRes.data ?? []) as Array<Record<string, unknown>>
    const deliveries = (deliveriesRes.data ?? []) as Array<Record<string, unknown>>
    const taxInvoices = (taxInvoicesRes.data ?? []) as Array<Record<string, unknown>>
    const taxSendLogs = (taxSendLogsRes.data ?? []) as Array<Record<string, unknown>>
    const checklistRows = (checklistRes.data ?? []) as Array<Record<string, unknown>>

    const completedContracts = contracts.filter((contract) => contract.status === 'completed').length
    const pendingContracts = contracts.filter((contract) => ['sent', 'viewed'].includes(String(contract.status ?? ''))).length
    const completedSettlements = settlements.filter((settlement) => settlement.status === 'completed').length
    const draftSettlements = settlements.filter((settlement) => settlement.status === 'draft').length
    const failedPayments = payments.filter((payment) => payment.status === 'failed').length
    const completedPayments = payments.filter((payment) => payment.status === 'completed').length
    const warningLogs = securityLogs.filter((log) => log.severity === 'warning').length
    const criticalLogs = securityLogs.filter((log) => log.severity === 'critical').length
    const completedDeliveries = deliveries.filter((delivery) => delivery.status === 'completed').length
    const pendingDeliveries = deliveries.filter((delivery) =>
      ['sent', 'delivered', 'viewed'].includes(String(delivery.status ?? '')),
    ).length

    const linkedDrivers = ((driversRes.data ?? []) as Array<Record<string, unknown>>).filter(
      (driver) => typeof driver.user_id === 'string' && driver.user_id,
    ).length
    const totalDrivers = driversRes.count ?? 0

    const issuedTaxInvoices = taxInvoices.filter((invoice) => invoice.status === 'issued').length
    const pendingTaxInvoices = taxInvoices.filter((invoice) => invoice.status === 'pending').length
    const manualReverseInvoices = taxInvoices.filter((invoice) => invoice.invoice_type === 'manual_reverse').length
    const successfulTaxSends = taxSendLogs.filter((log) => log.success === true).length
    const pushTaxSends = taxSendLogs.filter((log) => log.success === true && log.channel === 'push').length
    const smsTaxSends = taxSendLogs.filter((log) => log.success === true && log.channel === 'sms').length

    const checklistCount = checklistRows.reduce((count, row) => {
      const value = row.value
      if (!value || typeof value !== 'object' || Array.isArray(value)) return count
      return count + Object.values(value as Record<string, unknown>).filter(Boolean).length
    }, 0)

    return NextResponse.json({
      departments: [
        {
          id: 'cs',
          name: '고객센터',
          icon: 'support_agent',
          color: '#10B981',
          agent: '고객사 문의와 문서 전달 상태를 모니터링합니다.',
          metrics: {
            '문의 문서': deliveriesRes.count ?? deliveries.length,
            '완료': completedDeliveries,
            '진행 중': pendingDeliveries,
            '주요 이슈': pendingDeliveries > 0 ? '문서 수신 확인 필요' : '특이사항 없음',
          },
        },
        {
          id: 'legal',
          name: '법무',
          icon: 'gavel',
          color: '#8B5CF6',
          agent: '계약 발송과 서명 완료 흐름을 관리합니다.',
          metrics: {
            '계약 건수': contractsRes.count ?? contracts.length,
            '서명 완료': completedContracts,
            '서명 대기': pendingContracts,
            '주요 이슈': pendingContracts > 0 ? '서명 대기 계약 존재' : '계약 흐름 안정',
          },
        },
        {
          id: 'finance',
          name: '재무',
          icon: 'account_balance',
          color: '#F59E0B',
          agent: '결제와 수기 역발행 세금계산서 흐름을 확인합니다.',
          metrics: {
            '결제 완료': completedPayments,
            '결제 실패': failedPayments,
            '발행 완료': issuedTaxInvoices,
            '전송 성공': successfulTaxSends,
            '푸시 전송': pushTaxSends,
            '문자 전송': smsTaxSends,
            '주요 이슈': failedPayments > 0 || pendingTaxInvoices > 0 ? '결제 또는 발행 대기 확인 필요' : '정상',
          },
        },
        {
          id: 'ops',
          name: '운영',
          icon: 'engineering',
          color: '#3B82F6',
          agent: '정산, 세금계산서, 운영 체크리스트 진척도를 봅니다.',
          metrics: {
            '정산 완료': completedSettlements,
            '정산 초안': draftSettlements,
            '수기 역발행': manualReverseInvoices,
            '체크 완료': checklistCount,
            '주요 이슈': draftSettlements > 0 ? '정산 초안 점검 필요' : '운영 흐름 안정',
          },
        },
        {
          id: 'dev',
          name: '개발',
          icon: 'code',
          color: '#6366F1',
          agent: '보안 경고와 치명 로그를 우선 확인합니다.',
          metrics: {
            '경고 로그': warningLogs,
            '치명 로그': criticalLogs,
            '최근 실패 결제': failedPayments,
            '최근 전송 실패': taxSendLogs.filter((log) => log.success === false).length,
            '주요 이슈': criticalLogs > 0 ? '치명 로그 점검 필요' : '정상',
          },
        },
        {
          id: 'drivers',
          name: '기사 관리',
          icon: 'local_shipping',
          color: '#EC4899',
          agent: '소속 기사 계정 연결과 계약/정산 연결도를 봅니다.',
          metrics: {
            '전체 기사': totalDrivers,
            '연결 완료': linkedDrivers,
            '미연결': totalDrivers - linkedDrivers,
            '연동률': `${totalDrivers > 0 ? ((linkedDrivers / totalDrivers) * 100).toFixed(1) : '0.0'}%`,
            '주요 이슈': totalDrivers - linkedDrivers > 0 ? '계정 미연결 기사 존재' : '정상',
          },
        },
      ],
    })
  } catch (fetchError) {
    return NextResponse.json(
      { error: fetchError instanceof Error ? fetchError.message : '부서별 운영 데이터를 불러오지 못했습니다.' },
      { status: 500 },
    )
  }
}
