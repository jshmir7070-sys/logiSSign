import { useEffect, useRef } from 'react';
import { ActivityIndicator, StyleSheet, View } from 'react-native';
import { Slot, useRouter, useSegments } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { useAuth } from '../hooks/useAuth';
import {
  registerPushToken,
  addNotificationListeners,
  getNavigationFromNotification,
} from '../services/push.service';
import { colors } from '../constants/theme';

export default function RootLayout() {
  const { session, isLoading, driver } = useAuth();
  const segments = useSegments();
  const router = useRouter();
  const pushRegistered = useRef(false);

  // 인증 라우팅
  useEffect(() => {
    if (isLoading) return;

    const inAuthGroup = segments[0] === '(auth)';

    if (!session && !inAuthGroup) {
      router.replace('/(auth)/login');
    } else if (session && inAuthGroup) {
      router.replace('/(tabs)');
    }
  }, [session, isLoading, segments, router]);

  // 푸시 알림 초기화 (async — Expo Go 호환)
  useEffect(() => {
    if (!driver?.id || pushRegistered.current) return;
    pushRegistered.current = true;

    let cleanupFn: (() => void) | null = null;

    (async () => {
      // 토큰 등록
      await registerPushToken(driver.id);

      // 알림 리스너
      cleanupFn = await addNotificationListeners(
        // 포그라운드 수신 — 별도 처리 필요 없음 (시스템 알림 표시)
        undefined,
        // 알림 탭 → 화면 이동
        (response) => {
          const nav = getNavigationFromNotification(response);
          if (nav) {
            router.push(nav.route as never);
          }
        }
      );
    })();

    return () => {
      cleanupFn?.();
    };
  }, [driver?.id, router]);

  if (isLoading) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color={colors.primary} />
      </View>
    );
  }

  return (
    <>
      <StatusBar style="auto" />
      <Slot />
    </>
  );
}

const styles = StyleSheet.create({
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: colors.surface,
  },
});
