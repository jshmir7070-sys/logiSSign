import { NextRequest, NextResponse } from 'next/server'
import { createServerClient, type CookieOptions } from '@supabase/ssr'
import { createClient } from '@supabase/supabase-js'
import { timingSafeEqual } from 'crypto'

interface AuthResult {
  userId: string
  agencyId: string
  role: string
}

async function getUserFromRequest(request: NextRequest) {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
  const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY

  if (!supabaseUrl || !supabaseKey) {
    return {
      user: null,
      error: NextResponse.json({ error: 'Supabase 설정 누락' }, { status: 500 }),
    }
  }

  const authorization = request.headers.get('authorization') ?? ''
  const bearerToken = authorization.startsWith('Bearer ')
    ? authorization.slice(7).trim()
    : ''

  if (bearerToken) {
    const tokenClient = createClient(supabaseUrl, supabaseKey, {
      auth: {
        autoRefreshToken: false,
        persistSession: false,
      },
    })
    const { data, error } = await tokenClient.auth.getUser(bearerToken)
    if (error || !data.user) {
      return {
        user: null,
        error: NextResponse.json({ error: '인증이 필요합니다' }, { status: 401 }),
      }
    }
    return { user: data.user, error: null }
  }

  const supabase = createServerClient(supabaseUrl, supabaseKey, {
    cookies: {
      get(name: string) {
        return request.cookies.get(name)?.value
      },
      set(_name: string, _value: string, _options: CookieOptions) {
        // API route에서는 cookie set을 사용하지 않는다.
      },
      remove(_name: string, _options: CookieOptions) {
        // API route에서는 cookie remove를 사용하지 않는다.
      },
    },
  })

  const { data, error } = await supabase.auth.getUser()
  if (error || !data.user) {
    return {
      user: null,
      error: NextResponse.json({ error: '인증이 필요합니다' }, { status: 401 }),
    }
  }

  return { user: data.user, error: null }
}

/**
 * API route 공통 인증 헬퍼.
 * 쿠키 세션과 Bearer 토큰을 모두 허용하고 app_metadata 기준으로 권한을 판정한다.
 */
export async function authenticateRequest(
  request: NextRequest
): Promise<{ auth: AuthResult | null; error: NextResponse | null }> {
  const { user, error } = await getUserFromRequest(request)
  if (error || !user) {
    return { auth: null, error }
  }

  const role = (user.app_metadata?.role as string) ?? ''
  const agencyId = (user.app_metadata?.agency_id as string) ?? ''

  if (!role || !agencyId) {
    return {
      auth: null,
      error: NextResponse.json(
        { error: '계정 메타데이터가 올바르지 않습니다. 관리자에게 문의해 주세요.' },
        { status: 403 }
      ),
    }
  }

  return {
    auth: {
      userId: user.id,
      agencyId,
      role,
    },
    error: null,
  }
}

/**
 * 관리자 권한 확인.
 */
export async function authenticateAdmin(
  request: NextRequest
): Promise<{ auth: AuthResult | null; error: NextResponse | null }> {
  const { auth, error } = await authenticateRequest(request)
  if (error || !auth) return { auth, error }

  if (!['provider_admin', 'agency_admin'].includes(auth.role)) {
    return {
      auth: null,
      error: NextResponse.json({ error: '관리자 권한이 필요합니다' }, { status: 403 }),
    }
  }

  return { auth, error: null }
}

/**
 * CRON 전용 인증.
 */
export function authenticateCron(request: NextRequest): NextResponse | null {
  const cronSecret = process.env.CRON_SECRET

  if (!cronSecret) {
    if (process.env.NODE_ENV === 'production') {
      console.error('[CRON AUTH] CRON_SECRET 환경변수가 설정되지 않았습니다.')
      return NextResponse.json({ error: 'Server misconfiguration' }, { status: 500 })
    }

    console.warn('[CRON AUTH] CRON_SECRET 미설정 - 개발 환경이므로 통과')
    return null
  }

  const authHeader = request.headers.get('authorization') ?? ''
  const expected = `Bearer ${cronSecret}`

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
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  return null
}
