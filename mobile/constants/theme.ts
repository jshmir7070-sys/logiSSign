// =============================================================
// Precision Velocity Design System — React Native Tokens
// Source of truth: stitch/stitch_core/DESIGN.md
// =============================================================

export const colors = {
  // Primary
  primary: '#004ac6',
  primaryContainer: '#2563eb',
  onPrimary: '#ffffff',
  onPrimaryContainer: '#eeefff',
  onPrimaryFixed: '#00174b',
  onPrimaryFixedVariant: '#003ea8',
  primaryFixed: '#dbe1ff',
  primaryFixedDim: '#b4c5ff',
  inversePrimary: '#b4c5ff',

  // Secondary
  secondary: '#565e74',
  secondaryContainer: '#dae2fd',
  onSecondary: '#ffffff',
  onSecondaryContainer: '#5c647a',
  onSecondaryFixed: '#131b2e',
  onSecondaryFixedVariant: '#3f465c',
  secondaryFixed: '#dae2fd',
  secondaryFixedDim: '#bec6e0',

  // Tertiary (success)
  tertiary: '#006242',
  tertiaryContainer: '#007d55',
  onTertiary: '#ffffff',
  onTertiaryContainer: '#bdffdb',
  onTertiaryFixed: '#002113',
  onTertiaryFixedVariant: '#005236',
  tertiaryFixed: '#6ffbbe',
  tertiaryFixedDim: '#4edea3',

  // Error
  error: '#ba1a1a',
  errorContainer: '#ffdad6',
  onError: '#ffffff',
  onErrorContainer: '#93000a',

  // Surfaces (tonal layering — see DESIGN.md §2)
  surface: '#f7f9fb',
  surfaceDim: '#d8dadc',
  surfaceBright: '#f7f9fb',
  surfaceContainerLowest: '#ffffff',
  surfaceContainerLow: '#f2f4f6',
  surfaceContainer: '#eceef0',
  surfaceContainerHigh: '#e6e8ea',
  surfaceContainerHighest: '#e0e3e5',
  surfaceVariant: '#e0e3e5',
  surfaceTint: '#0053db',
  onSurface: '#191c1e',
  onSurfaceVariant: '#434655',
  background: '#f7f9fb',
  onBackground: '#191c1e',

  // Outlines
  outline: '#737686',
  outlineVariant: '#c3c6d7',

  // Inverse
  inverseSurface: '#2d3133',
  inverseOnSurface: '#eff1f3',

  // Sidebar (The Control Tower — DESIGN.md §5)
  sidebar: '#0F172A',
} as const;

// Power Gradient — for primary CTAs and sparklines (DESIGN.md §2)
export const gradients = {
  power: ['#004ac6', '#2563eb'] as const,
} as const;

export const spacing = {
  xs: 4,
  sm: 8,
  md: 12,
  lg: 16,
  xl: 20,
  '2xl': 24,
  '3xl': 32,
  '4xl': 40,
  '5xl': 48,
} as const;

// Dual-font strategy (DESIGN.md §3)
// Display/Headline + Body/Labels → Pretendard
// Data/Numbers → Inter
export const fontFamily = {
  headline: 'Pretendard',
  body: 'Pretendard',
  label: 'Pretendard',
  data: 'Inter',
  korean: 'Pretendard',
} as const;

export const typography = {
  // Display — Pretendard Bold, for dashboard summaries
  displayLarge: {
    fontFamily: fontFamily.headline,
    fontSize: 28,
    fontWeight: '700' as const,
    lineHeight: 36,
  },
  displayMedium: {
    fontFamily: fontFamily.headline,
    fontSize: 24,
    fontWeight: '700' as const,
    lineHeight: 32,
  },
  displaySmall: {
    fontFamily: fontFamily.data,
    fontSize: 20,
    fontWeight: '600' as const,
    lineHeight: 28,
  },
  // Title — Inter Semibold for KPI values
  titleLarge: {
    fontFamily: fontFamily.data,
    fontSize: 20,
    fontWeight: '600' as const,
    lineHeight: 28,
  },
  titleMedium: {
    fontFamily: fontFamily.data,
    fontSize: 18,
    fontWeight: '600' as const,
    lineHeight: 24,
  },
  titleSmall: {
    fontFamily: fontFamily.data,
    fontSize: 16,
    fontWeight: '600' as const,
    lineHeight: 22,
  },
  // Body — Pretendard
  bodyLarge: {
    fontFamily: fontFamily.body,
    fontSize: 16,
    fontWeight: '400' as const,
    lineHeight: 24,
  },
  bodyMedium: {
    fontFamily: fontFamily.body,
    fontSize: 14,
    fontWeight: '400' as const,
    lineHeight: 20,
  },
  bodySmall: {
    fontFamily: fontFamily.body,
    fontSize: 12,
    fontWeight: '400' as const,
    lineHeight: 16,
  },
  // Label — Pretendard with +0.02em letter-spacing for Korean clarity
  labelLarge: {
    fontFamily: fontFamily.label,
    fontSize: 14,
    fontWeight: '600' as const,
    lineHeight: 20,
    letterSpacing: 0.28, // 14 * 0.02
  },
  labelMedium: {
    fontFamily: fontFamily.label,
    fontSize: 12,
    fontWeight: '500' as const,
    lineHeight: 16,
    letterSpacing: 0.24, // 12 * 0.02
  },
  labelSmall: {
    fontFamily: fontFamily.label,
    fontSize: 11,
    fontWeight: '500' as const,
    lineHeight: 14,
    letterSpacing: 0.22, // 11 * 0.02
  },
} as const;

export const borderRadius = {
  sm: 4,
  md: 8,    // buttons (DESIGN.md §5: 8px radius)
  lg: 16,   // cards — "lg" per Do's and Don'ts
  xl: 24,   // cards — "xl" per Do's and Don'ts (1.5rem)
  '2xl': 24, // alias for xl — backwards compat
  full: 9999, // badges — "full" (999px)
} as const;

// Shadows — tinted with Sidebar Navy (#0F172A) per DESIGN.md §4
// Never use pure black shadows
export const shadows = {
  sm: {
    shadowColor: '#0F172A',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.04,
    shadowRadius: 2,
    elevation: 1,
  },
  md: {
    shadowColor: '#0F172A',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.06,
    shadowRadius: 16,
    elevation: 3,
  },
  card: {
    shadowColor: '#0F172A',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.06,
    shadowRadius: 16,
    elevation: 3,
  },
  lg: {
    shadowColor: '#0F172A',
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.08,
    shadowRadius: 32,
    elevation: 5,
  },
  ambient: {
    shadowColor: '#0F172A',
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.08,
    shadowRadius: 32,
    elevation: 5,
  },
  float: {
    shadowColor: '#0F172A',
    shadowOffset: { width: 0, height: 12 },
    shadowOpacity: 0.12,
    shadowRadius: 48,
    elevation: 8,
  },
} as const;

// Glass effect — for floating headers/dropdowns (DESIGN.md §2)
export const glass = {
  opacity: 0.8,
  blurRadius: 20,
} as const;

// Ghost border — for low-contrast containers (DESIGN.md §4)
export const ghostBorder = {
  color: colors.outlineVariant,
  opacity: 0.15,
  width: 1,
} as const;

const theme = {
  colors,
  gradients,
  spacing,
  fontFamily,
  typography,
  borderRadius,
  shadows,
  glass,
  ghostBorder,
} as const;

export type Theme = typeof theme;
export type Colors = typeof colors;
export type Typography = typeof typography;

export default theme;
