import { NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

export const dynamic = 'force-dynamic'
export const revalidate = 0

interface ServiceCheck {
  service: string
  status: 'ok' | 'degraded' | 'down'
  latencyMs: number
  detail?: string
}

/**
 * GET /api/health
 * 
 * 외부 모니터링(UptimeRobot 등) + 내부 상태 확인용
 * 인증 없이 접근 가능 (PUBLIC_ROUTES에 추가 필요)
 */
export async function GET() {
  const checks: ServiceCheck[] = []
  const start = Date.now()

  // 1. Supabase DB
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
  const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY

  if (supabaseUrl && supabaseKey && supabaseUrl !== 'your-project-url') {
    const supabase = createClient(supabaseUrl, supabaseKey)
    const dbStart = Date.now()
    try {
      const { error } = await supabase.from('agencies').select('id', { count: 'exact', head: true })
      checks.push({
        service: 'database',
        status: error ? 'degraded' : 'ok',
        latencyMs: Date.now() - dbStart,
        detail: error ? 'query failed' : undefined,
      })
    } catch {
      checks.push({
        service: 'database',
        status: 'down',
        latencyMs: Date.now() - dbStart,
        detail: 'connection failed',
      })
    }

    // 2. Supabase Storage
    const storageStart = Date.now()
    try {
      const { error } = await supabase.storage.listBuckets()
      checks.push({
        service: 'storage',
        status: error ? 'degraded' : 'ok',
        latencyMs: Date.now() - storageStart,
        detail: error ? 'storage error' : undefined,
      })
    } catch {
      checks.push({
        service: 'storage',
        status: 'down',
        latencyMs: Date.now() - storageStart,
        detail: 'connection failed',
      })
    }

    // 3. Supabase Auth
    const authStart = Date.now()
    try {
      await supabase.auth.getSession()
      checks.push({
        service: 'auth',
        status: 'ok',
        latencyMs: Date.now() - authStart,
      })
    } catch {
      checks.push({
        service: 'auth',
        status: 'down',
        latencyMs: Date.now() - authStart,
        detail: 'connection failed',
      })
    }
  } else {
    checks.push({ service: 'database', status: 'degraded', latencyMs: 0, detail: 'Supabase not configured' })
  }

  // 4. Environment check — ✅ 보안: 환경변수 이름 노출하지 않음
  const requiredEnvs = ['NEXT_PUBLIC_SUPABASE_URL', 'NEXT_PUBLIC_SUPABASE_ANON_KEY', 'SUPABASE_SERVICE_ROLE_KEY', 'CRON_SECRET']
  const missingCount = requiredEnvs.filter(k => !process.env[k]).length
  checks.push({
    service: 'environment',
    status: missingCount === 0 ? 'ok' : 'degraded',
    latencyMs: 0,
    detail: missingCount > 0 ? `${missingCount} required env vars missing` : undefined,
  })

  const overallStatus = checks.some(c => c.status === 'down')
    ? 'down'
    : checks.some(c => c.status === 'degraded')
      ? 'degraded'
      : 'ok'

  const statusCode = overallStatus === 'down' ? 503 : overallStatus === 'degraded' ? 200 : 200

  return NextResponse.json({
    status: overallStatus,
    timestamp: new Date().toISOString(),
    totalLatencyMs: Date.now() - start,
    version: process.env.VERCEL_GIT_COMMIT_SHA?.slice(0, 7) ?? 'dev',
    checks,
  }, { status: statusCode })
}
