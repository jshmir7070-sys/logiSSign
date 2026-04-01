import { NextRequest, NextResponse } from 'next/server'
import { createServerClient, type CookieOptions } from '@supabase/ssr'
import { timingSafeEqual } from 'crypto'

interface AuthResult {
  userId: string
  agencyId: string
  role: string
}

/**
 * API 라우트용 인증 헬퍼
 * 쿠키 기반 Supabase 세션에서 사용자 정보를 추출하고,
 * agency_id가 없으면 401을 반환합니다.
 */
export async function authenticateRequest(
  request: NextRequest
): Promise<{ auth: AuthResult | null; error: NextResponse | null }> {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
  const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY

  if (!supabaseUrl || !supabaseKey) {
    return {
      auth: null,
      error: NextResponse.json(
        { error: 'Supabase 설정 누락' },
        { status: 500 }
      ),
    }
  }

  const supabase = createServerClient(supabaseUrl, supabaseKey, {
    cookies: {
      get(name: string) {
        return request.cookies.get(name)?.value
      },
      set(_name: string, _value: string, _options: CookieOptions) {
        // API 라우트에서는 set 불필요
      },
      remove(_name: string, _options: CookieOptions) {
        // API 라우트에서는 remove 불필요
      },
    },
  })

  const {
    data: { user },
    error,
  } = await supabase.auth.getUser()

  if (error || !user) {
    return {
      auth: null,
      error: NextResponse.json(
        { error: '인증이 필요합니다' },
        { status: 401 }
      ),
    }
  }

  // ⚠️ 보안: app_metadata만 사용 (user_metadata는 클라이언트에서 조작 가능)
  const role = (user.app_metadata?.role as string) ?? ''
  const agencyId = (user.app_metadata?.agency_id as string) ?? ''

  if (!role || !agencyId) {
    return {
      auth: null,
      error: NextResponse.json(
        { error: '계정 메타데이터가 설정되지 않았습니다. 관리자에게 문의하세요.' },
        { status: 403 }
      ),
    }
  }

  return {
    auth: { userId: user.id, agencyId, role },
    error: null,
  }
}

/**
 * 관리자 전용 인증 — provider_admin 또는 agency_admin만 허용
 */
export async function authenticateAdmin(
  request: NextRequest
): Promise<{ auth: AuthResult | null; error: NextResponse | null }> {
  const { auth, error } = await authenticateRequest(request)
  if (error || !auth) return { auth, error }

  const allowedRoles = ['provider_admin', 'agency_admin']
  if (!allowedRoles.includes(auth.role)) {
    return {
      auth: null,
      error: NextResponse.json(
        { error: '관리자 권한이 필요합니다' },
        { status: 403 }
      ),
    }
  }

  return { auth, error: null }
}

/**
 * CRON 엔드포인트용 인증 (timing-safe 비교)
 *
 * CRON_SECRET 미설정 시:
 *  - production: 항상 500 에러 (절대 통과 불가)
 *  - development: 경고 로그 후 통과 (로컬 개발 편의)
 */
export function authenticateCron(request: NextRequest): NextResponse | null {
  const cronSecret = process.env.CRON_SECRET

  // 프로덕션에서 CRON_SECRET 미설정 시 차단
  if (!cronSecret) {
    if (process.env.NODE_ENV === 'production') {
      console.error('[CRON AUTH] CRON_SECRET 환경변수가 설정되지 않았습니다')
      return NextResponse.json(
        { error: 'Server misconfiguration' },
        { status: 500 }
      )
    }
    console.warn('[CRON AUTH] CRON_SECRET 미설정 — 개발 환경이므로 통과')
    return null
  }

  const authHeader = request.headers.get('authorization') ?? ''
  const expected = `Bearer ${cronSecret}`

  // timing-safe 비교: 동일 길이 Buffer로 변환하여 비교
  // 길이가 달라도 조기 리턴하지 않음 (타이밍 사이드채널 방지)
  const aBuf = Buffer.from(authHeader.padEnd(256, '\0'))
  const bBuf = Buffer.from(expected.padEnd(256, '\0'))

  const lengthMatch = authHeader.length === expected.length
  let contentMatch = true
  try {
    contentMatch = timingSafeEqual(aBuf, bBuf)
  } catch {
    contentMatch = false
  }

  if (!lengthMatch || !contentMatch) {
    return NextResponse.json(
      { error: 'Unauthorized' },
      { status: 401 }
    )
  }

  return null
}