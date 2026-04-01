import React from 'react';
import { View, Text, StyleSheet, type ViewStyle } from 'react-native';
import { colors, typography, borderRadius, spacing } from '../../constants/theme';

type BadgeVariant = 'success' | 'warning' | 'error' | 'info' | 'default';

interface BadgeProps {
  label: string;
  variant?: BadgeVariant;
  style?: ViewStyle;
}

const variantColors: Record<BadgeVariant, { bg: string; text: string }> = {
  success: { bg: colors.tertiaryFixed, text: colors.tertiary },
  warning: { bg: '#FFF3E0', text: '#E65100' },
  error: { bg: colors.errorContainer, text: colors.error },
  info: { bg: colors.primaryFixed, text: colors.primary },
  default: { bg: colors.surfaceContainerHigh, text: colors.onSurfaceVariant },
};

export default function Badge({ label, variant = 'default', style }: BadgeProps) {
  const c = variantColors[variant];
  return (
    <View style={[styles.badge, { backgroundColor: c.bg }, style]}>
      <Text style={[styles.text, { color: c.text }]}>{label}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  badge: {
    paddingHorizontal: spacing.sm,
    paddingVertical: 2,
    borderRadius: borderRadius.full,
    alignSelf: 'flex-start',
  },
  text: {
    ...typography.labelSmall,
    fontWeight: '600',
  },
});
