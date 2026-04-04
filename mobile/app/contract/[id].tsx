import { useEffect, useState, useCallback } from 'react';
import { View, Text, ScrollView, StyleSheet, useWindowDimensions, TouchableOpacity, Linking, Platform, LayoutAnimation, UIManager } from 'react-native';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
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

if (Platform.OS === 'android' && UIManager.setLayoutAnimationEnabledExperimental) {
  UIManager.setLayoutAnimationEnabledExperimental(true);
}

type Contract = Row<'contracts'>;

/** 본문 / 별지 분리 */
interface AnnexSection {
  title: string;
  content: string;
}

function splitContract(content: string): { body: string; annexes: AnnexSection[] } {
  const annexes: AnnexSection[] = [];
  // 【별지】 키워드로 분리
  const idx = content.search(/\n\s*(?:【별지】|【별지\s*\d*】|\[별지\])/);
  if (idx === -1) return { body: content, annexes: [] };

  const body = content.slice(0, idx).trim();
  const annexPart = content.slice(idx).trim();

  // 별지 내부를 개별 섹션으로 분리
  const parts = annexPart.split(/(?=\n\s*(?:【별지】|【별지\s*\d*】|\[별지\]|개인정보\s*제3자\s*제공|고유식별정보\s*제3자))/);
  for (const part of parts) {
    const trimmed = part.trim();
    if (!trimmed) continue;
    // 첫 줄을 제목으로
    const firstNewline = trimmed.indexOf('\n');
    if (firstNewline === -1) {
      annexes.push({ title: trimmed.slice(0, 30), content: trimmed });
    } else {
      const title = trimmed.slice(0, firstNewline).replace(/【|】|\[|\]/g, '').trim();
      annexes.push({ title: title || `별지 ${annexes.length + 1}`, content: trimmed.slice(firstNewline).trim() });
    }
  }

  return { body, annexes };
}

/** 본문에서 당사자 정보 추출 */
function extractParties(text: string): { agency: string; driver: string } {
  let agency = '';
  let driver = '';
  const agencyMatch = text.match(/^(.+?)\s*\(\s*이하/m);
  if (agencyMatch) agency = agencyMatch[1].trim();
  const driverMatch = text.match(/택배종사자인\s+(.+?)\s*\(/);
  if (driverMatch) driver = driverMatch[1].trim();
  return { agency, driver };
}

/** 별지 아코디언 */
function AnnexAccordion({ annex, index }: { annex: AnnexSection; index: number }) {
  const [open, setOpen] = useState(false);
  const toggle = useCallback(() => {
    LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut);
    setOpen(p => !p);
  }, []);

  return (
    <View style={annexStyles.container}>
      <TouchableOpacity style={annexStyles.header} onPress={toggle} activeOpacity={0.7}>
        <View style={annexStyles.badge}>
          <Text style={annexStyles.badgeText}>별지 {index + 1}</Text>
        </View>
        <Text style={annexStyles.title} numberOfLines={1}>{annex.title}</Text>
        <MaterialIcons name={open ? 'expand-less' : 'expand-more'} size={22} color={colors.onSurfaceVariant} />
      </TouchableOpacity>
      {open && (
        <View style={annexStyles.body}>
          <Text style={annexStyles.content}>{annex.content}</Text>
        </View>
      )}
    </View>
  );
}

const annexStyles = StyleSheet.create({
  container: {
    backgroundColor: colors.surfaceContainerLowest,
    borderRadius: borderRadius.xl,
    overflow: 'hidden',
    borderLeftWidth: 3,
    borderLeftColor: colors.tertiary + '40',
    ...shadows.sm,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: spacing.md,
    gap: spacing.sm,
  },
  badge: {
    backgroundColor: colors.tertiary + '18',
    borderRadius: borderRadius.sm,
    paddingHorizontal: spacing.sm,
    paddingVertical: 2,
  },
  badgeText: {
    ...typography.labelSmall,
    color: colors.tertiary,
    fontWeight: '700',
  },
  title: {
    ...typography.labelLarge,
    color: colors.onSurface,
    flex: 1,
  },
  body: {
    paddingHorizontal: spacing.md,
    paddingBottom: spacing.lg,
  },
  content: {
    ...typography.bodyMedium,
    color: colors.onSurface,
    lineHeight: 22,
  },
});

export default function ContractDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const { width } = useWindowDimensions();
  const insets = useSafeAreaInsets();
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
  const { body, annexes } = splitContract(contract.content ?? '');
  const parties = extractParties(contract.content ?? '');

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      <Header title="계약서 상세" showBack />

      <ScrollView contentContainerStyle={styles.content}>
        {/* 계약서 정보 */}
        <View style={styles.metaCard}>
          <Text style={styles.contractTitle}>{contract.title}</Text>
          <Badge
            label={contractStatusLabel(contract.status)}
            variant={contractStatusVariant(contract.status)}
            style={{ marginTop: spacing.sm }}
          />
          {contract.sent_at && (
            <Text style={styles.metaDate}>발송일: {new Date(contract.sent_at).toLocaleDateString('ko-KR')}</Text>
          )}
          {contract.signed_at && (
            <Text style={styles.metaDate}>서명일: {new Date(contract.signed_at).toLocaleDateString('ko-KR')}</Text>
          )}
          {contract.status === 'signed' && (contract as unknown as { signed_pdf_url: string | null }).signed_pdf_url && (
            <TouchableOpacity
              style={styles.pdfButton}
              onPress={() => {
                const pdfUrl = (contract as unknown as { signed_pdf_url: string }).signed_pdf_url;
                if (pdfUrl) Linking.openURL(pdfUrl);
              }}
              activeOpacity={0.7}
            >
              <MaterialIcons name="picture-as-pdf" size={16} color={colors.primary} />
              <Text style={styles.pdfButtonText}>서명된 계약서 PDF 보기</Text>
            </TouchableOpacity>
          )}
        </View>

        {/* 당사자 정보 — 기사만 */}
        {parties.driver ? (
          <View style={styles.partyCard}>
            <View style={styles.partyRow}>
              <View style={styles.partyIcon}>
                <MaterialIcons name="person" size={18} color={colors.tertiary} />
              </View>
              <View>
                <Text style={styles.partyLabel}>서명자 (수탁자)</Text>
                <Text style={styles.partyName}>{parties.driver}</Text>
              </View>
            </View>
          </View>
        ) : null}

        {/* 계약서 본문 — 전문 표시 */}
        <View style={styles.sectionHeader}>
          <View style={styles.sectionBadge}>
            <Text style={styles.sectionBadgeText}>계약서</Text>
          </View>
          <Text style={styles.sectionLabel}>본문</Text>
        </View>
        <View style={[styles.contractBody, { maxWidth: width - spacing.md * 2 }]}>
          <Text style={styles.contractContent}>{body}</Text>
        </View>

        {/* 별지 — 제목 클릭으로 펼치기/접기 */}
        {annexes.length > 0 && (
          <View style={styles.sectionHeader}>
            <View style={[styles.sectionBadge, { backgroundColor: colors.tertiary + '18' }]}>
              <Text style={[styles.sectionBadgeText, { color: colors.tertiary }]}>별지</Text>
            </View>
            <Text style={styles.sectionLabel}>부속 서류 ({annexes.length}건)</Text>
          </View>
        )}
        {annexes.map((annex, i) => (
          <AnnexAccordion key={i} annex={annex} index={i} />
        ))}

        {/* 서명 안내 */}
        {canSign && (
          <View style={styles.signNotice}>
            <Text style={styles.signNoticeText}>
              모든 내용을 확인한 후 아래 버튼을 눌러 전자서명하세요
            </Text>
          </View>
        )}
      </ScrollView>

      {/* 서명 버튼 */}
      {canSign && (
        <View style={[styles.footer, { paddingBottom: Math.max(insets.bottom, Platform.OS === 'android' ? 16 : 0) + spacing.lg }]}>
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
  content: { padding: spacing.md, paddingBottom: spacing.xl, gap: spacing.md },
  metaCard: {
    backgroundColor: colors.surfaceContainerLowest,
    borderRadius: borderRadius.xl,
    padding: spacing.lg,
    ...shadows.card,
  },
  contractTitle: { ...typography.titleMedium, color: colors.onSurface },
  metaDate: { ...typography.labelSmall, color: colors.onSurfaceVariant, marginTop: spacing.xs },
  pdfButton: {
    flexDirection: 'row', alignItems: 'center', gap: spacing.xs,
    marginTop: spacing.md, backgroundColor: colors.primary + '10',
    paddingHorizontal: spacing.md, paddingVertical: spacing.sm,
    borderRadius: borderRadius.md, alignSelf: 'flex-start',
  },
  pdfButtonText: { ...typography.labelMedium, color: colors.primary, fontWeight: '600' },
  partyCard: {
    backgroundColor: colors.surfaceContainerLowest,
    borderRadius: borderRadius.xl,
    padding: spacing.md,
    ...shadows.sm,
  },
  partyRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
  partyIcon: {
    width: 36, height: 36, borderRadius: borderRadius.md,
    backgroundColor: colors.tertiary + '15',
    alignItems: 'center', justifyContent: 'center',
  },
  partyLabel: { ...typography.labelSmall, color: colors.onSurfaceVariant },
  partyName: { ...typography.titleSmall, color: colors.onSurface, marginTop: 1 },
  sectionHeader: {
    flexDirection: 'row', alignItems: 'center', gap: spacing.sm, marginTop: spacing.sm,
  },
  sectionBadge: {
    backgroundColor: colors.primary + '18',
    borderRadius: borderRadius.sm,
    paddingHorizontal: spacing.sm, paddingVertical: 2,
  },
  sectionBadgeText: { ...typography.labelSmall, color: colors.primary, fontWeight: '700' },
  sectionLabel: { ...typography.labelLarge, color: colors.onSurface },
  contractBody: {
    backgroundColor: colors.surfaceContainerLowest,
    borderRadius: borderRadius.xl,
    padding: spacing.lg,
    ...shadows.sm,
  },
  contractContent: {
    ...typography.bodyMedium,
    color: colors.onSurface,
    lineHeight: 22,
  },
  signNotice: {
    backgroundColor: colors.primaryFixed + '30',
    borderRadius: borderRadius.lg,
    padding: spacing.md, alignItems: 'center',
  },
  signNoticeText: { ...typography.labelSmall, color: colors.primary, textAlign: 'center' },
  footer: {
    padding: spacing.lg,
    backgroundColor: colors.surface,
    borderTopWidth: 1,
    borderTopColor: colors.outlineVariant + '20',
  },
});
