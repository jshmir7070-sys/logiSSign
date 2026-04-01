import { useEffect, useState } from 'react';
import {
  View,
  Text,
  ScrollView,
  TouchableOpacity,
  StyleSheet,
  TextInput,
  Alert,
  ActivityIndicator,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter, useLocalSearchParams } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import Badge from '../../components/common/Badge';
import { useAuthStore } from '../../stores/authStore';
import {
  type ContractAmendment,
  type AmendmentChanges,
  AMENDMENT_TYPE_LABELS,
  AMENDMENT_STATUS_LABELS,
  approveAmendment,
  rejectAmendment,
} from '../../services/amendment.service';
import { supabase } from '../../lib/supabase';
import { colors, spacing, typography, borderRadius, shadows } from '../../constants/theme';

export default function AmendmentDetailScreen() {
  const router = useRouter();
  const { id } = useLocalSearchParams<{ id: string }>();
  const driver = useAuthStore((s) => s.driver);
  const [amendment, setAmendment] = useState<ContractAmendment | null>(null);
  const [loading, setLoading] = useState(true);
  const [processing, setProcessing] = useState(false);
  const [showRejectInput, setShowRejectInput] = useState(false);
  const [rejectReason, setRejectReason] = useState('');

  useEffect(() => {
    if (!id) return;
    supabase
      .from('contract_amendments')
      .select('*')
      .eq('id', id)
      .single()
      .then(({ data, error }) => {
        if (!error && data) setAmendment(data as ContractAmendment);
        setLoading(false);
      });
  }, [id]);

  const handleApprove = () => {
    Alert.alert(
      '변경 수락',
      '이 변경 요청을 수락하시겠습니까?\n수락 후에는 변경된 조건이 적용됩니다.',
      [
        { text: '취소', style: 'cancel' },
        {
          text: '수락',
          style: 'default',
          onPress: async () => {
            if (!amendment) return;
            setProcessing(true);
            const { error } = await approveAmendment(amendment.id);
            setProcessing(false);
            if (error) {
              Alert.alert('오류', error);
            } else {
              setAmendment({ ...amendment, status: 'approved', responded_at: new Date().toISOString() });
              Alert.alert('완료', '변경 요청을 수락했습니다.');
            }
          },
        },
      ]
    );
  };

  const handleReject = async () => {
    if (!amendment) return;
    setProcessing(true);
    const { error } = await rejectAmendment(amendment.id, rejectReason.trim() || undefined);
    setProcessing(false);
    if (error) {
      Alert.alert('오류', error);
    } else {
      setAmendment({
        ...amendment,
        status: 'rejected',
        responded_at: new Date().toISOString(),
        rejection_reason: rejectReason.trim() || null,
      });
      setShowRejectInput(false);
      Alert.alert('완료', '변경 요청을 거부했습니다. 기존 조건이 유지됩니다.');
    }
  };

  const statusVariant = (s: string): 'warning' | 'success' | 'error' | 'default' => {
    if (s === 'pending') return 'warning';
    if (s === 'approved') return 'success';
    if (s === 'rejected') return 'error';
    return 'default';
  };

  if (loading) {
    return (
      <SafeAreaView style={styles.container}>
        <ActivityIndicator size="large" color={colors.primary} style={{ marginTop: 100 }} />
      </SafeAreaView>
    );
  }

  if (!amendment) {
    return (
      <SafeAreaView style={styles.container}>
        <Text style={{ textAlign: 'center', marginTop: 100, color: colors.onSurfaceVariant }}>
          변경 요청을 찾을 수 없습니다
        </Text>
      </SafeAreaView>
    );
  }

  const changes = amendment.changes as AmendmentChanges | null;
  const isPending = amendment.status === 'pending';

  return (
    <SafeAreaView style={styles.container}>
      {/* 헤더 */}
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()} style={styles.backBtn}>
          <Ionicons name="arrow-back" size={24} color={colors.onSurface} />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>변경 요청 상세</Text>
        <View style={{ width: 40 }} />
      </View>

      <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
        {/* 상태 & 유형 */}
        <View style={styles.statusRow}>
          <Badge label={AMENDMENT_STATUS_LABELS[amendment.status]} variant={statusVariant(amendment.status)} />
          <View style={styles.typeBadge}>
            <Text style={styles.typeText}>{AMENDMENT_TYPE_LABELS[amendment.amendment_type]}</Text>
          </View>
        </View>

        {/* 제목 & 날짜 */}
        <Text style={styles.title}>{amendment.title}</Text>
        <Text style={styles.dateText}>
          요청일: {amendment.requested_at ? new Date(amendment.requested_at).toLocaleDateString('ko-KR') : '-'}
          {amendment.effective_date &&
            `  ·  적용 예정일: ${new Date(amendment.effective_date).toLocaleDateString('ko-KR')}`}
        </Text>

        {/* 설명 */}
        {amendment.description && (
          <View style={styles.descBox}>
            <Text style={styles.descText}>{amendment.description}</Text>
          </View>
        )}

        {/* 변경 전/후 비교 */}
        {changes && Object.keys(changes.before ?? {}).length > 0 && (
          <View style={styles.changesCard}>
            <Text style={styles.sectionTitle}>변경 내역</Text>
            {Object.entries(changes.before ?? {}).map(([field, beforeVal]) => (
              <View key={field} style={styles.changeRow}>
                <Text style={styles.changeField}>{field}</Text>
                <View style={styles.changeValues}>
                  <View style={styles.beforeBox}>
                    <Text style={styles.changeLabel}>변경 전</Text>
                    <Text style={styles.beforeText}>{beforeVal}</Text>
                  </View>
                  <Ionicons name="arrow-forward" size={16} color={colors.onSurfaceVariant} />
                  <View style={styles.afterBox}>
                    <Text style={styles.changeLabel}>변경 후</Text>
                    <Text style={styles.afterText}>{changes.after?.[field] ?? ''}</Text>
                  </View>
                </View>
              </View>
            ))}
          </View>
        )}

        {/* 거부 사유 표시 */}
        {amendment.status === 'rejected' && amendment.rejection_reason && (
          <View style={styles.rejectionBox}>
            <Ionicons name="close-circle" size={16} color={colors.error} />
            <Text style={styles.rejectionText}>거부 사유: {amendment.rejection_reason}</Text>
          </View>
        )}

        {/* 응답일 */}
        {amendment.responded_at && (
          <Text style={styles.respondedText}>
            응답일: {new Date(amendment.responded_at).toLocaleString('ko-KR')}
          </Text>
        )}

        {/* 거부 사유 입력 */}
        {isPending && showRejectInput && (
          <View style={styles.rejectInputBox}>
            <Text style={styles.rejectInputLabel}>거부 사유 (선택)</Text>
            <TextInput
              value={rejectReason}
              onChangeText={setRejectReason}
              placeholder="거부 사유를 입력해주세요"
              multiline
              numberOfLines={3}
              style={styles.rejectInput}
              placeholderTextColor={colors.onSurfaceVariant}
            />
            <View style={styles.rejectBtnRow}>
              <TouchableOpacity
                style={styles.rejectCancelBtn}
                onPress={() => { setShowRejectInput(false); setRejectReason(''); }}
              >
                <Text style={styles.rejectCancelText}>취소</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.rejectConfirmBtn, processing && { opacity: 0.5 }]}
                onPress={handleReject}
                disabled={processing}
              >
                {processing ? (
                  <ActivityIndicator size="small" color="#fff" />
                ) : (
                  <Text style={styles.rejectConfirmText}>거부 확정</Text>
                )}
              </TouchableOpacity>
            </View>
          </View>
        )}

        {/* 안내 문구 */}
        {isPending && (
          <View style={styles.infoBox}>
            <Ionicons name="information-circle-outline" size={18} color={colors.primary} />
            <Text style={styles.infoText}>
              변경 요청을 거부하시면 기존 계약 조건이 그대로 유지됩니다.{'\n'}
              수락 시 변경된 조건이 적용됩니다.
            </Text>
          </View>
        )}
      </ScrollView>

      {/* 하단 버튼 */}
      {isPending && !showRejectInput && (
        <View style={styles.footer}>
          <TouchableOpacity
            style={styles.rejectBtn}
            onPress={() => setShowRejectInput(true)}
            disabled={processing}
          >
            <Text style={styles.rejectBtnText}>거부</Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={[styles.approveBtn, processing && { opacity: 0.5 }]}
            onPress={handleApprove}
            disabled={processing}
          >
            {processing ? (
              <ActivityIndicator size="small" color="#fff" />
            ) : (
              <Text style={styles.approveBtnText}>수락</Text>
            )}
          </TouchableOpacity>
        </View>
      )}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.surface },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.md,
    borderBottomWidth: 1,
    borderBottomColor: colors.outlineVariant + '30',
  },
  backBtn: { width: 40, height: 40, alignItems: 'center', justifyContent: 'center' },
  headerTitle: { ...typography.titleMedium, color: colors.onSurface },
  content: { padding: spacing.lg, paddingBottom: 120 },
  statusRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm, marginBottom: spacing.md },
  typeBadge: {
    backgroundColor: colors.secondaryContainer,
    paddingHorizontal: spacing.sm,
    paddingVertical: 2,
    borderRadius: borderRadius.sm,
  },
  typeText: { ...typography.labelSmall, color: colors.onSecondaryContainer },
  title: { ...typography.titleLarge, color: colors.onSurface, marginBottom: spacing.xs },
  dateText: { ...typography.bodySmall, color: colors.onSurfaceVariant, marginBottom: spacing.lg },
  descBox: {
    backgroundColor: colors.surfaceContainerLow,
    padding: spacing.md,
    borderRadius: borderRadius.md,
    marginBottom: spacing.lg,
  },
  descText: { ...typography.bodyMedium, color: colors.onSurface, lineHeight: 22 },
  changesCard: {
    backgroundColor: colors.surfaceContainerLowest,
    borderRadius: borderRadius.lg,
    padding: spacing.lg,
    marginBottom: spacing.lg,
    ...shadows.sm,
  },
  sectionTitle: { ...typography.titleSmall, color: colors.onSurface, marginBottom: spacing.md },
  changeRow: {
    marginBottom: spacing.md,
    paddingBottom: spacing.md,
    borderBottomWidth: 1,
    borderBottomColor: colors.outlineVariant + '20',
  },
  changeField: { ...typography.labelMedium, color: colors.onSurface, fontWeight: '600', marginBottom: spacing.sm },
  changeValues: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
  beforeBox: { flex: 1, backgroundColor: '#fef2f2', padding: spacing.sm, borderRadius: borderRadius.sm },
  afterBox: { flex: 1, backgroundColor: '#f0fdf4', padding: spacing.sm, borderRadius: borderRadius.sm },
  changeLabel: { ...typography.labelSmall, color: colors.onSurfaceVariant, marginBottom: 2 },
  beforeText: { ...typography.bodyMedium, color: colors.error, textDecorationLine: 'line-through' },
  afterText: { ...typography.bodyMedium, color: colors.tertiary, fontWeight: '600' },
  rejectionBox: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: spacing.sm,
    backgroundColor: colors.errorContainer,
    padding: spacing.md,
    borderRadius: borderRadius.md,
    marginBottom: spacing.md,
  },
  rejectionText: { ...typography.bodySmall, color: colors.error, flex: 1 },
  respondedText: { ...typography.labelSmall, color: colors.onSurfaceVariant, marginBottom: spacing.md },
  infoBox: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: spacing.sm,
    backgroundColor: colors.primaryContainer + '15',
    padding: spacing.md,
    borderRadius: borderRadius.md,
    marginTop: spacing.md,
  },
  infoText: { ...typography.bodySmall, color: colors.onSurfaceVariant, flex: 1, lineHeight: 20 },
  rejectInputBox: {
    backgroundColor: colors.surfaceContainerLow,
    padding: spacing.lg,
    borderRadius: borderRadius.lg,
    marginTop: spacing.md,
  },
  rejectInputLabel: { ...typography.labelMedium, color: colors.onSurface, marginBottom: spacing.sm },
  rejectInput: {
    backgroundColor: colors.surfaceContainerLowest,
    borderRadius: borderRadius.md,
    padding: spacing.md,
    ...typography.bodyMedium,
    color: colors.onSurface,
    minHeight: 80,
    textAlignVertical: 'top',
    borderWidth: 1,
    borderColor: colors.outlineVariant,
  },
  rejectBtnRow: { flexDirection: 'row', justifyContent: 'flex-end', gap: spacing.sm, marginTop: spacing.md },
  rejectCancelBtn: {
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.sm,
    borderRadius: borderRadius.md,
    borderWidth: 1,
    borderColor: colors.outlineVariant,
  },
  rejectCancelText: { ...typography.labelMedium, color: colors.onSurfaceVariant },
  rejectConfirmBtn: {
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.sm,
    borderRadius: borderRadius.md,
    backgroundColor: colors.error,
  },
  rejectConfirmText: { ...typography.labelMedium, color: '#fff', fontWeight: '600' },
  footer: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    flexDirection: 'row',
    gap: spacing.md,
    padding: spacing.lg,
    paddingBottom: spacing.xl,
    backgroundColor: colors.surface,
    borderTopWidth: 1,
    borderTopColor: colors.outlineVariant + '30',
    ...shadows.md,
  },
  rejectBtn: {
    flex: 1,
    paddingVertical: 14,
    borderRadius: borderRadius.lg,
    borderWidth: 1.5,
    borderColor: colors.error,
    alignItems: 'center',
  },
  rejectBtnText: { ...typography.titleSmall, color: colors.error, fontWeight: '700' },
  approveBtn: {
    flex: 2,
    paddingVertical: 14,
    borderRadius: borderRadius.lg,
    backgroundColor: colors.primary,
    alignItems: 'center',
  },
  approveBtnText: { ...typography.titleSmall, color: '#fff', fontWeight: '700' },
});
