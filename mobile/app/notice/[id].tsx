import { useEffect, useState } from 'react';
import {
  View,
  Text,
  ScrollView,
  TouchableOpacity,
  StyleSheet,
  ActivityIndicator,
  Image,
  Dimensions,
} from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import { MaterialIcons } from '@expo/vector-icons';
import { supabase } from '../../lib/supabase';
import { categoryLabel } from '../../services/notice.service';
import { colors, spacing, typography, borderRadius, shadows } from '../../constants/theme';
import type { Row } from '../../types/database';

type Notice = Row<'notices'>;

const CATEGORY_COLORS: Record<string, string> = {
  '공지': colors.primary,
  '안내': colors.tertiary,
  '업데이트': '#d97706',
  '기타': colors.outline,
};

const { width: SCREEN_WIDTH } = Dimensions.get('window');

export default function NoticeDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const [notice, setNotice] = useState<Notice | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (id) {
      loadNotice(id);
    }
  }, [id]);

  const loadNotice = async (noticeId: string) => {
    setLoading(true);
    setError(null);
    try {
      const { data, error: fetchError } = await supabase
        .from('notices')
        .select('*')
        .eq('id', noticeId)
        .single();

      if (fetchError) throw fetchError;
      setNotice(data as Notice);
    } catch (err) {
      setError(err instanceof Error ? err.message : '공지사항을 불러올 수 없습니다');
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return (
      <SafeAreaView style={styles.container}>
        <View style={styles.header}>
          <TouchableOpacity onPress={() => router.back()} style={styles.backBtn}>
            <MaterialIcons name="arrow-back" size={24} color={colors.onSurface} />
          </TouchableOpacity>
          <Text style={styles.headerTitle}>공지사항</Text>
        </View>
        <View style={styles.centerBox}>
          <ActivityIndicator size="large" color={colors.primary} />
          <Text style={styles.loadingText}>불러오는 중...</Text>
        </View>
      </SafeAreaView>
    );
  }

  if (error || !notice) {
    return (
      <SafeAreaView style={styles.container}>
        <View style={styles.header}>
          <TouchableOpacity onPress={() => router.back()} style={styles.backBtn}>
            <MaterialIcons name="arrow-back" size={24} color={colors.onSurface} />
          </TouchableOpacity>
          <Text style={styles.headerTitle}>공지사항</Text>
        </View>
        <View style={styles.centerBox}>
          <MaterialIcons name="error-outline" size={48} color={colors.error} />
          <Text style={styles.errorText}>{error ?? '공지사항을 찾을 수 없습니다'}</Text>
          <TouchableOpacity
            style={styles.retryBtn}
            onPress={() => id && loadNotice(id)}
          >
            <Text style={styles.retryBtnText}>다시 시도</Text>
          </TouchableOpacity>
        </View>
      </SafeAreaView>
    );
  }

  const noticeData = notice as Record<string, unknown>;
  const cat = categoryLabel(noticeData.category as string);
  const badgeColor = CATEGORY_COLORS[cat] ?? colors.outline;
  const publishedAt = noticeData.published_at as string | null;
  const dateStr = publishedAt
    ? new Date(publishedAt).toLocaleDateString('ko-KR', {
        year: 'numeric',
        month: 'long',
        day: 'numeric',
      })
    : '';
  const title = noticeData.title as string;
  const content = noticeData.content as string;
  const attachmentUrl = noticeData.attachment_url as string | null;

  return (
    <SafeAreaView style={styles.container}>
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()} style={styles.backBtn}>
          <MaterialIcons name="arrow-back" size={24} color={colors.onSurface} />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>공지사항</Text>
      </View>

      <ScrollView
        style={styles.scrollView}
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
      >
        {/* Category badge + date */}
        <View style={styles.metaRow}>
          <View style={[styles.categoryBadge, { backgroundColor: badgeColor + '18' }]}>
            <Text style={[styles.categoryBadgeText, { color: badgeColor }]}>{cat}</Text>
          </View>
          <Text style={styles.dateText}>{dateStr}</Text>
        </View>

        {/* Title */}
        <Text style={styles.title}>{title}</Text>

        {/* Divider */}
        <View style={styles.divider} />

        {/* Content */}
        <Text style={styles.content}>{content}</Text>

        {/* Attachment image */}
        {attachmentUrl ? (
          <View style={styles.attachmentContainer}>
            <Image
              source={{ uri: attachmentUrl }}
              style={styles.attachmentImage}
              resizeMode="contain"
            />
          </View>
        ) : null}
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.surface,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.md,
    backgroundColor: colors.surfaceContainerLowest,
    borderBottomWidth: 1,
    borderBottomColor: colors.outlineVariant,
  },
  backBtn: {
    padding: spacing.xs,
    marginRight: spacing.sm,
  },
  headerTitle: {
    ...typography.titleMedium,
    color: colors.onSurface,
  },
  centerBox: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    gap: spacing.md,
  },
  loadingText: {
    ...typography.bodyMedium,
    color: colors.outline,
  },
  errorText: {
    ...typography.bodyMedium,
    color: colors.error,
    textAlign: 'center',
    paddingHorizontal: spacing['3xl'],
  },
  retryBtn: {
    marginTop: spacing.sm,
    paddingHorizontal: spacing.xl,
    paddingVertical: spacing.sm,
    borderRadius: borderRadius.md,
    backgroundColor: colors.primary,
  },
  retryBtnText: {
    ...typography.labelLarge,
    color: colors.onPrimary,
  },
  scrollView: {
    flex: 1,
  },
  scrollContent: {
    padding: spacing.lg,
    paddingBottom: spacing['5xl'],
  },
  metaRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: spacing.md,
  },
  categoryBadge: {
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.xs,
    borderRadius: borderRadius.full,
  },
  categoryBadgeText: {
    ...typography.labelMedium,
    fontWeight: '600',
  },
  dateText: {
    ...typography.labelSmall,
    color: colors.outline,
  },
  title: {
    ...typography.displayMedium,
    color: colors.onSurface,
    marginBottom: spacing.lg,
  },
  divider: {
    height: 1,
    backgroundColor: colors.outlineVariant,
    marginBottom: spacing.lg,
  },
  content: {
    ...typography.bodyLarge,
    color: colors.onSurface,
    lineHeight: 26,
  },
  attachmentContainer: {
    marginTop: spacing.xl,
    borderRadius: borderRadius.lg,
    overflow: 'hidden',
    backgroundColor: colors.surfaceContainerLow,
    ...shadows.sm,
  },
  attachmentImage: {
    width: SCREEN_WIDTH - spacing.lg * 2,
    height: (SCREEN_WIDTH - spacing.lg * 2) * 0.6,
  },
});
