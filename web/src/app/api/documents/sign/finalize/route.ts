import { NextRequest, NextResponse } from 'next/server'
import { createAdminSupabaseClient } from '@/lib/supabase'
import { authenticateRequest } from '@/lib/api-auth'
import { getClientIp } from '@/lib/get-ip'
import { rateLimitAuth } from '@/lib/rate-limit'
import { apiError } from '@/lib/api-error'
import { finalizeDocumentSigningWithClient } from '@/services/document-sign-field.service'

const supabaseAdmin = createAdminSupabaseClient()

export async function POST(request: NextRequest) {
  const ip = getClientIp(request)
  const limited = rateLimitAuth(ip, '/api/documents/sign/finalize')
  if (limited) return limited

  const { auth, error: authError } = await authenticateRequest(request)
  if (authError || !auth) return authError!

  if (auth.role !== 'driver') {
    return NextResponse.json({ error: '기사 계정만 문서 서명을 완료할 수 있습니다.' }, { status: 403 })
  }

  try {
    const body = await request.json()
    const deliveryId = typeof body?.deliveryId === 'string' ? body.deliveryId : ''

    if (!deliveryId) {
      return NextResponse.json({ error: 'deliveryId가 필요합니다.' }, { status: 400 })
    }

    const [{ data: driver, error: driverError }, { data: delivery, error: deliveryError }] = await Promise.all([
      supabaseAdmin
        .from('drivers')
        .select('id, agency_id')
        .eq('user_id', auth.userId)
        .maybeSingle(),
      supabaseAdmin
        .from('document_deliveries')
        .select('id, driver_id, agency_id')
        .eq('id', deliveryId)
        .maybeSingle(),
    ])

    if (driverError || !driver) {
      return NextResponse.json({ error: '기사 정보를 찾을 수 없습니다.' }, { status: 404 })
    }

    if (deliveryError || !delivery) {
      return NextResponse.json({ error: '문서 전송 기록을 찾을 수 없습니다.' }, { status: 404 })
    }

    if (delivery.driver_id !== driver.id || delivery.agency_id !== driver.agency_id) {
      return NextResponse.json({ error: '해당 문서에 접근할 권한이 없습니다.' }, { status: 403 })
    }

    const result = await finalizeDocumentSigningWithClient(deliveryId, supabaseAdmin)
    if (result.error) {
      return NextResponse.json({ error: result.error }, { status: 400 })
    }

    return NextResponse.json({
      signed: true,
      path: result.signedPdfPath,
      url: result.signedPdfUrl,
    })
  } catch (error) {
    return apiError(
      error instanceof Error ? error.message : '문서 서명 완료 처리에 실패했습니다.',
      500
    )
  }
}
