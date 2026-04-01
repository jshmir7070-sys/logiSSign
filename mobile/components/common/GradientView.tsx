/**
 * LinearGradient 대체 컴포넌트
 * RN 0.81 New Architecture에서 expo-linear-gradient 호환성 문제 우회
 * 단색 배경 + 반투명 오버레이로 그라디언트 효과 시뮬레이션
 */
import { View, StyleSheet, ViewStyle } from 'react-native';
import { colors } from '../../constants/theme';

interface GradientViewProps {
  style?: ViewStyle;
  children?: React.ReactNode;
}

export default function GradientView({ style, children }: GradientViewProps) {
  return (
    <View style={[styles.base, style]}>
      {children}
      <View style={styles.overlay} />
    </View>
  );
}

/** 가로 방향 버튼용 그라디언트 */
export function GradientButton({ style, children }: GradientViewProps) {
  return (
    <View style={[styles.buttonBase, style]}>
      {children}
    </View>
  );
}

const styles = StyleSheet.create({
  base: {
    backgroundColor: colors.primary,
    overflow: 'hidden' as const,
  },
  overlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: colors.primaryContainer,
    opacity: 0.35,
  },
  buttonBase: {
    backgroundColor: colors.primary,
  },
});
