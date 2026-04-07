import { useMemo, useState } from 'react';
import {
  Alert,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import { useRouter } from 'expo-router';
import GradientView, { GradientButton } from '../../components/common/GradientView';
import { borderRadius, colors, shadows, spacing, typography } from '../../constants/theme';
import {
  resetDriverPassword,
  sendDriverResetCode,
  verifyDriverResetCode,
} from '../../services/account-recovery.service';

type Step = 'input' | 'verify' | 'newPassword' | 'done';

function formatPhone(phone: string) {
  const digits = phone.replace(/[^0-9]/g, '').slice(0, 11);
  if (digits.length <= 3) return digits;
  if (digits.length <= 7) return `${digits.slice(0, 3)}-${digits.slice(3)}`;
  return `${digits.slice(0, 3)}-${digits.slice(3, 7)}-${digits.slice(7)}`;
}

export default function ResetPasswordScreen() {
  const router = useRouter();
  const [step, setStep] = useState<Step>('input');
  const [email, setEmail] = useState('');
  const [name, setName] = useState('');
  const [phone, setPhone] = useState('');
  const [code, setCode] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  const passwordChecks = useMemo(
    () => ({
      length: password.length >= 8,
      lower: /[a-z]/.test(password),
      upper: /[A-Z]/.test(password),
      number: /[0-9]/.test(password),
      special: /[^a-zA-Z0-9]/.test(password),
      match: password === confirmPassword && confirmPassword.length > 0,
    }),
    [password, confirmPassword]
  );

  const passwordValid = Object.values(passwordChecks).every(Boolean);

  const handleSend = async () => {
    if (!email.trim() || !name.trim() || !phone.trim()) {
      Alert.alert('입력 오류', '이메일, 이름, 휴대폰 번호를 입력해주세요.');
      return;
    }

    setIsSubmitting(true);
    try {
      await sendDriverResetCode({
        email: email.trim(),
        name: name.trim(),
        phone: phone.trim(),
      });
      setStep('verify');
      Alert.alert('인증번호 발송', '휴대폰으로 인증번호를 보냈습니다.');
    } catch (error) {
      Alert.alert('발송 실패', error instanceof Error ? error.message : '인증번호 발송에 실패했습니다.');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleVerify = async () => {
    if (code.trim().length !== 6) {
      Alert.alert('입력 오류', '6자리 인증번호를 입력해주세요.');
      return;
    }

    setIsSubmitting(true);
    try {
      await verifyDriverResetCode({
        email: email.trim(),
        name: name.trim(),
        phone: phone.trim(),
        code: code.trim(),
      });
      setStep('newPassword');
    } catch (error) {
      Alert.alert('인증 실패', error instanceof Error ? error.message : '휴대폰 인증에 실패했습니다.');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleReset = async () => {
    if (!passwordValid) {
      Alert.alert('비밀번호 오류', '비밀번호 조건을 모두 충족해주세요.');
      return;
    }

    setIsSubmitting(true);
    try {
      await resetDriverPassword({
        email: email.trim(),
        name: name.trim(),
        phone: phone.trim(),
        newPassword: password,
      });
      setStep('done');
    } catch (error) {
      Alert.alert('변경 실패', error instanceof Error ? error.message : '비밀번호 변경에 실패했습니다.');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <KeyboardAvoidingView
      style={styles.container}
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
    >
      <ScrollView contentContainerStyle={styles.scrollContent} keyboardShouldPersistTaps="handled">
        <GradientView style={styles.heroSection}>
          <Text style={styles.heroTitle}>비밀번호 찾기</Text>
          <Text style={styles.heroSubtitle}>휴대폰 인증 후 새 비밀번호를 설정합니다.</Text>
        </GradientView>

        <View style={styles.formCard}>
          {step === 'input' && (
            <>
              <Text style={styles.formTitle}>기사 계정 확인</Text>
              <View style={styles.inputGroup}>
                <Text style={styles.label}>이메일</Text>
                <TextInput
                  style={styles.input}
                  value={email}
                  onChangeText={setEmail}
                  placeholder="example@email.com"
                  placeholderTextColor={colors.outline}
                  keyboardType="email-address"
                  autoCapitalize="none"
                />
              </View>
              <View style={styles.inputGroup}>
                <Text style={styles.label}>이름</Text>
                <TextInput
                  style={styles.input}
                  value={name}
                  onChangeText={setName}
                  placeholder="이름 입력"
                  placeholderTextColor={colors.outline}
                />
              </View>
              <View style={styles.inputGroup}>
                <Text style={styles.label}>휴대폰 번호</Text>
                <TextInput
                  style={styles.input}
                  value={phone}
                  onChangeText={(value) => setPhone(formatPhone(value))}
                  placeholder="010-0000-0000"
                  placeholderTextColor={colors.outline}
                  keyboardType="phone-pad"
                />
              </View>
              <TouchableOpacity onPress={handleSend} disabled={isSubmitting} activeOpacity={0.8}>
                <GradientButton style={styles.actionButton}>
                  <Text style={styles.actionText}>{isSubmitting ? '발송 중...' : '인증번호 받기'}</Text>
                </GradientButton>
              </TouchableOpacity>
            </>
          )}

          {step === 'verify' && (
            <>
              <Text style={styles.formTitle}>휴대폰 인증</Text>
              <Text style={styles.helperText}>{phone} 번호로 받은 인증번호를 입력해주세요.</Text>
              <View style={styles.inputGroup}>
                <Text style={styles.label}>인증번호</Text>
                <TextInput
                  style={styles.input}
                  value={code}
                  onChangeText={(value) => setCode(value.replace(/[^0-9]/g, '').slice(0, 6))}
                  placeholder="6자리 인증번호"
                  placeholderTextColor={colors.outline}
                  keyboardType="number-pad"
                  maxLength={6}
                />
              </View>
              <TouchableOpacity onPress={handleVerify} disabled={isSubmitting} activeOpacity={0.8}>
                <GradientButton style={styles.actionButton}>
                  <Text style={styles.actionText}>{isSubmitting ? '확인 중...' : '휴대폰 인증 완료'}</Text>
                </GradientButton>
              </TouchableOpacity>
            </>
          )}

          {step === 'newPassword' && (
            <>
              <Text style={styles.formTitle}>새 비밀번호 설정</Text>
              <View style={styles.inputGroup}>
                <Text style={styles.label}>새 비밀번호</Text>
                <TextInput
                  style={styles.input}
                  value={password}
                  onChangeText={setPassword}
                  placeholder="영문, 숫자, 특수문자 포함"
                  placeholderTextColor={colors.outline}
                  secureTextEntry
                />
              </View>
              <View style={styles.inputGroup}>
                <Text style={styles.label}>비밀번호 재입력</Text>
                <TextInput
                  style={styles.input}
                  value={confirmPassword}
                  onChangeText={setConfirmPassword}
                  placeholder="비밀번호를 다시 입력해주세요"
                  placeholderTextColor={colors.outline}
                  secureTextEntry
                />
              </View>
              <View style={styles.checkGrid}>
                {[
                  ['length', '8자 이상'],
                  ['lower', '영문 소문자 포함'],
                  ['upper', '영문 대문자 포함'],
                  ['number', '숫자 포함'],
                  ['special', '특수문자 포함'],
                  ['match', '비밀번호 일치'],
                ].map(([key, label]) => (
                  <Text
                    key={key}
                    style={passwordChecks[key as keyof typeof passwordChecks] ? styles.checkOk : styles.checkPending}
                  >
                    {passwordChecks[key as keyof typeof passwordChecks] ? '✓' : '○'} {label}
                  </Text>
                ))}
              </View>
              <TouchableOpacity onPress={handleReset} disabled={isSubmitting || !passwordValid} activeOpacity={0.8}>
                <GradientButton style={styles.actionButton}>
                  <Text style={styles.actionText}>{isSubmitting ? '변경 중...' : '비밀번호 변경'}</Text>
                </GradientButton>
              </TouchableOpacity>
            </>
          )}

          {step === 'done' && (
            <>
              <Text style={styles.formTitle}>비밀번호가 변경되었습니다</Text>
              <Text style={styles.helperText}>새 비밀번호로 로그인해주세요.</Text>
              <TouchableOpacity onPress={() => router.replace('/(auth)/login')} activeOpacity={0.8}>
                <GradientButton style={styles.actionButton}>
                  <Text style={styles.actionText}>로그인으로 돌아가기</Text>
                </GradientButton>
              </TouchableOpacity>
            </>
          )}

          <View style={styles.linkRow}>
            <TouchableOpacity onPress={() => router.replace('/(auth)/login')}>
              <Text style={styles.linkText}>로그인</Text>
            </TouchableOpacity>
            <TouchableOpacity onPress={() => router.push('/(auth)/find-id')}>
              <Text style={styles.linkText}>아이디 찾기</Text>
            </TouchableOpacity>
          </View>
        </View>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.surface },
  scrollContent: { flexGrow: 1 },
  heroSection: {
    paddingTop: 88,
    paddingBottom: 56,
    paddingHorizontal: spacing.lg,
    alignItems: 'center',
  },
  heroTitle: {
    ...typography.displayMedium,
    color: colors.surfaceContainerLowest,
    marginBottom: spacing.sm,
  },
  heroSubtitle: {
    ...typography.bodyMedium,
    color: colors.surfaceContainerLowest,
    opacity: 0.9,
    textAlign: 'center',
  },
  formCard: {
    flex: 1,
    backgroundColor: colors.surfaceContainerLowest,
    borderTopLeftRadius: borderRadius['2xl'],
    borderTopRightRadius: borderRadius['2xl'],
    marginTop: -spacing['2xl'],
    paddingHorizontal: spacing['2xl'],
    paddingTop: spacing['3xl'],
    paddingBottom: spacing['4xl'],
    ...shadows.lg,
  },
  formTitle: {
    ...typography.titleLarge,
    color: colors.onSurface,
    marginBottom: spacing.lg,
  },
  helperText: {
    ...typography.bodyMedium,
    color: colors.onSurfaceVariant,
    marginBottom: spacing.lg,
  },
  inputGroup: { marginBottom: spacing.lg },
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
  actionButton: {
    height: 52,
    borderRadius: borderRadius.lg,
    justifyContent: 'center',
    alignItems: 'center',
    marginTop: spacing.sm,
  },
  actionText: {
    ...typography.titleSmall,
    color: colors.surfaceContainerLowest,
  },
  checkGrid: {
    gap: spacing.xs,
    marginBottom: spacing.lg,
  },
  checkOk: {
    ...typography.bodySmall,
    color: '#16a34a',
  },
  checkPending: {
    ...typography.bodySmall,
    color: colors.onSurfaceVariant,
  },
  linkRow: {
    marginTop: spacing.xl,
    flexDirection: 'row',
    justifyContent: 'center',
    gap: spacing.lg,
  },
  linkText: {
    ...typography.bodySmall,
    color: colors.primary,
  },
});
