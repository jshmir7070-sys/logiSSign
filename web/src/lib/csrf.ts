import { NextResponse, type NextRequest } from 'next/server'

/**
 * CSRF 방어 미들웨어 헬퍼
 * 
 * SameSite=Lax 쿠키 + Origin/Referer 헤더 검증
 * POST/PATCH/DELETE 요청에서 Origin이 허용 목록에 없으면 차단
 */

const ALLOWED_ORIGINS = new Set([
  process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000',
  'https://logissign.com',
  'https://www.logissign.com',
])

export function csrfCheck(request: NextRequest): NextResponse | null {
  const method = request.method
  
  // GET/HEAD/OPTIONS는 CSRF 대상 아님
  if (['GET', 'HEAD', 'OPTIONS'].includes(method)) return null

  // API 라우트만 검사
  const { pathname } = request.nextUrl
  if (!pathname.startsWith('/api/')) return null

  // 공개 API는 CSRF 검사 제외 (이미 rate limit 적용)
  const CSRF_EXEMPT = [
    '/api/auth/signup',
    '/api/auth/driver-signup',
    '/api/verify',
    '/api/cron/',
  ]
  if (CSRF_EXEMPT.some(p => pathname.startsWith(p))) return null

  // Origin 또는 Referer 헤더 검사
  const origin = request.headers.get('origin')
  const referer = request.headers.get('referer')

  if (origin) {
    if (!ALLOWED_ORIGINS.has(origin)) {
      console.warn(`[CSRF] Blocked: origin=${origin}, path=${pathname}`)
      return NextResponse.json(
        { error: '잘못된 요청 출처입니다' },
        { status: 403 }
      )
    }
    return null
  }

  if (referer) {
    const refererOrigin = new URL(referer).origin
    if (!ALLOWED_ORIGINS.has(refererOrigin)) {
      console.warn(`[CSRF] Blocked: referer=${refererOrigin}, path=${pathname}`)
      return NextResponse.json(
        { error: '잘못된 요청 출처입니다' },
        { status: 403 }
      )
    }
    return null
  }

  // Origin/Referer 모두 없으면 — 서버 간 호출 허용 (CRON 등)
  // 하지만 인증은 별도로 체크됨
  return null
}
