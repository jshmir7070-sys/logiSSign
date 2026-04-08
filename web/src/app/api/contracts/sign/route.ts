import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { apiError } from '@/lib/api-error'
import { getClientIp } from '@/lib/get-ip'
import { rateLimitAuth } from '@/lib/rate-limit'
import { generateSignedPdf } from '@/services/signed-pdf.service'
import { bridgeContractToSettlement } from '@/services/contract-settlement-bridge.service'

const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!,
  { auth: { autoRefreshToken: false, persistSession: false } }
)

/**
 * POST /api/contracts/sign
 * 계약서 전자서명 처리 (모바일 → 서버)
 *
 * 보안:
 * 1. Supabase JWT에서 driver_id 추출
 * 2. 계약서의 driver_id와 일치하는지 확인
 * 3. 본인인증 certId 서버 재검증
 * 4. 서명 기록 INSERT + 상태 업데이트
 */
export async function POST(request: NextRequest) {
  const ip = getClientIp(request)
  const limited = await rateLimitAuth(ip, '/api/contracts/sign')
  if (limited) return limited

  try {
    // 1. JWT 인증 — Authorization 헤더 또는 쿠키에서 토큰 추출
    const authHeader = request.headers.get('authorization') ?? ''
    const token = authHeader.startsWith('Bearer ')
      ? authHeader.slice(7)
      : null

    if (!token) {
      return NextResponse.json({ error: '인증 토큰이 필요합니다' }, { status: 401 })
    }

    const { data: { user }, error: authErr } = await supabaseAdmin.auth.getUser(token)
    if (authErr || !user) {
      return NextResponse.json({ error: '유효하지 않은 인증입니다' }, { status: 401 })
    }

    // 2. Body 파싱
    const body = await request.json()
    const {
      contractId,
      driverId,
      signatureBase64,
      certId,
      consentData,
    } = body as {
      contractId: string
      driverId: string
      signatureBase64: string
      certId?: string
      consentData?: Record<string, boolean>
    }

    if (!contractId || !driverId || !signatureBase64) {
      return NextResponse.json({ error: '필수 필드가 누락되었습니다' }, { status: 400 })
    }

    // 3. 로그인 계정 = 요청 기사인지 확인
    //    모바일 기사 계정의 app_metadata 또는 user_metadata에서 driver_id 확인
    // ✅ 보안: app_metadata만 사용 (user_metadata는 클라이언트가 수정 가능하므로 신뢰 불가)
    const metaDriverId = user.app_metadata?.driver_id
    if (metaDriverId && metaDriverId !== driverId) {
      return NextResponse.json({ error: '본인의 계약서만 서명할 수 있습니다' }, { status: 403 })
    }

    // 4. 계약서 존재 + driver_id 일치 + 서명 가능 상태 확인
    const { data: contract, error: fetchErr } = await supabaseAdmin
      .from('contracts')
      .select('id, driver_id, status')
      .eq('id', contractId)
      .single()

    if (fetchErr || !contract) {
      return NextResponse.json({ error: '계약서를 찾을 수 없습니다' }, { status: 404 })
    }

    if (contract.driver_id !== driverId) {
      return NextResponse.json({ error: '본인의 계약서만 서���할 수 있습니다' }, { status: 403 })
    }

    if (contract.status === 'signed') {
      return NextResponse.json({ error: '이미 서명된 계약서입니다' }, { status: 409 })
    }

    if (contract.status !== 'sent' && contract.status !== 'viewed') {
      return NextResponse.json({ error: '서명 가능한 상태가 아닙니다' }, { status: 400 })
    }

    // 5. 본인인증 certId 서버 재검증 (certId가 있으면)
    let identityVerified = false
    if (certId) {
      try {
        const portoneSecret = process.env.PORTONE_V2_SECRET
        if (portoneSecret) {
          const verifyRes = await fetch(
            `https://api.portone.io/identity-verifications/${encodeURIComponent(certId)}`,
            {
              headers: {
                Authorization: `PortOne ${portoneSecret}`,
                'Content-Type': 'application/json',
              },
            }
          )
          if (verifyRes.ok) {
            const verifyData = await verifyRes.json()
            if (verifyData.status === 'VERIFIED') {
              identityVerified = true
            }
          }
        } else {
          // 포트원 키 없으면 certId 존재 자체로 기록 (개발 환경)
          identityVerified = true
        }
      } catch (verifyErr) {
        console.error('[ContractSign] Identity verification failed for certId:', certId, verifyErr)
        return NextResponse.json(
          { error: '본인인증 검증에 실패했습니다. 다시 시도해주세요.' },
          { status: 422 }
        )
      }

      if (!identityVerified) {
        return NextResponse.json(
          { error: '본인인증이 완료되지 않았습니다. 인증 후 다시 시도해주세요.' },
          { status: 422 }
        )
      }
    }

    // 6. 클라이언트 IP / UA 추출
    const signerIp = request.headers.get('x-forwarded-for')?.split(',')[0]?.trim()
      ?? request.headers.get('x-real-ip')
      ?? '0.0.0.0'
    const signerUserAgent = request.headers.get('user-agent') ?? 'unknown'

    const now = new Date().toISOString()

    // 7. 서명 기록 INSERT
    const { error: sigError } = await supabaseAdmin
      .from('contract_signatures')
      .insert({
        contract_id: contractId,
        driver_id: driverId,
        phone_verified: identityVerified ? 'identity_verified' : 'app_auth',
        identity_cert_id: certId ?? null,
        signature_image_base64: signatureBase64,
        signer_ip: signerIp,
        signer_user_agent: signerUserAgent,
        signed_at: now,
        consent_contract: consentData?.consent_contract ?? false,
        consent_privacy_collect: consentData?.consent_privacy_collect ?? false,
        consent_privacy_id: consentData?.consent_privacy_id ?? false,
        consent_privacy_3rd: consentData?.consent_privacy_3rd ?? false,
        consent_privacy_3rd_id: consentData?.consent_privacy_3rd_id ?? false,
        audit_log: {
          action: 'signed',
          method: identityVerified ? 'identity_verified' : 'in_app',
          identity_cert_id: certId ?? null,
          identity_verified: identityVerified,
          timestamp: now,
          consents: consentData ?? {},
          ip: signerIp,
          user_agent: signerUserAgent,
        },
      })

    if (sigError) {
      console.error('[ContractSign] Signature insert error:', sigError)
      return NextResponse.json({ error: '서명 기록 저장 실패' }, { status: 500 })
    }

    // 8. PDF 필드 응답 파싱 (pdf 모드일 경우)
    let signFieldResponses = null
    try {
      const parsed = JSON.parse(signatureBase64)
      if (parsed?.type === 'pdf_fields' && parsed.responses) {
        signFieldResponses = parsed.responses
      }
    } catch {
      // text 모드: signatureBase64는 일반 base64 문자열
    }

    // 9. 계약서 상태 업데이트
    const updateData: Record<string, unknown> = {
      status: 'signed',
      signed_at: now,
    }
    if (signFieldResponses) {
      updateData.sign_field_responses = signFieldResponses
    }
    const { error: updateError } = await supabaseAdmin
      .from('contracts')
      .update(updateData)
      .eq('id', contractId)

    if (updateError) {
      console.error('[ContractSign] Contract update error:', updateError)
      return NextResponse.json({ error: '계약서 상태 업데이트 실패' }, { status: 500 })
    }

    const pdfResult = await generateSignedPdf(contractId)

    // 10. 계약서→정산 브릿지: 단가/공제/계약기간 자동 연결
    let bridgeResult = null
    try {
      bridgeResult = await bridgeContractToSettlement(contractId, driverId)
    } catch (bridgeErr) {
      console.warn('[ContractSign] Settlement bridge failed (non-blocking):', bridgeErr)
    }

    return NextResponse.json({
      signed: true,
      identityVerified,
      signedPdfUrl: pdfResult.url,
      pdfGenerated: !!pdfResult.url,
      warning: pdfResult.error,
      settlement: bridgeResult,
    })
  } catch (err) {
    console.error('[ContractSign] Unexpected error:', err)
    return apiError('서명 처리 중 오류가 발생했습니다', 500)
  }
}
