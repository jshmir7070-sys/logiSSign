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
  Image,
} from 'react-native';
import GradientView, { GradientButton } from '../../components/common/GradientView';
import { useRouter } from 'expo-router';
import { useAuthStore } from '../../stores/authStore';
import { colors, spacing, typography, borderRadius, shadows } from '../../constants/theme';

export default function LoginScreen() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const signIn = useAuthStore((s) => s.signIn);
  const router = useRouter();

  const handleLogin = async () => {
    if (!email.trim() || !password.trim()) {
      Alert.alert('입력 오류', '이메일과 비밀번호를 입력해주세요.');
      return;
    }

    setIsSubmitting(true);
    const { error } = await signIn(email.trim(), password);
    setIsSubmitting(false);

    if (error) {
      Alert.alert('로그인 실패', error);
    }
  };

  const handleRegister = () => {
    router.push('/(auth)/register');
  };

  return (
    <KeyboardAvoidingView
      style={styles.container}
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
    >
      <ScrollView
        contentContainerStyle={styles.scrollContent}
        keyboardShouldPersistTaps="handled"
      >
        <GradientView style={styles.heroSection}>
          <Image
            source={require('../../assets/logo.png')}
            style={styles.heroLogo}
            resizeMode="contain"
          />
        </GradientView>

        <View style={styles.formCard}>
          <Text style={styles.formTitle}>로그인</Text>

          <View style={styles.inputGroup}>
            <Text style={styles.label}>이메일</Text>
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
            <Text style={styles.label}>비밀번호</Text>
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

          <TouchableOpacity
            onPress={handleLogin}
            disabled={isSubmitting}
            activeOpacity={0.8}
          >
            <GradientButton style={styles.loginButton}>
              <Text style={styles.loginButtonText}>
                {isSubmitting ? '로그인 중...' : '로그인'}
              </Text>
            </GradientButton>
          </TouchableOpacity>

          <TouchableOpacity
            style={styles.registerButton}
            onPress={handleRegister}
            disabled={isSubmitting}
            activeOpacity={0.7}
          >
            <Text style={styles.registerButtonText}>초대코드로 가입하기</Text>
          </TouchableOpacity>
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
  },
  heroSection: {
    paddingTop: 80,
    paddingBottom: 60,
    paddingHorizontal: spacing.lg,
    alignItems: 'center',
  },
  heroLogo: {
    width: 240,
    height: 80,
    marginBottom: spacing.sm,
  },
  heroTitle: {
    ...typography.displayLarge,
    color: colors.surfaceContainerLowest,
    marginBottom: spacing.sm,
  },
  heroSubtitle: {
    ...typography.bodyLarge,
    color: colors.surfaceContainerLowest,
    opacity: 0.85,
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
    marginBottom: spacing['2xl'],
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
  loginButton: {
    height: 52,
    borderRadius: borderRadius.lg,
    justifyContent: 'center',
    alignItems: 'center',
    marginTop: spacing.xl,
  },
  loginButtonText: {
    ...typography.titleSmall,
    color: colors.surfaceContainerLowest,
  },
  registerButton: {
    height: 52,
    borderRadius: borderRadius.lg,
    borderWidth: 1,
    borderColor: colors.primary,
    justifyContent: 'center',
    alignItems: 'center',
    marginTop: spacing.md,
  },
  registerButtonText: {
    ...typography.titleSmall,
    color: colors.primary,
  },
});
