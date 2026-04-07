import { useState } from 'react';
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
import { sendDriverFindIdCode, verifyDriverFindIdCode } from '../../services/account-recovery.service';

type Step = 'input' | 'verify' | 'result';

function formatPhone(phone: string) {
  const digits = phone.replace(/[^0-9]/g, '').slice(0, 11);
  if (digits.length <= 3) return digits;
  if (digits.length <= 7) return `${digits.slice(0, 3)}-${digits.slice(3)}`;
  return `${digits.slice(0, 3)}-${digits.slice(3, 7)}-${digits.slice(7)}`;
}

export default function FindIdScreen() {
  const router = useRouter();
  const [step, setStep] = useState<Step>('input');
  const [name, setName] = useState('');
  const [phone, setPhone] = useState('');
  const [code, setCode] = useState('');
  const [resultEmail, setResultEmail] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  const handleSend = async () => {
    if (!name.trim() || !phone.trim()) {
      Alert.alert('입력 오류', '이름과 휴대폰 번호를 입력해주세요.');
      return;
    }

    setIsSubmitting(true);
    try {
      await sendDriverFindIdCode({ name: name.trim(), phone: phone.trim() });
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
      const result = await verifyDriverFindIdCode({
        name: name.trim(),
        phone: phone.trim(),
        code: code.trim(),
      });
      setResultEmail(result.email);
      setStep('result');
    } catch (error) {
      Alert.alert('인증 실패', error instanceof Error ? error.message : '인증번호 확인에 실패했습니다.');
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
          <Text style={styles.heroTitle}>아이디 찾기</Text>
          <Text style={styles.heroSubtitle}>휴대폰 인증으로 가입 이메일을 확인합니다.</Text>
        </GradientView>

        <View style={styles.formCard}>
          {step === 'input' && (
            <>
              <Text style={styles.formTitle}>기사 계정 확인</Text>
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
                  <Text style={styles.actionText}>{isSubmitting ? '확인 중...' : '인증번호 확인'}</Text>
                </GradientButton>
              </TouchableOpacity>
            </>
          )}

          {step === 'result' && (
            <>
              <Text style={styles.formTitle}>가입 이메일</Text>
              <Text style={styles.resultEmail}>{resultEmail}</Text>
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
            <TouchableOpacity onPress={() => router.push('/(auth)/reset-password')}>
              <Text style={styles.linkText}>비밀번호 찾기</Text>
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
  resultEmail: {
    ...typography.titleLarge,
    color: colors.primary,
    marginBottom: spacing.xl,
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
