import { useState } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  Alert,
  ActivityIndicator,
} from 'react-native';
import { GradientButton } from '../../components/common/GradientView';
import { useRouter } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import { supabase } from '../../lib/supabase';
import { colors, spacing, typography, borderRadius, shadows } from '../../constants/theme';

interface AgencyInfo {
  id: string;
  name: string;
}

export default function RegisterScreen() {
  const router = useRouter();

  // Step 1: 초대코드
  const [inviteCode, setInviteCode] = useState('');
  const [agency, setAgency] = useState<AgencyInfo | null>(null);
  const [isValidating, setIsValidating] = useState(false);

  // Step 2: 기본 정보 + 계정
  const [name, setName] = useState('');
  const [birthDate, setBirthDate] = useState('');
  const [phone, setPhone] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [passwordConfirm, setPasswordConfirm] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Step 3: 동의 항목
  const [agreeTerms, setAgreeTerms] = useState(false);
  const [agreePrivacy, setAgreePrivacy] = useState(false);
  const [agreeAge, setAgreeAge] = useState(false);

  /** 초대코드 검증 → 서버 API로 검증 (가입 API의 사전 확인) */
  const validateInviteCode = async () => {
    if (!inviteCode.trim()) {
      Alert.alert('입력 오류', '초대코드를 입력해주세요.');
      return;
    }

    setIsValidating(true);
    try {
      // driver-signup API에 validate 모드로 호출
      const APP_URL = process.env.EXPO_PUBLIC_APP_URL || 'https://logissign.com';
      const res = await fetch(`${APP_URL}/api/auth/driver-signup`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ inviteCode: inviteCode.trim().toUpperCase(), validateOnly: true }),
      });
      const data = await res.json();
      setIsValidating(false);

      if (!res.ok || data.error) {
        Alert.alert('인증 실패', data.error || '유효하지 않은 초대코드입니다.');
        return;
      }
      setAgency({ id: data.agencyId ?? '', name: data.agencyName ?? '' });
    } catch {
      setIsValidating(false);
      Alert.alert('오류', '초대코드 검증 중 문제가 발생했습니다.');
    }
  };

  /** 이메일 + 비밀번호로 가입 → drivers 레코드 생성 */
  const handleRegister = async () => {
    // 유효성 검사
    if (!name.trim()) {
      Alert.alert('입력 오류', '이름을 입력해주세요.');
      return;
    }
    if (!phone.trim()) {
      Alert.alert('입력 오류', '전화번호를 입력해주세요.');
      return;
    }
    if (!email.trim()) {
      Alert.alert('입력 오류', '이메일을 입력해주세요.');
      return;
    }
    if (password.length < 8) {
      Alert.alert('입력 오류', '비밀번호는 8자 이상이어야 합니다.');
      return;
    }
    if (password !== passwordConfirm) {
      Alert.alert('입력 오류', '비밀번호가 일치하지 않습니다.');
      return;
    }
    if (!agreeTerms || !agreePrivacy || !agreeAge) {
      Alert.alert('동의 필요', '필수 약관에 모두 동의해주세요.');
      return;
    }

    setIsSubmitting(true);

    try {
      // 서버 API 한 번 호출로 Auth 생성 + driver 연결 원자적 처리
      const APP_URL = process.env.EXPO_PUBLIC_APP_URL || 'https://logissign.com';
      const res = await fetch(`${APP_URL}/api/auth/driver-signup`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          inviteCode: inviteCode.trim().toUpperCase(),
          name: name.trim(),
          phone: phone.trim(),
          email: email.trim(),
          password,
          birthDate: birthDate.trim() || null,
        }),
      });

      const result = await res.json();

      if (!res.ok || !result.success) {
        setIsSubmitting(false);
        Alert.alert('가입 실패', result.error || '회원가입에 실패했습니다.');
        return;
      }

      setIsSubmitting(false);

      // 퇴사 후 재가입/이직 케이스 구분
      let message = `${result.agencyName} 소속으로 가입되었습니다.\n로그인해주세요.`;
      let title = '가입 완료';
      if (result.reinstated) {
        title = '복직 완료';
        message = `${result.agencyName} 소속으로 복직되었습니다.\n새 비밀번호로 로그인해주세요.`;
      } else if (result.transferred) {
        title = '이직 가입 완료';
        message = `${result.agencyName} 소속으로 등록되었습니다.\n새 비밀번호로 로그인해주세요.`;
      }

      Alert.alert(
        title,
        message,
        [{ text: '로그인하기', onPress: () => router.replace('/(auth)/login') }]
      );
    } catch (err) {
      setIsSubmitting(false);
      Alert.alert('오류', '회원가입 중 문제가 발생했습니다.');
    }
  };

  const step = agency ? 2 : 1;

  return (
    <SafeAreaView style={styles.container}>
      <KeyboardAvoidingView
        style={styles.flex}
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
      >
        <ScrollView
          contentContainerStyle={styles.scrollContent}
          keyboardShouldPersistTaps="handled"
        >
          {/* 헤더 */}
          <View style={styles.header}>
            <TouchableOpacity
              onPress={() => (agency ? setAgency(null) : router.back())}
              style={styles.backButton}
            >
              <Text style={styles.backText}>{'<'} {agency ? '초대코드' : '뒤로'}</Text>
            </TouchableOpacity>
            <Text style={styles.headerTitle}>회원가입</Text>
            <View style={styles.stepIndicator}>
              <Text style={styles.stepText}>{step}/2</Text>
            </View>
          </View>

          {/* Step 1: 초대코드 */}
          {!agency ? (
            <View style={styles.section}>
              <Text style={styles.sectionTitle}>초대코드 인증</Text>
              <Text style={styles.sectionDesc}>
                소속 운수사에서 받은 초대코드를 입력해주세요.
              </Text>

              <View style={styles.inputGroup}>
                <Text style={styles.label}>초대코드</Text>
                <TextInput
                  style={styles.input}
                  placeholder="초대코드 입력"
                  placeholderTextColor={colors.outline}
                  value={inviteCode}
                  onChangeText={setInviteCode}
                  autoCapitalize="characters"
                  editable={!isValidating}
                />
              </View>

              <TouchableOpacity
                onPress={validateInviteCode}
                disabled={isValidating}
                activeOpacity={0.8}
              >
                <GradientButton style={styles.primaryButton}>
                  {isValidating ? (
                    <ActivityIndicator color={colors.surfaceContainerLowest} />
                  ) : (
                    <Text style={styles.primaryButtonText}>인증하기</Text>
                  )}
                </GradientButton>
              </TouchableOpacity>
            </View>
          ) : (
            /* Step 2: 기본 정보 + 계정 설정 */
            <View style={styles.section}>
              <View style={styles.agencyBadge}>
                <Text style={styles.agencyBadgeLabel}>소속 운수사</Text>
                <Text style={styles.agencyBadgeName}>{agency.name}</Text>
              </View>

              <Text style={styles.sectionTitle}>기본 정보</Text>

              <View style={styles.inputGroup}>
                <Text style={styles.label}>이름 *</Text>
                <TextInput
                  style={styles.input}
                  placeholder="실명 입력"
                  placeholderTextColor={colors.outline}
                  value={name}
                  onChangeText={setName}
                  editable={!isSubmitting}
                />
              </View>

              <View style={styles.inputGroup}>
                <Text style={styles.label}>생년월일</Text>
                <TextInput
                  style={styles.input}
                  placeholder="YYYY-MM-DD"
                  placeholderTextColor={colors.outline}
                  value={birthDate}
                  onChangeText={setBirthDate}
                  keyboardType="numeric"
                  editable={!isSubmitting}
                />
              </View>

              <View style={styles.inputGroup}>
                <Text style={styles.label}>전화번호 *</Text>
                <TextInput
                  style={styles.input}
                  placeholder="010-0000-0000"
                  placeholderTextColor={colors.outline}
                  value={phone}
                  onChangeText={setPhone}
                  keyboardType="phone-pad"
                  editable={!isSubmitting}
                />
              </View>

              <Text style={[styles.sectionTitle, { marginTop: spacing.xl }]}>계정 설정</Text>

              <View style={styles.inputGroup}>
                <Text style={styles.label}>이메일 (로그인용) *</Text>
                <TextInput
                  style={styles.input}
                  placeholder="example@email.com"
                  placeholderTextColor={colors.outline}
                  value={email}
                  onChangeText={setEmail}
                  keyboardType="email-address"
                  autoCapitalize="none"
                  autoComplete="email"
                  editable={!isSubmitting}
                />
              </View>

              <View style={styles.inputGroup}>
                <Text style={styles.label}>비밀번호 (8자 이상) *</Text>
                <TextInput
                  style={styles.input}
                  placeholder="비밀번호 입력"
                  placeholderTextColor={colors.outline}
                  value={password}
                  onChangeText={setPassword}
                  secureTextEntry
                  editable={!isSubmitting}
                />
              </View>

              <View style={styles.inputGroup}>
                <Text style={styles.label}>비밀번호 확인 *</Text>
                <TextInput
                  style={styles.input}
                  placeholder="비밀번호 재입력"
                  placeholderTextColor={colors.outline}
                  value={passwordConfirm}
                  onChangeText={setPasswordConfirm}
                  secureTextEntry
                  editable={!isSubmitting}
                />
              </View>

              {/* 약관 동의 */}
              <View style={styles.consentSection}>
                <Text style={styles.consentTitle}>약관 동의</Text>

                <TouchableOpacity
                  style={styles.consentRow}
                  onPress={() => {
                    const allChecked = agreeTerms && agreePrivacy && agreeAge;
                    setAgreeTerms(!allChecked);
                    setAgreePrivacy(!allChecked);
                    setAgreeAge(!allChecked);
                  }}
                  activeOpacity={0.7}
                >
                  <View style={[styles.checkbox, (agreeTerms && agreePrivacy && agreeAge) && styles.checkboxChecked]}>
                    {(agreeTerms && agreePrivacy && agreeAge) && <Text style={styles.checkmark}>✓</Text>}
                  </View>
                  <Text style={styles.consentAllLabel}>전체 동의</Text>
                </TouchableOpacity>

                <View style={styles.consentDivider} />

                <TouchableOpacity style={styles.consentRow} onPress={() => setAgreeTerms(!agreeTerms)} activeOpacity={0.7}>
                  <View style={[styles.checkbox, agreeTerms && styles.checkboxChecked]}>
                    {agreeTerms && <Text style={styles.checkmark}>✓</Text>}
                  </View>
                  <Text style={styles.consentLabel}>[필수] 서비스 이용약관 동의</Text>
                </TouchableOpacity>

                <TouchableOpacity style={styles.consentRow} onPress={() => setAgreePrivacy(!agreePrivacy)} activeOpacity={0.7}>
                  <View style={[styles.checkbox, agreePrivacy && styles.checkboxChecked]}>
                    {agreePrivacy && <Text style={styles.checkmark}>✓</Text>}
                  </View>
                  <Text style={styles.consentLabel}>[필수] 개인정보 수집·이용 동의</Text>
                </TouchableOpacity>

                <TouchableOpacity style={styles.consentRow} onPress={() => setAgreeAge(!agreeAge)} activeOpacity={0.7}>
                  <View style={[styles.checkbox, agreeAge && styles.checkboxChecked]}>
                    {agreeAge && <Text style={styles.checkmark}>✓</Text>}
                  </View>
                  <Text style={styles.consentLabel}>[필수] 만 14세 이상 확인</Text>
                </TouchableOpacity>
              </View>

              <TouchableOpacity
                onPress={handleRegister}
                disabled={isSubmitting}
                activeOpacity={0.8}
              >
                <GradientButton style={styles.primaryButton}>
                  {isSubmitting ? (
                    <ActivityIndicator color={colors.surfaceContainerLowest} />
                  ) : (
                    <Text style={styles.primaryButtonText}>가입 완료</Text>
                  )}
                </GradientButton>
              </TouchableOpacity>
            </View>
          )}
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.surface,
  },
  flex: {
    flex: 1,
  },
  scrollContent: {
    flexGrow: 1,
    paddingBottom: spacing['4xl'],
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.md,
  },
  backButton: {
    paddingVertical: spacing.sm,
    paddingRight: spacing.md,
  },
  backText: {
    ...typography.bodyMedium,
    color: colors.primary,
  },
  headerTitle: {
    ...typography.titleMedium,
    color: colors.onSurface,
  },
  stepIndicator: {
    backgroundColor: colors.primaryContainer,
    borderRadius: borderRadius.full,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.xs,
  },
  stepText: {
    ...typography.labelMedium,
    color: colors.surfaceContainerLowest,
  },
  section: {
    paddingHorizontal: spacing['2xl'],
    paddingTop: spacing.xl,
  },
  sectionTitle: {
    ...typography.titleLarge,
    color: colors.onSurface,
    marginBottom: spacing.sm,
  },
  sectionDesc: {
    ...typography.bodyMedium,
    color: colors.onSurfaceVariant,
    marginBottom: spacing['2xl'],
  },
  agencyBadge: {
    backgroundColor: colors.surfaceContainerLow,
    borderRadius: borderRadius.lg,
    padding: spacing.lg,
    marginBottom: spacing['2xl'],
    borderLeftWidth: 4,
    borderLeftColor: colors.tertiary,
  },
  agencyBadgeLabel: {
    ...typography.labelMedium,
    color: colors.onSurfaceVariant,
    marginBottom: spacing.xs,
  },
  agencyBadgeName: {
    ...typography.titleMedium,
    color: colors.tertiary,
  },
  inputGroup: {
    marginBottom: spacing.lg,
  },
  label: {
    ...typography.labelLarge,
    color: colors.onSurfaceVariant,
    marginBottom: spacing.sm,
  },
  input: {
    height: 48,
    borderWidth: 1,
    borderColor: colors.outlineVariant,
    borderRadius: borderRadius.md,
    paddingHorizontal: spacing.lg,
    ...typography.bodyLarge,
    color: colors.onSurface,
    backgroundColor: colors.surfaceContainerLowest,
  },
  primaryButton: {
    height: 52,
    borderRadius: borderRadius.lg,
    justifyContent: 'center',
    alignItems: 'center',
    marginTop: spacing.xl,
  },
  primaryButtonText: {
    ...typography.titleSmall,
    color: colors.surfaceContainerLowest,
  },
  consentSection: {
    marginTop: spacing.xl,
    padding: spacing.lg,
    backgroundColor: colors.surfaceContainerLow,
    borderRadius: borderRadius.lg,
  },
  consentTitle: {
    ...typography.labelLarge,
    color: colors.onSurface,
    marginBottom: spacing.md,
    fontWeight: '700',
  },
  consentRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    paddingVertical: spacing.sm,
  },
  checkbox: {
    width: 22,
    height: 22,
    borderRadius: 6,
    borderWidth: 2,
    borderColor: colors.outlineVariant,
    justifyContent: 'center',
    alignItems: 'center',
  },
  checkboxChecked: {
    backgroundColor: colors.primary,
    borderColor: colors.primary,
  },
  checkmark: {
    color: '#fff',
    fontSize: 14,
    fontWeight: '700',
  },
  consentAllLabel: {
    ...typography.bodyMedium,
    color: colors.onSurface,
    fontWeight: '700',
  },
  consentLabel: {
    ...typography.bodySmall,
    color: colors.onSurfaceVariant,
  },
  consentDivider: {
    height: 1,
    backgroundColor: colors.outlineVariant,
    opacity: 0.4,
    marginVertical: spacing.sm,
  },
});
