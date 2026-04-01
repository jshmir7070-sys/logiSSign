/**
 * 본인인증 서비스 (모바일)
 *
 * 계약서 전자서명 전 본인 확인
 * PASS 또는 카카오 인증을 WebView로 호출
 *
 * 실 연동 시:
 *  1. 웹 포털 API에서 인증 세션 생성
 *  2. 인증 URL을 WebView / 외부 브라우저로 열기
 *  3. 콜백으로 결과 수신
 *  4. 결과를 서명 데이터에 포함
 */

import { Linking, Platform } from 'react-native';

export type IdentityProvider = 'pass' | 'kakao';

export interface VerificationResult {
  verified: boolean;
  provider: IdentityProvider;
  certId: string;
  name: string;
  phone: string;
  verifiedAt: string;
  error: string | null;
}

/**
 * 본인인증 실행
 * 개발 환경에서는 인증 없이 통과 (API 키 미설정 시)
 * 실 서비스에서는 WebView → PASS/카카오 인증 → 콜백
 */
export async function requestIdentityVerification(
  provider: IdentityProvider,
  contractId: string,
  driverInfo: { name: string; phone: string }
): Promise<VerificationResult> {
  // TODO: 실 연동 시 서버에서 세션 생성 후 WebView로 인증 페이지 열기
  // const session = await fetch('/api/identity/session', { method: 'POST', body: ... })
  // await Linking.openURL(session.verificationUrl)
  // ... 콜백 대기 ...

  // 개발 모드: 인증 성공으로 처리
  console.log(`[Identity] ${provider} 인증 요청 — 개발모드 자동 통과`);

  return {
    verified: true,
    provider,
    certId: `dev_${Date.now()}`,
    name: driverInfo.name,
    phone: driverInfo.phone,
    verifiedAt: new Date().toISOString(),
    error: null,
  };
}

/**
 * 본인인증 제공업체 선택 UI에 표시할 정보
 */
export const IDENTITY_PROVIDERS = [
  {
    id: 'pass' as IdentityProvider,
    name: 'PASS 인증',
    description: '통신사 본인확인 + 민간인증서',
    icon: '🔐',
    recommended: Platform.OS === 'android', // Android에서 PASS 앱 보급률 높음
  },
  {
    id: 'kakao' as IdentityProvider,
    name: '카카오 인증',
    description: '카카오톡 간편인증',
    icon: '💬',
    recommended: Platform.OS === 'ios', // iOS에서 카카오 사용률 높음
  },
] as const;
