import { useEffect, useState } from 'react';
import { ScrollView, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useLocalSearchParams } from 'expo-router';

import Header from '../../components/common/Header';
import LoadingSpinner from '../../components/common/LoadingSpinner';
import EmptyState from '../../components/common/EmptyState';
import { borderRadius, colors, shadows, spacing, typography } from '../../constants/theme';
import { useAuthStore } from '../../stores/authStore';
import {
  getDriverTaxInvoiceDetail,
  taxInvoiceStatusLabel,
  taxInvoiceTypeLabel,
  type DriverTaxInvoice,
} from '../../services/tax-invoice.service';

function formatAmount(amount: number): string {
  return `₩${amount.toLocaleString('ko-KR')}`;
}

function InfoRow({ label, value }: { label: string; value: string }) {
  return (
    <View style={styles.infoRow}>
      <Text style={styles.infoLabel}>{label}</Text>
      <Text style={styles.infoValue}>{value}</Text>
    </View>
  );
}

export default function TaxInvoiceDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const driver = useAuthStore((state) => state.driver);
  const [loading, setLoading] = useState(true);
  const [invoice, setInvoice] = useState<DriverTaxInvoice | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    async function load() {
      if (!driver?.id || !id) return;

      const result = await getDriverTaxInvoiceDetail(driver.id, id);
      if (result.error) {
        setError(result.error);
      } else {
        setInvoice(result.data);
      }
      setLoading(false);
    }

    void load();
  }, [driver?.id, id]);

  if (loading) {
    return <LoadingSpinner fullScreen />;
  }

  if (!invoice) {
    return (
      <SafeAreaView style={styles.container}>
        <Header title="세금계산서 상세" showBack />
        <EmptyState
          emoji="🧾"
          title="세금계산서를 찾지 못했습니다"
          description={error ?? '선택한 세금계산서를 불러올 수 없습니다.'}
        />
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.container}>
      <Header title="세금계산서 상세" showBack />

      <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
        <View style={styles.heroCard}>
          <Text style={styles.heroTitle}>{invoice.year_month} 세금계산서</Text>
          <Text style={styles.heroSubtitle}>
            {taxInvoiceTypeLabel(invoice.invoice_type)} · {taxInvoiceStatusLabel(invoice.status)}
          </Text>
          <Text style={styles.heroAmount}>{formatAmount(invoice.total_amount)}</Text>
        </View>

        <View style={styles.section}>
          <Text style={styles.sectionTitle}>공급자 정보</Text>
          <InfoRow label="기사명" value={invoice.drivers?.name ?? '-'} />
          <InfoRow label="사업자번호" value={invoice.drivers?.business_reg_number ?? '-'} />
          <InfoRow label="대표자명" value={invoice.drivers?.representative_name ?? '-'} />
        </View>

        <View style={styles.section}>
          <Text style={styles.sectionTitle}>세금계산서 정보</Text>
          <InfoRow label="공급가액" value={formatAmount(invoice.supply_amount)} />
          <InfoRow label="세액" value={formatAmount(invoice.tax_amount)} />
          <InfoRow label="합계" value={formatAmount(invoice.total_amount)} />
          <InfoRow label="발행일" value={invoice.issued_at ? new Date(invoice.issued_at).toLocaleDateString('ko-KR') : '-'} />
          <InfoRow label="상태" value={taxInvoiceStatusLabel(invoice.status)} />
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
  content: {
    padding: spacing.lg,
    gap: spacing.md,
  },
  heroCard: {
    backgroundColor: colors.primary,
    borderRadius: borderRadius.xl,
    padding: spacing.xl,
    ...shadows.card,
  },
  heroTitle: {
    ...typography.titleMedium,
    color: colors.onPrimary,
  },
  heroSubtitle: {
    marginTop: 4,
    ...typography.bodySmall,
    color: colors.onPrimaryContainer,
  },
  heroAmount: {
    marginTop: spacing.lg,
    ...typography.displayMedium,
    color: colors.onPrimary,
  },
  section: {
    backgroundColor: colors.surfaceContainerLowest,
    borderRadius: borderRadius.lg,
    padding: spacing.lg,
    ...shadows.card,
  },
  sectionTitle: {
    ...typography.titleSmall,
    color: colors.onSurface,
    marginBottom: spacing.md,
  },
  infoRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    gap: spacing.md,
    paddingVertical: spacing.sm,
    borderBottomWidth: 1,
    borderBottomColor: `${colors.outlineVariant}40`,
  },
  infoLabel: {
    ...typography.bodySmall,
    color: colors.onSurfaceVariant,
  },
  infoValue: {
    flex: 1,
    textAlign: 'right',
    ...typography.bodyMedium,
    color: colors.onSurface,
  },
});
