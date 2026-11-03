/**
 * Design tokens — unified export (mobile theme).
 * Import from '@/theme' style path: `import { theme } from '../theme/tokens';`
 *
 * Rule for Sprint 1+: screens and components must consume colors/spacing/typography
 * only through this module (or its submodules) — no raw hex in StyleSheet.
 */

import { palette, colors } from './colors';
import { spacing, stack, layout, radius, shadow } from './spacing';
import { fontFamily, fontSize, fontWeight, lineHeight, typography } from './typography';

export const theme = {
  colors,
  palette, // raw scale — avoid using directly in screens
  spacing,
  stack,
  layout,
  radius,
  shadow,
  typography,
  fontSize,
  fontWeight,
  lineHeight,
  fontFamily,
} as const;

export type Theme = typeof theme;

// Re-export individual tokens for convenient named imports.
export { palette, colors, spacing, stack, layout, radius, shadow };
export { fontFamily, fontSize, fontWeight, lineHeight, typography };
export type { ColorToken } from './colors';
export type { SpacingToken } from './spacing';
export type { TypographyToken } from './typography';
