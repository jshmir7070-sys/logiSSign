/**
 * 본인인증 서비스 (모바일)
 *
 * 포트원 V2 본인인증을 WebView/외부 브라우저로 호출
 * 서버 API에서 결과 검증
 */

import { Platform, Linking } from 'react-native';

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

const APP_URL = process.env.EXPO_PUBLIC_APP_URL || 'https://logissign.com';

/**
 * 본인인증 실행
 * 서버 API를 통해 포트원 본인인증 결과를 검증
 */
export async function requestIdentityVerification(
  provider: IdentityProvider,
  contractId: string,
  driverInfo: { name: string; phone: string }
): Promise<VerificationResult> {
  try {
    // 서버에 본인인증 세션 생성 요청
    const verificationId = `identity_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`;

    // 포트원 본인인증 URL로 외부 브라우저 열기
    const verifyUrl = `${APP_URL}/verify-identity?id=${verificationId}&name=${encodeURIComponent(driverInfo.name)}&phone=${encodeURIComponent(driverInfo.phone)}&provider=${provider}`;

    const canOpen = await Linking.canOpenURL(verifyUrl);
    if (canOpen) {
      await Linking.openURL(verifyUrl);
    }

    // 서버에서 본인인증 결과 확인 (폴링)
    for (let i = 0; i < 60; i++) {
      await new Promise(r => setTimeout(r, 3000)); // 3초 간격

      const res = await fetch(`${APP_URL}/api/payment`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'verify-identity',
          identityVerificationId: verificationId,
        }),
      });

      if (!res.ok) continue;
      const data = await res.json();

      if (data.verified) {
        return {
          verified: true,
          provider,
          certId: verificationId,
          name: data.name || driverInfo.name,
          phone: data.phone || driverInfo.phone,
          verifiedAt: new Date().toISOString(),
          error: null,
        };
      }
    }

    // 타임아웃 (3분)
    return {
      verified: false,
      provider,
      certId: '',
      name: '',
      phone: '',
      verifiedAt: '',
      error: '본인인증 시간이 초과되었습니다. 다시 시도해주세요.',
    };
  } catch (err) {
    return {
      verified: false,
      provider,
      certId: '',
      name: '',
      phone: '',
      verifiedAt: '',
      error: err instanceof Error ? err.message : '본인인증 실패',
    };
  }
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
    recommended: Platform.OS === 'android',
  },
  {
    id: 'kakao' as IdentityProvider,
    name: '카카오 인증',
    description: '카카오톡 간편인증',
    icon: '💬',
    recommended: Platform.OS === 'ios',
  },
] as const;
