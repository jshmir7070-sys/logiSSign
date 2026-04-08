import { Platform } from 'react-native';
import * as Device from 'expo-device';
import Constants from 'expo-constants';
import { supabase } from '../lib/supabase';

/**
 * Expo Push Notification 서비스
 *
 * ⚠️ expo-notifications는 Expo Go SDK 53+에서 원격 푸시를 지원하지 않음.
 *    → lazy import로 실제 디바이스(development build)에서만 로드
 *    → Expo Go에서는 graceful 스킵
 *
 * 플로우:
 *  1. 앱 시작 시 registerPushToken() → Expo Push Token 발급
 *  2. 토큰을 drivers.push_token에 저장
 *  3. 서버에서 Expo Push API로 알림 전송
 *  4. 앱에서 수신 → 알림 표시 + 탭 시 화면 이동
 */

/** expo-notifications 지연 로딩 (Expo Go 호환) */
async function getNotifications() {
  try {
    const mod = await import('expo-notifications');
    return mod;
  } catch {
    __DEV__ && console.log('[Push] expo-notifications를 로드할 수 없습니다 (Expo Go 환경)');
    return null;
  }
}

/** 알림 핸들러 초기화 (앱 시작 시 1회 호출) */
let handlerInitialized = false;
async function ensureNotificationHandler() {
  if (handlerInitialized) return;
  handlerInitialized = true;
  try {
    const Notifications = await getNotifications();
    if (!Notifications) return;
    Notifications.setNotificationHandler({
      handleNotification: async () => ({
        shouldShowAlert: true,
        shouldPlaySound: true,
        shouldSetBadge: true,
        shouldShowBanner: true,
        shouldShowList: true,
      }),
    });
  } catch {
    // Expo Go에서 실패 — 무시
  }
}

/**
 * 푸시 토큰 등록 + DB 저장
 */
export async function registerPushToken(driverId: string): Promise<string | null> {
  try {
    // 실제 디바이스에서만 동작
    if (!Device.isDevice) {
      __DEV__ && console.log('[Push] 시뮬레이터에서는 푸시 알림을 사용할 수 없습니다');
      return null;
    }

    const Notifications = await getNotifications();
    if (!Notifications) {
      __DEV__ && console.log('[Push] Expo Go에서는 푸시 알림을 사용할 수 없습니다. Development build를 사용하세요.');
      return null;
    }

    await ensureNotificationHandler();

    // 권한 요청
    const { status: existingStatus } = await Notifications.getPermissionsAsync();
    let finalStatus = existingStatus;

    if (existingStatus !== 'granted') {
      const { status } = await Notifications.requestPermissionsAsync();
      finalStatus = status;
    }

    if (finalStatus !== 'granted') {
      __DEV__ && console.log('[Push] 알림 권한이 거부되었습니다');
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
    const projectId = Constants.expoConfig?.extra?.eas?.projectId;
    if (!projectId) {
      __DEV__ && console.warn('[Push] EAS projectId not found in app.json');
      return null;
    }
    const tokenData = await Notifications.getExpoPushTokenAsync({ projectId });
    const token = tokenData.data;

    // DB에 토큰 저장
    const { error } = await supabase
      .from('drivers')
      .update({ push_token: token })
      .eq('id', driverId);

    if (error) {
      __DEV__ && console.warn('[Push] 토큰 저장 실패:', error.message);
    } else {
      __DEV__ && console.log('[Push] 토큰 등록 완료:', token.slice(0, 20) + '...');
    }

    return token;
  } catch (err) {
    __DEV__ && console.warn('[Push] 토큰 등록 오류:', err);
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
export async function addNotificationListeners(
  onReceived?: (notification: { request: { content: { data?: Record<string, unknown> } } }) => void,
  onTapped?: (response: { notification: { request: { content: { data?: Record<string, unknown> } } } }) => void,
): Promise<() => void> {
  const Notifications = await getNotifications();
  if (!Notifications) {
    return () => {}; // noop cleanup
  }

  await ensureNotificationHandler();

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
  response: { notification: { request: { content: { data?: Record<string, unknown> } } } }
): { route: string; params?: Record<string, unknown> } | null {
  const data = response.notification.request.content.data;
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
    case 'tax_invoice':
      return { route: '/tax-invoices/[id]', params: { id: data.id } };
    default:
      return null;
  }
}
