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
import { useRouter } from 'expo-router';
import { MaterialIcons } from '@expo/vector-icons';
import { formatKRW } from '../../lib/formatKRW';
import { useAuthStore } from '../../stores/authStore';
import {
  getDriverSettlements,
  statusLabel,
  statusVariant,
  type SettlementWithPrincipal,
} from '../../services/settlement.service';
import Badge from '../../components/common/Badge';
import { borderRadius, colors, shadows, spacing, typography } from '../../constants/theme';

export default function SettlementScreen() {
  const router = useRouter();
  const driver = useAuthStore((s) => s.driver);
  const [settlements, setSettlements] = useState<SettlementWithPrincipal[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const loadSettlements = useCallback(async () => {
    if (!driver?.id) return;
    const result = await getDriverSettlements(driver.id);
    if (result.data) {
      setSettlements(result.data);
    }
    setLoading(false);
  }, [driver?.id]);

  useEffect(() => {
    void loadSettlements();
  }, [loadSettlements]);

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    await loadSettlements();
    setRefreshing(false);
  }, [loadSettlements]);

  const renderCard = ({ item }: { item: SettlementWithPrincipal }) => {
    const deductions = (item.deduction_detail ?? {}) as Record<string, number>;
    const deductionEntries = Object.entries(deductions);

    return (
      <TouchableOpacity
        style={styles.card}
        onPress={() => router.push(`/settlement/${item.id}` as never)}
        activeOpacity={0.7}
      >
        <View style={styles.cardHeader}>
          <View style={styles.cardHeaderLeft}>
            <Text style={styles.cardMonth}>{item.year_month}</Text>
            <Badge label={statusLabel(item.status)} variant={statusVariant(item.status)} />
          </View>
          {item.principals?.name && <Text style={styles.principalTag}>{item.principals.name}</Text>}
        </View>

        <View style={styles.sectionBlock}>
          <Text style={styles.sectionLabel}>수입</Text>
          <DetailRow label="배송 건수" value={`${item.delivery_count}건`} />
          <DetailRow label="기본금액" value={formatKRW(item.base_amount)} />
          {item.incentive_amount > 0 && (
            <DetailRow label="인센티브" value={`+${formatKRW(item.incentive_amount)}`} positive />
          )}
          {(() => {
            const fi = Number((item as unknown as Record<string, unknown>).fresh_incentive ?? 0);
            return fi > 0 ? <DetailRow label="프레시백" value={`+${formatKRW(fi)}`} positive /> : null;
          })()}
          {(() => {
            const ei = Number((item as unknown as Record<string, unknown>).extra_incentive ?? 0);
            return ei > 0 ? <DetailRow label="추가 인센티브" value={`+${formatKRW(ei)}`} positive /> : null;
          })()}
          <View style={styles.separatorThin} />
          <DetailRow label="총 수입" value={formatKRW(item.total_amount)} bold />
        </View>

        {(deductionEntries.length > 0 || item.total_deduction > 0) && (
          <View style={styles.sectionBlock}>
            <Text style={styles.sectionLabel}>차감</Text>
            {deductionEntries.map(([name, amount]) => (
              <DetailRow key={name} label={name} value={`-${formatKRW(amount)}`} negative />
            ))}
            {item.vat_amount > 0 && (
              <DetailRow label="부가세" value={`-${formatKRW(item.vat_amount)}`} negative />
            )}
            <View style={styles.separatorThin} />
            <DetailRow label="총 차감" value={`-${formatKRW(item.total_deduction)}`} negative bold />
          </View>
        )}

        <View style={styles.finalBlock}>
          <Text style={styles.finalLabel}>최종 지급액</Text>
          <Text style={styles.finalValue}>{formatKRW(item.net_amount)}</Text>
        </View>
      </TouchableOpacity>
    );
  };

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.headerTitle}>정산서</Text>
      </View>

      {loading ? (
        <View style={styles.emptyState}>
          <Text style={styles.emptyText}>불러오는 중...</Text>
        </View>
      ) : (
        <FlatList
          data={settlements}
          renderItem={renderCard}
          keyExtractor={(item) => item.id}
          contentContainerStyle={styles.listContent}
          showsVerticalScrollIndicator={false}
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} />}
          ListEmptyComponent={
            <View style={styles.emptyState}>
              <MaterialIcons name="receipt-long" size={48} color={colors.outline} />
              <Text style={styles.emptyText}>정산 이력이 없습니다</Text>
              <Text style={styles.emptySubText}>
                대리점에서 정산서를 발행하면 여기에서 바로 확인할 수 있습니다.
              </Text>
            </View>
          }
        />
      )}
    </SafeAreaView>
  );
}

function DetailRow({
  label,
  value,
  positive,
  negative,
  bold,
}: {
  label: string;
  value: string;
  positive?: boolean;
  negative?: boolean;
  bold?: boolean;
}) {
  return (
    <View style={detailStyles.row}>
      <Text style={[detailStyles.label, bold && detailStyles.bold]}>{label}</Text>
      <Text
        style={[
          detailStyles.value,
          bold && detailStyles.bold,
          positive && { color: colors.tertiary },
          negative && { color: colors.error },
        ]}
      >
        {value}
      </Text>
    </View>
  );
}

const detailStyles = StyleSheet.create({
  row: { flexDirection: 'row', justifyContent: 'space-between', paddingVertical: 5 },
  label: { ...typography.bodyMedium, color: colors.onSurfaceVariant },
  value: { ...typography.bodyMedium, color: colors.onSurface },
  bold: { fontWeight: '700' },
});

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.surface },
  header: { paddingHorizontal: spacing.lg, paddingVertical: spacing.lg },
  headerTitle: { ...typography.titleLarge, color: colors.onSurface },
  listContent: {
    paddingHorizontal: spacing.lg,
    paddingBottom: spacing['4xl'],
    gap: spacing.md,
  },
  card: {
    backgroundColor: colors.surfaceContainerLowest,
    borderRadius: borderRadius.lg,
    padding: spacing.lg,
    ...shadows.sm,
  },
  cardHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  cardHeaderLeft: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
  cardMonth: { ...typography.bodyMedium, color: colors.onSurface, fontWeight: '600' },
  principalTag: {
    ...typography.labelSmall,
    color: colors.onSurfaceVariant,
    backgroundColor: colors.surfaceContainerLow,
    paddingHorizontal: spacing.sm,
    paddingVertical: 2,
    borderRadius: borderRadius.sm,
    overflow: 'hidden',
  },
  sectionBlock: {
    marginTop: spacing.md,
    paddingTop: spacing.sm,
    borderTopWidth: 1,
    borderTopColor: `${colors.outlineVariant}40`,
  },
  sectionLabel: {
    ...typography.labelMedium,
    color: colors.onSurfaceVariant,
    marginBottom: spacing.xs,
    fontWeight: '600',
  },
  separatorThin: {
    height: 1,
    backgroundColor: colors.outlineVariant,
    opacity: 0.3,
    marginVertical: spacing.xs,
  },
  finalBlock: {
    marginTop: spacing.md,
    paddingTop: spacing.md,
    paddingBottom: spacing.xs,
    borderTopWidth: 1.5,
    borderTopColor: `${colors.primary}30`,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  finalLabel: { ...typography.labelLarge, color: colors.onSurface },
  finalValue: { ...typography.titleMedium, color: colors.primary, fontWeight: '700' },
  emptyState: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: spacing['5xl'],
    gap: spacing.sm,
  },
  emptyText: { ...typography.bodyMedium, color: colors.outline },
  emptySubText: { ...typography.bodySmall, color: colors.outlineVariant, textAlign: 'center' },
});
