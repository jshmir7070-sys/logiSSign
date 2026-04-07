import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Linking,
  ScrollView,
  StyleSheet,
  Switch,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import * as ImagePicker from 'expo-image-picker';
import { SafeAreaView } from 'react-native-safe-area-context';
import { MaterialIcons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import GradientView from '../../components/common/GradientView';
import { useAuthStore } from '../../stores/authStore';
import { supabase } from '../../lib/supabase';
import { borderRadius, colors, shadows, spacing, typography } from '../../constants/theme';
import type { DocumentType } from '../../types/database';

interface MenuItem {
  id: string;
  icon: keyof typeof MaterialIcons.glyphMap;
  label: string;
}

interface NotificationPreferences {
  settlement: boolean;
  notice: boolean;
  contract: boolean;
}

const APP_URL = process.env.EXPO_PUBLIC_APP_URL || 'https://logissign.com';

const DEFAULT_NOTIFICATION_PREFERENCES: NotificationPreferences = {
  settlement: true,
  notice: true,
  contract: true,
};

const MENU_ITEMS: MenuItem[] = [
  { id: 'info', icon: 'person-outline', label: '개인정보' },
  { id: 'phone', icon: 'phone', label: '연락처' },
  { id: 'vehicle', icon: 'directions-car', label: '차량정보' },
  { id: 'documents', icon: 'folder-open', label: '문서함' },
  { id: 'seal', icon: 'verified', label: '도장/서명 관리' },
];

const DOC_UPLOAD_ITEMS: Array<MenuItem & { type: DocumentType }> = [
  { id: 'vehicle_registration', type: 'vehicle_registration', icon: 'directions-car', label: '차량등록증' },
  { id: 'license', type: 'license', icon: 'badge', label: '운전면허증' },
  { id: 'cargo_license', type: 'cargo_license', icon: 'local-shipping', label: '화물운송자격증' },
];

const APP_INFO_ITEMS: MenuItem[] = [
  { id: 'version', icon: 'info-outline', label: '버전 정보' },
  { id: 'terms', icon: 'description', label: '이용약관' },
  { id: 'privacy', icon: 'shield', label: '개인정보처리방침' },
];

function normalizeNotificationPreferences(value: unknown): NotificationPreferences {
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    return DEFAULT_NOTIFICATION_PREFERENCES;
  }

  const candidate = value as Record<string, unknown>;
  return {
    settlement:
      typeof candidate.settlement === 'boolean'
        ? candidate.settlement
        : DEFAULT_NOTIFICATION_PREFERENCES.settlement,
    notice:
      typeof candidate.notice === 'boolean' ? candidate.notice : DEFAULT_NOTIFICATION_PREFERENCES.notice,
    contract:
      typeof candidate.contract === 'boolean'
        ? candidate.contract
        : DEFAULT_NOTIFICATION_PREFERENCES.contract,
  };
}

export default function ProfileScreen() {
  const router = useRouter();
  const { driver, setDriver, signOut } = useAuthStore();

  const [documents, setDocuments] = useState<Record<string, { url: string; date: string } | null>>({});
  const [uploading, setUploading] = useState<string | null>(null);
  const [unsignedContracts, setUnsignedContracts] = useState(0);
  const [notificationPrefs, setNotificationPrefs] = useState<NotificationPreferences>(
    DEFAULT_NOTIFICATION_PREFERENCES,
  );
  const [notificationSavingKey, setNotificationSavingKey] = useState<keyof NotificationPreferences | null>(null);
  const [privacyRequestLoading, setPrivacyRequestLoading] = useState(false);

  const notificationPrefsFromDriver = useMemo(() => {
    return normalizeNotificationPreferences(
      driver?.custom_values &&
        typeof driver.custom_values === 'object' &&
        !Array.isArray(driver.custom_values)
        ? (driver.custom_values as Record<string, unknown>).notification_preferences
        : null,
    );
  }, [driver?.custom_values]);

  useEffect(() => {
    setNotificationPrefs(notificationPrefsFromDriver);
  }, [notificationPrefsFromDriver]);

  const getAccessToken = useCallback(async () => {
    const {
      data: { session },
    } = await supabase.auth.getSession();
    return session?.access_token ?? '';
  }, []);

  const loadProfileData = useCallback(async () => {
    if (!driver?.id) return;

    const accessToken = await getAccessToken();
    const [{ data: documentRows }, { count }, profileResponse] = await Promise.all([
      supabase
        .from('driver_documents')
        .select('type, file_url, uploaded_at')
        .eq('driver_id', driver.id),
      supabase
        .from('contracts')
        .select('id', { count: 'exact', head: true })
        .eq('driver_id', driver.id)
        .in('status', ['sent', 'viewed']),
      fetch(`${APP_URL}/api/drivers/me`, {
        headers: {
          Authorization: `Bearer ${accessToken}`,
        },
      }),
    ]);

    if (documentRows) {
      const next: Record<string, { url: string; date: string }> = {};
      for (const document of documentRows) {
        next[document.type as string] = {
          url: document.file_url as string,
          date: new Date(document.uploaded_at as string).toLocaleDateString('ko-KR'),
        };
      }
      setDocuments(next);
    }

    setUnsignedContracts(count ?? 0);

    if (profileResponse.ok) {
      const payload = await profileResponse.json().catch(() => ({}));
      if (payload?.data && driver) {
        const nextCustomValues =
          payload.data.custom_values &&
          typeof payload.data.custom_values === 'object' &&
          !Array.isArray(payload.data.custom_values)
            ? (payload.data.custom_values as Record<string, unknown>)
            : driver.custom_values;

        setDriver({
          ...driver,
          ...payload.data,
          custom_values: nextCustomValues,
        });
      }
    }
  }, [driver, getAccessToken, setDriver]);

  useEffect(() => {
    void loadProfileData();
  }, [loadProfileData]);

  const handleDocUpload = async (docType: DocumentType, label: string) => {
    if (!driver?.id) return;

    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ['images'],
      allowsEditing: false,
      quality: 0.8,
    });

    if (result.canceled || !result.assets?.[0]) return;

    setUploading(docType);
    try {
      const asset = result.assets[0];
      const ext = asset.uri.split('.').pop() ?? 'jpg';
      const fileName = `driver-docs/${driver.id}/${docType}_${Date.now()}.${ext}`;

      const response = await fetch(asset.uri);
      const blob = await response.blob();

      const { error: uploadError } = await supabase.storage
        .from('documents')
        .upload(fileName, blob, { contentType: `image/${ext}`, upsert: true });

      if (uploadError) {
        Alert.alert('업로드 실패', uploadError.message);
        return;
      }

      const { data: urlData } = await supabase.storage.from('documents').createSignedUrl(fileName, 3600);

      await supabase.from('driver_documents').delete().eq('driver_id', driver.id).eq('type', docType);

      await supabase.from('driver_documents').insert({
        driver_id: driver.id,
        type: docType,
        title: label,
        file_url: urlData?.signedUrl ?? '',
      });

      await loadProfileData();
      Alert.alert('업로드 완료', `${label} 업로드가 완료되었습니다.`);
    } catch {
      Alert.alert('오류', '파일 업로드 중 문제가 발생했습니다.');
    } finally {
      setUploading(null);
    }
  };

  const updateNotificationPreference = useCallback(
    async (key: keyof NotificationPreferences, value: boolean) => {
      if (!driver) return;

      const previous = notificationPrefs;
      const next = {
        ...previous,
        [key]: value,
      };

      setNotificationPrefs(next);
      setNotificationSavingKey(key);

      try {
        const accessToken = await getAccessToken();
        const response = await fetch(`${APP_URL}/api/drivers/update-self`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${accessToken}`,
          },
          body: JSON.stringify({
            notification_preferences: next,
          }),
        });

        const payload = await response.json().catch(() => ({}));
        if (!response.ok) {
          setNotificationPrefs(previous);
          Alert.alert('저장 실패', payload?.error || '알림 설정을 저장하지 못했습니다.');
          return;
        }

        const customValues =
          driver.custom_values &&
          typeof driver.custom_values === 'object' &&
          !Array.isArray(driver.custom_values)
            ? (driver.custom_values as Record<string, unknown>)
            : {};

        setDriver({
          ...driver,
          custom_values: {
            ...customValues,
            notification_preferences: next,
          },
        });
      } catch {
        setNotificationPrefs(previous);
        Alert.alert('오류', '알림 설정 저장 중 문제가 발생했습니다.');
      } finally {
        setNotificationSavingKey(null);
      }
    },
    [driver, getAccessToken, notificationPrefs, setDriver],
  );

  const submitDeletionRequest = useCallback(async () => {
    setPrivacyRequestLoading(true);
    try {
      const accessToken = await getAccessToken();
      const response = await fetch(`${APP_URL}/api/user-data`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${accessToken}`,
        },
        body: JSON.stringify({ action: 'delete_request' }),
      });

      const payload = await response.json().catch(() => ({}));
      if (!response.ok) {
        Alert.alert('요청 실패', payload?.error || '삭제 요청을 접수하지 못했습니다.');
        return;
      }

      Alert.alert('접수 완료', payload?.message || '개인정보 삭제 요청이 접수되었습니다.');
    } catch {
      Alert.alert('오류', '요청 접수 중 문제가 발생했습니다.');
    } finally {
      setPrivacyRequestLoading(false);
    }
  }, [getAccessToken]);

  const handlePrivacyRequestPress = useCallback(() => {
    Alert.alert('개인정보 관리', '원하시는 작업을 선택해 주세요.', [
      { text: '취소', style: 'cancel' },
      {
        text: '정보 수정',
        onPress: () => router.push('/profile/edit'),
      },
      {
        text: '삭제 요청',
        style: 'destructive',
        onPress: () => void submitDeletionRequest(),
      },
    ]);
  }, [router, submitDeletionRequest]);

  const getInitials = (name: string | undefined): string => {
    if (!name) return '?';
    return name.slice(0, 1);
  };

  const handleSignOut = () => {
    Alert.alert('로그아웃', '로그아웃 하시겠습니까?', [
      { text: '취소', style: 'cancel' },
      { text: '로그아웃', style: 'destructive', onPress: () => void signOut() },
    ]);
  };

  const handleMenuPress = (itemId: string) => {
    if (itemId === 'info') {
      router.push('/profile/edit');
      return;
    }
    if (itemId === 'phone') {
      router.push('/profile/edit?section=contact');
      return;
    }
    if (itemId === 'vehicle') {
      router.push('/profile/edit?section=vehicle');
      return;
    }
    if (itemId === 'documents') {
      router.push('/documents');
      return;
    }
    if (itemId === 'seal') {
      router.push('/seal');
    }
  };

  const joinDateFormatted = driver?.created_at
    ? new Date(driver.created_at).toLocaleDateString('ko-KR', {
        year: 'numeric',
        month: 'long',
        day: 'numeric',
      })
    : '-';

  const activityStatus = driver?.status === 'active' ? '활성' : '대기';

  return (
    <SafeAreaView style={styles.container}>
      <ScrollView
        style={styles.scrollView}
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
      >
        <GradientView style={styles.profileHeader}>
          <View style={styles.avatarContainer}>
            <Text style={styles.avatarText}>{getInitials(driver?.name)}</Text>
          </View>
          <Text style={styles.profileName}>{driver?.name ?? '기사'}</Text>
          <Text style={styles.profileAgency}>{driver?.agency_name ?? '소속 정보 없음'}</Text>
        </GradientView>

        <View style={styles.statsRow}>
          <View style={styles.statItem}>
            <Text style={styles.statLabel}>가입일</Text>
            <Text style={styles.statValue}>{joinDateFormatted}</Text>
          </View>
          <View style={styles.statDivider} />
          <View style={styles.statItem}>
            <Text style={styles.statLabel}>활동상태</Text>
            <Text style={[styles.statValue, styles.statActive]}>{activityStatus}</Text>
          </View>
          <View style={styles.statDivider} />
          <View style={styles.statItem}>
            <Text style={styles.statLabel}>미서명 계약</Text>
            <Text style={[styles.statValue, styles.statWarning]}>{unsignedContracts}건</Text>
          </View>
        </View>

        <View style={styles.sectionCard}>
          <Text style={styles.sectionTitle}>프로필 메뉴</Text>
          {MENU_ITEMS.map((item) => (
            <TouchableOpacity
              key={item.id}
              style={styles.menuItem}
              activeOpacity={0.7}
              onPress={() => handleMenuPress(item.id)}
            >
              <View style={styles.menuLeft}>
                <MaterialIcons name={item.icon} size={22} color={colors.onSurfaceVariant} />
                <Text style={styles.menuLabel}>{item.label}</Text>
              </View>
              <MaterialIcons name="chevron-right" size={22} color={colors.outline} />
            </TouchableOpacity>
          ))}
        </View>

        <View style={styles.sectionCard}>
          <Text style={styles.sectionTitle}>서류 관리</Text>
          <Text style={styles.sectionDesc}>
            필수 서류를 촬영하거나 앨범에서 선택해 업로드할 수 있습니다.
          </Text>
          {DOC_UPLOAD_ITEMS.map((item) => {
            const document = documents[item.id];
            const isUploading = uploading === item.type;

            return (
              <TouchableOpacity
                key={item.id}
                style={styles.docItem}
                activeOpacity={0.7}
                onPress={() => void handleDocUpload(item.type, item.label)}
                disabled={isUploading}
              >
                <View style={styles.menuLeft}>
                  <View style={[styles.docIconWrap, document ? styles.docIconDone : styles.docIconEmpty]}>
                    <MaterialIcons
                      name={document ? 'check-circle' : item.icon}
                      size={22}
                      color={document ? colors.tertiary : colors.onSurfaceVariant}
                    />
                  </View>
                  <View>
                    <Text style={styles.menuLabel}>{item.label}</Text>
                    {document ? (
                      <Text style={styles.docDate}>업로드일 {document.date}</Text>
                    ) : (
                      <Text style={styles.docEmpty}>미등록</Text>
                    )}
                  </View>
                </View>
                {isUploading ? (
                  <ActivityIndicator size="small" color={colors.primary} />
                ) : (
                  <View style={styles.docUploadBtn}>
                    <MaterialIcons
                      name={document ? 'refresh' : 'file-upload'}
                      size={18}
                      color={document ? colors.onSurfaceVariant : colors.primary}
                    />
                    <Text style={[styles.docUploadText, document ? styles.docReupload : null]}>
                      {document ? '재업로드' : '업로드'}
                    </Text>
                  </View>
                )}
              </TouchableOpacity>
            );
          })}
        </View>

        <View style={styles.sectionCard}>
          <Text style={styles.sectionTitle}>알림 설정</Text>

          <View style={styles.toggleItem}>
            <Text style={styles.toggleLabel}>정산서 알림</Text>
            <Switch
              value={notificationPrefs.settlement}
              onValueChange={(value) => void updateNotificationPreference('settlement', value)}
              trackColor={{ false: colors.surfaceContainerHigh, true: `${colors.primary}66` }}
              thumbColor={notificationPrefs.settlement ? colors.primary : colors.outline}
              disabled={notificationSavingKey !== null}
            />
          </View>

          <View style={styles.toggleItem}>
            <Text style={styles.toggleLabel}>공지사항 알림</Text>
            <Switch
              value={notificationPrefs.notice}
              onValueChange={(value) => void updateNotificationPreference('notice', value)}
              trackColor={{ false: colors.surfaceContainerHigh, true: `${colors.primary}66` }}
              thumbColor={notificationPrefs.notice ? colors.primary : colors.outline}
              disabled={notificationSavingKey !== null}
            />
          </View>

          <View style={styles.toggleItem}>
            <Text style={styles.toggleLabel}>계약서 알림</Text>
            <Switch
              value={notificationPrefs.contract}
              onValueChange={(value) => void updateNotificationPreference('contract', value)}
              trackColor={{ false: colors.surfaceContainerHigh, true: `${colors.primary}66` }}
              thumbColor={notificationPrefs.contract ? colors.primary : colors.outline}
              disabled={notificationSavingKey !== null}
            />
          </View>

          {notificationSavingKey ? (
            <Text style={styles.helperText}>알림 설정을 저장하는 중입니다.</Text>
          ) : null}
        </View>

        <View style={styles.sectionCard}>
          <Text style={styles.sectionTitle}>개인정보 관리</Text>

          <TouchableOpacity
            style={styles.menuItem}
            activeOpacity={0.7}
            onPress={handlePrivacyRequestPress}
            disabled={privacyRequestLoading}
          >
            <View style={styles.menuLeft}>
              <MaterialIcons name="manage-accounts" size={22} color={colors.onSurfaceVariant} />
              <Text style={styles.menuLabel}>수정/삭제 요청</Text>
            </View>
            {privacyRequestLoading ? (
              <ActivityIndicator size="small" color={colors.primary} />
            ) : (
              <MaterialIcons name="chevron-right" size={22} color={colors.outline} />
            )}
          </TouchableOpacity>

          <TouchableOpacity
            style={styles.menuItem}
            activeOpacity={0.7}
            onPress={() => void Linking.openURL('https://logissign.com/privacy')}
          >
            <View style={styles.menuLeft}>
              <MaterialIcons name="policy" size={22} color={colors.onSurfaceVariant} />
              <Text style={styles.menuLabel}>개인정보처리방침</Text>
            </View>
            <MaterialIcons name="chevron-right" size={22} color={colors.outline} />
          </TouchableOpacity>
        </View>

        <View style={styles.sectionCard}>
          <Text style={styles.sectionTitle}>앱 정보</Text>
          {APP_INFO_ITEMS.map((item) =>
            item.id === 'version' ? (
              <View key={item.id} style={styles.menuItemStatic}>
                <View style={styles.menuLeft}>
                  <MaterialIcons name={item.icon} size={22} color={colors.onSurfaceVariant} />
                  <Text style={styles.menuLabel}>{item.label}</Text>
                </View>
                <Text style={styles.versionText}>v1.0.0</Text>
              </View>
            ) : (
              <TouchableOpacity
                key={item.id}
                style={styles.menuItem}
                activeOpacity={0.7}
                onPress={() => {
                  if (item.id === 'terms') {
                    void Linking.openURL('https://logissign.com/terms');
                  }
                  if (item.id === 'privacy') {
                    void Linking.openURL('https://logissign.com/privacy');
                  }
                }}
              >
                <View style={styles.menuLeft}>
                  <MaterialIcons name={item.icon} size={22} color={colors.onSurfaceVariant} />
                  <Text style={styles.menuLabel}>{item.label}</Text>
                </View>
                <MaterialIcons name="chevron-right" size={22} color={colors.outline} />
              </TouchableOpacity>
            ),
          )}
        </View>

        <TouchableOpacity style={styles.logoutButton} onPress={handleSignOut} activeOpacity={0.7}>
          <MaterialIcons name="logout" size={20} color={colors.error} />
          <Text style={styles.logoutText}>로그아웃</Text>
        </TouchableOpacity>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.surface,
  },
  scrollView: {
    flex: 1,
  },
  scrollContent: {
    paddingBottom: spacing['5xl'],
  },
  profileHeader: {
    alignItems: 'center',
    paddingTop: spacing['3xl'],
    paddingBottom: spacing['4xl'],
  },
  avatarContainer: {
    width: 72,
    height: 72,
    borderRadius: 36,
    backgroundColor: 'rgba(255,255,255,0.25)',
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: spacing.md,
  },
  avatarText: {
    ...typography.displayMedium,
    color: colors.surfaceContainerLowest,
  },
  profileName: {
    ...typography.titleLarge,
    color: colors.surfaceContainerLowest,
    marginBottom: spacing.xs,
  },
  profileAgency: {
    ...typography.bodyMedium,
    color: colors.surfaceContainerLowest,
    opacity: 0.8,
  },
  statsRow: {
    flexDirection: 'row',
    backgroundColor: colors.surfaceContainerLowest,
    marginHorizontal: spacing.lg,
    marginTop: -spacing['2xl'],
    borderRadius: borderRadius.lg,
    padding: spacing.lg,
    ...shadows.md,
  },
  statItem: {
    flex: 1,
    alignItems: 'center',
  },
  statDivider: {
    width: 1,
    backgroundColor: colors.outlineVariant,
    opacity: 0.5,
  },
  statLabel: {
    ...typography.labelSmall,
    color: colors.onSurfaceVariant,
    marginBottom: spacing.xs,
  },
  statValue: {
    ...typography.labelLarge,
    color: colors.onSurface,
  },
  statActive: {
    color: colors.tertiary,
  },
  statWarning: {
    color: colors.error,
  },
  sectionCard: {
    backgroundColor: colors.surfaceContainerLowest,
    marginHorizontal: spacing.lg,
    marginTop: spacing.lg,
    borderRadius: borderRadius.lg,
    padding: spacing.lg,
    ...shadows.sm,
  },
  sectionTitle: {
    ...typography.titleSmall,
    color: colors.onSurface,
    marginBottom: spacing.md,
  },
  sectionDesc: {
    ...typography.bodySmall,
    color: colors.onSurfaceVariant,
    marginBottom: spacing.md,
    marginTop: -spacing.sm,
  },
  helperText: {
    ...typography.labelSmall,
    color: colors.onSurfaceVariant,
    marginTop: spacing.sm,
  },
  menuItem: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: spacing.md,
    borderBottomWidth: 1,
    borderBottomColor: `${colors.outlineVariant}40`,
  },
  menuItemStatic: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: spacing.md,
  },
  menuLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
  },
  menuLabel: {
    ...typography.bodyMedium,
    color: colors.onSurface,
  },
  versionText: {
    ...typography.bodySmall,
    color: colors.outline,
  },
  toggleItem: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: spacing.sm,
  },
  toggleLabel: {
    ...typography.bodyMedium,
    color: colors.onSurface,
  },
  docItem: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: spacing.md,
    borderBottomWidth: 1,
    borderBottomColor: `${colors.outlineVariant}40`,
  },
  docIconWrap: {
    width: 42,
    height: 42,
    borderRadius: borderRadius.md,
    justifyContent: 'center',
    alignItems: 'center',
  },
  docIconDone: {
    backgroundColor: colors.tertiaryContainer,
  },
  docIconEmpty: {
    backgroundColor: colors.surfaceContainerLow,
  },
  docDate: {
    ...typography.bodySmall,
    color: colors.onSurfaceVariant,
    marginTop: spacing.xs,
  },
  docEmpty: {
    ...typography.bodySmall,
    color: colors.outline,
    marginTop: spacing.xs,
  },
  docUploadBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
  },
  docUploadText: {
    ...typography.labelMedium,
    color: colors.primary,
  },
  docReupload: {
    color: colors.onSurfaceVariant,
  },
  logoutButton: {
    marginHorizontal: spacing.lg,
    marginTop: spacing.xl,
    marginBottom: spacing['3xl'],
    backgroundColor: colors.errorContainer,
    borderRadius: borderRadius.lg,
    paddingVertical: spacing.md,
    alignItems: 'center',
    justifyContent: 'center',
    flexDirection: 'row',
    gap: spacing.sm,
  },
  logoutText: {
    ...typography.labelLarge,
    color: colors.error,
  },
});
