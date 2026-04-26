import { useState, useCallback, useEffect, useMemo } from 'react';
import {
  View,
  Text,
  ScrollView,
  TouchableOpacity,
  TextInput,
  Image,
  Alert,
  StyleSheet,
  ActivityIndicator,
  Platform,
  Dimensions,
} from 'react-native';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import { MaterialIcons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { useAuthStore } from '../../stores/authStore';
import { supabase } from '../../lib/supabase';
import SignaturePad from '../../components/common/SignaturePad';
import { colors, spacing, typography, borderRadius, shadows } from '../../constants/theme';

const { width: SW } = Dimensions.get('window');
const APP_URL = process.env.EXPO_PUBLIC_APP_URL || 'https://logissign.com';

interface SealRecord {
  id: string;
  seal_image_url: string;
  seal_data_uri?: string;
  name_text: string;
  is_default: boolean;
  category: string;
  created_at: string;
}

interface SealPreview {
  id: string;
  dataUri: string;
  font: string;
  shape: SealShape;
}

type Mode = 'list' | 'choose' | 'seal_input' | 'seal_select' | 'sign';
type SealShape = 'circle' | 'square' | 'oval' | 'rounded_square';

const SHAPE_LABELS: Record<SealShape, string> = {
  circle: '원형',
  square: '정사각',
  oval: '타원형',
  rounded_square: '둥근사각',
};

function isSignatureRecord(seal: SealRecord) {
  return seal.category === 'signature';
}

function getAssetTypeLabel(seal: SealRecord) {
  return isSignatureRecord(seal) ? '저장된 서명' : '저장된 도장';
}

export default function SealScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { driver } = useAuthStore();
  const [mode, setMode] = useState<Mode>('list');
  const [seals, setSeals] = useState<SealRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [nameText, setNameText] = useState(driver?.name ?? '');
  const [previews, setPreviews] = useState<SealPreview[]>([]);
  const [generating, setGenerating] = useState(false);
  const [selectedShape, setSelectedShape] = useState<SealShape>('circle');
  const [selectedPreview, setSelectedPreview] = useState<SealPreview | null>(null);
  const [saving, setSaving] = useState(false);
  const [signatureData, setSignatureData] = useState<string | null>(null);

  const loadSeals = useCallback(async () => {
    if (!driver?.id) return;
    setLoading(true);

    const { data } = await supabase
      .from('seals')
      .select('*')
      .eq('owner_type', 'driver')
      .eq('owner_id', driver.id)
      .order('is_default', { ascending: false })
      .order('created_at', { ascending: false });

    setSeals((data ?? []) as SealRecord[]);
    setLoading(false);
  }, [driver?.id]);

  useEffect(() => {
    loadSeals();
  }, [loadSeals]);

  const filteredPreviews = useMemo(
    () => previews.filter((preview) => preview.shape === selectedShape),
    [previews, selectedShape],
  );

  const generatePreviews = async () => {
    if (!nameText.trim()) return;
    setGenerating(true);

    try {
      const { data: { session } } = await supabase.auth.getSession();
      const token = session?.access_token;

      if (!token) {
        Alert.alert('오류', '로그인이 필요합니다. 다시 로그인해 주세요.');
        setGenerating(false);
        return;
      }

      const res = await fetch(`${APP_URL}/api/seals/generate?name=${encodeURIComponent(nameText.trim())}`, {
        headers: {
          Authorization: `Bearer ${token}`,
        },
      });

      const data = await res.json();
      if (!res.ok || !Array.isArray(data.previews)) {
        Alert.alert('오류', data.error || '도장 시안을 불러오지 못했습니다.');
        setGenerating(false);
        return;
      }

      setPreviews(data.previews as SealPreview[]);
      setSelectedShape('circle');
      setSelectedPreview(null);
      setMode('seal_select');
    } catch {
      Alert.alert('오류', '도장 시안을 생성하는 중 문제가 발생했습니다.');
    }

    setGenerating(false);
  };

  const saveSeal = async (dataUri: string, category: string, nameOverride?: string) => {
    if (!driver?.id) return;

    setSaving(true);
    const { error } = await supabase.from('seals').insert({
      owner_type: 'driver',
      owner_id: driver.id,
      category,
      script: 'hangul',
      seal_data_uri: dataUri,
      seal_image_url: '',
      name_text: nameOverride ?? nameText.trim(),
      is_default: !seals.some((seal) => seal.category === category),
    });
    setSaving(false);

    if (error) {
      Alert.alert('오류', error.message);
      return;
    }

    Alert.alert('완료', category === 'signature' ? '서명이 저장되었습니다.' : '도장이 저장되었습니다.');
    await loadSeals();
    setMode('list');
    setSelectedPreview(null);
    setSignatureData(null);
  };

  const handleDelete = (sealId: string) => {
    Alert.alert('삭제', '이 자산을 삭제하시겠습니까?', [
      { text: '취소', style: 'cancel' },
      {
        text: '삭제',
        style: 'destructive',
        onPress: async () => {
          await supabase.from('seals').delete().eq('id', sealId);
          loadSeals();
        },
      },
    ]);
  };

  const handleSetDefault = async (sealId: string, category: string) => {
    if (!driver?.id) return;

    await supabase
      .from('seals')
      .update({ is_default: false })
      .eq('owner_type', 'driver')
      .eq('owner_id', driver.id)
      .eq('category', category);

    await supabase.from('seals').update({ is_default: true }).eq('id', sealId);
    loadSeals();
  };

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      <View style={styles.header}>
        <TouchableOpacity
          onPress={() => (mode === 'list' ? router.back() : setMode(mode === 'seal_select' ? 'seal_input' : 'list'))}
          style={styles.backBtn}
        >
          <MaterialIcons name="arrow-back" size={24} color={colors.onSurface} />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>
          {mode === 'list'
            ? '도장/서명 관리'
            : mode === 'choose'
              ? '자산 만들기'
              : mode === 'seal_input'
                ? '도장 이름 입력'
                : mode === 'seal_select'
                  ? '도장 4안 선택'
                  : '서명 저장'}
        </Text>
        <View style={{ width: 40 }} />
      </View>

      <ScrollView style={styles.scroll} contentContainerStyle={styles.scrollContent}>
        {mode === 'list' && (
          <>
            <TouchableOpacity style={styles.addBtn} onPress={() => setMode('choose')}>
              <MaterialIcons name="add-circle-outline" size={24} color={colors.primary} />
              <Text style={styles.addBtnText}>도장 또는 서명 만들기</Text>
            </TouchableOpacity>

            {loading ? (
              <ActivityIndicator size="large" color={colors.primary} style={{ marginTop: 40 }} />
            ) : seals.length === 0 ? (
              <View style={styles.empty}>
                <MaterialIcons name="verified" size={48} color={colors.primary + '40'} />
                <Text style={styles.emptyText}>저장된 도장/서명이 없습니다.</Text>
                <Text style={styles.emptySubText}>계약 입력 전에 기사용 도장 또는 서명을 먼저 만들어 주세요.</Text>
              </View>
            ) : (
              <View style={styles.sealGrid}>
                {seals.map((seal) => (
                  <View key={seal.id} style={[styles.sealCard, seal.is_default && styles.sealCardDefault]}>
                    {seal.is_default && (
                      <View style={styles.defaultBadge}>
                        <Text style={styles.defaultBadgeText}>기본</Text>
                      </View>
                    )}
                    {seal.seal_data_uri || seal.seal_image_url ? (
                      <Image source={{ uri: seal.seal_data_uri || seal.seal_image_url }} style={styles.sealImage} resizeMode="contain" />
                    ) : (
                      <View style={styles.sealPlaceholder}>
                        <Text style={styles.sealPlaceholderText}>{seal.name_text.slice(0, 2)}</Text>
                      </View>
                    )}
                    <Text style={styles.sealName}>{seal.name_text}</Text>
                    <Text style={styles.sealType}>{getAssetTypeLabel(seal)}</Text>
                    <View style={styles.sealActions}>
                      {!seal.is_default && (
                        <TouchableOpacity onPress={() => handleSetDefault(seal.id, seal.category)}>
                          <Text style={styles.actionPrimary}>기본 설정</Text>
                        </TouchableOpacity>
                      )}
                      <TouchableOpacity onPress={() => handleDelete(seal.id)}>
                        <Text style={styles.actionDanger}>삭제</Text>
                      </TouchableOpacity>
                    </View>
                  </View>
                ))}
              </View>
            )}
          </>
        )}

        {mode === 'choose' && (
          <View style={styles.chooseWrap}>
            <Text style={styles.sectionTitle}>만들 방식 선택</Text>
            <TouchableOpacity style={styles.chooseCard} onPress={() => { setMode('seal_input'); setNameText(driver?.name ?? ''); }}>
              <View style={[styles.chooseIcon, { backgroundColor: colors.primary + '12' }]}>
                <MaterialIcons name="verified" size={28} color={colors.primary} />
              </View>
              <View style={{ flex: 1 }}>
                <Text style={styles.chooseLabel}>도장 만들기</Text>
                <Text style={styles.chooseDesc}>선택한 모양 안에서 4가지 폰트 시안을 비교해 저장합니다.</Text>
              </View>
              <MaterialIcons name="chevron-right" size={22} color={colors.outline} />
            </TouchableOpacity>
            <TouchableOpacity style={styles.chooseCard} onPress={() => setMode('sign')}>
              <View style={[styles.chooseIcon, { backgroundColor: colors.tertiary + '12' }]}>
                <MaterialIcons name="gesture" size={28} color={colors.tertiary} />
              </View>
              <View style={{ flex: 1 }}>
                <Text style={styles.chooseLabel}>서명 저장</Text>
                <Text style={styles.chooseDesc}>4가지 필기구 스타일 중 골라 직접 그리고 저장합니다.</Text>
              </View>
              <MaterialIcons name="chevron-right" size={22} color={colors.outline} />
            </TouchableOpacity>
          </View>
        )}

        {mode === 'seal_input' && (
          <View style={styles.inputWrap}>
            <Text style={styles.sectionTitle}>도장 이름 입력</Text>
            <TextInput
              style={styles.nameInput}
              value={nameText}
              onChangeText={setNameText}
              placeholder="예: 홍길동"
              placeholderTextColor={colors.outline}
              maxLength={10}
              autoFocus
            />
            <Text style={styles.hint}>이름을 입력한 뒤 시안 생성을 누르면 모양별 4가지 폰트 안이 준비됩니다.</Text>
            <TouchableOpacity
              style={[styles.primaryBtn, (!nameText.trim() || generating) && styles.btnDisabled]}
              disabled={!nameText.trim() || generating}
              onPress={generatePreviews}
            >
              {generating ? <ActivityIndicator color="#fff" /> : <Text style={styles.primaryBtnText}>도장 시안 만들기</Text>}
            </TouchableOpacity>
          </View>
        )}

        {mode === 'seal_select' && (
          <View style={styles.selectWrap}>
            <Text style={styles.sectionTitle}>{nameText || '기사'} 도장</Text>
            <Text style={styles.hint}>모양을 고르면 같은 모양 안에서 4가지 폰트 시안을 비교할 수 있습니다.</Text>

            <View style={styles.filterRow}>
              {(['circle', 'square', 'oval', 'rounded_square'] as SealShape[]).map((shape) => (
                <TouchableOpacity
                  key={shape}
                  style={[styles.filterChip, selectedShape === shape && styles.filterChipActive]}
                  onPress={() => setSelectedShape(shape)}
                >
                  <Text style={[styles.filterChipText, selectedShape === shape && styles.filterChipTextActive]}>
                    {SHAPE_LABELS[shape]}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>

            <View style={styles.previewGrid}>
              {filteredPreviews.map((preview) => (
                <TouchableOpacity
                  key={preview.id}
                  style={[styles.previewCard, selectedPreview?.id === preview.id && styles.previewCardSelected]}
                  onPress={() => setSelectedPreview(preview)}
                  activeOpacity={0.7}
                >
                  <Image
                    source={{ uri: preview.dataUri }}
                    style={[styles.previewImage, preview.shape === 'oval' && styles.previewImageOval]}
                    resizeMode="contain"
                  />
                  <Text style={styles.previewFont}>{preview.font}</Text>
                  {selectedPreview?.id === preview.id && (
                    <View style={styles.selectedCheck}>
                      <MaterialIcons name="check-circle" size={20} color={colors.primary} />
                    </View>
                  )}
                </TouchableOpacity>
              ))}
            </View>

            {filteredPreviews.length === 0 && (
              <Text style={[styles.hint, { textAlign: 'center', marginTop: 20 }]}>선택한 모양의 시안을 불러오지 못했습니다.</Text>
            )}
          </View>
        )}

        {mode === 'sign' && (
          <View style={styles.signWrap}>
            <Text style={styles.sectionTitle}>서명 저장</Text>
            <Text style={styles.hint}>필기구 스타일을 바꾸며 자연스러운 서명을 저장해 둘 수 있습니다.</Text>
            <SignaturePad
              width={SW - spacing.md * 4}
              height={200}
              onSignatureChange={setSignatureData}
            />
          </View>
        )}
      </ScrollView>

      {mode === 'seal_select' && selectedPreview && (
        <View style={[styles.footer, { paddingBottom: Math.max(insets.bottom, Platform.OS === 'android' ? 16 : 0) + spacing.md }]}>
          <TouchableOpacity style={styles.primaryBtn} onPress={() => saveSeal(selectedPreview.dataUri, 'personal')} disabled={saving}>
            {saving ? <ActivityIndicator color="#fff" /> : <Text style={styles.primaryBtnText}>이 도장 저장</Text>}
          </TouchableOpacity>
        </View>
      )}

      {mode === 'sign' && signatureData && (
        <View style={[styles.footer, { paddingBottom: Math.max(insets.bottom, Platform.OS === 'android' ? 16 : 0) + spacing.md }]}>
          <TouchableOpacity
            style={styles.primaryBtn}
            onPress={() => saveSeal(signatureData, 'signature', `${driver?.name ?? '기사'} 서명`)}
            disabled={saving}
          >
            {saving ? <ActivityIndicator color="#fff" /> : <Text style={styles.primaryBtnText}>이 서명 저장</Text>}
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
    paddingVertical: spacing.sm,
    borderBottomWidth: 1,
    borderBottomColor: colors.outlineVariant + '20',
  },
  backBtn: { width: 40, height: 40, borderRadius: 20, alignItems: 'center', justifyContent: 'center' },
  headerTitle: { ...typography.titleMedium, color: colors.onSurface, fontWeight: '700' },
  scroll: { flex: 1 },
  scrollContent: { padding: spacing.md, paddingBottom: 120 },
  sectionTitle: { ...typography.titleSmall, color: colors.onSurface, fontWeight: '700', marginBottom: spacing.sm },
  hint: { ...typography.bodySmall, color: colors.onSurfaceVariant + '80', marginTop: spacing.xs },
  addBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    padding: spacing.md,
    borderRadius: borderRadius.xl,
    borderWidth: 2,
    borderColor: colors.primary + '30',
    borderStyle: 'dashed',
    marginBottom: spacing.lg,
  },
  addBtnText: { ...typography.bodyMedium, color: colors.primary, fontWeight: '600' },
  empty: { alignItems: 'center', paddingVertical: 60 },
  emptyText: { ...typography.bodyMedium, color: colors.onSurfaceVariant, marginTop: 16 },
  emptySubText: { ...typography.bodySmall, color: colors.outline, marginTop: 4, textAlign: 'center' },
  sealGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 12 },
  sealCard: {
    width: '47%',
    alignItems: 'center',
    padding: spacing.md,
    borderRadius: borderRadius.xl,
    borderWidth: 2,
    borderColor: colors.outlineVariant + '20',
    backgroundColor: colors.surfaceContainerLowest,
  },
  sealCardDefault: { borderColor: colors.primary + '40', backgroundColor: colors.primary + '05' },
  defaultBadge: {
    position: 'absolute',
    top: 8,
    left: 8,
    backgroundColor: colors.primary,
    borderRadius: 10,
    paddingHorizontal: 8,
    paddingVertical: 2,
  },
  defaultBadgeText: { color: '#fff', fontSize: 10, fontWeight: '700' },
  sealImage: { width: 72, height: 72 },
  sealPlaceholder: {
    width: 72,
    height: 72,
    borderRadius: 36,
    borderWidth: 3,
    borderColor: '#C42B2B',
    alignItems: 'center',
    justifyContent: 'center',
  },
  sealPlaceholderText: { fontSize: 24, fontWeight: '900', color: '#C42B2B' },
  sealName: { ...typography.bodySmall, color: colors.onSurface, fontWeight: '600', marginTop: 8, textAlign: 'center' },
  sealType: { ...typography.labelSmall, color: colors.onSurfaceVariant, marginTop: 2, textAlign: 'center' },
  sealActions: { flexDirection: 'row', gap: 16, marginTop: 8 },
  actionPrimary: { ...typography.labelSmall, color: colors.primary },
  actionDanger: { ...typography.labelSmall, color: colors.error },
  chooseWrap: { gap: 12 },
  chooseCard: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    padding: spacing.lg,
    borderRadius: borderRadius.xl,
    backgroundColor: colors.surfaceContainerLowest,
    ...shadows.sm,
  },
  chooseIcon: { width: 48, height: 48, borderRadius: 14, alignItems: 'center', justifyContent: 'center' },
  chooseLabel: { ...typography.bodyLarge, color: colors.onSurface, fontWeight: '600' },
  chooseDesc: { ...typography.bodySmall, color: colors.onSurfaceVariant, marginTop: 2 },
  inputWrap: { gap: 12 },
  nameInput: {
    height: 52,
    borderRadius: borderRadius.lg,
    borderWidth: 1.5,
    borderColor: colors.outlineVariant + '40',
    paddingHorizontal: spacing.lg,
    fontSize: 18,
    color: colors.onSurface,
    backgroundColor: colors.surfaceContainerLowest,
    textAlign: 'center',
    fontWeight: '700',
    letterSpacing: 2,
  },
  primaryBtn: {
    height: 50,
    borderRadius: borderRadius.lg,
    backgroundColor: colors.primary,
    alignItems: 'center',
    justifyContent: 'center',
  },
  primaryBtnText: { color: '#fff', fontSize: 15, fontWeight: '700' },
  btnDisabled: { opacity: 0.4 },
  selectWrap: { gap: 8 },
  filterRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginVertical: spacing.sm },
  filterChip: {
    paddingHorizontal: 14,
    paddingVertical: 6,
    borderRadius: 20,
    backgroundColor: colors.surfaceContainerLow,
    borderWidth: 1,
    borderColor: colors.outlineVariant + '20',
  },
  filterChipActive: { backgroundColor: colors.primary, borderColor: colors.primary },
  filterChipText: { ...typography.labelMedium, color: colors.onSurfaceVariant },
  filterChipTextActive: { color: '#fff', fontWeight: '700' },
  previewGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 10 },
  previewCard: {
    width: (SW - spacing.md * 2 - 20) / 2,
    alignItems: 'center',
    paddingVertical: spacing.md,
    borderRadius: borderRadius.lg,
    borderWidth: 2,
    borderColor: colors.outlineVariant + '15',
    backgroundColor: colors.surfaceContainerLowest,
  },
  previewCardSelected: { borderColor: colors.primary, backgroundColor: colors.primary + '08' },
  previewImage: { width: 72, height: 72, marginBottom: 6 },
  previewImageOval: { width: 56, height: 82 },
  previewFont: { ...typography.labelSmall, color: colors.onSurfaceVariant },
  selectedCheck: { position: 'absolute', top: 4, right: 4 },
  signWrap: { gap: 12 },
  footer: {
    padding: spacing.md,
    backgroundColor: colors.surface,
    borderTopWidth: 1,
    borderTopColor: colors.outlineVariant + '20',
  },
});
