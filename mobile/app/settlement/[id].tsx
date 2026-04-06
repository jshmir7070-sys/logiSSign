import { useEffect, useState } from 'react';
import { View, Text, ScrollView, StyleSheet, Linking, Alert } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useLocalSearchParams } from 'expo-router';
import Header from '../../components/common/Header';
import Card from '../../components/common/Card';
import Badge from '../../components/common/Badge';
import Button from '../../components/common/Button';
import LoadingSpinner from '../../components/common/LoadingSpinner';
import {
  getSettlementDetail,
  formatKRW,
  statusLabel,
  statusVariant,
  type SettlementWithPrincipal,
} from '../../services/settlement.service';
import { supabase } from '../../lib/supabase';
import { colors, spacing, typography, borderRadius } from '../../constants/theme';

interface DisplayConfig {
  delivery_count: boolean;
  delivery_amount: boolean;
  return_count: boolean;
  return_amount: boolean;
  pickup_count: boolean;
  pickup_amount: boolean;
  fresh_back: boolean;
  incentive_amount: boolean;
  etc_income: boolean;
  deduction_detail: boolean;
  supply_price: boolean;
  tax_amount: boolean;
  total_sum: boolean;
  payment_amount: boolean;
}

const DEFAULT_DISPLAY: DisplayConfig = {
  delivery_count: true,
  delivery_amount: true,
  return_count: false,
  return_amount: false,
  pickup_count: false,
  pickup_amount: false,
  fresh_back: false,
  incentive_amount: false,
  etc_income: false,
  deduction_detail: true,
  supply_price: true,
  tax_amount: true,
  total_sum: true,
  payment_amount: true,
};

export default function SettlementDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const [settlement, setSettlement] = useState<SettlementWithPrincipal | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [display, setDisplay] = useState<DisplayConfig>(DEFAULT_DISPLAY);
  const [openingPdf, setOpeningPdf] = useState(false);

  useEffect(() => {
    if (!id) return;

    getSettlementDetail(id).then(async (res) => {
      if (res.data) {
        setSettlement(res.data);

        if (res.data.principal_id) {
          const { data: principal } = await supabase
            .from('principals')
            .select('field_config')
            .eq('id', res.data.principal_id)
            .single() as { data: { field_config: Record<string, unknown> } | null; error: unknown };

          if (principal?.field_config?.settlement_display && typeof principal.field_config.settlement_display === 'object') {
            setDisplay({
              ...DEFAULT_DISPLAY,
              ...(principal.field_config.settlement_display as Partial<DisplayConfig>),
            });
          }
        }
      }

      if (res.error) setError(res.error);
      setLoading(false);
    });
  }, [id]);

  const handleOpenPdf = async () => {
    if (!settlement?.pdf_url || openingPdf) return;

    setOpeningPdf(true);
    try {
      let openUrl = settlement.pdf_url;

      if (!openUrl.startsWith('http')) {
        const storagePath = openUrl.startsWith('settlements/')
          ? openUrl.slice('settlements/'.length)
          : openUrl;

        const { data: signedData, error: signedError } = await supabase.storage
          .from('settlements')
          .createSignedUrl(storagePath, 3600);

        if (signedError || !signedData?.signedUrl) {
          Alert.alert('PDF 열기 실패', '정산서 PDF 링크를 생성하지 못했습니다.');
          return;
        }

        openUrl = signedData.signedUrl;
      }

      await Linking.openURL(openUrl);
    } catch {
      Alert.alert('PDF 열기 실패', '정산서 PDF를 열지 못했습니다.');
    } finally {
      setOpeningPdf(false);
    }
  };

  if (loading) return <LoadingSpinner fullScreen />;

  if (error || !settlement) {
    return (
      <SafeAreaView style={styles.container}>
        <Header title="정산 상세" showBack />
        <View style={styles.errorWrap}>
          <Text style={styles.errorText}>{error || '정산 정보를 찾을 수 없습니다.'}</Text>
        </View>
      </SafeAreaView>
    );
  }

  const deductions = settlement.deduction_detail ?? {};
  const freshIncentive = Number((settlement as unknown as Record<string, unknown>).fresh_incentive ?? 0);

  return (
    <SafeAreaView style={styles.container}>
      <Header title="정산 상세" showBack />
      <ScrollView contentContainerStyle={styles.content}>
        <Card style={styles.summaryCard}>
          <View style={styles.summaryHeader}>
            <Text style={styles.yearMonth}>{settlement.year_month}</Text>
            <Badge label={statusLabel(settlement.status)} variant={statusVariant(settlement.status)} />
          </View>
          {settlement.principals?.name && (
            <Text style={styles.principalName}>{settlement.principals.name}</Text>
          )}
          <Text style={styles.netAmount}>{formatKRW(settlement.net_amount)}</Text>
          <Text style={styles.netLabel}>지급 총액</Text>
        </Card>

        <Card style={styles.sectionCard}>
          <Text style={styles.sectionTitle}>수입 내역</Text>
          {display.delivery_count && (
            <Row label="배송 건수" value={`${settlement.delivery_count}건`} />
          )}
          {display.delivery_amount && (
            <Row label="기본 금액" value={formatKRW(settlement.base_amount)} />
          )}
          {display.incentive_amount && settlement.incentive_amount > 0 && (
            <Row label="인센티브" value={formatKRW(settlement.incentive_amount)} positive />
          )}
          {display.fresh_back && freshIncentive > 0 && (
            <Row label="프레시백" value={formatKRW(freshIncentive)} positive />
          )}
          {display.tax_amount && settlement.vat_amount > 0 && (
            <Row label="부가세" value={formatKRW(settlement.vat_amount)} />
          )}
          {display.total_sum && (
            <>
              <Divider />
              <Row label="총 수입" value={formatKRW(settlement.total_amount)} bold />
            </>
          )}
        </Card>

        {display.deduction_detail && (
          <Card style={styles.sectionCard}>
            <Text style={styles.sectionTitle}>차감 내역</Text>
            {Object.keys(deductions).length > 0 ? (
              Object.entries(deductions).map(([name, amount]) => (
                <Row key={name} label={name} value={`-${formatKRW(amount)}`} negative />
              ))
            ) : (
              <Text style={styles.noData}>차감 항목 없음</Text>
            )}
            <Divider />
            <Row label="총 차감" value={`-${formatKRW(settlement.total_deduction)}`} negative bold />
          </Card>
        )}

        {display.payment_amount && (
          <Card style={styles.finalCard}>
            <View style={styles.finalRow}>
              <Text style={styles.finalLabel}>최종 지급액</Text>
              <Text style={styles.finalValue}>{formatKRW(settlement.net_amount)}</Text>
            </View>
          </Card>
        )}

        {settlement.pdf_url ? (
          <Button
            title="정산서 PDF 보기"
            variant="outline"
            fullWidth
            loading={openingPdf}
            onPress={handleOpenPdf}
          />
        ) : (
          <View style={styles.noPdfWrap}>
            <Text style={styles.noPdfText}>PDF 정산서가 아직 생성되지 않았습니다.</Text>
          </View>
        )}
      </ScrollView>
    </SafeAreaView>
  );
}

function Row({
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
    <View style={rowStyles.row}>
      <Text style={[rowStyles.label, bold && rowStyles.bold]}>{label}</Text>
      <Text
        style={[
          rowStyles.value,
          bold && rowStyles.bold,
          positive && { color: colors.tertiary },
          negative && { color: colors.error },
        ]}
      >
        {value}
      </Text>
    </View>
  );
}

function Divider() {
  return <View style={rowStyles.divider} />;
}

const rowStyles = StyleSheet.create({
  row: { flexDirection: 'row', justifyContent: 'space-between', paddingVertical: 6 },
  label: { ...typography.bodyMedium, color: colors.onSurfaceVariant },
  value: { ...typography.bodyMedium, color: colors.onSurface, fontFamily: 'Inter' },
  bold: { fontWeight: '700' },
  divider: { height: 1, backgroundColor: colors.outlineVariant, opacity: 0.3, marginVertical: spacing.sm },
});

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.surface },
  content: { padding: spacing.lg, gap: spacing.md, paddingBottom: spacing['5xl'] },
  errorWrap: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  errorText: { ...typography.bodyMedium, color: colors.error },
  summaryCard: { alignItems: 'center', paddingVertical: spacing['3xl'] },
  summaryHeader: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm, marginBottom: spacing.sm },
  yearMonth: { ...typography.titleMedium, color: colors.onSurface },
  principalName: { ...typography.labelMedium, color: colors.onSurfaceVariant, marginBottom: spacing.md },
  netAmount: { ...typography.displayLarge, color: colors.primary, marginTop: spacing.sm },
  netLabel: { ...typography.labelMedium, color: colors.onSurfaceVariant, marginTop: spacing.xs },
  sectionCard: {},
  sectionTitle: { ...typography.titleSmall, color: colors.onSurface, marginBottom: spacing.md },
  noData: { ...typography.bodySmall, color: colors.onSurfaceVariant },
  finalCard: {
    backgroundColor: colors.primary + '08',
    borderWidth: 1,
    borderColor: colors.primary + '20',
    borderRadius: borderRadius.xl,
    padding: spacing.lg,
  },
  finalRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  finalLabel: { ...typography.titleSmall, color: colors.onSurface },
  finalValue: { ...typography.titleLarge, color: colors.primary },
  noPdfWrap: { alignItems: 'center', paddingVertical: spacing.lg },
  noPdfText: { ...typography.bodySmall, color: colors.onSurfaceVariant },
});
