import { NextResponse } from 'next/server'

/**
 * API 에러 응답 헬퍼
 * 프로덕션에서는 내부 에러 상세를 숨기고, 개발환경에서만 노출합니다.
 */
export function apiError(
  err: unknown,
  status: number = 500,
  fallbackMessage: string = '서버 오류가 발생했습니다'
): NextResponse {
  const message = err instanceof Error ? err.message : String(err)

  // 서버 로그에는 항상 상세 기록
  console.error(`[API Error] ${message}`, err)

  // 클라이언트 응답
  const clientMessage =
    process.env.NODE_ENV === 'development' ? message : fallbackMessage

  return NextResponse.json({ error: clientMessage }, { status })
}
