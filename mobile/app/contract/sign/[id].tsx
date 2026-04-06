/**
 * 계약서 서명 화면 (기사 앱)
 *
 * 두 가지 모드:
 * 1. text 모드: 기존 동의 체크 + 서명패드 + 본인인증
 * 2. pdf 모드: PDF 미리보기 + sign_fields 오버레이 (외부문서 서명과 동일)
 */

import { useState, useEffect, useCallback } from 'react';
import {
  View,
  Text,
  ScrollView,
  Alert,
  StyleSheet,
  useWindowDimensions,
  TouchableOpacity,
  Platform,
  ActivityIndicator,
  Modal,
  Image,
  TextInput,
} from 'react-native';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { MaterialIcons } from '@expo/vector-icons';
import Header from '../../../components/common/Header';
import Button from '../../../components/common/Button';
import SignaturePad from '../../../components/common/SignaturePad';
import { useAuthStore } from '../../../stores/authStore';
import { getContractDetail, signContract } from '../../../services/contract.service';
import {
  requestIdentityVerification,
  IDENTITY_PROVIDERS,
  type IdentityProvider,
  type VerificationResult,
} from '../../../services/identity.service';
import { colors, spacing, typography, borderRadius, shadows } from '../../../constants/theme';
import { supabase } from '../../../lib/supabase';

/* ══════════════════════ PDF 필드 타입 ══════════════════════ */

type FieldType = 'checkbox' | 'signature' | 'seal' | 'date' | 'text';

interface SignField {
  id: string;
  field_type: FieldType;
  field_owner?: 'sender' | 'receiver';
  page_number: number;
  x: number;
  y: number;
  width: number;
  height: number;
  label: string | null;
  required: boolean;
  sort_order: number;
  binding_variable?: string;
  binding_var?: string;
  default_value?: string | null;
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

function compareSignFieldOrder(a: SignField, b: SignField) {
  return (a.sort_order - b.sort_order) || (a.page_number - b.page_number) || (a.y - b.y) || (a.x - b.x);
}

/* ══════════════════════ 동의 항목 (text 모드) ══════════════════════ */

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

/* ══════════════════════ 메인 컴포넌트 ══════════════════════ */

export default function ContractSignScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const driver = useAuthStore((s) => s.driver);
  const { width } = useWindowDimensions();
  const insets = useSafeAreaInsets();

  // 공통 상태
  const [loading, setLoading] = useState(true);
  const [signing, setSigning] = useState(false);
  const [identityResult, setIdentityResult] = useState<VerificationResult | null>(null);
  const [verifying, setVerifying] = useState(false);
  const [contractTitle, setContractTitle] = useState('');

  // 모드 분기
  const [templateType, setTemplateType] = useState<'text' | 'pdf'>('text');

  // text 모드 상태
  const [signatureData, setSignatureData] = useState<string | null>(null);
  const [consents, setConsents] = useState<Record<string, boolean>>({});

  // pdf 모드 상태
  const [pdfUrl, setPdfUrl] = useState('');
  const [signFields, setSignFields] = useState<SignField[]>([]);
  const [fieldResponses, setFieldResponses] = useState<Record<string, FieldResponse>>({});
  const [currentPage, setCurrentPage] = useState(1);
  const [sigModalField, setSigModalField] = useState<string | null>(null);
  const [textModalFieldId, setTextModalFieldId] = useState<string | null>(null);
  const [textModalValue, setTextModalValue] = useState('');

  const padWidth = width - spacing.lg * 2;
  const padHeight = 200;

  // ── 데이터 로드 ──
  useEffect(() => {
    if (!id || !driver?.id) return;
    (async () => {
      const { data: contract, error } = await getContractDetail(id, driver.id);
      if (error || !contract) {
        Alert.alert('오류', error ?? '계약서를 찾을 수 없습니다');
        setLoading(false);
        return;
      }

      setContractTitle(contract.title ?? '');

      const type = (contract as Record<string, unknown>).template_type as string;
      if (type === 'pdf') {
        setTemplateType('pdf');
        const rawPdfUrl = ((contract as Record<string, unknown>).template_pdf_url as string) ?? '';
        if (rawPdfUrl.startsWith('http')) {
          setPdfUrl(rawPdfUrl);
        } else if (rawPdfUrl) {
          const { data: signed } = await supabase.storage.from('contracts').createSignedUrl(rawPdfUrl, 3600);
          setPdfUrl(signed?.signedUrl ?? '');
        } else {
          setPdfUrl('');
        }
        const fields = (contract as Record<string, unknown>).sign_fields;
        if (Array.isArray(fields)) {
          const sortedFields = [...(fields as SignField[])].sort(compareSignFieldOrder);
          setSignFields(sortedFields);
          // 자동 채움: sender 필드 + receiver 바인딩 필드
          const autoResponses: Record<string, FieldResponse> = {};
          for (const f of sortedFields) {
            // sender 필드: default_value가 이미 전송 시 채워져 옴
            if (f.field_owner === 'sender' && f.default_value) {
              if (f.field_type === 'seal' || f.field_type === 'signature') {
                autoResponses[f.id] = { imageData: f.default_value };
              } else {
                autoResponses[f.id] = { value: f.default_value };
              }
            }
            // receiver 필드: default_value(바인딩으로 채워진 값) 또는 바인딩 변수 해석
            if (f.field_owner !== 'sender' || !f.field_owner) {
              if (f.default_value && (f.field_type === 'text' || f.field_type === 'date')) {
                autoResponses[f.id] = { value: f.default_value };
              } else if ((f.binding_variable || f.binding_var) && f.field_type === 'text') {
                const bindKey = f.binding_variable || f.binding_var || '';
                const val = resolveBindingVariable(bindKey, driver);
                if (val) autoResponses[f.id] = { value: val };
              }
            }
          }
          setFieldResponses(autoResponses);
        }
      } else {
        setTemplateType('text');
      }

      // 열람 상태 업데이트
      if (contract.status === 'sent') {
        await supabase
          .from('contracts')
          .update({ status: 'viewed' })
          .eq('id', id)
          .eq('driver_id', driver.id);
      }

      setLoading(false);
    })();
  }, [id, driver?.id]);

  // ── 바인딩 변수 → 실제값 ──
  function resolveBindingVariable(variable: string, driverData: Record<string, unknown> | null): string | null {
    if (!driverData) return null;
    const map: Record<string, string | null> = {
      '{{기사명}}': (driverData.name as string) ?? null,
      '{{연락처}}': (driverData.phone as string) ?? null,
      '{{오늘날짜}}': new Date().toLocaleDateString('ko-KR'),
    };
    return map[variable] ?? null;
  }

  // ════════════════ TEXT 모드 핸들러 ════════════════

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

  const canSubmitText = allRequiredChecked && !!signatureData && !!identityResult?.verified;

  // ════════════════ PDF 모드 핸들러 ════════════════

  const toggleCheckbox = useCallback((fieldId: string) => {
    setFieldResponses(prev => {
      const cur = prev[fieldId]?.value === 'true';
      return { ...prev, [fieldId]: { value: cur ? 'false' : 'true' } };
    });
  }, []);

  const applySeal = useCallback(async (fieldId: string) => {
    const userId = driver?.id;
    if (!userId) return;
    const { data: seal } = await supabase
      .from('seals')
      .select('seal_data_uri')
      .eq('owner_id', userId)
      .eq('is_default', true)
      .limit(1)
      .single();

    if (seal?.seal_data_uri) {
      setFieldResponses(prev => ({
        ...prev,
        [fieldId]: { imageData: seal.seal_data_uri ?? undefined, value: 'sealed' },
      }));
    } else {
      Alert.alert('도장 없음', '등록된 도장이 없습니다. 설정에서 도장을 먼저 등록해주세요.');
    }
  }, [driver?.id]);

  const handlePdfSignatureComplete = useCallback((base64: string | null) => {
    if (!sigModalField || !base64) {
      setSigModalField(null);
      return;
    }
    setFieldResponses(prev => ({
      ...prev,
      [sigModalField]: { imageData: base64, value: 'signed' },
    }));
    setSigModalField(null);
  }, [sigModalField]);

  const applyDate = useCallback((fieldId: string) => {
    const today = new Date().toLocaleDateString('ko-KR', {
      year: 'numeric', month: '2-digit', day: '2-digit',
    });
    setFieldResponses(prev => ({ ...prev, [fieldId]: { value: today } }));
  }, []);

  const orderedReceiverTextFields = [...signFields]
    .filter((field) => field.field_owner !== 'sender' && field.field_type === 'text')
    .sort(compareSignFieldOrder);

  const openTextFieldModal = useCallback((field: SignField) => {
    setCurrentPage(field.page_number);
    setTextModalFieldId(field.id);
    setTextModalValue(fieldResponses[field.id]?.value ?? field.default_value ?? '');
  }, [fieldResponses]);

  const moveTextFieldModal = useCallback((direction: -1 | 1) => {
    if (!textModalFieldId) return;

    const currentIndex = orderedReceiverTextFields.findIndex((field) => field.id === textModalFieldId);
    const nextField = orderedReceiverTextFields[currentIndex + direction];
    if (!nextField) return;

    setCurrentPage(nextField.page_number);
    setTextModalFieldId(nextField.id);
    setTextModalValue(fieldResponses[nextField.id]?.value ?? nextField.default_value ?? '');
  }, [fieldResponses, orderedReceiverTextFields, textModalFieldId]);

  const submitTextFieldValue = useCallback((direction?: -1 | 1) => {
    if (!textModalFieldId) return;

    const nextValue = textModalValue.trim();
    setFieldResponses((prev) => {
      const updated = { ...prev };
      if (nextValue) updated[textModalFieldId] = { value: nextValue };
      else delete updated[textModalFieldId];
      return updated;
    });

    if (direction) {
      moveTextFieldModal(direction);
      return;
    }

    setTextModalFieldId(null);
  }, [moveTextFieldModal, textModalFieldId, textModalValue]);

  const handleFieldTap = useCallback((field: SignField) => {
    // sender 필드는 읽기 전용 — 터치 무시
    if (field.field_owner === 'sender') return;

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
        openTextFieldModal(field);
        break;
    }
  }, [toggleCheckbox, applySeal, applyDate, openTextFieldModal]);

  // PDF 필드 완료 상태
  const pageFields = signFields.filter(f => f.page_number === currentPage);
  const totalPages = Math.max(1, ...signFields.map(f => f.page_number));
  const activeTextField = textModalFieldId
    ? orderedReceiverTextFields.find((field) => field.id === textModalFieldId) ?? null
    : null;
  const activeTextFieldIndex = activeTextField
    ? orderedReceiverTextFields.findIndex((field) => field.id === activeTextField.id)
    : -1;
  const hasPrevTextField = activeTextFieldIndex > 0;
  const hasNextTextField = activeTextFieldIndex >= 0 && activeTextFieldIndex < orderedReceiverTextFields.length - 1;
  // receiver 필드만 필수 체크 (sender는 자동 채움)
  const totalRequired = signFields.filter(f => f.required && f.field_owner !== 'sender').length;
  const completedRequired = signFields.filter(f => {
    if (!f.required || f.field_owner === 'sender') return false;
    const r = fieldResponses[f.id];
    return r && (r.value || r.imageData);
  }).length;

  // PDF 모드에서도 서명 필드가 하나 이상 있어야 canSubmit
  const canSubmitPdf = completedRequired >= totalRequired && !!identityResult?.verified;

  // PDF 프리뷰 크기
  const previewW = width - 32;
  const previewH = previewW * (841 / 595);

  // ════════════════ 본인인증 (공통) ════════════════

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

  // ════════════════ 서명 제출 ════════════════

  const handleSign = async () => {
    if (!id || !driver?.id) return;

    // text 모드: 기존 서명 데이터
    // pdf 모드: 모든 필드 응답을 signatureBase64에 JSON으로 담기
    let signaturePayload: string;
    let consentPayload = undefined;

    if (templateType === 'text') {
      if (!signatureData || !allRequiredChecked) return;
      signaturePayload = signatureData;
      consentPayload = {
        consent_contract: consents['contract'] ?? false,
        consent_privacy_collect: consents['privacy_collect'] ?? false,
        consent_privacy_id: consents['privacy_id'] ?? false,
        consent_privacy_3rd: consents['privacy_3rd'] ?? false,
        consent_privacy_3rd_id: consents['privacy_3rd_id'] ?? false,
      };
    } else {
      // PDF 모드: 필드 응답을 JSON으로 직렬화
      signaturePayload = JSON.stringify({
        type: 'pdf_fields',
        responses: fieldResponses,
      });
    }

    Alert.alert(
      '서명 확인',
      templateType === 'text'
        ? `계약서 및 ${checkedCount}건의 동의 항목에 전자서명합니다.\n서명 후에는 취소할 수 없습니다.`
        : `${completedRequired}/${totalRequired} 항목이 완료되었습니다.\n서명 후에는 취소할 수 없습니다.`,
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
              signaturePayload,
              '0.0.0.0',
              'logiSSign-Mobile-App',
              consentPayload,
              identityResult?.certId,
            );
            setSigning(false);

            if (error) {
              Alert.alert('서명 실패', error);
            } else {
              Alert.alert('서명 완료', '계약서에 서명이 완료되었습니다.', [
                { text: '확인', onPress: () => router.back() },
              ]);
            }
          },
        },
      ]
    );
  };

  // ════════════════ 로딩 ════════════════

  if (loading) {
    return (
      <SafeAreaView style={styles.container} edges={['top', 'bottom']}>
        <Header title="전자서명" showBack />
        <View style={styles.loadingWrap}>
          <ActivityIndicator size="large" color={colors.primary} />
          <Text style={styles.loadingText}>계약서 로딩 중...</Text>
        </View>
      </SafeAreaView>
    );
  }

  // ════════════════ 본인인증 섹션 (공통) ════════════════

  const renderIdentitySection = () => (
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
  );

  // ════════════════ PDF 모드 렌더링 ════════════════

  if (templateType === 'pdf') {
    return (
      <SafeAreaView style={styles.container} edges={['top', 'bottom']}>
        <Header title={contractTitle || '계약서 서명'} showBack />

        {/* 진행률 바 */}
        <View style={styles.progressBar}>
          <View style={[styles.progressFill, { width: `${totalRequired > 0 ? (completedRequired / totalRequired) * 100 : 0}%` }]} />
        </View>
        <Text style={styles.progressText}>
          {completedRequired}/{totalRequired} 항목 완료
        </Text>

        <ScrollView contentContainerStyle={styles.pdfScrollContent}>
          {/* PDF + 필드 오버레이 */}
          <View style={[styles.pdfContainer, { width: previewW, height: previewH }]}>
            {pdfUrl ? (
              <View style={StyleSheet.absoluteFill}>
                <Image
                  source={{ uri: pdfUrl }}
                  style={StyleSheet.absoluteFill}
                  resizeMode="contain"
                />
              </View>
            ) : (
              <View style={StyleSheet.absoluteFill}>
                <Text style={styles.pdfPlaceholder}>PDF 미리보기</Text>
              </View>
            )}

            {/* 필드 오버레이 */}
            {pageFields.map(field => {
              const resp = fieldResponses[field.id];
              const isCompleted = resp && (resp.value || resp.imageData);
              const isSender = field.field_owner === 'sender';
              const fieldColor = isSender ? '#E11D48' : FIELD_COLORS[field.field_type];

              return (
                <TouchableOpacity
                  key={field.id}
                  activeOpacity={isSender ? 1 : 0.7}
                  onPress={() => handleFieldTap(field)}
                  disabled={isSender}
                  style={[
                    styles.fieldOverlay,
                    {
                      left: `${field.x}%`,
                      top: `${field.y}%`,
                      width: `${field.width}%`,
                      height: `${field.height}%`,
                      borderColor: isSender ? '#E11D4830' : (isCompleted ? '#22C55E' : fieldColor),
                      backgroundColor: isSender ? '#E11D4808' : (isCompleted ? '#22C55E18' : `${fieldColor}18`),
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
                      {resp?.value || field.label || '터치하여 입력'}
                    </Text>
                  )}
                </TouchableOpacity>
              );
            })}
          </View>

          {/* 페이지 네비게이션 */}
          {totalPages > 1 && (
            <View style={styles.pageNav}>
              <TouchableOpacity
                onPress={() => setCurrentPage(p => Math.max(1, p - 1))}
                disabled={currentPage <= 1}
                style={[styles.pageBtn, currentPage <= 1 && styles.pageBtnDisabled]}
              >
                <MaterialIcons name="chevron-left" size={24} color={currentPage <= 1 ? '#D1D5DB' : colors.primary} />
              </TouchableOpacity>
              <Text style={styles.pageText}>{currentPage} / {totalPages}</Text>
              <TouchableOpacity
                onPress={() => setCurrentPage(p => Math.min(totalPages, p + 1))}
                disabled={currentPage >= totalPages}
                style={[styles.pageBtn, currentPage >= totalPages && styles.pageBtnDisabled]}
              >
                <MaterialIcons name="chevron-right" size={24} color={currentPage >= totalPages ? '#D1D5DB' : colors.primary} />
              </TouchableOpacity>
            </View>
          )}

          {/* 본인인증 섹션 */}
          <View style={styles.pdfIdentitySection}>
            {renderIdentitySection()}
          </View>
        </ScrollView>

        {/* 하단 버튼 */}
        <View style={[styles.footer, { paddingBottom: Platform.OS === 'android' ? spacing.xl : spacing.md }]}>
          <Button
            title={signing ? '서명 처리 중...' : `서명 제출 (${completedRequired}/${totalRequired})`}
            onPress={handleSign}
            disabled={!canSubmitPdf || signing}
            loading={signing}
            fullWidth
            size="lg"
          />
        </View>

        <Modal visible={!!textModalFieldId} animationType="slide" transparent>
          <View style={styles.modalOverlay}>
            <View style={styles.modalContent}>
              <Text style={styles.modalTitle}>{activeTextField?.label ?? '텍스트 입력'}</Text>
              <Text style={styles.modalDesc}>
                {activeTextFieldIndex >= 0 ? `${activeTextFieldIndex + 1} / ${orderedReceiverTextFields.length}` : '텍스트 값을 입력해 주세요'}
              </Text>

              <TextInput
                value={textModalValue}
                onChangeText={setTextModalValue}
                placeholder="값을 입력해 주세요"
                style={styles.textModalInput}
                autoFocus
              />

              <View style={styles.textModalActions}>
                <TouchableOpacity
                  onPress={() => moveTextFieldModal(-1)}
                  disabled={!hasPrevTextField}
                  style={[styles.textModalButton, !hasPrevTextField && styles.textModalButtonDisabled]}
                >
                  <Text style={[styles.textModalButtonText, !hasPrevTextField && styles.textModalButtonTextDisabled]}>이전</Text>
                </TouchableOpacity>
                <TouchableOpacity
                  onPress={() => setTextModalFieldId(null)}
                  style={[styles.textModalButton, styles.modalCancel]}
                >
                  <Text style={[styles.textModalButtonText, styles.modalCancelText]}>취소</Text>
                </TouchableOpacity>
                <TouchableOpacity
                  onPress={() => submitTextFieldValue(hasNextTextField ? 1 : undefined)}
                  style={[styles.textModalButton, styles.textModalPrimaryButton]}
                >
                  <Text style={styles.textModalPrimaryText}>{hasNextTextField ? '저장 후 다음' : '저장'}</Text>
                </TouchableOpacity>
              </View>
            </View>
          </View>
        </Modal>

        {/* 서명패드 모달 */}
        <Modal visible={!!sigModalField} animationType="slide" transparent>
          <View style={styles.modalOverlay}>
            <View style={styles.modalContent}>
              <Text style={styles.modalTitle}>자필 서명</Text>
              <Text style={styles.modalDesc}>아래 영역에 서명해 주세요</Text>

              <SignaturePad
                width={width - 64}
                height={200}
                onSignatureChange={handlePdfSignatureComplete}
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

  // ════════════════ TEXT 모드 렌더링 (기존) ════════════════

  return (
    <SafeAreaView style={styles.container} edges={['top', 'bottom']}>
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
        {renderIdentitySection()}

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
      <View style={[styles.footer, { paddingBottom: Platform.OS === 'android' ? spacing.xl : spacing.md }]}>
        <Button
          title={signing ? '서명 처리 중...' : `동의 및 서명 완료 (${checkedCount}/${CONSENT_ITEMS.length})`}
          onPress={handleSign}
          disabled={!canSubmitText || signing}
          loading={signing}
          fullWidth
          size="lg"
        />
      </View>
    </SafeAreaView>
  );
}

/* ══════════════════════ 스타일 ══════════════════════ */

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.surface },
  content: { padding: spacing.lg, paddingBottom: spacing.xl, gap: spacing.lg },
  loadingWrap: { flex: 1, justifyContent: 'center', alignItems: 'center', gap: 12 },
  loadingText: { fontSize: 14, color: colors.onSurfaceVariant },
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
  footer: {
    padding: spacing.lg,
    paddingBottom: spacing.lg,
    backgroundColor: colors.surface,
    borderTopWidth: 1,
    borderTopColor: colors.outlineVariant + '20',
  },

  /* PDF mode */
  progressBar: {
    height: 3,
    backgroundColor: colors.outlineVariant + '30',
    marginHorizontal: 16,
    marginTop: 8,
    borderRadius: 2,
    overflow: 'hidden',
  },
  progressFill: { height: '100%', backgroundColor: colors.primary, borderRadius: 2 },
  progressText: {
    ...typography.labelSmall,
    color: colors.onSurfaceVariant,
    textAlign: 'right',
    paddingHorizontal: 16,
    paddingTop: 4,
    paddingBottom: 8,
  },
  pdfScrollContent: { alignItems: 'center', paddingVertical: 16 },
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
  pageNav: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.lg,
    marginTop: spacing.md,
  },
  pageBtn: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: colors.surfaceContainerLowest,
    justifyContent: 'center',
    alignItems: 'center',
    ...shadows.sm,
  },
  pageBtnDisabled: { opacity: 0.4 },
  pageText: { ...typography.labelLarge, color: colors.onSurface },
  pdfIdentitySection: {
    width: '100%',
    paddingHorizontal: 16,
    marginTop: spacing.lg,
  },

  /* Modal */
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
  textModalInput: {
    minHeight: 48,
    borderWidth: 1,
    borderColor: '#D1D5DB',
    borderRadius: 12,
    paddingHorizontal: 14,
    paddingVertical: 12,
    fontSize: 15,
    color: colors.onSurface,
    backgroundColor: colors.surfaceContainerLowest,
  },
  textModalActions: {
    flexDirection: 'row',
    gap: spacing.sm,
    marginTop: 16,
  },
  textModalButton: {
    flex: 1,
    minHeight: 44,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#F3F4F6',
  },
  textModalButtonDisabled: {
    opacity: 0.45,
  },
  textModalButtonText: {
    fontSize: 14,
    fontWeight: '600',
    color: colors.onSurface,
  },
  textModalButtonTextDisabled: {
    color: '#9CA3AF',
  },
  textModalPrimaryButton: {
    backgroundColor: colors.primary,
  },
  textModalPrimaryText: {
    fontSize: 14,
    fontWeight: '700',
    color: colors.onPrimary,
  },
  modalCancel: {
    paddingHorizontal: 24,
    paddingVertical: 10,
    borderRadius: 8,
    backgroundColor: '#F3F4F6',
  },
  modalCancelText: { fontSize: 14, color: '#6B7280' },
});
