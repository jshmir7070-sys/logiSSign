import React, { type ReactNode } from 'react';
import { View, Text, TouchableOpacity, StyleSheet, type ViewStyle } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { colors, typography, spacing } from '../../constants/theme';

interface ListItemProps {
  title: string;
  subtitle?: string;
  right?: ReactNode;
  onPress?: () => void;
  showChevron?: boolean;
  icon?: keyof typeof Ionicons.glyphMap;
  style?: ViewStyle;
}

export default function ListItem({
  title,
  subtitle,
  right,
  onPress,
  showChevron = false,
  icon,
  style,
}: ListItemProps) {
  const Wrapper = onPress ? TouchableOpacity : View;

  return (
    <Wrapper
      onPress={onPress}
      activeOpacity={0.7}
      style={[styles.container, style]}
    >
      {icon && (
        <View style={styles.iconWrap}>
          <Ionicons name={icon} size={20} color={colors.onSurfaceVariant} />
        </View>
      )}
      <View style={styles.content}>
        <Text style={styles.title}>{title}</Text>
        {subtitle && <Text style={styles.subtitle}>{subtitle}</Text>}
      </View>
      {right && <View style={styles.right}>{right}</View>}
      {showChevron && (
        <Ionicons name="chevron-forward" size={18} color={colors.outlineVariant} />
      )}
    </Wrapper>
  );
}

const styles = StyleSheet.create({
  container: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: spacing.md,
    paddingHorizontal: spacing.lg,
    minHeight: 56,
  },
  iconWrap: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: colors.surfaceContainerLow,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: spacing.md,
  },
  content: { flex: 1 },
  title: {
    ...typography.bodyMedium,
    color: colors.onSurface,
    fontWeight: '500',
  },
  subtitle: {
    ...typography.labelSmall,
    color: colors.onSurfaceVariant,
    marginTop: 2,
  },
  right: { marginLeft: spacing.sm },
});
