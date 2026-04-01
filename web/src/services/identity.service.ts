import { createServerSupabaseClient } from '@/lib/supabase'

/**
 * 본인인증 서비스 (PASS + 카카오 인증 지원)
 *
 * 계약서 전자서명 시 본인 확인용
 * 전자서명법상 법적 효력 있는 본인인증
 *
 * 연동 방식:
 *  - PASS: 통신사(SKT/KT/LGU+) 본인확인 + 민간인증서
 *  - 카카오: 카카오톡 내 간편인증
 *  - 둘 다 표준창(WebView) 방식으로 연동
 *
 * 필요 환경변수:
 *  NEXT_PUBLIC_IDENTITY_PROVIDER_ID   — 본인인증 서비스 제공업체 ID
 *  NEXT_PUBLIC_IDENTITY_API_KEY       — API Key
 *  NEXT_PUBLIC_IDENTITY_CALLBACK_URL  — 인증 완료 콜백 URL
 *
 * 연동 업체 옵션:
 *  1. 다날 (danal.co.kr) — PASS + 카카오 동시 지원, 중소기업 친화적
 *  2. KG이니시스 — 대형 서비스용
 *  3. NHN KCP — 결제 연동과 함께 사용 시 유리
 */

export type IdentityProvider = 'pass' | 'kakao'

export interface IdentityVerificationRequest {
  /** 인증 수단 */
  provider: IdentityProvider
  /** 인증 목적 */
  purpose: 'contract_sign' | 'signup'
  /** 기사 정보 (사전 입력용) */
  name?: string
  phone?: string
  birthDate?: string
  /** 관련 계약서 ID */
  contractId?: string
}

export interface IdentityVerificationResult {
  /** 인증 성공 여부 */
  verified: boolean
  /** 인증 실패 시 에러 */
  error: string | null
  /** 인증 완료 데이터 */
  data: {
    /** 인증된 실명 */
    name: string
    /** 인증된 전화번호 */
    phone: string
    /** 인증된 생년월일 */
    birthDate: string
    /** 인증 수단 */
    provider: IdentityProvider
    /** 인증 고유 ID (업체 발급) */
    certId: string
    /** CI (Connecting Information) — 동일인 판별 키 */
    ci: string
    /** DI (Duplication Information) — 서비스 내 중복 확인 키 */
    di: string
    /** 인증 시각 */
    verifiedAt: string
  } | null
}

/**
 * 본인인증 세션 생성
 * 프론트에서 WebView를 열어 인증 페이지를 보여줌
 * 인증 완료 시 callback URL로 결과 전달
 *
 * ⚠️ 실제 연동 시 다날/KG이니시스 등의 SDK에 맞게 교체 필요
 */
export async function createVerificationSession(
  request: IdentityVerificationRequest
): Promise<{
  sessionId: string
  verificationUrl: string
  error: string | null
}> {
  const apiKey = process.env.NEXT_PUBLIC_IDENTITY_API_KEY
  const providerId = process.env.NEXT_PUBLIC_IDENTITY_PROVIDER_ID
  const _callbackUrl = process.env.NEXT_PUBLIC_IDENTITY_CALLBACK_URL

  if (!apiKey || !providerId) {
    // 프로덕션에서 API 키 미설정 시 차단
    if (process.env.NODE_ENV === 'production' && process.env.ALLOW_DEV_IDENTITY !== 'true') {
      console.error('[Identity] 프로덕션에서 본인인증 API 키가 설정되지 않았습니다')
      return {
        sessionId: '',
        verificationUrl: '',
        error: '본인인증 서비스가 설정되지 않았습니다. 관리자에게 문의하세요.',
      }
    }
    console.warn('[Identity] API 키 미설정 — 개발 모드 (인증 스킵)')
    return {
      sessionId: `dev_${Date.now()}`,
      verificationUrl: '',
      error: null,
    }
  }

  try {
    // 실제 구현 시 다날 API 호출 예시:
    // POST https://api.danal.co.kr/auth/v1/session
    // { providerId, provider: request.provider, callbackUrl, ... }

    const sessionId = crypto.randomUUID()
    const verificationUrl = `https://auth.example.com/verify?session=${sessionId}&provider=${request.provider}`

    return { sessionId, verificationUrl, error: null }
  } catch (err) {
    return {
      sessionId: '',
      verificationUrl: '',
      error: err instanceof Error ? err.message : '인증 세션 생성 실패',
    }
  }
}

/**
 * 본인인증 결과 확인
 * 콜백으로 받은 sessionId로 인증 결과 조회
 */
export async function getVerificationResult(
  sessionId: string
): Promise<IdentityVerificationResult> {
  const apiKey = process.env.NEXT_PUBLIC_IDENTITY_API_KEY

  if (!apiKey) {
    // 프로덕션에서 차단
    if (process.env.NODE_ENV === 'production' && process.env.ALLOW_DEV_IDENTITY !== 'true') {
      return { verified: false, error: '본인인증 서비스가 설정되지 않았습니다', data: null }
    }
    // 개발 모드: dev_ 세션만 허용
    if (sessionId.startsWith('dev_')) {
      return {
        verified: true,
        error: null,
        data: {
          name: '개발테스트',
          phone: '01000000000',
          birthDate: '19900101',
          provider: 'pass',
          certId: sessionId,
          ci: 'dev_ci_' + sessionId,
          di: 'dev_di_' + sessionId,
          verifiedAt: new Date().toISOString(),
        },
      }
    }
  }

  try {
    // 실제 구현 시 다날 API 호출:
    // GET https://api.danal.co.kr/auth/v1/result?sessionId=xxx

    return {
      verified: false,
      error: '본인인증 서비스 미연동',
      data: null,
    }
  } catch (err) {
    return {
      verified: false,
      error: err instanceof Error ? err.message : '인증 결과 조회 실패',
      data: null,
    }
  }
}

/**
 * 계약서 서명 시 본인인증 결과를 contract_signatures에 저장
 */
export async function saveVerificationToSignature(
  contractId: string,
  result: IdentityVerificationResult
): Promise<void> {
  if (!result.verified || !result.data) return

  const supabase = await createServerSupabaseClient()
  const { data: signature } = await supabase
    .from('contract_signatures')
    .select('id')
    .eq('contract_id', contractId)
    .single()

  if (!signature) return

  await supabase
    .from('contract_signatures')
    .update({
      verified_at: new Date().toISOString(),
      verification_data: result.data,
    })
    .eq('id', signature.id)
}