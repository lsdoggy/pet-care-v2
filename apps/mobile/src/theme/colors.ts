/**
 * Design tokens — colors (mobile).
 * Mirror of apps/web/src/styles/tokens.css. Single source of truth: keep both in sync.
 * Raw palette values must not be used directly in screens — go through semantic aliases.
 */

export const palette = {
  // Teal (primary)
  teal50: '#F0FDFA',
  teal100: '#CCFBF1',
  teal500: '#14B8A6',
  teal600: '#0D9488',
  teal700: '#0F766E',
  // Orange (accent)
  orange50: '#FFF7ED',
  orange100: '#FFEDD5',
  orange500: '#F97316',
  orange600: '#EA580C',
  // Slate (neutrals)
  slate50: '#F8FAFC',
  slate100: '#F1F5F9',
  slate200: '#E2E8F0',
  slate300: '#CBD5E1',
  slate400: '#94A3B8',
  slate500: '#64748B',
  slate600: '#475569',
  slate700: '#334155',
  slate800: '#1E293B',
  slate900: '#0F172A',
  // Status
  green600: '#16A34A',
  green50: '#F0FDF4',
  amber600: '#D97706',
  amber50: '#FFFBEB',
  red600: '#DC2626',
  red50: '#FEF2F2',
} as const;

/** Semantic colors — use these in StyleSheet definitions. */
export const colors = {
  // Brand
  primary: palette.teal600,
  primaryHover: palette.teal700,
  primarySubtle: palette.teal50,
  onPrimary: '#FFFFFF',

  accent: palette.orange500,
  accentHover: palette.orange600,
  accentSubtle: palette.orange50,
  onAccent: '#FFFFFF',

  // Surfaces
  pageBackground: palette.slate50,
  surface: '#FFFFFF',
  surfaceMuted: palette.slate100,

  // Text
  textPrimary: palette.slate900,
  textSecondary: palette.slate600,
  textTertiary: palette.slate400,
  textInverse: '#FFFFFF',

  // Borders & dividers
  border: palette.slate200,
  borderStrong: palette.slate300,

  // Status
  success: palette.green600,
  successSubtle: palette.green50,
  warning: palette.amber600,
  warningSubtle: palette.amber50,
  danger: palette.red600,
  dangerSubtle: palette.red50,
  info: palette.teal600,
  infoSubtle: palette.teal50,
} as const;

export type ColorToken = keyof typeof colors;
