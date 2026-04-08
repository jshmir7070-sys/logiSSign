/**
 * 본인인증 서비스 — PortOne V2 Identity Verification
 *
 * 계약서 전자서명 시 본인 확인용
 * 전자서명법상 법적 효력 있는 본인인증
 *
 * PortOne V2 API:
 *   GET https://api.portone.io/identity-verifications/{id}
 *   Authorization: PortOne {secret}
 *
 * 필요 환경변수:
 *   PORTONE_V2_SECRET — PortOne V2 API 시크릿 키
 */

export interface IdentityVerificationResult {
  /** 인증 성공 여부 */
  verified: boolean
  /** 인증 실패 시 에러 */
  error: string | null
}

/**
 * PortOne V2 본인인증 결과 검증
 *
 * certId를 사용하여 PortOne V2 API에서 본인인증 상태를 확인합니다.
 *
 * 개발 모드 바이패스:
 *   PORTONE_V2_SECRET이 미설정이고 NODE_ENV !== 'production'이면
 *   certId 존재 자체로 인증 성공 처리합니다.
 */
export async function verifyIdentity(
  certId: string
): Promise<IdentityVerificationResult> {
  if (!certId) {
    return { verified: false, error: '본인인증 ID(certId)가 필요합니다.' }
  }

  const portoneSecret = process.env.PORTONE_V2_SECRET

  // 개발 모드 바이패스: 시크릿 미설정 + 비프로덕션 환경
  if (!portoneSecret && process.env.NODE_ENV !== 'production') {
    console.warn('[Identity] PORTONE_V2_SECRET 미설정 — 개발 모드 바이패스 (certId 존재로 인증 처리)')
    return { verified: true, error: null }
  }

  if (!portoneSecret) {
    console.error('[Identity] 프로덕션에서 PORTONE_V2_SECRET이 설정되지 않았습니다')
    return {
      verified: false,
      error: '본인인증 서비스가 설정되지 않았습니다. 관리자에게 문의하세요.',
    }
  }

  try {
    const response = await fetch(
      `https://api.portone.io/identity-verifications/${encodeURIComponent(certId)}`,
      {
        headers: {
          Authorization: `PortOne ${portoneSecret}`,
          'Content-Type': 'application/json',
        },
      }
    )

    if (!response.ok) {
      const statusText = response.statusText || String(response.status)
      console.error(`[Identity] PortOne API 응답 오류: ${response.status} ${statusText}`)
      return {
        verified: false,
        error: '본인인증 검증에 실패했습니다. 다시 시도해주세요.',
      }
    }

    const data = await response.json()

    if (data.status === 'VERIFIED') {
      return { verified: true, error: null }
    }

    return {
      verified: false,
      error: '본인인증이 완료되지 않았습니다. 인증 후 다시 시도해주세요.',
    }
  } catch (err) {
    console.error('[Identity] PortOne 본인인증 검증 실패:', err)
    return {
      verified: false,
      error: err instanceof Error ? err.message : '본인인증 검증 중 오류가 발생했습니다.',
    }
  }
}
