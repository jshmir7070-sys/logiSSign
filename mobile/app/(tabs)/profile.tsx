import { useState } from 'react';
import {
  View,
  Text,
  ScrollView,
  TouchableOpacity,
  StyleSheet,
  Switch,
  Alert,
} from 'react-native';
import GradientView from '../../components/common/GradientView';
import { SafeAreaView } from 'react-native-safe-area-context';
import { MaterialIcons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { useAuthStore } from '../../stores/authStore';
import { colors, spacing, typography, borderRadius, shadows } from '../../constants/theme';

interface MenuItem {
  id: string;
  icon: keyof typeof MaterialIcons.glyphMap;
  label: string;
}

const MENU_ITEMS: MenuItem[] = [
  { id: '1', icon: 'person-outline', label: '내 정보' },
  { id: '2', icon: 'phone', label: '연락처' },
  { id: '3', icon: 'directions-car', label: '차량번호' },
  { id: '4', icon: 'folder-open', label: '문서함' },
  { id: '5', icon: 'verified', label: '도장/서명 관리' },
];

const APP_INFO_ITEMS: MenuItem[] = [
  { id: 'version', icon: 'info-outline', label: '버전 정보' },
  { id: 'terms', icon: 'description', label: '이용약관' },
  { id: 'privacy', icon: 'shield', label: '개인정보처리방침' },
];

export default function ProfileScreen() {
  const router = useRouter();
  const { driver, signOut } = useAuthStore();

  const [settlementNotif, setSettlementNotif] = useState(true);
  const [noticeNotif, setNoticeNotif] = useState(true);
  const [contractNotif, setContractNotif] = useState(true);

  const getInitials = (name: string | undefined): string => {
    if (!name) return '?';
    return name.slice(0, 1);
  };

  const handleSignOut = () => {
    Alert.alert('로그아웃', '로그아웃 하시겠습니까?', [
      { text: '취소', style: 'cancel' },
      {
        text: '로그아웃',
        style: 'destructive',
        onPress: () => signOut(),
      },
    ]);
  };

  const joinDateFormatted = driver?.created_at
    ? new Date(driver.created_at).toLocaleDateString('ko-KR', {
        year: 'numeric',
        month: 'long',
        day: 'numeric',
      })
    : '-';

  const contractStatus = driver?.status === 'active' ? '활성' : '대기';

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
          <Text style={styles.profileAgency}>
            {driver?.agency_name ?? '소속 미지정'}
          </Text>
        </GradientView>

        <View style={styles.statsRow}>
          <View style={styles.statItem}>
            <Text style={styles.statLabel}>가입일</Text>
            <Text style={styles.statValue}>{joinDateFormatted}</Text>
          </View>
          <View style={styles.statDivider} />
          <View style={styles.statItem}>
            <Text style={styles.statLabel}>계약상태</Text>
            <Text style={[styles.statValue, styles.statActive]}>{contractStatus}</Text>
          </View>
          <View style={styles.statDivider} />
          <View style={styles.statItem}>
            <Text style={styles.statLabel}>미서명</Text>
            <Text style={[styles.statValue, styles.statWarning]}>2건</Text>
          </View>
        </View>

        <View style={styles.sectionCard}>
          <Text style={styles.sectionTitle}>내 정보</Text>
          {MENU_ITEMS.map((item) => (
            <TouchableOpacity key={item.id} style={styles.menuItem} activeOpacity={0.7}
              onPress={() => {
                if (item.id === '4') router.push('/documents');
                if (item.id === '5') router.push('/seal');
              }}>
              <View style={styles.menuLeft}>
                <MaterialIcons
                  name={item.icon}
                  size={22}
                  color={colors.onSurfaceVariant}
                />
                <Text style={styles.menuLabel}>{item.label}</Text>
              </View>
              <MaterialIcons
                name="chevron-right"
                size={22}
                color={colors.outline}
              />
            </TouchableOpacity>
          ))}
        </View>

        <View style={styles.sectionCard}>
          <Text style={styles.sectionTitle}>알림 설정</Text>

          <View style={styles.toggleItem}>
            <Text style={styles.toggleLabel}>정산서 알림</Text>
            <Switch
              value={settlementNotif}
              onValueChange={setSettlementNotif}
              trackColor={{
                false: colors.surfaceContainerHigh,
                true: colors.primary + '66',
              }}
              thumbColor={settlementNotif ? colors.primary : colors.outline}
            />
          </View>

          <View style={styles.toggleItem}>
            <Text style={styles.toggleLabel}>공지사항 알림</Text>
            <Switch
              value={noticeNotif}
              onValueChange={setNoticeNotif}
              trackColor={{
                false: colors.surfaceContainerHigh,
                true: colors.primary + '66',
              }}
              thumbColor={noticeNotif ? colors.primary : colors.outline}
            />
          </View>

          <View style={styles.toggleItem}>
            <Text style={styles.toggleLabel}>계약서 알림</Text>
            <Switch
              value={contractNotif}
              onValueChange={setContractNotif}
              trackColor={{
                false: colors.surfaceContainerHigh,
                true: colors.primary + '66',
              }}
              thumbColor={contractNotif ? colors.primary : colors.outline}
            />
          </View>
        </View>

        <View style={styles.sectionCard}>
          <Text style={styles.sectionTitle}>앱 정보</Text>
          {APP_INFO_ITEMS.map((item) => (
            <TouchableOpacity key={item.id} style={styles.menuItem} activeOpacity={0.7}>
              <View style={styles.menuLeft}>
                <MaterialIcons
                  name={item.icon}
                  size={22}
                  color={colors.onSurfaceVariant}
                />
                <Text style={styles.menuLabel}>{item.label}</Text>
              </View>
              {item.id === 'version' ? (
                <Text style={styles.versionText}>v1.0.0</Text>
              ) : (
                <MaterialIcons
                  name="chevron-right"
                  size={22}
                  color={colors.outline}
                />
              )}
            </TouchableOpacity>
          ))}
        </View>

        <TouchableOpacity
          style={styles.logoutButton}
          onPress={handleSignOut}
          activeOpacity={0.7}
        >
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
  menuItem: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: spacing.md,
    borderBottomWidth: 1,
    borderBottomColor: colors.outlineVariant + '40',
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
  logoutButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.sm,
    marginHorizontal: spacing.lg,
    marginTop: spacing['2xl'],
    paddingVertical: spacing.lg,
    borderRadius: borderRadius.lg,
    borderWidth: 1,
    borderColor: colors.error,
  },
  logoutText: {
    ...typography.labelLarge,
    color: colors.error,
  },
});
