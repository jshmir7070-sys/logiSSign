import { Platform } from 'react-native';
import * as Notifications from 'expo-notifications';
import * as Device from 'expo-device';
import { supabase } from '../lib/supabase';

/**
 * Expo Push Notification 서비스
 *
 * 플로우:
 *  1. 앱 시작 시 registerPushToken() → Expo Push Token 발급
 *  2. 토큰을 drivers.push_token에 저장
 *  3. 서버에서 Expo Push API로 알림 전송
 *  4. 앱에서 수신 → 알림 표시 + 탭 시 화면 이동
 */

// 알림 핸들러 설정 — 포그라운드에서도 알림 표시
Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldShowAlert: true,
    shouldPlaySound: true,
    shouldSetBadge: true,
    shouldShowBanner: true,
    shouldShowList: true,
  }),
});

/**
 * 푸시 토큰 등록 + DB 저장
 */
export async function registerPushToken(driverId: string): Promise<string | null> {
  try {
    // 실제 디바이스에서만 동작
    if (!Device.isDevice) {
      console.log('[Push] 시뮬레이터에서는 푸시 알림을 사용할 수 없습니다');
      return null;
    }

    // 권한 요청
    const { status: existingStatus } = await Notifications.getPermissionsAsync();
    let finalStatus = existingStatus;

    if (existingStatus !== 'granted') {
      const { status } = await Notifications.requestPermissionsAsync();
      finalStatus = status;
    }

    if (finalStatus !== 'granted') {
      console.log('[Push] 알림 권한이 거부되었습니다');
      return null;
    }

    // Android 채널 설정
    if (Platform.OS === 'android') {
      await Notifications.setNotificationChannelAsync('default', {
        name: '기본 알림',
        importance: Notifications.AndroidImportance.MAX,
        vibrationPattern: [0, 250, 250, 250],
        lightColor: '#2563eb',
        sound: 'default',
      });
    }

    // Expo Push Token 발급
    const tokenData = await Notifications.getExpoPushTokenAsync({
      projectId: 'your-eas-project-id', // app.json extra.eas.projectId와 동일
    });
    const token = tokenData.data;

    // DB에 토큰 저장
    const { error } = await supabase
      .from('drivers')
      .update({ push_token: token })
      .eq('id', driverId);

    if (error) {
      console.warn('[Push] 토큰 저장 실패:', error.message);
    } else {
      console.log('[Push] 토큰 등록 완료:', token.slice(0, 20) + '...');
    }

    return token;
  } catch (err) {
    console.warn('[Push] 토큰 등록 오류:', err);
    return null;
  }
}

/**
 * 푸시 토큰 해제 (로그아웃 시)
 */
export async function unregisterPushToken(driverId: string): Promise<void> {
  try {
    await supabase
      .from('drivers')
      .update({ push_token: null })
      .eq('id', driverId);
  } catch {
    // 비치명적
  }
}

/**
 * 알림 수신/탭 리스너 등록
 *
 * @param onReceived - 포그라운드에서 알림 수신 시 콜백
 * @param onTapped - 알림 탭 시 콜백 (화면 이동용)
 * @returns cleanup 함수
 */
export function addNotificationListeners(
  onReceived?: (notification: Notifications.Notification) => void,
  onTapped?: (response: Notifications.NotificationResponse) => void,
): () => void {
  const receivedSub = Notifications.addNotificationReceivedListener((notification) => {
    onReceived?.(notification);
  });

  const responseSub = Notifications.addNotificationResponseReceivedListener((response) => {
    onTapped?.(response);
  });

  return () => {
    receivedSub.remove();
    responseSub.remove();
  };
}

/**
 * 알림 데이터에서 네비게이션 경로 추출
 */
export function getNavigationFromNotification(
  response: Notifications.NotificationResponse
): { route: string; params?: Record<string, string> } | null {
  const data = response.notification.request.content.data as Record<string, string> | undefined;
  if (!data?.type) return null;

  switch (data.type) {
    case 'contract':
      return { route: '/contract/[id]', params: { id: data.id } };
    case 'settlement':
      return { route: '/(tabs)/settlement' };
    case 'amendment':
      return { route: '/amendment/[id]', params: { id: data.id } };
    case 'notice':
      return { route: '/(tabs)/notice' };
    case 'document':
      return { route: '/documents' };
    case 'education':
      return { route: '/(tabs)/education' };
    default:
      return null;
  }
}
