import { useEffect, useState } from 'react';
import { View, Text, FlatList, TouchableOpacity, StyleSheet } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import Badge from '../../components/common/Badge';
import EmptyState from '../../components/common/EmptyState';
import LoadingSpinner from '../../components/common/LoadingSpinner';
import { useAuthStore } from '../../stores/authStore';
import {
  getDriverContracts,
  contractStatusLabel,
  contractStatusVariant,
  type ContractListItem,
} from '../../services/contract.service';
import {
  getDriverAmendments,
  AMENDMENT_TYPE_LABELS,
  type ContractAmendment,
} from '../../services/amendment.service';
import { colors, spacing, typography, borderRadius, shadows } from '../../constants/theme';

export default function ContractsScreen() {
  const router = useRouter();
  const driver = useAuthStore((s) => s.driver);
  const [contracts, setContracts] = useState<ContractListItem[]>([]);
  const [amendments, setAmendments] = useState<ContractAmendment[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!driver?.id) return;
    Promise.all([
      getDriverContracts(driver.id),
      getDriverAmendments(driver.id, 'pending'),
    ]).then(([contractRes, amendmentRes]) => {
      if (contractRes.data) setContracts(contractRes.data);
      if (amendmentRes.data) setAmendments(amendmentRes.data);
      setLoading(false);
    });
  }, [driver?.id]);

  const pending = contracts.filter((c) => c.status === 'sent' || c.status === 'viewed');
  const completed = contracts.filter((c) => c.status === 'signed' || c.status === 'expired');

  if (loading) return <LoadingSpinner fullScreen />;

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.headerTitle}>전자계약</Text>
        {pending.length > 0 && (
          <View style={styles.pendingBadge}>
            <Text style={styles.pendingText}>{pending.length}</Text>
          </View>
        )}
      </View>

      <FlatList
        data={contracts}
        keyExtractor={(item) => item.id}
        contentContainerStyle={styles.listContent}
        showsVerticalScrollIndicator={false}
        ListHeaderComponent={
          amendments.length > 0 ? (
            <View style={styles.amendmentSection}>
              <View style={styles.amendmentHeader}>
                <Ionicons name="alert-circle" size={18} color={colors.error} />
                <Text style={styles.amendmentHeaderText}>
                  계약 변경 요청 ({amendments.length}건)
                </Text>
              </View>
              {amendments.map((a) => (
                <TouchableOpacity
                  key={a.id}
                  style={styles.amendmentCard}
                  onPress={() => router.push(`/amendment/${a.id}`)}
                  activeOpacity={0.7}
                >
                  <View style={styles.amendmentCardTop}>
                    <View style={styles.amendmentIcon}>
                      <Ionicons name="swap-horizontal" size={18} color={colors.error} />
                    </View>
                    <View style={{ flex: 1 }}>
                      <Text style={styles.amendmentTitle} numberOfLines={1}>{a.title}</Text>
                      <Text style={styles.amendmentMeta}>
                        {AMENDMENT_TYPE_LABELS[a.amendment_type]} · {a.requested_at ? new Date(a.requested_at).toLocaleDateString('ko-KR') : '-'}
                      </Text>
                    </View>
                    <View style={styles.amendmentAction}>
                      <Text style={styles.amendmentActionText}>확인</Text>
                      <Ionicons name="chevron-forward" size={14} color={colors.error} />
                    </View>
                  </View>
                </TouchableOpacity>
              ))}
            </View>
          ) : null
        }
        ListEmptyComponent={
          <EmptyState emoji="📋" title="계약서가 없습니다" description="운영사에서 계약서를 발송하면 여기에 표시됩니다" />
        }
        renderItem={({ item }) => (
          <TouchableOpacity
            style={styles.card}
            onPress={() => router.push(`/contract/${item.id}`)}
            activeOpacity={0.7}
          >
            <View style={styles.cardTop}>
              <View style={styles.cardIcon}>
                <Ionicons
                  name={item.status === 'signed' ? 'checkmark-circle' : 'document-text-outline'}
                  size={20}
                  color={item.status === 'signed' ? colors.tertiary : colors.primary}
                />
              </View>
              <View style={styles.cardContent}>
                <Text style={styles.cardTitle} numberOfLines={1}>{item.title}</Text>
                <Text style={styles.cardDate}>
                  {item.status === 'signed' && item.signed_at
                    ? `서명: ${new Date(item.signed_at).toLocaleDateString('ko-KR')}`
                    : item.sent_at
                      ? `발송: ${new Date(item.sent_at).toLocaleDateString('ko-KR')}`
                      : new Date(item.created_at).toLocaleDateString('ko-KR')}
                </Text>
              </View>
              <Badge
                label={contractStatusLabel(item.status)}
                variant={contractStatusVariant(item.status)}
              />
            </View>
            {(item.status === 'sent' || item.status === 'viewed') && (
              <View style={styles.signPrompt}>
                <Text style={styles.signPromptText}>서명이 필요합니다</Text>
                <Ionicons name="arrow-forward" size={14} color={colors.primary} />
              </View>
            )}
          </TouchableOpacity>
        )}
      />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.surface },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.lg,
    gap: spacing.sm,
  },
  headerTitle: { ...typography.titleLarge, color: colors.onSurface },
  pendingBadge: {
    backgroundColor: colors.error,
    borderRadius: borderRadius.full,
    width: 22,
    height: 22,
    alignItems: 'center',
    justifyContent: 'center',
  },
  pendingText: { ...typography.labelSmall, color: '#fff', fontWeight: '700' },
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
  cardTop: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
  },
  cardIcon: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: colors.surfaceContainerLow,
    alignItems: 'center',
    justifyContent: 'center',
  },
  cardContent: { flex: 1 },
  cardTitle: { ...typography.bodyMedium, color: colors.onSurface, fontWeight: '500' },
  cardDate: { ...typography.labelSmall, color: colors.onSurfaceVariant, marginTop: 2 },
  signPrompt: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'flex-end',
    marginTop: spacing.md,
    paddingTop: spacing.sm,
    borderTopWidth: 1,
    borderTopColor: colors.outlineVariant + '30',
    gap: spacing.xs,
  },
  signPromptText: { ...typography.labelMedium, color: colors.primary, fontWeight: '600' },
  // 변경 요청 섹션
  amendmentSection: {
    marginBottom: spacing.lg,
    backgroundColor: colors.errorContainer + '20',
    borderRadius: borderRadius.lg,
    padding: spacing.md,
  },
  amendmentHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    marginBottom: spacing.md,
  },
  amendmentHeaderText: {
    ...typography.titleSmall,
    color: colors.error,
    fontWeight: '700',
  },
  amendmentCard: {
    backgroundColor: colors.surfaceContainerLowest,
    borderRadius: borderRadius.md,
    padding: spacing.md,
    marginBottom: spacing.sm,
    borderLeftWidth: 3,
    borderLeftColor: colors.error,
  },
  amendmentCardTop: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
  },
  amendmentIcon: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: colors.errorContainer + '40',
    alignItems: 'center',
    justifyContent: 'center',
  },
  amendmentTitle: {
    ...typography.bodyMedium,
    color: colors.onSurface,
    fontWeight: '600',
  },
  amendmentMeta: {
    ...typography.labelSmall,
    color: colors.onSurfaceVariant,
    marginTop: 2,
  },
  amendmentAction: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 2,
  },
  amendmentActionText: {
    ...typography.labelMedium,
    color: colors.error,
    fontWeight: '600',
  },
});
