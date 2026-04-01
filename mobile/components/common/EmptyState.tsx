import React from 'react';
import { View, Text, StyleSheet, type ViewStyle } from 'react-native';
import { colors, typography, spacing } from '../../constants/theme';

interface EmptyStateProps {
  emoji?: string;
  title: string;
  description?: string;
  style?: ViewStyle;
}

export default function EmptyState({ emoji = '📭', title, description, style }: EmptyStateProps) {
  return (
    <View style={[styles.container, style]}>
      <Text style={styles.emoji}>{emoji}</Text>
      <Text style={styles.title}>{title}</Text>
      {description && <Text style={styles.description}>{description}</Text>}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: spacing['5xl'],
    paddingHorizontal: spacing['3xl'],
  },
  emoji: { fontSize: 48, marginBottom: spacing.lg },
  title: {
    ...typography.titleSmall,
    color: colors.onSurface,
    textAlign: 'center',
  },
  description: {
    ...typography.bodySmall,
    color: colors.onSurfaceVariant,
    textAlign: 'center',
    marginTop: spacing.sm,
  },
});
