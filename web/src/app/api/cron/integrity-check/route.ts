/**
 * CRON 무결성 검사 API
 *
 * 정기적으로 호출되어 모든 서명 완료 계약서의 해시를 재검증합니다.
 * Vercel Cron 또는 외부 스케줄러에서 호출:
 *   GET /api/cron/integrity-check
 *
 * 보안: CRON_SECRET timing-safe 검증
 */

import { NextRequest, NextResponse } from 'next/server'
import { runIntegrityCheck } from '@/services/integrity-check.service'
import { authenticateCron } from '@/lib/api-auth'

export const dynamic = 'force-dynamic'
export const maxDuration = 300 // 최대 5분 (대량 계약 처리)

export async function GET(request: NextRequest) {
  // timing-safe 인증
  const cronError = authenticateCron(request)
  if (cronError) return cronError

  try {
    const result = await runIntegrityCheck('cron')

    // 실패 건이 있으면 경고 로그
    if (result.failed > 0) {
      console.error(
        `[INTEGRITY-CHECK] ⚠️ ${result.failed}건 위변조 의심 감지!`,
        JSON.stringify(result.failures.map(f => ({
          id: f.contractId,
          doc: f.documentNumber,
          reasons: f.reasons,
        })))
      )
    } else {
      console.log(
        `[INTEGRITY-CHECK] ✅ 전체 ${result.totalContracts}건 정상 (${result.durationMs}ms)`
      )
    }

    return NextResponse.json({
      success: true,
      ...result,
    })
  } catch (error) {
    console.error('[INTEGRITY-CHECK] 실행 오류:', error)
    return NextResponse.json(
      { error: '무결성 검사 실행 중 오류가 발생했습니다' },
      { status: 500 }
    )
  }
}
