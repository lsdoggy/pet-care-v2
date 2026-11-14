import { useLanguage } from '../i18n/language';
/**
 * ScreenHeader — shared top bar for tab screens (mobile).
 * Design Sprint 0, Step 5: part of the navigation shell.
 * Pure presentational component: no business logic, no data fetching.
 */

import type { ReactNode } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';
import { Text } from './Typography';
import { colors, spacing, typography, layout, radius } from '../theme/tokens';
import { ROUTE_TITLES, useNavigation, type Route } from '../navigation/AppStack';

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

/**
 * DetailHeader — back-arrow header for pushed (non-tab) stack screens.
 * Title comes from ROUTE_TITLES so every detail screen shares one pattern.
 * Presentational only; uses the existing useNavigation() context (no new deps).
 */
export function DetailHeader({ route }: { route: Route }) {
  const navigation = useNavigation();
  const language = useLanguage();
  return (
    <View style={styles.bar} accessibilityRole="header">
      <PressableBack onBack={navigation.pop} />
      <View style={styles.textWrap}>
        <Text style={styles.title} numberOfLines={1}>
          {ROUTE_TITLES[route.name][language]}
        </Text>
      </View>
      {/* Spacer keeps the title centered like the tab header layout. */}
      <View style={styles.backHit} />
    </View>
  );
}

function PressableBack({ onBack }: { onBack: () => void }) {
  const language = useLanguage();
  return (
    <Pressable
      onPress={onBack}
      hitSlop={8}
      style={({ pressed }) => [styles.backHit, pressed && styles.backPressed]}
      accessibilityRole="button"
      accessibilityLabel={language === 'ru' ? 'Назад' : 'Go back'}
    >
      <Text style={styles.backChevron} importantForAccessibility="no">
        ‹
      </Text>
    </Pressable>
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
  backHit: { width: 44, height: 44, alignItems: 'center', justifyContent: 'center', borderRadius: radius.md },
  backPressed: { backgroundColor: colors.primarySubtle },
  backChevron: { fontSize: typography.h1.fontSize, lineHeight: typography.h1.lineHeight, color: colors.primaryStrong, fontWeight: '700' },
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
