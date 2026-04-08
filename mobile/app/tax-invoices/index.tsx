import { useEffect, useState } from 'react';
import { FlatList, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';

import Header from '../../components/common/Header';
import LoadingSpinner from '../../components/common/LoadingSpinner';
import EmptyState from '../../components/common/EmptyState';
import { borderRadius, colors, shadows, spacing, typography } from '../../constants/theme';
import { useAuthStore } from '../../stores/authStore';
import {
  getDriverTaxInvoices,
  taxInvoiceStatusLabel,
  taxInvoiceTypeLabel,
  type DriverTaxInvoice,
} from '../../services/tax-invoice.service';

function formatAmount(amount: number): string {
  return `₩${amount.toLocaleString('ko-KR')}`;
}

export default function TaxInvoiceListScreen() {
  const router = useRouter();
  const driver = useAuthStore((state) => state.driver);
  const [loading, setLoading] = useState(true);
  const [invoices, setInvoices] = useState<DriverTaxInvoice[]>([]);

  useEffect(() => {
    async function load() {
      if (!driver?.id) return;

      const result = await getDriverTaxInvoices(driver.id);
      if (result.data) {
        setInvoices(result.data.filter((invoice) => invoice.status !== 'cancelled'));
      }
      setLoading(false);
    }

    void load();
  }, [driver?.id]);

  if (loading) {
    return <LoadingSpinner fullScreen />;
  }

  return (
    <SafeAreaView style={styles.container}>
      <Header title="세금계산서" showBack />

      <FlatList
        data={invoices}
        keyExtractor={(item) => item.id}
        contentContainerStyle={styles.content}
        ListEmptyComponent={
          <EmptyState
            emoji="🧾"
            title="세금계산서가 없습니다"
            description="발행 완료된 세금계산서가 있으면 여기에서 바로 확인할 수 있습니다."
          />
        }
        renderItem={({ item }) => (
          <TouchableOpacity
            activeOpacity={0.8}
            style={styles.card}
            onPress={() => router.push(`/tax-invoices/${item.id}` as never)}
          >
            <View style={styles.cardHeader}>
              <View style={styles.iconWrap}>
                <Ionicons name="receipt-outline" size={20} color={colors.primary} />
              </View>
              <View style={styles.cardBody}>
                <Text style={styles.title}>{item.year_month} 세금계산서</Text>
                <Text style={styles.subtitle}>
                  {taxInvoiceTypeLabel(item.invoice_type)} · {taxInvoiceStatusLabel(item.status)}
                </Text>
              </View>
              <Ionicons name="chevron-forward" size={18} color={colors.outline} />
            </View>

            <View style={styles.metaRow}>
              <Text style={styles.metaLabel}>공급가액</Text>
              <Text style={styles.metaValue}>{formatAmount(item.supply_amount)}</Text>
            </View>
            <View style={styles.metaRow}>
              <Text style={styles.metaLabel}>세액</Text>
              <Text style={styles.metaValue}>{formatAmount(item.tax_amount)}</Text>
            </View>
            <View style={styles.metaRow}>
              <Text style={styles.metaLabel}>합계</Text>
              <Text style={styles.totalValue}>{formatAmount(item.total_amount)}</Text>
            </View>
          </TouchableOpacity>
        )}
      />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.surface,
  },
  content: {
    padding: spacing.lg,
    gap: spacing.md,
  },
  card: {
    backgroundColor: colors.surfaceContainerLowest,
    borderRadius: borderRadius.lg,
    padding: spacing.lg,
    ...shadows.card,
  },
  cardHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: spacing.md,
  },
  iconWrap: {
    width: 40,
    height: 40,
    borderRadius: 20,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.primaryFixed,
  },
  cardBody: {
    flex: 1,
    marginLeft: spacing.md,
  },
  title: {
    ...typography.titleMedium,
    color: colors.onSurface,
  },
  subtitle: {
    marginTop: 2,
    ...typography.bodySmall,
    color: colors.onSurfaceVariant,
  },
  metaRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginTop: spacing.sm,
  },
  metaLabel: {
    ...typography.bodySmall,
    color: colors.onSurfaceVariant,
  },
  metaValue: {
    ...typography.bodyMedium,
    color: colors.onSurface,
  },
  totalValue: {
    ...typography.titleSmall,
    color: colors.primary,
  },
});
