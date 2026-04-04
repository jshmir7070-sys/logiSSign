import { useState, useCallback, useEffect } from 'react';
import {
  View, Text, ScrollView, TouchableOpacity, TextInput, Image,
  Alert, StyleSheet, ActivityIndicator, Platform, Dimensions,
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
  shape: string;
}

type Mode = 'list' | 'choose' | 'seal_input' | 'seal_select' | 'sign';
type ShapeFilter = 'all' | 'circle' | 'square' | 'oval';

const SHAPE_LABELS: Record<string, string> = { all: '전체', circle: '원형', square: '사각', oval: '타원' };

export default function SealScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { driver } = useAuthStore();
  const [mode, setMode] = useState<Mode>('list');
  const [seals, setSeals] = useState<SealRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [nameText, setNameText] = useState(driver?.name ?? '');

  // 미리보기
  const [previews, setPreviews] = useState<SealPreview[]>([]);
  const [generating, setGenerating] = useState(false);
  const [shapeFilter, setShapeFilter] = useState<ShapeFilter>('all');
  const [selectedPreview, setSelectedPreview] = useState<SealPreview | null>(null);
  const [saving, setSaving] = useState(false);

  // 서명
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

  useEffect(() => { loadSeals(); }, [loadSeals]);

  // 도장 미리보기 생성 (서버 API)
  const generatePreviews = async () => {
    if (!nameText.trim()) return;
    setGenerating(true);
    try {
      const res = await fetch(`${APP_URL}/api/seals/generate?name=${encodeURIComponent(nameText.trim())}`);
      const data = await res.json();
      if (data.previews) {
        setPreviews(data.previews);
        setMode('seal_select');
      } else {
        Alert.alert('오류', data.error || '도장 생성 실패');
      }
    } catch {
      Alert.alert('오류', '서버 연결 실패');
    }
    setGenerating(false);
  };

  // 도장 등록
  const saveSeal = async (dataUri: string, category: string) => {
    if (!driver?.id) return;
    setSaving(true);
    const { error } = await supabase.from('seals').insert({
      owner_type: 'driver',
      owner_id: driver.id,
      category,
      script: 'hangul',
      seal_data_uri: dataUri,
      seal_image_url: '',
      name_text: nameText.trim(),
      is_default: seals.length === 0,
    });
    setSaving(false);
    if (error) {
      Alert.alert('오류', error.message);
    } else {
      Alert.alert('완료', '도장이 등록되었습니다.');
      loadSeals();
      setMode('list');
      setSelectedPreview(null);
    }
  };

  const handleDelete = (sealId: string) => {
    Alert.alert('삭제', '이 도장을 삭제하시겠습니까?', [
      { text: '취소', style: 'cancel' },
      { text: '삭제', style: 'destructive', onPress: async () => {
        await supabase.from('seals').delete().eq('id', sealId);
        loadSeals();
      }},
    ]);
  };

  const handleSetDefault = async (sealId: string) => {
    if (!driver?.id) return;
    await supabase.from('seals').update({ is_default: false }).eq('owner_type', 'driver').eq('owner_id', driver.id);
    await supabase.from('seals').update({ is_default: true }).eq('id', sealId);
    loadSeals();
  };

  const filteredPreviews = shapeFilter === 'all' ? previews : previews.filter(p => p.shape === shapeFilter);

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity onPress={() => mode === 'list' ? router.back() : setMode(mode === 'seal_select' ? 'seal_input' : 'list')} style={styles.backBtn}>
          <MaterialIcons name="arrow-back" size={24} color={colors.onSurface} />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>
          {mode === 'list' ? '도장/서명 관리' : mode === 'choose' ? '만들기' : mode === 'seal_input' ? '도장 만들기' : mode === 'seal_select' ? '스타일 선택' : '서명 만들기'}
        </Text>
        <View style={{ width: 40 }} />
      </View>

      <ScrollView style={styles.scroll} contentContainerStyle={styles.scrollContent}>

        {/* ═══ 목록 ═══ */}
        {mode === 'list' && (
          <>
            <TouchableOpacity style={styles.addBtn} onPress={() => setMode('choose')}>
              <MaterialIcons name="add-circle-outline" size={24} color={colors.primary} />
              <Text style={styles.addBtnText}>새 도장/서명 만들기</Text>
            </TouchableOpacity>

            {loading ? (
              <ActivityIndicator size="large" color={colors.primary} style={{ marginTop: 40 }} />
            ) : seals.length === 0 ? (
              <View style={styles.empty}>
                <MaterialIcons name="verified" size={48} color={colors.primary + '40'} />
                <Text style={styles.emptyText}>등록된 도장이 없습니다</Text>
                <Text style={styles.emptySubText}>도장 또는 서명을 만들어 계약서에 사용하세요</Text>
              </View>
            ) : (
              <View style={styles.sealGrid}>
                {seals.map(seal => (
                  <View key={seal.id} style={[styles.sealCard, seal.is_default && styles.sealCardDefault]}>
                    {seal.is_default && <View style={styles.defaultBadge}><Text style={styles.defaultBadgeText}>기본</Text></View>}
                    {(seal.seal_data_uri || seal.seal_image_url) ? (
                      <Image source={{ uri: seal.seal_data_uri || seal.seal_image_url }} style={styles.sealImage} resizeMode="contain" />
                    ) : (
                      <View style={styles.sealPlaceholder}><Text style={styles.sealPlaceholderText}>{seal.name_text.slice(0, 2)}</Text></View>
                    )}
                    <Text style={styles.sealName}>{seal.name_text}</Text>
                    <View style={styles.sealActions}>
                      {!seal.is_default && <TouchableOpacity onPress={() => handleSetDefault(seal.id)}><Text style={styles.actionPrimary}>기본 설정</Text></TouchableOpacity>}
                      <TouchableOpacity onPress={() => handleDelete(seal.id)}><Text style={styles.actionDanger}>삭제</Text></TouchableOpacity>
                    </View>
                  </View>
                ))}
              </View>
            )}
          </>
        )}

        {/* ═══ 선택: 도장 vs 서명 ═══ */}
        {mode === 'choose' && (
          <View style={styles.chooseWrap}>
            <Text style={styles.sectionTitle}>만들 방식을 선택하세요</Text>
            <TouchableOpacity style={styles.chooseCard} onPress={() => { setMode('seal_input'); setNameText(driver?.name ?? ''); }}>
              <View style={[styles.chooseIcon, { backgroundColor: colors.primary + '12' }]}><MaterialIcons name="verified" size={28} color={colors.primary} /></View>
              <View style={{ flex: 1 }}>
                <Text style={styles.chooseLabel}>도장</Text>
                <Text style={styles.chooseDesc}>이름 입력 → 다양한 글씨체·모양 선택</Text>
              </View>
              <MaterialIcons name="chevron-right" size={22} color={colors.outline} />
            </TouchableOpacity>
            <TouchableOpacity style={styles.chooseCard} onPress={() => setMode('sign')}>
              <View style={[styles.chooseIcon, { backgroundColor: colors.tertiary + '12' }]}><MaterialIcons name="gesture" size={28} color={colors.tertiary} /></View>
              <View style={{ flex: 1 }}>
                <Text style={styles.chooseLabel}>서명(사인)</Text>
                <Text style={styles.chooseDesc}>직접 손으로 서명을 그려 등록</Text>
              </View>
              <MaterialIcons name="chevron-right" size={22} color={colors.outline} />
            </TouchableOpacity>
          </View>
        )}

        {/* ═══ 도장 이름 입력 ═══ */}
        {mode === 'seal_input' && (
          <View style={styles.inputWrap}>
            <Text style={styles.sectionTitle}>이름을 입력하세요</Text>
            <TextInput
              style={styles.nameInput}
              value={nameText}
              onChangeText={setNameText}
              placeholder="예: 홍길동"
              placeholderTextColor={colors.outline}
              maxLength={10}
              autoFocus
            />
            <TouchableOpacity
              style={[styles.primaryBtn, (!nameText.trim() || generating) && styles.btnDisabled]}
              disabled={!nameText.trim() || generating}
              onPress={generatePreviews}
            >
              {generating ? <ActivityIndicator color="#fff" /> : <Text style={styles.primaryBtnText}>도장 만들기</Text>}
            </TouchableOpacity>
            <Text style={styles.hint}>한글로 입력하세요 (최대 10자)</Text>
          </View>
        )}

        {/* ═══ 도장 스타일 선택 ═══ */}
        {mode === 'seal_select' && (
          <View style={styles.selectWrap}>
            <Text style={styles.sectionTitle}>{nameText} 도장</Text>
            <Text style={styles.hint}>마음에 드는 스타일을 선택하세요</Text>

            {/* 모양 필터 */}
            <View style={styles.filterRow}>
              {(['all', 'circle', 'square', 'oval'] as ShapeFilter[]).map(s => (
                <TouchableOpacity
                  key={s}
                  style={[styles.filterChip, shapeFilter === s && styles.filterChipActive]}
                  onPress={() => setShapeFilter(s)}
                >
                  <Text style={[styles.filterChipText, shapeFilter === s && styles.filterChipTextActive]}>
                    {SHAPE_LABELS[s]}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>

            {/* 미리보기 그리드 */}
            <View style={styles.previewGrid}>
              {filteredPreviews.map(p => (
                <TouchableOpacity
                  key={p.id}
                  style={[styles.previewCard, selectedPreview?.id === p.id && styles.previewCardSelected]}
                  onPress={() => setSelectedPreview(p)}
                  activeOpacity={0.7}
                >
                  <Image source={{ uri: p.dataUri }} style={styles.previewImage} resizeMode="contain" />
                  <Text style={styles.previewFont}>{p.font}</Text>
                  {selectedPreview?.id === p.id && (
                    <View style={styles.selectedCheck}>
                      <MaterialIcons name="check-circle" size={20} color={colors.primary} />
                    </View>
                  )}
                </TouchableOpacity>
              ))}
            </View>

            {filteredPreviews.length === 0 && (
              <Text style={[styles.hint, { textAlign: 'center', marginTop: 20 }]}>해당 모양의 도장이 없습니다</Text>
            )}
          </View>
        )}

        {/* ═══ 서명(사인) ═══ */}
        {mode === 'sign' && (
          <View style={styles.signWrap}>
            <Text style={styles.sectionTitle}>손가락으로 서명하세요</Text>
            <SignaturePad
              width={SW - spacing.md * 4}
              height={200}
              onSignatureChange={setSignatureData}
            />
            <Text style={styles.hint}>서명은 계약서 전자서명에 사용됩니다</Text>
          </View>
        )}
      </ScrollView>

      {/* ═══ 하단 버튼 ═══ */}
      {(mode === 'seal_select' && selectedPreview) && (
        <View style={[styles.footer, { paddingBottom: Math.max(insets.bottom, Platform.OS === 'android' ? 16 : 0) + spacing.md }]}>
          <TouchableOpacity style={styles.primaryBtn} onPress={() => saveSeal(selectedPreview.dataUri, 'personal')} disabled={saving}>
            {saving ? <ActivityIndicator color="#fff" /> : <Text style={styles.primaryBtnText}>이 도장으로 등록하기</Text>}
          </TouchableOpacity>
        </View>
      )}
      {(mode === 'sign' && signatureData) && (
        <View style={[styles.footer, { paddingBottom: Math.max(insets.bottom, Platform.OS === 'android' ? 16 : 0) + spacing.md }]}>
          <TouchableOpacity style={styles.primaryBtn} onPress={() => { setNameText(driver?.name ?? '서명'); saveSeal(signatureData, 'personal'); }} disabled={saving}>
            {saving ? <ActivityIndicator color="#fff" /> : <Text style={styles.primaryBtnText}>서명 등록하기</Text>}
          </TouchableOpacity>
        </View>
      )}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.surface },
  header: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    paddingHorizontal: spacing.md, paddingVertical: spacing.sm,
    borderBottomWidth: 1, borderBottomColor: colors.outlineVariant + '20',
  },
  backBtn: { width: 40, height: 40, borderRadius: 20, alignItems: 'center', justifyContent: 'center' },
  headerTitle: { ...typography.titleMedium, color: colors.onSurface, fontWeight: '700' },
  scroll: { flex: 1 },
  scrollContent: { padding: spacing.md, paddingBottom: 120 },

  sectionTitle: { ...typography.titleSmall, color: colors.onSurface, fontWeight: '700', marginBottom: spacing.sm },
  hint: { ...typography.bodySmall, color: colors.onSurfaceVariant + '80', marginTop: spacing.xs },

  // Add
  addBtn: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8,
    padding: spacing.md, borderRadius: borderRadius.xl, borderWidth: 2,
    borderColor: colors.primary + '30', borderStyle: 'dashed', marginBottom: spacing.lg,
  },
  addBtnText: { ...typography.bodyMedium, color: colors.primary, fontWeight: '600' },

  // Empty
  empty: { alignItems: 'center', paddingVertical: 60 },
  emptyText: { ...typography.bodyMedium, color: colors.onSurfaceVariant, marginTop: 16 },
  emptySubText: { ...typography.bodySmall, color: colors.outline, marginTop: 4 },

  // Grid
  sealGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 12 },
  sealCard: {
    width: '47%', alignItems: 'center', padding: spacing.md, borderRadius: borderRadius.xl,
    borderWidth: 2, borderColor: colors.outlineVariant + '20', backgroundColor: colors.surfaceContainerLowest,
  },
  sealCardDefault: { borderColor: colors.primary + '40', backgroundColor: colors.primary + '05' },
  defaultBadge: { position: 'absolute', top: 8, left: 8, backgroundColor: colors.primary, borderRadius: 10, paddingHorizontal: 8, paddingVertical: 2 },
  defaultBadgeText: { color: '#fff', fontSize: 10, fontWeight: '700' },
  sealImage: { width: 72, height: 72 },
  sealPlaceholder: { width: 72, height: 72, borderRadius: 36, borderWidth: 3, borderColor: '#C42B2B', alignItems: 'center', justifyContent: 'center' },
  sealPlaceholderText: { fontSize: 24, fontWeight: '900', color: '#C42B2B' },
  sealName: { ...typography.bodySmall, color: colors.onSurface, fontWeight: '600', marginTop: 8 },
  sealActions: { flexDirection: 'row', gap: 16, marginTop: 8 },
  actionPrimary: { ...typography.labelSmall, color: colors.primary },
  actionDanger: { ...typography.labelSmall, color: colors.error },

  // Choose
  chooseWrap: { gap: 12 },
  chooseCard: {
    flexDirection: 'row', alignItems: 'center', gap: 12, padding: spacing.lg,
    borderRadius: borderRadius.xl, backgroundColor: colors.surfaceContainerLowest, ...shadows.sm,
  },
  chooseIcon: { width: 48, height: 48, borderRadius: 14, alignItems: 'center', justifyContent: 'center' },
  chooseLabel: { ...typography.bodyLarge, color: colors.onSurface, fontWeight: '600' },
  chooseDesc: { ...typography.bodySmall, color: colors.onSurfaceVariant, marginTop: 2 },

  // Input
  inputWrap: { gap: 12 },
  nameInput: {
    height: 52, borderRadius: borderRadius.lg, borderWidth: 1.5, borderColor: colors.outlineVariant + '40',
    paddingHorizontal: spacing.lg, fontSize: 18, color: colors.onSurface, backgroundColor: colors.surfaceContainerLowest,
    textAlign: 'center', fontWeight: '700', letterSpacing: 2,
  },

  // Buttons
  primaryBtn: {
    height: 50, borderRadius: borderRadius.lg, backgroundColor: colors.primary,
    alignItems: 'center', justifyContent: 'center',
  },
  primaryBtnText: { color: '#fff', fontSize: 15, fontWeight: '700' },
  btnDisabled: { opacity: 0.4 },

  // Select
  selectWrap: { gap: 8 },
  filterRow: { flexDirection: 'row', gap: 8, marginVertical: spacing.sm },
  filterChip: {
    paddingHorizontal: 14, paddingVertical: 6, borderRadius: 20,
    backgroundColor: colors.surfaceContainerLow, borderWidth: 1, borderColor: colors.outlineVariant + '20',
  },
  filterChipActive: { backgroundColor: colors.primary, borderColor: colors.primary },
  filterChipText: { ...typography.labelMedium, color: colors.onSurfaceVariant },
  filterChipTextActive: { color: '#fff', fontWeight: '700' },

  previewGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 10 },
  previewCard: {
    width: (SW - spacing.md * 2 - 30) / 3, alignItems: 'center', paddingVertical: spacing.md,
    borderRadius: borderRadius.lg, borderWidth: 2, borderColor: colors.outlineVariant + '15',
    backgroundColor: colors.surfaceContainerLowest,
  },
  previewCardSelected: { borderColor: colors.primary, backgroundColor: colors.primary + '08' },
  previewImage: { width: 64, height: 64, marginBottom: 6 },
  previewFont: { ...typography.labelSmall, color: colors.onSurfaceVariant, fontSize: 9 },
  selectedCheck: { position: 'absolute', top: 4, right: 4 },

  // Sign
  signWrap: { gap: 12 },

  // Footer
  footer: {
    padding: spacing.md, backgroundColor: colors.surface,
    borderTopWidth: 1, borderTopColor: colors.outlineVariant + '20',
  },
});
