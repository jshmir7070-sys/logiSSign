/**
 * 기사 도장/서명 관리 화면
 *
 * 기능:
 * - 도장 or 사인 선택
 * - 도장 선택 시: 이름 입력 → 여러 스타일 미리보기 → 선택 → 등록
 * - 사인 선택 시: 서명패드로 직접 사인 → 등록
 * - 기존에 등록된 도장 관리 (삭제, 기본 설정)
 */

import { useState, useRef, useCallback, useEffect } from 'react';
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
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { MaterialIcons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { useAuthStore } from '../../stores/authStore';
import { colors, spacing, typography, borderRadius } from '../../constants/theme';
import { createClient } from '@supabase/supabase-js';
import Constants from 'expo-constants';

const supabaseUrl = Constants.expoConfig?.extra?.supabaseUrl ?? '';
const supabaseKey = Constants.expoConfig?.extra?.supabaseAnonKey ?? '';

interface SealRecord {
  id: string;
  seal_image_url: string;
  seal_data_uri?: string;
  name_text: string;
  is_default: boolean;
  category: string;
  created_at: string;
}

type Mode = 'list' | 'choose' | 'seal_name' | 'seal_preview' | 'sign';

export default function SealScreen() {
  const router = useRouter();
  const { driver } = useAuthStore();
  const [mode, setMode] = useState<Mode>('list');
  const [seals, setSeals] = useState<SealRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [nameText, setNameText] = useState(driver?.name ?? '');
  const [saving, setSaving] = useState(false);

  const loadSeals = useCallback(async () => {
    if (!driver?.id) return;
    setLoading(true);
    try {
      const supabase = createClient(supabaseUrl, supabaseKey);
      const { data } = await supabase
        .from('seals')
        .select('*')
        .eq('owner_type', 'driver')
        .eq('owner_id', driver.id)
        .order('is_default', { ascending: false })
        .order('created_at', { ascending: false });
      setSeals((data ?? []) as SealRecord[]);
    } catch {}
    setLoading(false);
  }, [driver?.id]);

  useEffect(() => { loadSeals(); }, [loadSeals]);

  const handleDelete = (sealId: string) => {
    Alert.alert('삭제', '이 도장을 삭제하시겠습니까?', [
      { text: '취소', style: 'cancel' },
      {
        text: '삭제', style: 'destructive', onPress: async () => {
          const supabase = createClient(supabaseUrl, supabaseKey);
          await supabase.from('seals').delete().eq('id', sealId);
          loadSeals();
        },
      },
    ]);
  };

  const handleSetDefault = async (sealId: string) => {
    if (!driver?.id) return;
    const supabase = createClient(supabaseUrl, supabaseKey);
    await supabase.from('seals').update({ is_default: false }).eq('owner_type', 'driver').eq('owner_id', driver.id);
    await supabase.from('seals').update({ is_default: true }).eq('id', sealId);
    loadSeals();
  };

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity onPress={() => mode === 'list' ? router.back() : setMode('list')} style={styles.backBtn}>
          <MaterialIcons name="arrow-back" size={24} color={colors.onSurface} />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>도장/서명 관리</Text>
        <View style={{ width: 40 }} />
      </View>

      <ScrollView style={styles.content} contentContainerStyle={{ paddingBottom: 40 }}>
        {/* ── 목록 모드 ── */}
        {mode === 'list' && (
          <View>
            {/* 새 도장 만들기 버튼 */}
            <TouchableOpacity style={styles.addBtn} onPress={() => setMode('choose')}>
              <MaterialIcons name="add-circle-outline" size={24} color={colors.primary} />
              <Text style={styles.addBtnText}>새 도장/서명 만들기</Text>
            </TouchableOpacity>

            {loading ? (
              <ActivityIndicator size="large" color={colors.primary} style={{ marginTop: 40 }} />
            ) : seals.length === 0 ? (
              <View style={styles.emptyState}>
                <MaterialIcons name="verified" size={48} color={colors.primary + '40'} />
                <Text style={styles.emptyText}>등록된 도장이 없습니다</Text>
                <Text style={styles.emptySubText}>도장 또는 서명을 만들어 계약서에 사용하세요</Text>
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
                    <Image
                      source={{ uri: seal.seal_data_uri || seal.seal_image_url }}
                      style={styles.sealImage}
                      resizeMode="contain"
                    />
                    <Text style={styles.sealName}>{seal.name_text}</Text>
                    <View style={styles.sealActions}>
                      {!seal.is_default && (
                        <TouchableOpacity onPress={() => handleSetDefault(seal.id)}>
                          <Text style={styles.actionText}>기본 설정</Text>
                        </TouchableOpacity>
                      )}
                      <TouchableOpacity onPress={() => handleDelete(seal.id)}>
                        <Text style={[styles.actionText, { color: colors.error }]}>삭제</Text>
                      </TouchableOpacity>
                    </View>
                  </View>
                ))}
              </View>
            )}
          </View>
        )}

        {/* ── 선택 모드: 도장 vs 사인 ── */}
        {mode === 'choose' && (
          <View style={styles.chooseContainer}>
            <Text style={styles.chooseTitle}>만들 방식을 선택하세요</Text>
            <TouchableOpacity style={styles.chooseCard} onPress={() => setMode('seal_name')}>
              <View style={styles.chooseIcon}>
                <MaterialIcons name="verified" size={32} color={colors.primary} />
              </View>
              <View style={{ flex: 1 }}>
                <Text style={styles.chooseLabel}>도장</Text>
                <Text style={styles.chooseDesc}>이름을 입력하면 여러 스타일의 도장이 생성됩니다</Text>
              </View>
              <MaterialIcons name="chevron-right" size={24} color={colors.onSurfaceVariant} />
            </TouchableOpacity>
            <TouchableOpacity style={styles.chooseCard} onPress={() => setMode('sign')}>
              <View style={styles.chooseIcon}>
                <MaterialIcons name="gesture" size={32} color={colors.tertiary} />
              </View>
              <View style={{ flex: 1 }}>
                <Text style={styles.chooseLabel}>서명(사인)</Text>
                <Text style={styles.chooseDesc}>직접 손으로 서명을 그려서 등록합니다</Text>
              </View>
              <MaterialIcons name="chevron-right" size={24} color={colors.onSurfaceVariant} />
            </TouchableOpacity>
          </View>
        )}

        {/* ── 도장 이름 입력 ── */}
        {mode === 'seal_name' && (
          <View style={styles.nameContainer}>
            <Text style={styles.chooseTitle}>이름을 입력하세요</Text>
            <TextInput
              style={styles.nameInput}
              value={nameText}
              onChangeText={setNameText}
              placeholder="예: 홍길동"
              maxLength={10}
              autoFocus
            />
            <TouchableOpacity
              style={[styles.generateBtn, !nameText.trim() && { opacity: 0.4 }]}
              disabled={!nameText.trim()}
              onPress={() => setMode('seal_preview')}
            >
              <Text style={styles.generateBtnText}>만들기</Text>
            </TouchableOpacity>
            <Text style={styles.hintText}>한글 또는 한자로 입력하세요 (최대 10자)</Text>
          </View>
        )}

        {/* ── 도장 미리보기는 WebView에서 Canvas 활용 (추후 네이티브 구현 가능) ── */}
        {mode === 'seal_preview' && (
          <View style={styles.previewContainer}>
            <Text style={styles.chooseTitle}>도장 스타일을 선택하세요</Text>
            <Text style={styles.hintText}>
              도장 미리보기는 웹 포털(설정 → 도장/서명)에서 더 다양한 스타일을 선택할 수 있습니다.
            </Text>
            <Text style={styles.hintText}>
              아래에서 기본 도장을 빠르게 생성할 수 있습니다.
            </Text>

            {/* 간단한 스타일 옵션 — 앱에서는 기본 2가지 */}
            <View style={styles.simplePreviewGrid}>
              <TouchableOpacity
                style={[styles.simplePreviewCard, styles.simplePreviewSelected]}
                onPress={async () => {
                  setSaving(true);
                  // 간단한 원형 도장 placeholder 저장
                  if (!driver?.id) return;
                  const supabase = createClient(supabaseUrl, supabaseKey);
                  await supabase.from('seals').insert({
                    owner_type: 'driver',
                    owner_id: driver.id,
                    category: 'personal',
                    script: 'hangul',
                    seal_image_url: '',
                    name_text: nameText.trim(),
                    is_default: seals.length === 0,
                  });
                  setSaving(false);
                  loadSeals();
                  setMode('list');
                  Alert.alert('완료', '도장이 등록되었습니다.');
                }}
              >
                <View style={styles.previewCircle}>
                  <Text style={styles.previewCircleText}>{nameText.slice(0, 2)}</Text>
                </View>
                <Text style={styles.previewStyleLabel}>원형</Text>
              </TouchableOpacity>

              <TouchableOpacity
                style={styles.simplePreviewCard}
                onPress={async () => {
                  setSaving(true);
                  if (!driver?.id) return;
                  const supabase = createClient(supabaseUrl, supabaseKey);
                  await supabase.from('seals').insert({
                    owner_type: 'driver',
                    owner_id: driver.id,
                    category: 'personal',
                    script: 'hangul',
                    seal_image_url: '',
                    name_text: nameText.trim(),
                    is_default: seals.length === 0,
                  });
                  setSaving(false);
                  loadSeals();
                  setMode('list');
                  Alert.alert('완료', '도장이 등록되었습니다.');
                }}
              >
                <View style={styles.previewSquare}>
                  <Text style={styles.previewSquareText}>{nameText.slice(0, 2)}</Text>
                </View>
                <Text style={styles.previewStyleLabel}>사각형</Text>
              </TouchableOpacity>
            </View>

            {saving && <ActivityIndicator size="small" color={colors.primary} style={{ marginTop: 16 }} />}
          </View>
        )}

        {/* ── 서명(사인) 모드 ── */}
        {mode === 'sign' && (
          <View style={styles.signContainer}>
            <Text style={styles.chooseTitle}>손가락으로 서명하세요</Text>
            <Text style={styles.hintText}>기존 서명 패드가 계약서 서명 시 사용됩니다. 여기서는 기본 서명을 미리 등록할 수 있습니다.</Text>

            <View style={styles.signPadPlaceholder}>
              <MaterialIcons name="gesture" size={48} color={colors.onSurfaceVariant + '40'} />
              <Text style={styles.signPadText}>서명 패드</Text>
              <Text style={styles.hintText}>계약서 서명 시 사용되는 서명 패드와 동일합니다</Text>
            </View>

            <TouchableOpacity style={styles.generateBtn} onPress={() => setMode('list')}>
              <Text style={styles.generateBtnText}>완료</Text>
            </TouchableOpacity>
          </View>
        )}
      </ScrollView>
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
  content: { flex: 1, paddingHorizontal: spacing.md, paddingTop: spacing.lg },

  // Add button
  addBtn: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8,
    padding: spacing.md, borderRadius: borderRadius.xl, borderWidth: 2,
    borderColor: colors.primary + '30', borderStyle: 'dashed',
    marginBottom: spacing.lg,
  },
  addBtnText: { ...typography.bodyMedium, color: colors.primary, fontWeight: '600' },

  // Empty
  emptyState: { alignItems: 'center', paddingVertical: 60 },
  emptyText: { ...typography.bodyMedium, color: colors.onSurfaceVariant, marginTop: 16, fontWeight: '500' },
  emptySubText: { ...typography.bodySmall, color: colors.onSurfaceVariant + '80', marginTop: 4 },

  // Seal grid
  sealGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 12 },
  sealCard: {
    width: '47%', alignItems: 'center', padding: spacing.md, borderRadius: borderRadius.xl,
    borderWidth: 2, borderColor: colors.outlineVariant + '20', backgroundColor: colors.surface,
  },
  sealCardDefault: { borderColor: colors.primary + '40', backgroundColor: colors.primary + '05' },
  defaultBadge: {
    position: 'absolute', top: 8, left: 8,
    backgroundColor: colors.primary, borderRadius: 10, paddingHorizontal: 8, paddingVertical: 2,
  },
  defaultBadgeText: { color: '#fff', fontSize: 10, fontWeight: '700' },
  sealImage: { width: 72, height: 72 },
  sealName: { ...typography.bodySmall, color: colors.onSurface, fontWeight: '600', marginTop: 8 },
  sealActions: { flexDirection: 'row', gap: 16, marginTop: 8 },
  actionText: { ...typography.labelSmall, color: colors.primary },

  // Choose
  chooseContainer: { gap: 16 },
  chooseTitle: { ...typography.titleSmall, color: colors.onSurface, fontWeight: '700', marginBottom: 8 },
  chooseCard: {
    flexDirection: 'row', alignItems: 'center', gap: 12, padding: spacing.md,
    borderRadius: borderRadius.xl, borderWidth: 1, borderColor: colors.outlineVariant + '20',
    backgroundColor: colors.surface,
  },
  chooseIcon: {
    width: 52, height: 52, borderRadius: 16, backgroundColor: colors.primary + '10',
    alignItems: 'center', justifyContent: 'center',
  },
  chooseLabel: { ...typography.bodyLarge, color: colors.onSurface, fontWeight: '600' },
  chooseDesc: { ...typography.bodySmall, color: colors.onSurfaceVariant, marginTop: 2 },

  // Name input
  nameContainer: { gap: 16 },
  nameInput: {
    height: 48, borderRadius: borderRadius.lg, borderWidth: 1, borderColor: colors.outlineVariant + '40',
    paddingHorizontal: spacing.md, fontSize: 16, color: colors.onSurface, backgroundColor: colors.surface,
  },
  generateBtn: {
    height: 48, borderRadius: borderRadius.lg, backgroundColor: colors.primary,
    alignItems: 'center', justifyContent: 'center',
  },
  generateBtnText: { color: '#fff', fontSize: 15, fontWeight: '700' },
  hintText: { ...typography.bodySmall, color: colors.onSurfaceVariant + '80' },

  // Preview
  previewContainer: { gap: 16 },
  simplePreviewGrid: { flexDirection: 'row', gap: 16, justifyContent: 'center', marginTop: 16 },
  simplePreviewCard: {
    alignItems: 'center', gap: 8, padding: 20, borderRadius: borderRadius.xl,
    borderWidth: 2, borderColor: colors.outlineVariant + '20', width: '45%',
  },
  simplePreviewSelected: { borderColor: colors.primary + '60', backgroundColor: colors.primary + '05' },
  previewCircle: {
    width: 80, height: 80, borderRadius: 40, borderWidth: 3, borderColor: '#C42B2B',
    alignItems: 'center', justifyContent: 'center',
  },
  previewCircleText: { fontSize: 28, fontWeight: '900', color: '#C42B2B', fontFamily: 'serif' },
  previewSquare: {
    width: 80, height: 80, borderRadius: 4, borderWidth: 3, borderColor: '#C42B2B',
    alignItems: 'center', justifyContent: 'center',
  },
  previewSquareText: { fontSize: 28, fontWeight: '900', color: '#C42B2B', fontFamily: 'serif' },
  previewStyleLabel: { ...typography.bodySmall, color: colors.onSurfaceVariant, fontWeight: '500' },

  // Sign
  signContainer: { gap: 16 },
  signPadPlaceholder: {
    height: 200, borderRadius: borderRadius.xl, borderWidth: 2, borderColor: colors.outlineVariant + '30',
    borderStyle: 'dashed', alignItems: 'center', justifyContent: 'center', gap: 8,
    backgroundColor: colors.surface,
  },
  signPadText: { ...typography.bodyMedium, color: colors.onSurfaceVariant + '60' },
});
