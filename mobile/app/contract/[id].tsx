import { useEffect, useState } from 'react';
import { View, Text, ScrollView, StyleSheet, useWindowDimensions, TouchableOpacity, Linking } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { MaterialIcons } from '@expo/vector-icons';
import Header from '../../components/common/Header';
import Button from '../../components/common/Button';
import Badge from '../../components/common/Badge';
import LoadingSpinner from '../../components/common/LoadingSpinner';
import {
  getContractDetail,
  contractStatusLabel,
  contractStatusVariant,
} from '../../services/contract.service';
import type { Row } from '../../types/database';
import { colors, spacing, typography, borderRadius, shadows } from '../../constants/theme';

type Contract = Row<'contracts'>;

/** 계약서 content를 본문 / 별지1(개인정보 수집) / 별지2(제3자 제공)으로 분리 */
function splitContractSections(content: string): {
  body: string;
  privacyCollect: string | null;
  privacyThirdParty: string | null;
} {
  // 구분자: ━━━ 또는 【별지】 또는 [별지]
  const dividerPattern = /━{5,}|─{5,}/g;
  const parts = content.split(dividerPattern).map((s) => s.trim()).filter(Boolean);

  if (parts.length >= 3) {
    return {
      body: parts[0],
      privacyCollect: parts[1],
      privacyThirdParty: parts[2],
    };
  }
  if (parts.length === 2) {
    return { body: parts[0], privacyCollect: parts[1], privacyThirdParty: null };
  }
  return { body: content, privacyCollect: null, privacyThirdParty: null };
}

export default function ContractDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const { width } = useWindowDimensions();
  const [contract, setContract] = useState<Contract | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    if (!id) return;
    getContractDetail(id).then((res) => {
      if (res.data) setContract(res.data);
      if (res.error) setError(res.error);
      setLoading(false);
    });
  }, [id]);

  if (loading) return <LoadingSpinner fullScreen />;
  if (error || !contract) {
    return (
      <SafeAreaView style={styles.container}>
        <Header title="계약서" showBack />
        <View style={styles.center}>
          <Text style={styles.errorText}>{error || '계약서를 찾을 수 없습니다'}</Text>
        </View>
      </SafeAreaView>
    );
  }

  const canSign = contract.status === 'sent' || contract.status === 'viewed';
  const sections = splitContractSections(contract.content ?? '');

  return (
    <SafeAreaView style={styles.container}>
      <Header title="계약서 상세" showBack />

      <ScrollView contentContainerStyle={styles.content}>
        {/* Meta */}
        <View style={styles.metaCard}>
          <Text style={styles.contractTitle}>{contract.title}</Text>
          <Badge
            label={contractStatusLabel(contract.status)}
            variant={contractStatusVariant(contract.status)}
            style={{ marginTop: spacing.sm }}
          />
          {contract.sent_at && (
            <Text style={styles.metaDate}>
              발송일: {new Date(contract.sent_at).toLocaleDateString('ko-KR')}
            </Text>
          )}
          {contract.signed_at && (
            <Text style={styles.metaDate}>
              서명일: {new Date(contract.signed_at).toLocaleDateString('ko-KR')}
            </Text>
          )}
          {contract.status === 'signed' && (contract as unknown as { signed_pdf_url: string | null }).signed_pdf_url && (
            <TouchableOpacity
              style={styles.pdfButton}
              onPress={() => {
                const url = (contract as unknown as { signed_pdf_url: string }).signed_pdf_url;
                if (url) Linking.openURL(url);
              }}
              activeOpacity={0.7}
            >
              <MaterialIcons name="picture-as-pdf" size={16} color={colors.primary} />
              <Text style={styles.pdfButtonText}>서명된 계약서 PDF 보기</Text>
            </TouchableOpacity>
          )}
        </View>

        {/* 계약서 본문 */}
        <View style={styles.sectionHeader}>
          <View style={styles.sectionBadge}>
            <Text style={styles.sectionBadgeText}>계약서</Text>
          </View>
          <Text style={styles.sectionLabel}>위·수탁 표준계약서</Text>
        </View>
        <View style={[styles.contractBody, { maxWidth: width - spacing.lg * 2 }]}>
          <Text style={styles.contractContent}>{sections.body}</Text>
        </View>

        {/* 별지 1: 개인정보 수집·이용 동의서 */}
        {sections.privacyCollect && (
          <>
            <View style={styles.sectionHeader}>
              <View style={[styles.sectionBadge, { backgroundColor: colors.tertiary + '18' }]}>
                <Text style={[styles.sectionBadgeText, { color: colors.tertiary }]}>별지 1</Text>
              </View>
              <Text style={styles.sectionLabel}>개인정보 수집·이용 동의서</Text>
            </View>
            <View style={[styles.contractBody, styles.privacySection, { maxWidth: width - spacing.lg * 2 }]}>
              <Text style={styles.contractContent}>{sections.privacyCollect}</Text>
            </View>
          </>
        )}

        {/* 별지 2: 개인정보 제3자 제공 동의서 */}
        {sections.privacyThirdParty && (
          <>
            <View style={styles.sectionHeader}>
              <View style={[styles.sectionBadge, { backgroundColor: '#d97706' + '18' }]}>
                <Text style={[styles.sectionBadgeText, { color: '#d97706' }]}>별지 2</Text>
              </View>
              <Text style={styles.sectionLabel}>개인정보 제3자 제공 동의서</Text>
            </View>
            <View style={[styles.contractBody, styles.privacySection, { maxWidth: width - spacing.lg * 2 }]}>
              <Text style={styles.contractContent}>{sections.privacyThirdParty}</Text>
            </View>
          </>
        )}

        {/* 서명 안내 */}
        {canSign && (
          <View style={styles.signNotice}>
            <Text style={styles.signNoticeText}>
              아래 버튼을 누르면 동의 체크 및 전자서명 화면으로 이동합니다
            </Text>
          </View>
        )}
      </ScrollView>

      {/* Sign Button */}
      {canSign && (
        <View style={styles.footer}>
          <Button
            title="동의 및 전자서명 하기"
            onPress={() => router.push(`/contract/sign/${contract.id}`)}
            fullWidth
            size="lg"
          />
        </View>
      )}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.surface },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  errorText: { ...typography.bodyMedium, color: colors.error },
  content: { padding: spacing.lg, paddingBottom: 120, gap: spacing.md },
  metaCard: {
    backgroundColor: colors.surfaceContainerLowest,
    borderRadius: borderRadius.xl,
    padding: spacing.lg,
    ...shadows.card,
  },
  contractTitle: { ...typography.titleMedium, color: colors.onSurface },
  metaDate: { ...typography.labelSmall, color: colors.onSurfaceVariant, marginTop: spacing.xs },
  pdfButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
    marginTop: spacing.md,
    backgroundColor: colors.primary + '10',
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    borderRadius: borderRadius.md,
    alignSelf: 'flex-start',
  },
  pdfButtonText: {
    ...typography.labelMedium,
    color: colors.primary,
    fontWeight: '600',
  },
  sectionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    marginTop: spacing.md,
  },
  sectionBadge: {
    backgroundColor: colors.primary + '18',
    borderRadius: borderRadius.sm,
    paddingHorizontal: spacing.sm,
    paddingVertical: 2,
  },
  sectionBadgeText: {
    ...typography.labelSmall,
    color: colors.primary,
    fontWeight: '700',
  },
  sectionLabel: {
    ...typography.labelLarge,
    color: colors.onSurface,
  },
  contractBody: {
    backgroundColor: colors.surfaceContainerLowest,
    borderRadius: borderRadius.xl,
    padding: spacing.lg,
    ...shadows.sm,
  },
  privacySection: {
    borderLeftWidth: 3,
    borderLeftColor: colors.tertiary + '40',
  },
  contractContent: {
    ...typography.bodyMedium,
    color: colors.onSurface,
    lineHeight: 22,
  },
  signNotice: {
    backgroundColor: colors.primaryFixed + '30',
    borderRadius: borderRadius.lg,
    padding: spacing.md,
    alignItems: 'center',
  },
  signNoticeText: {
    ...typography.labelSmall,
    color: colors.primary,
    textAlign: 'center',
  },
  footer: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    padding: spacing.lg,
    paddingBottom: spacing['3xl'],
    backgroundColor: colors.surface,
    borderTopWidth: 1,
    borderTopColor: colors.outlineVariant + '20',
  },
});
