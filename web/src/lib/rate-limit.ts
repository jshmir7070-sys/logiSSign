import { NextResponse } from 'next/server'

/**
 * 메모리 기반 Rate Limiter
 * Vercel Serverless에서는 인스턴스별 메모리이므로 완벽하진 않지만,
 * 단일 인스턴스 공격은 차단합니다.
 * 프로덕션에서는 Redis(Upstash) 기반으로 교체 권장.
 */

interface RateLimitEntry {
  count: number
  resetAt: number
}

const store = new Map<string, RateLimitEntry>()

// 매 5분마다 만료 엔트리 정리
setInterval(() => {
  const now = Date.now()
  const keys = Array.from(store.keys())
  for (const key of keys) {
    const entry = store.get(key)
    if (entry && entry.resetAt <= now) store.delete(key)
  }
}, 5 * 60 * 1000)

interface RateLimitOptions {
  /** 윈도우 내 최대 요청 수 */
  maxRequests: number
  /** 윈도우 크기 (밀리초) */
  windowMs: number
}

/**
 * Rate limit 체크
 * @returns null이면 통과, NextResponse이면 차단
 */
export function checkRateLimit(
  ip: string,
  endpoint: string,
  options: RateLimitOptions = { maxRequests: 30, windowMs: 60_000 }
): NextResponse | null {
  const key = `${ip}:${endpoint}`
  const now = Date.now()

  const entry = store.get(key)

  if (!entry || entry.resetAt <= now) {
    store.set(key, { count: 1, resetAt: now + options.windowMs })
    return null
  }

  entry.count++

  if (entry.count > options.maxRequests) {
    const retryAfter = Math.ceil((entry.resetAt - now) / 1000)
    return NextResponse.json(
      { error: '요청이 너무 많습니다. 잠시 후 다시 시도하세요.' },
      {
        status: 429,
        headers: {
          'Retry-After': String(retryAfter),
          'X-RateLimit-Limit': String(options.maxRequests),
          'X-RateLimit-Remaining': '0',
          'X-RateLimit-Reset': String(entry.resetAt),
        },
      }
    )
  }

  return null
}

/** 공개 API용 — 분당 10회 */
export function rateLimitPublic(ip: string, endpoint: string) {
  return checkRateLimit(ip, endpoint, { maxRequests: 10, windowMs: 60_000 })
}

/** 인증된 API용 — 분당 60회 */
export function rateLimitAuth(ip: string, endpoint: string) {
  return checkRateLimit(ip, endpoint, { maxRequests: 60, windowMs: 60_000 })
}
