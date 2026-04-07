import { useState } from 'react';
import {
  Alert,
  Image,
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
import { useAuthStore } from '../../stores/authStore';
import { borderRadius, colors, shadows, spacing, typography } from '../../constants/theme';

export default function LoginScreen() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const signIn = useAuthStore((state) => state.signIn);
  const router = useRouter();

  const handleLogin = async () => {
    if (!email.trim() || !password.trim()) {
      Alert.alert('입력 오류', '이메일과 비밀번호를 입력해 주세요.');
      return;
    }

    setIsSubmitting(true);
    const { error } = await signIn(email.trim(), password);
    setIsSubmitting(false);

    if (error) {
      Alert.alert('로그인 실패', error);
    }
  };

  return (
    <KeyboardAvoidingView
      style={styles.container}
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
    >
      <ScrollView contentContainerStyle={styles.scrollContent} keyboardShouldPersistTaps="handled">
        <GradientView style={styles.heroSection}>
          <Image
            source={require('../../assets/logiSSign.png')}
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

          <TouchableOpacity onPress={handleLogin} disabled={isSubmitting} activeOpacity={0.8}>
            <GradientButton style={styles.loginButton}>
              <Text style={styles.loginButtonText}>
                {isSubmitting ? '로그인 중...' : '로그인'}
              </Text>
            </GradientButton>
          </TouchableOpacity>

          <TouchableOpacity
            style={styles.registerButton}
            onPress={() => router.push('/(auth)/register')}
            disabled={isSubmitting}
            activeOpacity={0.7}
          >
            <Text style={styles.registerButtonText}>초대코드로 가입하기</Text>
          </TouchableOpacity>

          <View style={styles.linkRow}>
            <TouchableOpacity onPress={() => router.push('/(auth)/find-id')} activeOpacity={0.7}>
              <Text style={styles.linkText}>아이디 찾기</Text>
            </TouchableOpacity>
            <TouchableOpacity onPress={() => router.push('/(auth)/reset-password')} activeOpacity={0.7}>
              <Text style={styles.linkText}>비밀번호 찾기</Text>
            </TouchableOpacity>
          </View>
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
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: spacing.xl,
    borderRadius: borderRadius.xl,
    paddingVertical: spacing.xl,
    ...shadows.lg,
  },
  heroLogo: {
    width: 220,
    height: 80,
  },
  formCard: {
    borderRadius: borderRadius.xl,
    backgroundColor: colors.surfaceContainerLowest,
    padding: spacing.xl,
    ...shadows.md,
  },
  formTitle: {
    marginBottom: spacing.lg,
    color: colors.onSurface,
    fontFamily: typography.displayMedium.fontFamily,
    fontSize: typography.displayMedium.fontSize,
    fontWeight: '700',
    textAlign: 'center',
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
  loginButton: {
    marginTop: spacing.sm,
  },
  loginButtonText: {
    color: '#fff',
    fontFamily: typography.labelLarge.fontFamily,
    fontSize: typography.labelLarge.fontSize,
    fontWeight: '700',
    textAlign: 'center',
  },
  registerButton: {
    marginTop: spacing.md,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: borderRadius.lg,
    borderWidth: 1,
    borderColor: colors.outlineVariant,
    paddingVertical: spacing.md,
  },
  registerButtonText: {
    color: colors.onSurface,
    fontFamily: typography.labelLarge.fontFamily,
    fontSize: typography.labelLarge.fontSize,
    fontWeight: '600',
  },
  linkRow: {
    marginTop: spacing.lg,
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  linkText: {
    color: colors.primary,
    fontFamily: typography.labelLarge.fontFamily,
    fontSize: typography.labelLarge.fontSize,
    fontWeight: '600',
  },
});
