/**
 * 외부 문서 서명 화면 (기사 앱)
 *
 * PDF 미리보기 위에 서명 필드 오버레이 → 기사가 체크/도장/서명 수행 → 제출
 *
 * 푸시알림 → document/{deliveryId} → 이 화면
 */

import { useState, useEffect, useCallback } from 'react';
import {
  View,
  Text,
  ScrollView,
  TouchableOpacity,
  Alert,
  Modal,
  StyleSheet,
  useWindowDimensions,
  ActivityIndicator,
  Image,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { MaterialIcons } from '@expo/vector-icons';
import Header from '../../../components/common/Header';
import Button from '../../../components/common/Button';
import SignaturePad from '../../../components/common/SignaturePad';
import { useAuthStore } from '../../../stores/authStore';
import { colors, spacing, borderRadius } from '../../../constants/theme';
import { supabase } from '../../../lib/supabase';

/* ══════════════════════ 타입 ══════════════════════ */

type FieldType = 'checkbox' | 'signature' | 'seal' | 'date' | 'text';

interface SignField {
  id: string;
  field_type: FieldType;
  page_number: number;
  x: number;
  y: number;
  width: number;
  height: number;
  label: string | null;
  required: boolean;
  sort_order: number;
}

interface FieldResponse {
  value?: string;
  imageData?: string;
}

const FIELD_COLORS: Record<FieldType, string> = {
  checkbox: '#2563EB',
  signature: '#7C3AED',
  seal: '#DC2626',
  date: '#059669',
  text: '#D97706',
};

const FIELD_ICONS: Record<FieldType, string> = {
  checkbox: 'check-box-outline-blank',
  signature: 'draw',
  seal: 'circle',
  date: 'event',
  text: 'text-fields',
};

/* ══════════════════════ 메인 컴포넌트 ══════════════════════ */

export default function DocumentSignScreen() {
  const { id: deliveryId } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const { width: screenW } = useWindowDimensions();
  const session = useAuthStore((s) => s.session);
  const userId = session?.user?.id;

  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [docTitle, setDocTitle] = useState('');
  const [pdfUrl, setPdfUrl] = useState('');
  const [fields, setFields] = useState<SignField[]>([]);
  const [responses, setResponses] = useState<Record<string, FieldResponse>>({});
  const [currentPage, setCurrentPage] = useState(1);

  // 서명패드 모달
  const [sigModalField, setSigModalField] = useState<string | null>(null);

  // ── 데이터 로드 ──
  useEffect(() => {
    if (!deliveryId) return;
    (async () => {
      // delivery → document_file 조회
      const { data: delivery } = await supabase
        .from('document_deliveries')
        .select('document_file_id, title')
        .eq('id', deliveryId)
        .single();

      if (!delivery?.document_file_id) {
        Alert.alert('오류', '문서를 찾을 수 없습니다');
        return;
      }

      setDocTitle(delivery.title);

      // 문서 파일 정보
      const { data: docFile } = await supabase
        .from('document_files')
        .select('file_url')
        .eq('id', delivery.document_file_id)
        .single();

      if (docFile?.file_url) {
        let nextPdfUrl = docFile.file_url;

        if (!nextPdfUrl.startsWith('http')) {
          const { data: signedData, error: signedError } = await supabase.storage
            .from('documents')
            .createSignedUrl(nextPdfUrl, 3600);

          if (signedError || !signedData?.signedUrl) {
            Alert.alert('오류', '문서 URL을 생성하지 못했습니다.');
            return;
          }

          nextPdfUrl = signedData.signedUrl;
        }

        setPdfUrl(nextPdfUrl);
      }

      // 서명 필드 목록
      const { data: signFields } = await supabase
        .from('document_sign_fields')
        .select('*')
        .eq('document_file_id', delivery.document_file_id)
        .order('page_number')
        .order('sort_order');

      setFields((signFields ?? []) as SignField[]);

      // 기존 응답 로드 (중간 저장분)
      const { data: existingResp } = await supabase
        .from('document_sign_responses')
        .select('field_id, value, image_data')
        .eq('delivery_id', deliveryId);

      if (existingResp) {
        const map: Record<string, FieldResponse> = {};
        for (const r of existingResp) {
          map[r.field_id] = { value: r.value ?? undefined, imageData: r.image_data ?? undefined };
        }
        setResponses(map);
      }

      // 열람 상태 업데이트
      await supabase
        .from('document_deliveries')
        .update({ status: 'viewed', viewed_at: new Date().toISOString() })
        .eq('id', deliveryId)
        .in('status', ['sent', 'delivered']);

      setLoading(false);
    })();
  }, [deliveryId]);

  // ── 체크박스 토글 ──
  const toggleCheckbox = useCallback((fieldId: string) => {
    setResponses(prev => {
      const cur = prev[fieldId]?.value === 'true';
      return { ...prev, [fieldId]: { value: cur ? 'false' : 'true' } };
    });
  }, []);

  // ── 도장 날인 (등록된 도장 자동 사용) ──
  const applySeal = useCallback(async (fieldId: string) => {
    if (!userId) return;
    // 등록된 기본 도장 조회
    const { data: seal } = await supabase
      .from('seals')
      .select('seal_data_uri')
      .eq('owner_id', userId)
      .eq('is_default', true)
      .limit(1)
      .single();

    if (seal?.seal_data_uri) {
      setResponses(prev => ({
        ...prev,
        [fieldId]: { imageData: seal.seal_data_uri ?? undefined, value: 'sealed' },
      }));
    } else {
      Alert.alert('도장 없음', '등록된 도장이 없습니다. 설정에서 도장을 먼저 등록해주세요.');
    }
  }, [userId]);

  // ── 서명 완료 콜백 ──
  const handleSignatureComplete = useCallback((base64: string | null) => {
    if (!sigModalField || !base64) {
      setSigModalField(null);
      return;
    }
    setResponses(prev => ({
      ...prev,
      [sigModalField]: { imageData: base64, value: 'signed' },
    }));
    setSigModalField(null);
  }, [sigModalField]);

  // ── 날짜 자동입력 ──
  const applyDate = useCallback((fieldId: string) => {
    const today = new Date().toLocaleDateString('ko-KR', {
      year: 'numeric', month: '2-digit', day: '2-digit',
    });
    setResponses(prev => ({ ...prev, [fieldId]: { value: today } }));
  }, []);

  // ── 필드 터치 핸들러 ──
  const handleFieldTap = useCallback((field: SignField) => {
    switch (field.field_type) {
      case 'checkbox':
        toggleCheckbox(field.id);
        break;
      case 'seal':
        applySeal(field.id);
        break;
      case 'signature':
        setSigModalField(field.id);
        break;
      case 'date':
        applyDate(field.id);
        break;
      case 'text':
        // 텍스트는 Alert prompt 로 간단 처리 (iOS만 지원)
        if (typeof Alert.prompt === 'function') {
          Alert.prompt('텍스트 입력', field.label ?? '내용을 입력하세요', (text: string) => {
            if (text) setResponses(prev => ({ ...prev, [field.id]: { value: text } }));
          });
        } else {
          Alert.alert('안내', '텍스트 입력은 추후 지원됩니다');
        }
        break;
    }
  }, [toggleCheckbox, applySeal, applyDate]);

  // ── 제출 ──
  const handleSubmit = useCallback(async () => {
    // 필수 필드 확인
    const missingLabels: string[] = [];
    for (const f of fields) {
      if (!f.required) continue;
      const resp = responses[f.id];
      if (!resp || (!resp.value && !resp.imageData)) {
        missingLabels.push(f.label || f.field_type);
      }
    }

    if (missingLabels.length > 0) {
      Alert.alert('미완료 항목', `다음 필수 항목을 완료해주세요:\n\n${missingLabels.join('\n')}`);
      return;
    }

    Alert.alert('서명 제출', '모든 항목을 확인하셨나요? 제출하시겠습니까?', [
      { text: '취소', style: 'cancel' },
      {
        text: '제출',
        onPress: async () => {
          setSubmitting(true);
          try {
            // 각 응답을 DB에 저장
            for (const f of fields) {
              const resp = responses[f.id];
              if (!resp) continue;
              await supabase.from('document_sign_responses').upsert({
                delivery_id: deliveryId,
                field_id: f.id,
                driver_id: userId ?? '',
                value: resp.value ?? null,
                image_data: resp.imageData ?? null,
                signed_at: new Date().toISOString(),
              }, { onConflict: 'delivery_id,field_id' });
            }

            // delivery 상태 업데이트
            await supabase
              .from('document_deliveries')
              .update({ status: 'signed', signed_at: new Date().toISOString() })
              .eq('id', deliveryId);

            Alert.alert('완료', '서명이 제출되었습니다.', [
              { text: '확인', onPress: () => router.back() },
            ]);
          } catch (err) {
            Alert.alert('오류', '서명 제출 중 오류가 발생했습니다.');
          }
          setSubmitting(false);
        },
      },
    ]);
  }, [fields, responses, deliveryId, userId, router]);

  // ── 현재 페이지 필드 ──
  const pageFields = fields.filter(f => f.page_number === currentPage);

  // 필드 완료 카운트
  const totalRequired = fields.filter(f => f.required).length;
  const completedRequired = fields.filter(f => {
    if (!f.required) return false;
    const r = responses[f.id];
    return r && (r.value || r.imageData);
  }).length;

  // PDF 프리뷰 크기 (화면 폭에 맞춤)
  const previewW = screenW - 32;
  const previewH = previewW * (841 / 595); // A4 비율

  if (loading) {
    return (
      <SafeAreaView style={styles.container}>
        <Header title="문서 서명" showBack />
        <View style={styles.loadingWrap}>
          <ActivityIndicator size="large" color={colors.primary} />
          <Text style={styles.loadingText}>문서 로딩 중...</Text>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.container}>
      <Header title={docTitle || '문서 서명'} showBack />

      {/* 진행률 바 */}
      <View style={styles.progressBar}>
        <View style={[styles.progressFill, { width: `${totalRequired > 0 ? (completedRequired / totalRequired) * 100 : 0}%` }]} />
      </View>
      <Text style={styles.progressText}>
        {completedRequired}/{totalRequired} 항목 완료
      </Text>

      <ScrollView contentContainerStyle={styles.scrollContent}>
        {/* PDF + 필드 오버레이 */}
        <View style={[styles.pdfContainer, { width: previewW, height: previewH }]}>
          {/* PDF 배경은 이미지/WebView로 렌더링 */}
          {pdfUrl ? (
            <View style={StyleSheet.absoluteFill}>
              <Text style={styles.pdfPlaceholder}>PDF 미리보기</Text>
            </View>
          ) : null}

          {/* 필드 오버레이 */}
          {pageFields.map(field => {
            const resp = responses[field.id];
            const isCompleted = resp && (resp.value || resp.imageData);
            const fieldColor = FIELD_COLORS[field.field_type];

            return (
              <TouchableOpacity
                key={field.id}
                activeOpacity={0.7}
                onPress={() => handleFieldTap(field)}
                style={[
                  styles.fieldOverlay,
                  {
                    left: `${field.x}%`,
                    top: `${field.y}%`,
                    width: `${field.width}%`,
                    height: `${field.height}%`,
                    borderColor: isCompleted ? '#22C55E' : fieldColor,
                    backgroundColor: isCompleted ? '#22C55E18' : `${fieldColor}18`,
                  },
                ]}
              >
                {field.field_type === 'checkbox' && (
                  <MaterialIcons
                    name={resp?.value === 'true' ? 'check-box' : 'check-box-outline-blank'}
                    size={Math.min(previewW * field.width / 100, previewH * field.height / 100) * 0.7}
                    color={resp?.value === 'true' ? '#22C55E' : fieldColor}
                  />
                )}

                {(field.field_type === 'signature' || field.field_type === 'seal') && resp?.imageData && (
                  <Image
                    source={{ uri: resp.imageData }}
                    style={styles.fieldImage}
                    resizeMode="contain"
                  />
                )}

                {(field.field_type === 'signature' || field.field_type === 'seal') && !resp?.imageData && (
                  <Text style={[styles.fieldLabel, { color: fieldColor }]}>
                    {field.field_type === 'signature' ? '터치하여 서명' : '터치하여 날인'}
                  </Text>
                )}

                {field.field_type === 'date' && (
                  <Text style={[styles.fieldDateText, { color: resp?.value ? '#059669' : '#9CA3AF' }]}>
                    {resp?.value || '터치하여 날짜'}
                  </Text>
                )}

                {field.field_type === 'text' && (
                  <Text style={[styles.fieldDateText, { color: resp?.value ? '#D97706' : '#9CA3AF' }]} numberOfLines={1}>
                    {resp?.value || '터치하여 입력'}
                  </Text>
                )}
              </TouchableOpacity>
            );
          })}
        </View>
      </ScrollView>

      {/* 하단 버튼 */}
      <View style={styles.bottomBar}>
        <Button
          title={submitting ? '제출 중...' : '서명 제출'}
          onPress={handleSubmit}
          disabled={submitting || completedRequired < totalRequired}
          style={styles.submitButton}
        />
      </View>

      {/* 서명패드 모달 */}
      <Modal visible={!!sigModalField} animationType="slide" transparent>
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <Text style={styles.modalTitle}>자필 서명</Text>
            <Text style={styles.modalDesc}>아래 영역에 서명해 주세요</Text>

            <SignaturePad
              width={screenW - 64}
              height={200}
              onSignatureChange={handleSignatureComplete}
            />

            <View style={styles.modalButtons}>
              <TouchableOpacity
                onPress={() => setSigModalField(null)}
                style={styles.modalCancel}
              >
                <Text style={styles.modalCancelText}>취소</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>
    </SafeAreaView>
  );
}

/* ══════════════════════ 스타일 ══════════════════════ */

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#F8F9FA' },
  loadingWrap: { flex: 1, justifyContent: 'center', alignItems: 'center', gap: 12 },
  loadingText: { fontSize: 14, color: '#9CA3AF' },
  progressBar: {
    height: 3,
    backgroundColor: '#E5E7EB',
    marginHorizontal: 16,
    marginTop: 8,
    borderRadius: 2,
    overflow: 'hidden',
  },
  progressFill: { height: '100%', backgroundColor: '#F59E0B', borderRadius: 2 },
  progressText: {
    fontSize: 12,
    color: '#6B7280',
    textAlign: 'right',
    paddingHorizontal: 16,
    paddingTop: 4,
    paddingBottom: 8,
  },
  scrollContent: { alignItems: 'center', paddingVertical: 16 },
  pdfContainer: {
    backgroundColor: '#FFF',
    borderRadius: 4,
    overflow: 'hidden',
    elevation: 3,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    position: 'relative',
  },
  pdfPlaceholder: {
    flex: 1,
    textAlign: 'center',
    textAlignVertical: 'center',
    color: '#D1D5DB',
    fontSize: 16,
  },
  fieldOverlay: {
    position: 'absolute',
    borderWidth: 2,
    borderRadius: 4,
    justifyContent: 'center',
    alignItems: 'center',
    borderStyle: 'dashed',
  },
  fieldImage: { width: '90%', height: '90%' },
  fieldLabel: { fontSize: 9, textAlign: 'center' },
  fieldDateText: { fontSize: 10, textAlign: 'center' },
  bottomBar: {
    padding: 16,
    paddingBottom: 24,
    backgroundColor: '#FFF',
    borderTopWidth: 1,
    borderTopColor: '#E5E7EB',
  },
  submitButton: { backgroundColor: '#F59E0B' },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.5)',
    justifyContent: 'flex-end',
  },
  modalContent: {
    backgroundColor: '#FFF',
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    padding: 24,
    paddingBottom: 40,
  },
  modalTitle: { fontSize: 18, fontWeight: '700', color: '#111', marginBottom: 4 },
  modalDesc: { fontSize: 13, color: '#6B7280', marginBottom: 16 },
  modalButtons: { flexDirection: 'row', justifyContent: 'center', marginTop: 16 },
  modalCancel: {
    paddingHorizontal: 24,
    paddingVertical: 10,
    borderRadius: 8,
    backgroundColor: '#F3F4F6',
  },
  modalCancelText: { fontSize: 14, color: '#6B7280' },
});
