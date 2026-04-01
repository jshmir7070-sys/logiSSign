import React from 'react';
import {
  TouchableOpacity,
  Text,
  StyleSheet,
  ActivityIndicator,
  type ViewStyle,
  type TextStyle,
} from 'react-native';
import { GradientButton } from './GradientView';
import { colors, typography, borderRadius, spacing } from '../../constants/theme';

type ButtonVariant = 'primary' | 'secondary' | 'outline' | 'ghost' | 'destructive';
type ButtonSize = 'sm' | 'md' | 'lg';

interface ButtonProps {
  title: string;
  onPress: () => void;
  variant?: ButtonVariant;
  size?: ButtonSize;
  disabled?: boolean;
  loading?: boolean;
  fullWidth?: boolean;
  style?: ViewStyle;
}

const sizeStyles: Record<ButtonSize, { height: number; paddingHorizontal: number; text: TextStyle }> = {
  sm: { height: 36, paddingHorizontal: spacing.lg, text: { fontSize: 13, fontWeight: '600' } },
  md: { height: 44, paddingHorizontal: spacing['2xl'], text: { fontSize: 14, fontWeight: '600' } },
  lg: { height: 52, paddingHorizontal: spacing['3xl'], text: { fontSize: 16, fontWeight: '600' } },
};

export default function Button({
  title,
  onPress,
  variant = 'primary',
  size = 'md',
  disabled = false,
  loading = false,
  fullWidth = false,
  style,
}: ButtonProps) {
  const s = sizeStyles[size];
  const isDisabled = disabled || loading;

  if (variant === 'primary') {
    return (
      <TouchableOpacity
        onPress={onPress}
        disabled={isDisabled}
        style={[fullWidth && styles.fullWidth, style]}
        activeOpacity={0.8}
      >
        <GradientButton
          style={[
            styles.base,
            { height: s.height, paddingHorizontal: s.paddingHorizontal },
            isDisabled && styles.disabled,
          ] as any}
        >
          {loading ? (
            <ActivityIndicator color={colors.onPrimary} size="small" />
          ) : (
            <Text style={[styles.primaryText, s.text]}>{title}</Text>
          )}
        </GradientButton>
      </TouchableOpacity>
    );
  }

  const variantStyle = variantStyles[variant];

  return (
    <TouchableOpacity
      onPress={onPress}
      disabled={isDisabled}
      style={[
        styles.base,
        { height: s.height, paddingHorizontal: s.paddingHorizontal },
        variantStyle.container,
        isDisabled && styles.disabled,
        fullWidth && styles.fullWidth,
        style,
      ]}
      activeOpacity={0.7}
    >
      {loading ? (
        <ActivityIndicator color={variantStyle.textColor} size="small" />
      ) : (
        <Text style={[s.text, { color: variantStyle.textColor }]}>{title}</Text>
      )}
    </TouchableOpacity>
  );
}

const variantStyles: Record<Exclude<ButtonVariant, 'primary'>, { container: ViewStyle; textColor: string }> = {
  secondary: {
    container: { backgroundColor: colors.surfaceContainerHigh },
    textColor: colors.onSurface,
  },
  outline: {
    container: {
      backgroundColor: 'transparent',
      borderWidth: 1,
      borderColor: colors.outlineVariant + '40',
    },
    textColor: colors.primary,
  },
  ghost: {
    container: { backgroundColor: 'transparent' },
    textColor: colors.primary,
  },
  destructive: {
    container: { backgroundColor: colors.errorContainer },
    textColor: colors.error,
  },
};

const styles = StyleSheet.create({
  base: {
    borderRadius: borderRadius.md,
    alignItems: 'center',
    justifyContent: 'center',
    flexDirection: 'row',
  },
  primaryText: {
    color: colors.onPrimary,
  },
  disabled: {
    opacity: 0.5,
  },
  fullWidth: {
    width: '100%',
  },
});
