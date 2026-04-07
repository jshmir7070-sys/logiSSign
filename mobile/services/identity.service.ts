/**
 * 모바일 본인인증 서비스
 * PortOne V2 본인인증 페이지를 외부 브라우저로 열고
 * 서버 API에서 결과를 확인합니다.
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
 * 서버 API를 통해 PortOne 본인인증 결과를 검증합니다.
 */
export async function requestIdentityVerification(
  provider: IdentityProvider,
  contractId: string,
  driverInfo: { name: string; phone: string }
): Promise<VerificationResult> {
  try {
    const verificationId = `identity_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`;
    const verifyUrl = `${APP_URL}/verify-identity?id=${verificationId}&name=${encodeURIComponent(driverInfo.name)}&phone=${encodeURIComponent(driverInfo.phone)}&provider=${provider}&contractId=${encodeURIComponent(contractId)}`;

    const canOpen = await Linking.canOpenURL(verifyUrl);
    if (canOpen) {
      await Linking.openURL(verifyUrl);
    }

    for (let i = 0; i < 60; i += 1) {
      await new Promise((resolve) => setTimeout(resolve, 3000));

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

    return {
      verified: false,
      provider,
      certId: '',
      name: '',
      phone: '',
      verifiedAt: '',
      error: '본인인증 시간이 초과되었습니다. 다시 시도해 주세요.',
    };
  } catch (err) {
    return {
      verified: false,
      provider,
      certId: '',
      name: '',
      phone: '',
      verifiedAt: '',
      error: err instanceof Error ? err.message : '본인인증에 실패했습니다.',
    };
  }
}

/**
 * 본인인증 수단 선택 UI 데이터
 */
export const IDENTITY_PROVIDERS = [
  {
    id: 'pass' as IdentityProvider,
    name: 'PASS 인증',
    description: '통신사 본인확인 + 휴대폰 인증',
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
