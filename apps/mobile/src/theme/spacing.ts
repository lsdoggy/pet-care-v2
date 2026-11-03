/**
 * Design tokens — spacing & radius (mobile).
 * 4px base grid, mirror of apps/web/src/styles/tokens.css.
 */

/** 4px base grid. Use named steps, not arbitrary numbers. */
export const spacing = {
  x0: 0,
  x1: 4,
  x2: 8,
  x3: 12,
  x4: 16,
  x5: 20,
  x6: 24,
  x8: 32,
  x10: 40,
  x12: 48,
  x16: 64,
} as const;

/** Vertical stacks (between sections / list items). */
export const stack = {
  tight: spacing.x2, // 8
  base: spacing.x3, // 12
  loose: spacing.x4, // 16
  xl: spacing.x6, // 24
} as const;

/** Horizontal page padding (mobile-first). */
export const layout = {
  pagePaddingX: spacing.x4, // 16
  screenGap: spacing.x4,
  tabBarHeight: 56,
  minTouchTarget: 44, // WCAG AA touch target
} as const;

export const radius = {
  none: 0,
  sm: 6,
  md: 10,
  lg: 14,
  xl: 20,
  full: 9999,
} as const;

/**
 * RN has no box-shadow on Android without elevation; approximate soft web shadows
 * with elevation + transparent black borders where needed.
 */
export const shadow = {
  card: {
    boxShadowColor: 'rgba(15, 23, 42, 0.08)',
    boxShadowOffset: { width: 0, height: 1 },
    boxShadowRadius: 3,
    // Android fallback:
    elevation: 2,
  },
  raised: {
    boxShadowColor: 'rgba(15, 23, 42, 0.12)',
    boxShadowOffset: { width: 0, height: 4 },
    boxShadowRadius: 12,
    elevation: 6,
  },
} as const;

export type SpacingToken = keyof typeof spacing;
