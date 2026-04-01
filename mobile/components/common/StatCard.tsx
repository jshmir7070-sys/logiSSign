import React from 'react';
import { View, Text, StyleSheet, type ViewStyle } from 'react-native';
import { colors, typography, borderRadius, shadows, spacing } from '../../constants/theme';

interface StatCardProps {
  label: string;
  value: string;
  trend?: string;
  trendPositive?: boolean;
  style?: ViewStyle;
}

export default function StatCard({ label, value, trend, trendPositive, style }: StatCardProps) {
  return (
    <View style={[styles.card, style]}>
      <Text style={styles.label}>{label}</Text>
      <Text style={styles.value}>{value}</Text>
      {trend && (
        <Text style={[styles.trend, { color: trendPositive ? colors.tertiary : colors.error }]}>
          {trendPositive ? '▲' : '▼'} {trend}
        </Text>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: colors.surfaceContainerLowest,
    borderRadius: borderRadius.xl,
    padding: spacing.lg,
    ...shadows.card,
  },
  label: {
    ...typography.labelMedium,
    color: colors.onSurfaceVariant,
  },
  value: {
    ...typography.displayMedium,
    color: colors.onSurface,
    marginTop: spacing.xs,
  },
  trend: {
    ...typography.labelSmall,
    marginTop: spacing.xs,
  },
});
