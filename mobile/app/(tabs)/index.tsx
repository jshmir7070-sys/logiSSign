import { useEffect, useState, useCallback } from 'react';
import {
  View,
  Text,
  ScrollView,
  TouchableOpacity,
  StyleSheet,
  FlatList,
  RefreshControl,
  Modal,
  Image,
  Linking,
  Dimensions,
} from 'react-native';
import GradientView from '../../components/common/GradientView';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { MaterialIcons } from '@expo/vector-icons';
import { useAuthStore } from '../../stores/authStore';
import { formatKRW } from '../../lib/formatKRW';
import { getDriverSettlements, type SettlementWithPrincipal } from '../../services/settlement.service';
import { getDriverNotices, categoryLabel } from '../../services/notice.service';
import { supabase } from '../../lib/supabase';
import type { Row } from '../../types/database';
import { colors, spacing, typography, borderRadius, shadows } from '../../constants/theme';

type Notice = Row<'notices'>;

/* ── 배너/팝업 타입 ── */
interface BannerItem {
  id: string;
  type: 'popup' | 'banner';
  image_url: string;
  link_url: string | null;
  is_active: boolean;
}

const { width: SCREEN_WIDTH } = Dimensions.get('window');

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
  { id: '4', icon: 'edit-document', label: '계약서', route: '/(tabs)/contracts' },
];

export default function HomeScreen() {
  const driver = useAuthStore((s) => s.driver);
  const router = useRouter();
  const [settlements, setSettlements] = useState<SettlementWithPrincipal[]>([]);
  const [notices, setNotices] = useState<Notice[]>([]);
  const [refreshing, setRefreshing] = useState(false);
  const [banners, setBanners] = useState<BannerItem[]>([]);
  const [popupBanner, setPopupBanner] = useState<BannerItem | null>(null);
  const [showPopup, setShowPopup] = useState(false);

  const loadData = useCallback(async () => {
    if (driver?.id) {
      const settResult = await getDriverSettlements(driver.id);
      if (settResult.data) setSettlements(settResult.data.slice(0, 3));
    }
    const noticeResult = await getDriverNotices();
    if (noticeResult.data) setNotices(noticeResult.data.slice(0, 3));

    // 배너/팝업 로드
    const { data: bannerData } = await supabase
      .from('notices')
      .select('id, title, attachment_url, appstore_url, category')
      .eq('status', 'published')
      .not('attachment_url', 'is', null)
      .order('published_at', { ascending: false })
      .limit(5);

    if (bannerData) {
      const items: BannerItem[] = bannerData
        .filter((b: Record<string, unknown>) => b.attachment_url)
        .map((b: Record<string, unknown>) => ({
          id: b.id as string,
          type: (b.category === 'update' ? 'popup' : 'banner') as 'popup' | 'banner',
          image_url: b.attachment_url as string,
          link_url: b.appstore_url as string | null,
          is_active: true,
        }));

      const stripBanners = items.filter(b => b.type === 'banner');
      const popup = items.find(b => b.type === 'popup');

      setBanners(stripBanners);
      if (popup) {
        const popupKey = `popup_shown_${popup.id}`;
        const alreadyShown = false; // AsyncStorage 대신 세션 단위
        if (!alreadyShown) {
          setPopupBanner(popup);
          setShowPopup(true);
        }
      }
    }
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
          {/* 운영사 로고 + 상호 */}
          {driver?.agency_name && (
            <View style={styles.agencyRow}>
              {driver?.agency_logo_url ? (
                <Image source={{ uri: driver.agency_logo_url }} style={styles.agencyLogo} resizeMode="contain" />
              ) : null}
              <Text style={styles.agencyName}>{driver.agency_name}</Text>
            </View>
          )}
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

        {/* ── 띠배너 (홈 상단) ── */}
        {banners.length > 0 && (
          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            style={styles.bannerScroll}
            contentContainerStyle={styles.bannerScrollContent}
          >
            {banners.map((banner) => (
              <TouchableOpacity
                key={banner.id}
                activeOpacity={0.9}
                onPress={() => {
                  if (banner.link_url && (banner.link_url.startsWith('https://') || banner.link_url.startsWith('http://'))) {
                    Linking.openURL(banner.link_url);
                  }
                }}
                style={styles.bannerCard}
              >
                <Image
                  source={{ uri: banner.image_url }}
                  style={styles.bannerImage}
                  resizeMode="cover"
                />
              </TouchableOpacity>
            ))}
          </ScrollView>
        )}

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
      {/* ── 팝업 광고 모달 ── */}
      <Modal visible={showPopup} transparent animationType="fade" onRequestClose={() => setShowPopup(false)}>
        <View style={styles.popupOverlay}>
          <View style={styles.popupContainer}>
            {popupBanner && (
              <TouchableOpacity
                activeOpacity={0.95}
                onPress={() => {
                  if (popupBanner.link_url && (popupBanner.link_url.startsWith('https://') || popupBanner.link_url.startsWith('http://'))) {
                    Linking.openURL(popupBanner.link_url);
                  }
                  setShowPopup(false);
                }}
              >
                <Image
                  source={{ uri: popupBanner.image_url }}
                  style={styles.popupImage}
                  resizeMode="contain"
                />
              </TouchableOpacity>
            )}
            <View style={styles.popupButtons}>
              <TouchableOpacity onPress={() => setShowPopup(false)} style={styles.popupCloseBtn}>
                <Text style={styles.popupCloseText}>닫기</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>
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
  agencyRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    marginBottom: spacing.md,
  },
  agencyLogo: {
    width: 28,
    height: 28,
    borderRadius: borderRadius.sm,
  },
  agencyName: {
    ...typography.labelMedium,
    color: colors.surfaceContainerLowest,
    opacity: 0.9,
    fontWeight: '700',
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
  /* ── 띠배너 ── */
  bannerScroll: {
    marginTop: spacing.lg,
  },
  bannerScrollContent: {
    paddingHorizontal: spacing.lg,
    gap: spacing.md,
  },
  bannerCard: {
    borderRadius: borderRadius.lg,
    overflow: 'hidden',
    ...shadows.sm,
  },
  bannerImage: {
    width: SCREEN_WIDTH - spacing.lg * 2,
    height: 80,
    borderRadius: borderRadius.lg,
  },
  /* ── 팝업 광고 ── */
  popupOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.6)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: spacing['2xl'],
  },
  popupContainer: {
    backgroundColor: colors.surfaceContainerLowest,
    borderRadius: borderRadius.xl,
    overflow: 'hidden',
    width: '100%',
    maxWidth: 340,
  },
  popupImage: {
    width: '100%',
    height: 400,
  },
  popupButtons: {
    flexDirection: 'row',
    borderTopWidth: 1,
    borderTopColor: colors.outlineVariant + '30',
  },
  popupCloseBtn: {
    flex: 1,
    paddingVertical: spacing.lg,
    alignItems: 'center',
  },
  popupCloseText: {
    ...typography.labelLarge,
    color: colors.onSurfaceVariant,
  },
});
