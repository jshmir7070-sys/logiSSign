import { useState } from 'react';
import {
  View,
  Text,
  ScrollView,
  Alert,
  StyleSheet,
  useWindowDimensions,
  TouchableOpacity,
  Platform,
} from 'react-native';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { MaterialIcons } from '@expo/vector-icons';
import Header from '../../../components/common/Header';
import Button from '../../../components/common/Button';
import SignaturePad from '../../../components/common/SignaturePad';
import { useAuthStore } from '../../../stores/authStore';
import { signContract } from '../../../services/contract.service';
import {
  requestIdentityVerification,
  IDENTITY_PROVIDERS,
  type IdentityProvider,
  type VerificationResult,
} from '../../../services/identity.service';
import { colors, spacing, typography, borderRadius, shadows } from '../../../constants/theme';

interface ConsentItem {
  key: string;
  label: string;
  description: string;
  required: boolean;
}

const CONSENT_ITEMS: ConsentItem[] = [
  {
    key: 'contract',
    label: '계약 내용 동의',
    description: '위·수탁 표준계약서의 전체 내용을 확인하였으며 이에 동의합니다.',
    required: true,
  },
  {
    key: 'privacy_collect',
    label: '개인정보 수집·이용 동의',
    description: '택배 운송 위·수탁계약 체결 및 이행을 위한 개인정보 수집·이용에 동의합니다.',
    required: true,
  },
  {
    key: 'privacy_id',
    label: '고유식별정보(주민등록번호) 수집·이용 동의',
    description: '고용보험, 소득세 신고 등을 위한 주민등록번호 수집·이용에 동의합니다.',
    required: true,
  },
  {
    key: 'privacy_3rd',
    label: '개인정보 제3자 제공 동의',
    description: '국토교통부, 한국교통안전공단 등에 개인정보를 제공하는 것에 동의합니다.',
    required: true,
  },
  {
    key: 'privacy_3rd_id',
    label: '고유식별정보 제3자 제공 동의',
    description: '종사자격 확인을 위해 주민등록번호를 제3자에게 제공하는 것에 동의합니다.',
    required: true,
  },
];

export default function ContractSignScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const driver = useAuthStore((s) => s.driver);
  const { width } = useWindowDimensions();
  const insets = useSafeAreaInsets();
  const [signatureData, setSignatureData] = useState<string | null>(null);
  const [consents, setConsents] = useState<Record<string, boolean>>({});
  const [signing, setSigning] = useState(false);
  const [identityResult, setIdentityResult] = useState<VerificationResult | null>(null);
  const [verifying, setVerifying] = useState(false);

  const padWidth = width - spacing.lg * 2;
  const padHeight = 200;

  const toggleConsent = (key: string) => {
    setConsents((prev) => ({ ...prev, [key]: !prev[key] }));
  };

  const toggleAll = () => {
    const allChecked = CONSENT_ITEMS.every((item) => consents[item.key]);
    const newValue = !allChecked;
    const next: Record<string, boolean> = {};
    for (const item of CONSENT_ITEMS) {
      next[item.key] = newValue;
    }
    setConsents(next);
  };

  const allRequiredChecked = CONSENT_ITEMS
    .filter((item) => item.required)
    .every((item) => consents[item.key]);

  const allChecked = CONSENT_ITEMS.every((item) => consents[item.key]);
  const checkedCount = CONSENT_ITEMS.filter((item) => consents[item.key]).length;

  const canSubmit = allRequiredChecked && !!signatureData && !!identityResult?.verified;

  const handleVerify = async (provider: IdentityProvider) => {
    if (!driver?.name || !driver?.phone) return;
    setVerifying(true);
    const result = await requestIdentityVerification(provider, id ?? '', {
      name: driver.name,
      phone: driver.phone,
    });
    setIdentityResult(result);
    setVerifying(false);
    if (result.verified) {
      Alert.alert('인증 완료', `${provider === 'pass' ? 'PASS' : '카카오'} 본인인증이 완료되었습니다.`);
    } else {
      Alert.alert('인증 실패', result.error ?? '본인인증에 실패했습니다.');
    }
  };

  const handleSign = async () => {
    if (!id || !driver?.id || !signatureData || !allRequiredChecked) return;

    Alert.alert(
      '서명 확인',
      `계약서 및 ${checkedCount}건의 동의 항목에 전자서명합니다.\n서명 후에는 취소할 수 없습니다.`,
      [
        { text: '취소', style: 'cancel' },
        {
          text: '서명하기',
          style: 'default',
          onPress: async () => {
            setSigning(true);
            const { error } = await signContract(
              id,
              driver.id,
              signatureData,
              '0.0.0.0',
              'logiSSign-Mobile-App',
              {
                consent_contract: consents['contract'] ?? false,
                consent_privacy_collect: consents['privacy_collect'] ?? false,
                consent_privacy_id: consents['privacy_id'] ?? false,
                consent_privacy_3rd: consents['privacy_3rd'] ?? false,
                consent_privacy_3rd_id: consents['privacy_3rd_id'] ?? false,
              },
            );
            setSigning(false);

            if (error) {
              Alert.alert('서명 실패', error);
            } else {
              Alert.alert('서명 완료', '계약서 및 동의서에 서명이 완료되었습니다.', [
                { text: '확인', onPress: () => router.back() },
              ]);
            }
          },
        },
      ]
    );
  };

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      <Header title="전자서명" showBack />

      <ScrollView contentContainerStyle={styles.content}>
        {/* Info */}
        <View style={styles.infoCard}>
          <Text style={styles.infoTitle}>서명 안내</Text>
          <Text style={styles.infoText}>
            계약서 내용을 충분히 확인한 후, 아래 동의 항목을 체크하고{'\n'}
            서명란에 이름을 정자로 서명해 주세요.{'\n'}
            전자서명은 법적 효력을 가집니다.
          </Text>
        </View>

        {/* Signer Info */}
        <View style={styles.signerCard}>
          <Text style={styles.signerLabel}>서명자</Text>
          <Text style={styles.signerName}>{driver?.name ?? '-'}</Text>
          <Text style={styles.signerPhone}>{driver?.phone ?? '-'}</Text>
        </View>

        {/* Consent Checkboxes */}
        <View style={styles.consentSection}>
          <View style={styles.consentHeader}>
            <Text style={styles.consentHeaderTitle}>동의 항목</Text>
            <TouchableOpacity onPress={toggleAll} style={styles.selectAllBtn}>
              <MaterialIcons
                name={allChecked ? 'check-box' : 'check-box-outline-blank'}
                size={20}
                color={allChecked ? colors.primary : colors.outline}
              />
              <Text style={[styles.selectAllText, allChecked && { color: colors.primary }]}>
                전체 동의
              </Text>
            </TouchableOpacity>
          </View>

          {CONSENT_ITEMS.map((item) => {
            const checked = consents[item.key] ?? false;
            return (
              <TouchableOpacity
                key={item.key}
                style={[styles.consentItem, checked && styles.consentItemChecked]}
                onPress={() => toggleConsent(item.key)}
                activeOpacity={0.7}
              >
                <MaterialIcons
                  name={checked ? 'check-box' : 'check-box-outline-blank'}
                  size={22}
                  color={checked ? colors.primary : colors.outline}
                />
                <View style={styles.consentTextWrap}>
                  <View style={styles.consentLabelRow}>
                    <Text style={[styles.consentLabel, checked && styles.consentLabelChecked]}>
                      {item.label}
                    </Text>
                    {item.required && (
                      <Text style={styles.requiredBadge}>필수</Text>
                    )}
                  </View>
                  <Text style={styles.consentDesc}>{item.description}</Text>
                </View>
              </TouchableOpacity>
            );
          })}

          {!allRequiredChecked && (
            <Text style={styles.consentWarning}>
              모든 필수 항목에 동의해야 서명할 수 있습니다
            </Text>
          )}
        </View>

        {/* Identity Verification */}
        <View style={styles.consentSection}>
          <View style={styles.consentHeader}>
            <Text style={styles.consentHeaderTitle}>본인인증</Text>
            {identityResult?.verified && (
              <View style={styles.verifiedBadge}>
                <MaterialIcons name="verified" size={14} color={colors.tertiary} />
                <Text style={styles.verifiedText}>인증완료</Text>
              </View>
            )}
          </View>

          {identityResult?.verified ? (
            <View style={styles.verifiedCard}>
              <MaterialIcons name="check-circle" size={24} color={colors.tertiary} />
              <View style={styles.verifiedInfo}>
                <Text style={styles.verifiedName}>{identityResult.name} 본인 확인됨</Text>
                <Text style={styles.verifiedMeta}>
                  {identityResult.provider === 'pass' ? 'PASS 인증' : '카카오 인증'} · {new Date(identityResult.verifiedAt).toLocaleTimeString('ko-KR')}
                </Text>
              </View>
            </View>
          ) : (
            <>
              <Text style={styles.verifyDesc}>
                전자서명의 법적 효력을 위해 본인인증이 필요합니다.
              </Text>
              <View style={styles.providerRow}>
                {IDENTITY_PROVIDERS.map((p) => (
                  <TouchableOpacity
                    key={p.id}
                    style={[styles.providerBtn, p.recommended && styles.providerBtnRecommended]}
                    onPress={() => handleVerify(p.id)}
                    disabled={verifying}
                    activeOpacity={0.7}
                  >
                    <Text style={styles.providerIcon}>{p.icon}</Text>
                    <Text style={styles.providerName}>{p.name}</Text>
                    <Text style={styles.providerDesc}>{p.description}</Text>
                    {p.recommended && (
                      <View style={styles.recommendBadge}>
                        <Text style={styles.recommendText}>추천</Text>
                      </View>
                    )}
                  </TouchableOpacity>
                ))}
              </View>
              {verifying && (
                <Text style={styles.verifyingText}>본인인증 진행 중...</Text>
              )}
            </>
          )}
        </View>

        {/* Signature Pad */}
        <View style={styles.padSection}>
          <Text style={styles.padLabel}>서명란</Text>
          <SignaturePad
            width={padWidth}
            height={padHeight}
            onSignatureChange={setSignatureData}
            fullScreen
          />
        </View>
      </ScrollView>

      {/* Footer */}
      <View style={[styles.footer, { paddingBottom: Math.max(insets.bottom, Platform.OS === 'android' ? 16 : 0) + spacing.lg }]}>
        <Button
          title={signing ? '서명 처리 중...' : `동의 및 서명 완료 (${checkedCount}/${CONSENT_ITEMS.length})`}
          onPress={handleSign}
          disabled={!canSubmit || signing}
          loading={signing}
          fullWidth
          size="lg"
        />
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.surface },
  content: { padding: spacing.lg, paddingBottom: spacing.xl, gap: spacing.lg },
  infoCard: {
    backgroundColor: colors.primaryFixed + '30',
    borderRadius: borderRadius.lg,
    padding: spacing.lg,
    borderLeftWidth: 4,
    borderLeftColor: colors.primary,
  },
  infoTitle: { ...typography.labelLarge, color: colors.primary, marginBottom: spacing.xs },
  infoText: { ...typography.bodySmall, color: colors.onSurfaceVariant, lineHeight: 18 },
  signerCard: {
    backgroundColor: colors.surfaceContainerLowest,
    borderRadius: borderRadius.xl,
    padding: spacing.lg,
    ...shadows.sm,
  },
  signerLabel: { ...typography.labelMedium, color: colors.onSurfaceVariant },
  signerName: { ...typography.titleMedium, color: colors.onSurface, marginTop: spacing.xs },
  signerPhone: { ...typography.bodySmall, color: colors.onSurfaceVariant, marginTop: 2 },

  /* Consent */
  consentSection: {
    backgroundColor: colors.surfaceContainerLowest,
    borderRadius: borderRadius.xl,
    padding: spacing.lg,
    ...shadows.sm,
  },
  consentHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: spacing.md,
    paddingBottom: spacing.sm,
    borderBottomWidth: 1,
    borderBottomColor: colors.outlineVariant + '30',
  },
  consentHeaderTitle: {
    ...typography.titleSmall,
    color: colors.onSurface,
  },
  selectAllBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
  },
  selectAllText: {
    ...typography.labelMedium,
    color: colors.outline,
  },
  consentItem: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: spacing.md,
    paddingVertical: spacing.md,
    borderBottomWidth: 1,
    borderBottomColor: colors.outlineVariant + '15',
  },
  consentItemChecked: {
    backgroundColor: colors.primary + '05',
    marginHorizontal: -spacing.sm,
    paddingHorizontal: spacing.sm,
    borderRadius: borderRadius.md,
  },
  consentTextWrap: { flex: 1 },
  consentLabelRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
  },
  consentLabel: {
    ...typography.bodyMedium,
    color: colors.onSurface,
    fontWeight: '500',
  },
  consentLabelChecked: {
    color: colors.primary,
  },
  requiredBadge: {
    ...typography.labelSmall,
    color: colors.error,
    fontWeight: '700',
    fontSize: 10,
  },
  consentDesc: {
    ...typography.bodySmall,
    color: colors.onSurfaceVariant,
    marginTop: 2,
    lineHeight: 16,
  },
  consentWarning: {
    ...typography.labelSmall,
    color: colors.error,
    textAlign: 'center',
    marginTop: spacing.md,
  },

  /* Identity Verification */
  verifiedBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: colors.tertiary + '15',
    paddingHorizontal: spacing.sm,
    paddingVertical: 2,
    borderRadius: borderRadius.full,
  },
  verifiedText: {
    ...typography.labelSmall,
    color: colors.tertiary,
    fontWeight: '700',
  },
  verifiedCard: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    backgroundColor: colors.tertiary + '08',
    borderRadius: borderRadius.lg,
    padding: spacing.lg,
    borderWidth: 1,
    borderColor: colors.tertiary + '20',
  },
  verifiedInfo: { flex: 1 },
  verifiedName: {
    ...typography.bodyMedium,
    color: colors.onSurface,
    fontWeight: '600',
  },
  verifiedMeta: {
    ...typography.labelSmall,
    color: colors.onSurfaceVariant,
    marginTop: 2,
  },
  verifyDesc: {
    ...typography.bodySmall,
    color: colors.onSurfaceVariant,
    marginBottom: spacing.md,
  },
  providerRow: {
    flexDirection: 'row',
    gap: spacing.md,
  },
  providerBtn: {
    flex: 1,
    backgroundColor: colors.surfaceContainerLow,
    borderRadius: borderRadius.lg,
    padding: spacing.lg,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: colors.outlineVariant + '30',
  },
  providerBtnRecommended: {
    borderColor: colors.primary + '40',
    backgroundColor: colors.primary + '05',
  },
  providerIcon: {
    fontSize: 28,
    marginBottom: spacing.sm,
  },
  providerName: {
    ...typography.labelLarge,
    color: colors.onSurface,
    marginBottom: 2,
  },
  providerDesc: {
    ...typography.labelSmall,
    color: colors.onSurfaceVariant,
    textAlign: 'center',
  },
  recommendBadge: {
    backgroundColor: colors.primary,
    borderRadius: borderRadius.full,
    paddingHorizontal: spacing.sm,
    paddingVertical: 1,
    marginTop: spacing.sm,
  },
  recommendText: {
    ...typography.labelSmall,
    color: '#fff',
    fontWeight: '700',
    fontSize: 9,
  },
  verifyingText: {
    ...typography.labelSmall,
    color: colors.primary,
    textAlign: 'center',
    marginTop: spacing.sm,
  },

  /* Signature */
  padSection: { gap: spacing.sm },
  padLabel: { ...typography.labelLarge, color: colors.onSurface },
  padHint: { ...typography.labelSmall, color: colors.onSurfaceVariant, textAlign: 'center' },
  footer: {
    padding: spacing.lg,
    paddingBottom: spacing.lg,
    backgroundColor: colors.surface,
    borderTopWidth: 1,
    borderTopColor: colors.outlineVariant + '20',
  },
});
