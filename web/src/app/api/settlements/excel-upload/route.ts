import { getClientIp } from '@/lib/get-ip'
import { apiError } from '@/lib/api-error'
import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { authenticateRequest } from '@/lib/api-auth'
import { rateLimitAuth } from '@/lib/rate-limit'
import { isPaidPlan, type PlanType } from '@/lib/plan-limits'
import { deductPoints, hasEnoughPoints } from '@/services/point.service'

const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!,
  { auth: { autoRefreshToken: false, persistSession: false } }
)

/**
 * POST /api/settlements/excel-upload
 * 엑셀 업로드 정산 저장 완료 시 포인트 차감
 *
 * Body: { yearMonth: string, principalId: string | null, driverCount: number }
 *
 * 포인트 단가: excel_upload = 2,500P / 1회
 * 구독형(basic+)은 무제한
 */
export async function POST(request: NextRequest) {
  const ip = getClientIp(request)
  const limited = await rateLimitAuth(ip, '/api/settlements/excel-upload')
  if (limited) return limited

  const { auth, error: authError } = await authenticateRequest(request)
  if (authError) return authError

  try {
    const body = await request.json()
    const { action } = body as { action: string }

    const agencyId = auth!.agencyId

    // 대리점 플랜 조회
    const { data: agency } = await supabaseAdmin
      .from('agencies')
      .select('plan')
      .eq('id', agencyId)
      .single()
    const agencyPlan = (agency?.plan ?? 'free') as PlanType
    const isSubscription = isPaidPlan(agencyPlan) && agencyPlan !== 'point'

    if (action === 'check') {
      // 사전 잔액 확인만 (업로드 시작 전)
      if (isSubscription) {
        return NextResponse.json({ enough: true, required: 0, balance: 0 })
      }
      const check = await hasEnoughPoints(agencyId, 'excel_upload', 1)
      return NextResponse.json(check)
    }

    if (action === 'deduct') {
      // 저장 완료 후 차감
      if (isSubscription) {
        return NextResponse.json({ deducted: 0, balanceAfter: 0 })
      }

      const check = await hasEnoughPoints(agencyId, 'excel_upload', 1)
      if (!check.enough) {
        return NextResponse.json({
          error: `포인트 잔액 부족 (필요: ${check.required.toLocaleString()}P, 잔액: ${check.balance.toLocaleString()}P). 포인트를 충전하거나 구독 플랜으로 변경해주세요.`,
        }, { status: 402 })
      }

      const result = await deductPoints({
        agencyId,
        action: 'excel_upload',
        count: 1,
        referenceType: 'excel_upload',
        referenceId: body.yearMonth,
        userId: auth!.userId,
      })

      return NextResponse.json(result)
    }

    return NextResponse.json({ error: 'Invalid action' }, { status: 400 })
  } catch (err) {
    console.error('[ExcelUpload] Unexpected error:', err)
    return apiError('엑셀 업로드 처리 중 오류가 발생했습니다', 500)
  }
}
