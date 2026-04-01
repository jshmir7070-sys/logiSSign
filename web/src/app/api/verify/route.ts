import { getClientIp } from '@/lib/get-ip'
import { apiError } from '@/lib/api-error'
import { NextRequest, NextResponse } from 'next/server'
import { verifyContract } from '@/services/verification.service'
import { verifyContractSchema, validateInput } from '@/lib/api-schemas'
import { rateLimitPublic } from '@/lib/rate-limit'

/**
 * 계약서 진위확인 API (공개)
 * POST /api/verify { verificationCode: string }
 */
export async function POST(req: NextRequest) {
  // Rate limit — 공개 API이므로 분당 10회
  const ip = getClientIp(req)
  const limited = rateLimitPublic(ip, '/api/verify')
  if (limited) return limited

  try {
    const body = await req.json()
    const { data: validated, error: validationError } = validateInput(verifyContractSchema, body)
    if (validationError || !validated) {
      return NextResponse.json({ error: validationError }, { status: 400 })
    }

    // 요청자 정보
    const verifierIp = ip
    const verifierUserAgent = req.headers.get('user-agent') ?? 'unknown'

    const result = await verifyContract(
      validated.verificationCode,
      verifierIp,
      verifierUserAgent
    )

    if (!result.valid && !result.documentNumber) {
      return NextResponse.json(
        { error: '해당 인증코드로 등록된 계약서를 찾을 수 없습니다.' },
        { status: 404 }
      )
    }

    return NextResponse.json({ data: result })
  } catch (err) {
    return apiError(err, 500, '진위확인 처리 중 오류가 발생했습니다')
  }
}
