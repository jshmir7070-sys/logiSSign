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
      Alert.alert('입력 오류', '이메일, 이름, 휴대폰 번호를 입력해 주세요.');
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
      Alert.alert('입력 오류', '6자리 인증번호를 입력해 주세요.');
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
      Alert.alert('비밀번호 오류', '비밀번호 조건을 모두 충족해 주세요.');
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
          <Text style={styles.heroSubtitle}>휴대폰 인증 후 비밀번호를 다시 설정합니다.</Text>
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
              <Text style={styles.helperText}>{phone} 번호로 받은 인증번호를 입력해 주세요.</Text>
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
                  <Text style={styles.actionText}>{isSubmitting ? '확인 중...' : '인증번호 확인'}</Text>
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
                  placeholder="새 비밀번호 입력"
                  placeholderTextColor={colors.outline}
                  secureTextEntry
                />
              </View>
              <View style={styles.inputGroup}>
                <Text style={styles.label}>비밀번호 확인</Text>
                <TextInput
                  style={styles.input}
                  value={confirmPassword}
                  onChangeText={setConfirmPassword}
                  placeholder="비밀번호 다시 입력"
                  placeholderTextColor={colors.outline}
                  secureTextEntry
                />
              </View>
              <View style={styles.checkList}>
                <Text style={[styles.checkItem, passwordChecks.length && styles.checkItemSuccess]}>8자 이상</Text>
                <Text style={[styles.checkItem, passwordChecks.lower && styles.checkItemSuccess]}>영문 소문자 포함</Text>
                <Text style={[styles.checkItem, passwordChecks.upper && styles.checkItemSuccess]}>영문 대문자 포함</Text>
                <Text style={[styles.checkItem, passwordChecks.number && styles.checkItemSuccess]}>숫자 포함</Text>
                <Text style={[styles.checkItem, passwordChecks.special && styles.checkItemSuccess]}>특수문자 포함</Text>
                <Text style={[styles.checkItem, passwordChecks.match && styles.checkItemSuccess]}>비밀번호 일치</Text>
              </View>
              <TouchableOpacity onPress={handleReset} disabled={isSubmitting} activeOpacity={0.8}>
                <GradientButton style={styles.actionButton}>
                  <Text style={styles.actionText}>{isSubmitting ? '변경 중...' : '비밀번호 변경'}</Text>
                </GradientButton>
              </TouchableOpacity>
            </>
          )}

          {step === 'done' && (
            <>
              <Text style={styles.formTitle}>변경 완료</Text>
              <Text style={styles.helperText}>새 비밀번호가 정상적으로 저장되었습니다.</Text>
              <TouchableOpacity onPress={() => router.replace('/(auth)/login')} activeOpacity={0.8}>
                <GradientButton style={styles.actionButton}>
                  <Text style={styles.actionText}>로그인으로 이동</Text>
                </GradientButton>
              </TouchableOpacity>
            </>
          )}
        </View>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.surface,
  },
  scrollContent: {
    flexGrow: 1,
    justifyContent: 'center',
    padding: spacing.lg,
  },
  heroSection: {
    marginBottom: spacing.xl,
    borderRadius: borderRadius.xl,
    paddingVertical: spacing.xl,
    paddingHorizontal: spacing.lg,
    ...shadows.lg,
  },
  heroTitle: {
    color: '#fff',
    fontFamily: typography.displayLarge.fontFamily,
    fontSize: typography.displayLarge.fontSize,
    fontWeight: '700',
    textAlign: 'center',
  },
  heroSubtitle: {
    marginTop: spacing.xs,
    color: 'rgba(255,255,255,0.85)',
    fontFamily: typography.bodyMedium.fontFamily,
    fontSize: typography.bodyMedium.fontSize,
    textAlign: 'center',
  },
  formCard: {
    borderRadius: borderRadius.xl,
    backgroundColor: colors.surfaceContainerLowest,
    padding: spacing.xl,
    ...shadows.md,
  },
  formTitle: {
    marginBottom: spacing.md,
    color: colors.onSurface,
    fontFamily: typography.displayMedium.fontFamily,
    fontSize: typography.displayMedium.fontSize,
    fontWeight: '700',
  },
  helperText: {
    marginBottom: spacing.md,
    color: colors.onSurfaceVariant,
    fontFamily: typography.bodyMedium.fontFamily,
    fontSize: typography.bodyMedium.fontSize,
    lineHeight: 20,
  },
  inputGroup: {
    marginBottom: spacing.md,
  },
  label: {
    marginBottom: spacing.xs,
    color: colors.onSurfaceVariant,
    fontFamily: typography.labelLarge.fontFamily,
    fontSize: typography.labelLarge.fontSize,
    fontWeight: '600',
  },
  input: {
    height: 52,
    borderRadius: borderRadius.lg,
    backgroundColor: colors.surfaceContainerLow,
    paddingHorizontal: spacing.md,
    color: colors.onSurface,
    fontFamily: typography.bodyLarge.fontFamily,
    fontSize: typography.bodyLarge.fontSize,
  },
  checkList: {
    marginBottom: spacing.md,
    gap: spacing.xs,
  },
  checkItem: {
    color: colors.onSurfaceVariant,
    fontFamily: typography.bodyMedium.fontFamily,
    fontSize: typography.bodyMedium.fontSize,
  },
  checkItemSuccess: {
    color: colors.tertiary,
    fontWeight: '700',
  },
  actionButton: {
    marginTop: spacing.sm,
  },
  actionText: {
    color: '#fff',
    fontFamily: typography.labelLarge.fontFamily,
    fontSize: typography.labelLarge.fontSize,
    fontWeight: '700',
    textAlign: 'center',
  },
});
