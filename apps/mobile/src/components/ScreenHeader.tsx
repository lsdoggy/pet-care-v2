/**
 * ScreenHeader — shared top bar for tab screens (mobile).
 * Design Sprint 0, Step 5: part of the navigation shell.
 * Pure presentational component: no business logic, no data fetching.
 */

import type { ReactNode } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { colors, spacing, typography, layout, radius } from '../theme/tokens';

interface Props {
  title: string;
  /** Optional subtitle under the title (e.g. user email). */
  subtitle?: string;
  /** Optional right-side actions slot (buttons, links). */
  actions?: ReactNode;
}

export function ScreenHeader({ title, subtitle, actions }: Props) {
  return (
    <View style={styles.bar} accessibilityRole="header">
      <View style={styles.textWrap}>
        <Text style={styles.title} numberOfLines={1}>
          {title}
        </Text>
        {subtitle ? (
          <Text style={styles.subtitle} numberOfLines={1}>
            {subtitle}
          </Text>
        ) : null}
      </View>
      {actions ? <View style={styles.actions}>{actions}</View> : null}
    </View>
  );
}

const styles = StyleSheet.create({
  bar: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: layout.pagePaddingX,
    paddingVertical: spacing.x3,
    minHeight: layout.headerHeight,
    backgroundColor: colors.surface,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  textWrap: { flex: 1, paddingRight: spacing.x3 },
  title: { ...typography.h2, color: colors.textPrimary },
  subtitle: { ...typography.caption, color: colors.textSecondary, marginTop: 2 },
  actions: { flexDirection: 'row', alignItems: 'center', gap: spacing.x2 },
});

/** Shared header action pill styles — used by tab screens for right-side buttons. */
export const headerActionStyles = StyleSheet.create({
  pill: {
    paddingHorizontal: spacing.x3,
    paddingVertical: spacing.x2,
    borderRadius: radius.md,
    minWidth: layout.minTouchTarget,
    minHeight: layout.minTouchTarget,
    alignItems: 'center',
    justifyContent: 'center',
  },
  pillText: { ...typography.button, fontSize: typography.caption.fontSize },
});
