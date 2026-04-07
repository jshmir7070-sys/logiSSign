import { NextRequest, NextResponse } from 'next/server'
import { authenticateAdmin } from '@/lib/api-auth'
import { getClientIp } from '@/lib/get-ip'
import { rateLimitAuth } from '@/lib/rate-limit'
import { createAdminSupabaseClient } from '@/lib/supabase'

const supabaseAdmin = createAdminSupabaseClient()

type ServiceStatus = 'normal' | 'warning' | 'error'

interface SentryIssueSummary {
  id: string
  title: string
  level: string
  count: number
  lastSeen: string
  permalink: string
  project: string
}

async function fetchRecentSentryIssues(): Promise<{
  configured: boolean
  status: ServiceStatus
  detail: string
  issues: SentryIssueSummary[]
}> {
  const token = process.env.SENTRY_AUTH_TOKEN
  const orgSlug = process.env.SENTRY_ORG_SLUG
  const projectEnv = process.env.SENTRY_PROJECT_SLUGS ?? process.env.SENTRY_PROJECT_SLUG

  if (!token || !orgSlug || !projectEnv) {
    return {
      configured: false,
      status: 'warning',
      detail: 'Sentry 프로젝트 환경 변수가 아직 설정되지 않았습니다.',
      issues: [],
    }
  }

  const projects = projectEnv
    .split(',')
    .map((value) => value.trim())
    .filter(Boolean)

  try {
    const responses = await Promise.all(
      projects.map(async (project) => {
        const response = await fetch(
          `https://sentry.io/api/0/projects/${orgSlug}/${project}/issues/?query=is:unresolved&sort=date&statsPeriod=14d&limit=5`,
          {
            headers: {
              Authorization: `Bearer ${token}`,
              'Content-Type': 'application/json',
            },
            cache: 'no-store',
          },
        )

        if (!response.ok) {
          throw new Error(`Sentry API ${response.status}`)
        }

        const data = (await response.json()) as Array<Record<string, unknown>>
        return data.map((issue) => ({
          id: String(issue.id ?? ''),
          title: String(issue.title ?? '제목 없음'),
          level: String(issue.level ?? 'error'),
          count: Number(issue.count ?? 0),
          lastSeen: String(issue.lastSeen ?? ''),
          permalink: String(issue.permalink ?? ''),
          project,
        }))
      }),
    )

    const issues = responses
      .flat()
      .sort((left, right) => new Date(right.lastSeen).getTime() - new Date(left.lastSeen).getTime())
      .slice(0, 8)

    return {
      configured: true,
      status: issues.length > 0 ? 'warning' : 'normal',
      detail:
        issues.length > 0
          ? `최근 미해결 이슈 ${issues.length}건이 있습니다.`
          : '최근 미해결 이슈가 없습니다.',
      issues,
    }
  } catch (error) {
    return {
      configured: true,
      status: 'warning',
      detail:
        error instanceof Error
          ? `Sentry 조회 실패: ${error.message}`
          : 'Sentry 이슈를 불러오지 못했습니다.',
      issues: [],
    }
  }
}

export async function GET(request: NextRequest) {
  const ip = getClientIp(request)
  const limited = await rateLimitAuth(ip, '/api/admin/server-status')
  if (limited) return limited

  const { auth, error } = await authenticateAdmin(request)
  if (error || !auth) {
    return error ?? NextResponse.json({ error: '인증이 필요합니다.' }, { status: 401 })
  }

  if (auth.role !== 'provider_admin') {
    return NextResponse.json(
      { error: '슈퍼 관리자만 서버 상태를 조회할 수 있습니다.' },
      { status: 403 },
    )
  }

  try {
    const dbStart = Date.now()
    const { count: agencyCount, error: dbError } = await supabaseAdmin
      .from('agencies')
      .select('id', { count: 'exact', head: true })
    const dbLatency = Date.now() - dbStart

    const storageStart = Date.now()
    const { data: buckets, error: storageError } = await supabaseAdmin.storage.listBuckets()
    const storageLatency = Date.now() - storageStart

    const authStart = Date.now()
    const { error: authError } = await supabaseAdmin.auth.admin.listUsers({ page: 1, perPage: 1 })
    const authLatency = Date.now() - authStart

    const [securityLogsRes, paymentOrdersRes, contractsRes, deliveriesRes, sentryState] =
      await Promise.all([
        supabaseAdmin
          .from('security_logs')
          .select('id, event_type, severity, resource, created_at')
          .in('severity', ['warning', 'critical'])
          .order('created_at', { ascending: false })
          .limit(20),
        supabaseAdmin
          .from('agency_payment_orders')
          .select('id, status, title, created_at, agencies(name)')
          .order('created_at', { ascending: false })
          .limit(20),
        supabaseAdmin.from('contracts').select('id, status', { count: 'exact' }),
        supabaseAdmin.from('document_deliveries').select('id, status', { count: 'exact' }),
        fetchRecentSentryIssues(),
      ])

    if (securityLogsRes.error) throw new Error(securityLogsRes.error.message)
    if (paymentOrdersRes.error) throw new Error(paymentOrdersRes.error.message)
    if (contractsRes.error) throw new Error(contractsRes.error.message)
    if (deliveriesRes.error) throw new Error(deliveriesRes.error.message)

    const paymentOrders = (paymentOrdersRes.data ?? []) as Array<Record<string, unknown>>
    const failedPayments = paymentOrders.filter((order) => order.status === 'failed')
    const pendingVirtualAccounts = paymentOrders.filter((order) => order.status === 'pending')

    return NextResponse.json({
      services: [
        {
          name: 'Database',
          status: dbError ? 'error' : dbLatency > 2000 ? 'warning' : 'normal',
          detail: dbError
            ? dbError.message
            : `응답 ${dbLatency}ms · 대리점 ${agencyCount ?? 0}개 확인`,
        },
        {
          name: 'Storage',
          status: storageError ? 'error' : storageLatency > 3000 ? 'warning' : 'normal',
          detail: storageError
            ? storageError.message
            : `응답 ${storageLatency}ms · 버킷 ${buckets?.length ?? 0}개 확인`,
        },
        {
          name: 'Auth',
          status: authError ? 'error' : authLatency > 3000 ? 'warning' : 'normal',
          detail: authError
            ? authError.message
            : `응답 ${authLatency}ms · 관리자 인증 API 정상`,
        },
        {
          name: 'Sentry',
          status: sentryState.status,
          detail: sentryState.detail,
        },
      ],
      dbStats: {
        tables: 4,
        totalRows:
          (agencyCount ?? 0) +
          (contractsRes.count ?? 0) +
          (deliveriesRes.count ?? 0) +
          failedPayments.length +
          pendingVirtualAccounts.length,
      },
      incidents: securityLogsRes.data ?? [],
      opsSummary: {
        failedPayments: failedPayments.length,
        pendingVirtualAccounts: pendingVirtualAccounts.length,
        pendingContracts: ((contractsRes.data ?? []) as Array<Record<string, unknown>>).filter((row) =>
          ['sent', 'viewed'].includes(String(row.status ?? '')),
        ).length,
        pendingDocuments: ((deliveriesRes.data ?? []) as Array<Record<string, unknown>>).filter((row) =>
          ['sent', 'delivered', 'viewed'].includes(String(row.status ?? '')),
        ).length,
      },
      recentPaymentFailures: failedPayments.map((order) => ({
        id: order.id,
        title: order.title,
        created_at: order.created_at,
        agency_name: Array.isArray(order.agencies)
          ? order.agencies[0]?.name ?? '-'
          : (order.agencies as { name?: string } | null)?.name ?? '-',
      })),
      recentSentryIssues: sentryState.issues,
      sentryConfigured: sentryState.configured,
    })
  } catch (fetchError) {
    return NextResponse.json(
      {
        error:
          fetchError instanceof Error
            ? fetchError.message
            : '서버 상태를 불러오지 못했습니다.',
      },
      { status: 500 },
    )
  }
}
