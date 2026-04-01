import { useEffect, useState, useCallback } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  FlatList,
  RefreshControl,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { MaterialIcons } from '@expo/vector-icons';
import { colors, spacing, typography, borderRadius, shadows } from '../../constants/theme';
import { getDriverNotices, categoryLabel } from '../../services/notice.service';
import type { Row } from '../../types/database';

type NoticeCategory = '전체' | '공지' | '안내' | '업데이트';
type Notice = Row<'notices'>;

const CATEGORIES: NoticeCategory[] = ['전체', '공지', '안내', '업데이트'];

const CATEGORY_COLORS: Record<string, string> = {
  '공지': colors.primary,
  '안내': colors.tertiary,
  '업데이트': '#d97706',
  '기타': colors.outline,
};

export default function NoticeScreen() {
  const [selectedCategory, setSelectedCategory] = useState<NoticeCategory>('전체');
  const [notices, setNotices] = useState<Notice[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const loadNotices = useCallback(async () => {
    const result = await getDriverNotices();
    if (result.data) setNotices(result.data);
    setLoading(false);
  }, []);

  useEffect(() => { loadNotices(); }, [loadNotices]);

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    await loadNotices();
    setRefreshing(false);
  }, [loadNotices]);

  const filteredNotices =
    selectedCategory === '전체'
      ? notices
      : notices.filter((n) => categoryLabel((n as Record<string, unknown>).category as string) === selectedCategory);

  const renderNoticeItem = ({ item }: { item: Notice }) => {
    const cat = categoryLabel((item as Record<string, unknown>).category as string);
    const borderColor = CATEGORY_COLORS[cat] ?? colors.outline;
    const publishedAt = (item as Record<string, unknown>).published_at as string | null;
    const dateStr = publishedAt ? new Date(publishedAt).toLocaleDateString('ko-KR') : '';

    return (
      <TouchableOpacity style={styles.noticeCard} activeOpacity={0.7}>
        <View style={[styles.noticeLeftBorder, { backgroundColor: borderColor }]} />
        <View style={styles.noticeContent}>
          <View style={styles.noticeTop}>
            <View style={styles.noticeTitleRow}>
              <Text style={styles.noticeTitle} numberOfLines={1}>
                {(item as Record<string, unknown>).title as string}
              </Text>
            </View>
            <Text style={styles.noticeDate}>{dateStr}</Text>
          </View>
          <Text style={styles.noticeSummary} numberOfLines={2}>
            {((item as Record<string, unknown>).content as string)?.slice(0, 80) ?? ''}
          </Text>
          <View style={styles.noticeCategoryBadge}>
            <Text style={[styles.noticeCategoryText, { color: borderColor }]}>
              {cat}
            </Text>
          </View>
        </View>
      </TouchableOpacity>
    );
  };

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.headerTitle}>공지사항</Text>
      </View>

      <View style={styles.categoryTabs}>
        {CATEGORIES.map((cat) => (
          <TouchableOpacity
            key={cat}
            style={[
              styles.categoryTab,
              selectedCategory === cat && styles.categoryTabActive,
            ]}
            onPress={() => setSelectedCategory(cat)}
          >
            <Text
              style={[
                styles.categoryTabText,
                selectedCategory === cat && styles.categoryTabTextActive,
              ]}
            >
              {cat}
            </Text>
          </TouchableOpacity>
        ))}
      </View>

      <FlatList
        data={filteredNotices}
        renderItem={renderNoticeItem}
        keyExtractor={(item) => item.id}
        contentContainerStyle={styles.listContent}
        showsVerticalScrollIndicator={false}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} />}
        ListEmptyComponent={
          <View style={styles.emptyState}>
            <MaterialIcons name="campaign" size={48} color={colors.outline} />
            <Text style={styles.emptyText}>
              {loading ? '불러오는 중...' : '공지사항이 없습니다'}
            </Text>
          </View>
        }
      />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.surface,
  },
  header: {
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.lg,
  },
  headerTitle: {
    ...typography.titleLarge,
    color: colors.onSurface,
  },
  categoryTabs: {
    flexDirection: 'row',
    paddingHorizontal: spacing.lg,
    gap: spacing.sm,
    marginBottom: spacing.md,
  },
  categoryTab: {
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.sm,
    borderRadius: borderRadius.full,
    backgroundColor: colors.surfaceContainerLow,
  },
  categoryTabActive: {
    backgroundColor: colors.primary,
  },
  categoryTabText: {
    ...typography.labelLarge,
    color: colors.onSurfaceVariant,
  },
  categoryTabTextActive: {
    color: colors.surfaceContainerLowest,
  },
  listContent: {
    paddingHorizontal: spacing.lg,
    paddingBottom: spacing['4xl'],
    gap: spacing.md,
  },
  noticeCard: {
    backgroundColor: colors.surfaceContainerLowest,
    borderRadius: borderRadius.lg,
    flexDirection: 'row',
    overflow: 'hidden',
    ...shadows.sm,
  },
  noticeLeftBorder: {
    width: 4,
  },
  noticeContent: {
    flex: 1,
    padding: spacing.lg,
  },
  noticeTop: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: spacing.xs,
  },
  noticeTitleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
    gap: spacing.sm,
  },
  unreadDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: colors.primary,
  },
  noticeTitle: {
    ...typography.bodyMedium,
    color: colors.onSurface,
    flex: 1,
  },
  noticeTitleUnread: {
    fontWeight: '700',
  },
  noticeDate: {
    ...typography.labelSmall,
    color: colors.outline,
    marginLeft: spacing.sm,
  },
  noticeSummary: {
    ...typography.bodySmall,
    color: colors.onSurfaceVariant,
    marginBottom: spacing.sm,
  },
  noticeCategoryBadge: {
    alignSelf: 'flex-start',
  },
  noticeCategoryText: {
    ...typography.labelSmall,
    fontWeight: '600',
  },
  emptyState: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: spacing['5xl'],
  },
  emptyText: {
    ...typography.bodyMedium,
    color: colors.outline,
    marginTop: spacing.md,
  },
});
