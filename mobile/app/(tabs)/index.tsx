import { useEffect, useState, useCallback } from 'react';
import {
  View,
  Text,
  ScrollView,
  TouchableOpacity,
  StyleSheet,
  FlatList,
  RefreshControl,
} from 'react-native';
import GradientView from '../../components/common/GradientView';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { MaterialIcons } from '@expo/vector-icons';
import { useAuthStore } from '../../stores/authStore';
import { formatKRW } from '../../lib/formatKRW';
import { getDriverSettlements, type SettlementWithPrincipal } from '../../services/settlement.service';
import { getDriverNotices, categoryLabel } from '../../services/notice.service';
import type { Row } from '../../types/database';
import { colors, spacing, typography, borderRadius, shadows } from '../../constants/theme';

type Notice = Row<'notices'>;

const STATUS_MAP = {
  draft: { label: '미정산', color: colors.error },
  sent: { label: '확인중', color: '#d97706' },
  confirmed: { label: '정산완료', color: colors.tertiary },
} as const;

type QuickItem = {
  id: string;
  icon: 'receipt-long' | 'description' | 'campaign' | 'edit-document';
  label: string;
  route: string;
};

const QUICK_ITEMS: QuickItem[] = [
  { id: '1', icon: 'receipt-long', label: '정산서', route: '/(tabs)/settlement' },
  { id: '2', icon: 'description', label: '세금계산서', route: '/(tabs)/settlement' },
  { id: '3', icon: 'campaign', label: '공지사항', route: '/(tabs)/notice' },
  { id: '4', icon: 'edit-document', label: '계약서', route: '/(tabs)/profile' },
];

export default function HomeScreen() {
  const driver = useAuthStore((s) => s.driver);
  const router = useRouter();
  const [settlements, setSettlements] = useState<SettlementWithPrincipal[]>([]);
  const [notices, setNotices] = useState<Notice[]>([]);
  const [refreshing, setRefreshing] = useState(false);

  const loadData = useCallback(async () => {
    if (driver?.id) {
      const settResult = await getDriverSettlements(driver.id);
      if (settResult.data) setSettlements(settResult.data.slice(0, 3));
    }
    const noticeResult = await getDriverNotices();
    if (noticeResult.data) setNotices(noticeResult.data.slice(0, 3));
  }, [driver?.id]);

  useEffect(() => { loadData(); }, [loadData]);

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    await loadData();
    setRefreshing(false);
  }, [loadData]);

  // 최신 정산 금액 (없으면 0)
  const latestAmount = settlements[0]?.net_amount ?? 0;
  const latestBase = settlements[0]?.base_amount ?? 0;
  const latestIncentive = settlements[0]?.incentive_amount ?? 0;

  const renderSettlementItem = ({ item }: { item: SettlementWithPrincipal }) => {
    const status = item.status as keyof typeof STATUS_MAP;
    const statusInfo = STATUS_MAP[status] ?? STATUS_MAP.draft;
    return (
      <View style={styles.settlementItem}>
        <View style={styles.settlementLeft}>
          <Text style={styles.settlementMonth}>{item.year_month}</Text>
          <Text style={styles.settlementAmount}>{formatKRW(item.net_amount)}</Text>
        </View>
        <View
          style={[styles.statusBadge, { backgroundColor: statusInfo.color + '18' }]}
        >
          <Text style={[styles.statusText, { color: statusInfo.color }]}>
            {statusInfo.label}
          </Text>
        </View>
      </View>
    );
  };

  return (
    <SafeAreaView style={styles.container}>
      <ScrollView
        style={styles.scrollView}
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} />}
      >
        <GradientView style={styles.heroCard}>
          <Text style={styles.heroGreeting}>
            {driver?.name ?? '기사'}님, 안녕하세요
          </Text>
          <Text style={styles.heroLabel}>최근 정산액</Text>
          <Text style={styles.heroAmount}>{formatKRW(latestAmount)}</Text>

          <View style={styles.heroSubRow}>
            <View style={styles.heroSubItem}>
              <Text style={styles.heroSubLabel}>기본급</Text>
              <Text style={styles.heroSubValue}>{formatKRW(latestBase)}</Text>
            </View>
            <View style={styles.heroSubDivider} />
            <View style={styles.heroSubItem}>
              <Text style={styles.heroSubLabel}>인센티브</Text>
              <Text style={styles.heroSubValue}>{formatKRW(latestIncentive)}</Text>
            </View>
          </View>
        </GradientView>

        <View style={styles.quickGrid}>
          {QUICK_ITEMS.map((item) => (
            <TouchableOpacity
              key={item.id}
              style={styles.quickItem}
              onPress={() => router.push(item.route as '/(tabs)/settlement')}
              activeOpacity={0.7}
            >
              <View style={styles.quickIconContainer}>
                <MaterialIcons
                  name={item.icon}
                  size={24}
                  color={colors.primary}
                />
              </View>
              <Text style={styles.quickLabel}>{item.label}</Text>
            </TouchableOpacity>
          ))}
        </View>

        <View style={styles.sectionHeader}>
          <Text style={styles.sectionTitle}>최근 정산</Text>
          <TouchableOpacity onPress={() => router.push('/(tabs)/settlement')}>
            <Text style={styles.seeAll}>전체보기</Text>
          </TouchableOpacity>
        </View>

        <View style={styles.card}>
          <FlatList
            data={settlements}
            renderItem={renderSettlementItem}
            keyExtractor={(item) => item.id}
            scrollEnabled={false}
            ItemSeparatorComponent={() => <View style={styles.separator} />}
            ListEmptyComponent={
              <Text style={{ ...typography.bodySmall, color: colors.outline, textAlign: 'center', padding: spacing.lg }}>
                정산 내역이 없습니다
              </Text>
            }
          />
        </View>

        <View style={styles.sectionHeader}>
          <Text style={styles.sectionTitle}>공지사항</Text>
          <TouchableOpacity onPress={() => router.push('/(tabs)/notice')}>
            <Text style={styles.seeAll}>전체보기</Text>
          </TouchableOpacity>
        </View>

        <View style={styles.card}>
          {notices.length === 0 ? (
            <Text style={{ ...typography.bodySmall, color: colors.outline, textAlign: 'center', padding: spacing.lg }}>
              공지사항이 없습니다
            </Text>
          ) : (
            notices.map((notice) => {
              const cat = categoryLabel((notice as Record<string, unknown>).category as string);
              const publishedAt = (notice as Record<string, unknown>).published_at as string | null;
              const dateStr = publishedAt ? new Date(publishedAt).toLocaleDateString('ko-KR') : '';
              return (
                <View key={notice.id} style={styles.noticeItem}>
                  <View style={styles.noticeLeft}>
                    <View style={styles.noticeCategoryBadge}>
                      <Text style={styles.noticeCategoryText}>{cat}</Text>
                    </View>
                    <Text style={styles.noticeTitle} numberOfLines={1}>
                      {(notice as Record<string, unknown>).title as string}
                    </Text>
                  </View>
                  <Text style={styles.noticeDate}>{dateStr}</Text>
                </View>
              );
            })
          )}
        </View>
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
    paddingHorizontal: spacing.lg,
    paddingBottom: spacing['4xl'],
  },
  heroCard: {
    borderRadius: borderRadius.xl,
    padding: spacing['2xl'],
    marginTop: spacing.lg,
  },
  heroGreeting: {
    ...typography.bodyMedium,
    color: colors.surfaceContainerLowest,
    opacity: 0.85,
    marginBottom: spacing.md,
  },
  heroLabel: {
    ...typography.labelMedium,
    color: colors.surfaceContainerLowest,
    opacity: 0.7,
    marginBottom: spacing.xs,
  },
  heroAmount: {
    ...typography.displayLarge,
    color: colors.surfaceContainerLowest,
    marginBottom: spacing.xl,
  },
  heroSubRow: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(255,255,255,0.15)',
    borderRadius: borderRadius.lg,
    padding: spacing.lg,
  },
  heroSubItem: {
    flex: 1,
    alignItems: 'center',
  },
  heroSubDivider: {
    width: 1,
    height: 32,
    backgroundColor: 'rgba(255,255,255,0.3)',
  },
  heroSubLabel: {
    ...typography.labelSmall,
    color: colors.surfaceContainerLowest,
    opacity: 0.7,
    marginBottom: spacing.xs,
  },
  heroSubValue: {
    ...typography.titleSmall,
    color: colors.surfaceContainerLowest,
  },
  quickGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    marginTop: spacing.xl,
    gap: spacing.md,
  },
  quickItem: {
    width: '47%',
    backgroundColor: colors.surfaceContainerLowest,
    borderRadius: borderRadius.lg,
    padding: spacing.lg,
    alignItems: 'center',
    ...shadows.sm,
  },
  quickIconContainer: {
    width: 48,
    height: 48,
    borderRadius: borderRadius.full,
    backgroundColor: colors.primary + '12',
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: spacing.sm,
  },
  quickLabel: {
    ...typography.labelLarge,
    color: colors.onSurface,
  },
  sectionHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginTop: spacing['2xl'],
    marginBottom: spacing.md,
  },
  sectionTitle: {
    ...typography.titleSmall,
    color: colors.onSurface,
  },
  seeAll: {
    ...typography.labelMedium,
    color: colors.primary,
  },
  card: {
    backgroundColor: colors.surfaceContainerLowest,
    borderRadius: borderRadius.lg,
    padding: spacing.lg,
    ...shadows.sm,
  },
  settlementItem: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: spacing.md,
  },
  settlementLeft: {
    flex: 1,
  },
  settlementMonth: {
    ...typography.bodyMedium,
    color: colors.onSurfaceVariant,
    marginBottom: spacing.xs,
  },
  settlementAmount: {
    ...typography.titleSmall,
    color: colors.onSurface,
  },
  statusBadge: {
    borderRadius: borderRadius.full,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.xs,
  },
  statusText: {
    ...typography.labelSmall,
    fontWeight: '600',
  },
  separator: {
    height: 1,
    backgroundColor: colors.outlineVariant,
    opacity: 0.5,
  },
  noticeItem: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: spacing.md,
  },
  noticeLeft: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
  },
  noticeCategoryBadge: {
    backgroundColor: colors.primary + '12',
    borderRadius: borderRadius.sm,
    paddingHorizontal: spacing.sm,
    paddingVertical: 2,
  },
  noticeCategoryText: {
    ...typography.labelSmall,
    color: colors.primary,
  },
  noticeTitle: {
    ...typography.bodyMedium,
    color: colors.onSurface,
    flex: 1,
  },
  noticeDate: {
    ...typography.labelSmall,
    color: colors.outline,
    marginLeft: spacing.sm,
  },
});
