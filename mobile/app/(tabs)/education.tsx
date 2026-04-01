import { useEffect, useState, useCallback } from 'react';
import { View, Text, FlatList, TouchableOpacity, StyleSheet } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { MaterialIcons } from '@expo/vector-icons';
import Badge from '../../components/common/Badge';
import LoadingSpinner from '../../components/common/LoadingSpinner';
import EmptyState from '../../components/common/EmptyState';
import { useAuthStore } from '../../stores/authStore';
import {
  getEducationCourses,
  getEducationRecords,
  CATEGORY_LABELS,
  CATEGORY_ICONS,
  type EducationCourse,
  type EducationRecord,
  type CourseWithRecord,
} from '../../services/education.service';
import { colors, spacing, typography, borderRadius, shadows } from '../../constants/theme';

export default function EducationScreen() {
  const router = useRouter();
  const driver = useAuthStore((s) => s.driver);
  const [courses, setCourses] = useState<CourseWithRecord[]>([]);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    if (!driver?.id || !driver?.agency_id) return;
    const [coursesRes, recordsRes] = await Promise.all([
      getEducationCourses(driver.agency_id),
      getEducationRecords(driver.id),
    ]);

    const records = recordsRes.data ?? [];
    const recordMap = new Map(records.map((r) => [r.course_id, r]));

    const merged: CourseWithRecord[] = (coursesRes.data ?? []).map((c) => ({
      ...c,
      record: recordMap.get(c.id) ?? null,
    }));
    setCourses(merged);
    setLoading(false);
  }, [driver?.id, driver?.agency_id]);

  useEffect(() => { load(); }, [load]);

  const completedCount = courses.filter((c) => c.record?.status === 'completed').length;
  const totalCount = courses.length;

  if (loading) return <LoadingSpinner fullScreen />;

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.headerTitle}>법정 교육</Text>
        {totalCount > 0 && (
          <View style={styles.progressBadge}>
            <Text style={styles.progressText}>{completedCount}/{totalCount} 이수</Text>
          </View>
        )}
      </View>

      <FlatList
        data={courses}
        keyExtractor={(item) => item.id}
        contentContainerStyle={styles.listContent}
        showsVerticalScrollIndicator={false}
        ListEmptyComponent={
          <EmptyState emoji="📚" title="등록된 교육이 없습니다" description="운영사에서 교육을 등록하면 여기에 표시됩니다" />
        }
        renderItem={({ item }) => {
          const record = item.record;
          const isCompleted = record?.status === 'completed';
          const progressPct = record
            ? Math.min(100, Math.round((record.total_study_sec / (item.required_minutes * 60)) * 100))
            : 0;

          return (
            <TouchableOpacity
              style={[styles.card, isCompleted && styles.cardCompleted]}
              onPress={() => router.push(`/education/${item.id}`)}
              activeOpacity={0.7}
            >
              <View style={styles.cardTop}>
                <Text style={styles.cardIcon}>{CATEGORY_ICONS[item.category] ?? '📚'}</Text>
                <View style={styles.cardContent}>
                  <Text style={styles.cardTitle}>{item.title}</Text>
                  <Text style={styles.cardMeta}>
                    {CATEGORY_LABELS[item.category] ?? item.category} · {item.required_minutes}분
                  </Text>
                </View>
                <Badge
                  label={isCompleted ? '이수완료' : record ? `${progressPct}%` : '미수강'}
                  variant={isCompleted ? 'success' : record ? 'warning' : 'default'}
                />
              </View>

              {/* Progress Bar */}
              {!isCompleted && (
                <View style={styles.progressBarBg}>
                  <View style={[styles.progressBarFill, { width: `${progressPct}%` }]} />
                </View>
              )}

              {/* Completed info */}
              {isCompleted && record?.certificate_number && (
                <View style={styles.certRow}>
                  <MaterialIcons name="verified" size={14} color={colors.tertiary} />
                  <Text style={styles.certText}>
                    이수증 {record.certificate_number}
                  </Text>
                  <Text style={styles.certDate}>
                    {record.completed_at ? new Date(record.completed_at).toLocaleDateString('ko-KR') : ''}
                  </Text>
                </View>
              )}
            </TouchableOpacity>
          );
        }}
      />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.surface },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.lg,
  },
  headerTitle: { ...typography.titleLarge, color: colors.onSurface },
  progressBadge: {
    backgroundColor: colors.primary + '15',
    borderRadius: borderRadius.full,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.xs,
  },
  progressText: { ...typography.labelMedium, color: colors.primary, fontWeight: '700' },
  listContent: {
    paddingHorizontal: spacing.lg,
    paddingBottom: spacing['5xl'],
    gap: spacing.md,
  },
  card: {
    backgroundColor: colors.surfaceContainerLowest,
    borderRadius: borderRadius.lg,
    padding: spacing.lg,
    ...shadows.sm,
  },
  cardCompleted: {
    borderLeftWidth: 3,
    borderLeftColor: colors.tertiary,
  },
  cardTop: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
  },
  cardIcon: { fontSize: 28 },
  cardContent: { flex: 1 },
  cardTitle: { ...typography.bodyMedium, color: colors.onSurface, fontWeight: '600' },
  cardMeta: { ...typography.labelSmall, color: colors.onSurfaceVariant, marginTop: 2 },
  progressBarBg: {
    height: 4,
    backgroundColor: colors.surfaceContainerHigh,
    borderRadius: 2,
    marginTop: spacing.md,
    overflow: 'hidden',
  },
  progressBarFill: {
    height: '100%',
    backgroundColor: colors.primary,
    borderRadius: 2,
  },
  certRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
    marginTop: spacing.md,
    paddingTop: spacing.sm,
    borderTopWidth: 1,
    borderTopColor: colors.outlineVariant + '20',
  },
  certText: { ...typography.labelSmall, color: colors.tertiary, fontWeight: '600', flex: 1 },
  certDate: { ...typography.labelSmall, color: colors.onSurfaceVariant },
});
