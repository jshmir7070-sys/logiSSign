import { NextRequest } from 'next/server'

/**
 * 신뢰할 수 있는 클라이언트 IP 추출
 * Vercel 환경: x-vercel-forwarded-for (프록시 설정 불변)
 * 기타: x-real-ip → x-forwarded-for 첫 번째 → fallback
 */
export function getClientIp(request: NextRequest): string {
  return (
    request.headers.get('x-vercel-forwarded-for')?.split(',')[0]?.trim() ||
    request.headers.get('x-real-ip') ||
    request.headers.get('x-forwarded-for')?.split(',')[0]?.trim() ||
    'unknown'
  )
}
