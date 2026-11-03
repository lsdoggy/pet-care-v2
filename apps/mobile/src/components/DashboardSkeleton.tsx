/**
 * DashboardSkeleton — loading placeholder for the mobile dashboard (Sprint 2).
 * Pure presentational component; mirrors apps/web/src/components/DashboardSkeleton.tsx.
 * Uses only theme tokens (no raw hex) and animates a subtle pulse via Reanimated-free
 * built-in Animated API to avoid new dependencies.
 */

import { useEffect, useRef } from 'react';
import { Animated, StyleSheet, View } from 'react-native';
import { colors, spacing, radius, layout, stack } from '../theme/tokens';

function Block({ height = 16, width = '100%', style }: { height?: number; width?: number | string; style?: object }) {
  const opacity = useRef(new Animated.Value(1)).current;

  useEffect(() => {
    const loop = Animated.loop(
      Animated.sequence([
        Animated.timing(opacity, { toValue: 0.45, duration: 700, useNativeDriver: true }),
        Animated.timing(opacity, { toValue: 1, duration: 700, useNativeDriver: true }),
      ]),
    );
    loop.start();
    return () => loop.stop();
  }, [opacity]);

  return (
    <Animated.View
      style={[{ height, width, borderRadius: radius.sm, backgroundColor: colors.surfaceMuted, opacity }, style]}
    />
  );
}

export function DashboardSkeleton() {
  return (
    <View style={styles.container} accessibilityRole="progressbar" accessibilityLabel="Загрузка данных">
      {/* Greeting */}
      <Block height={24} width="55%" />
      <Block height={14} width="38%" style={styles.mt} />

      {/* Attention card */}
      <View style={styles.card}>
        <Block height={18} width="45%" />
        <Block height={14} width="100%" style={styles.mt} />
        <Block height={14} width="80%" style={styles.mt} />
        <Block height={14} width="65%" style={styles.mt} />
      </View>

      {/* Quick actions */}
      <View style={styles.actionsRow}>
        {[0, 1, 2, 3].map((i) => (
          <View key={i} style={styles.actionTile}>
            <Block height={44} />
          </View>
        ))}
      </View>

      {/* Pet cards */}
      <View style={styles.card}>
        <Block height={18} width="40%" />
        <Block height={64} style={styles.mt} />
        <Block height={64} style={styles.mt} />
      </View>

      {/* Upcoming events */}
      <View style={styles.card}>
        <Block height={18} width="50%" />
        <Block height={48} style={styles.mt} />
        <Block height={48} style={styles.mt} />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    paddingHorizontal: layout.pagePaddingX,
    paddingTop: stack.base,
    paddingBottom: layout.contentBottomInset,
    gap: stack.loose,
    backgroundColor: colors.pageBackground,
  },
  card: {
    backgroundColor: colors.surface,
    borderRadius: radius.lg,
    borderWidth: 1,
    borderColor: colors.border,
    padding: spacing.x4,
    gap: spacing.x2,
  },
  mt: { marginTop: spacing.x2 },
  actionsRow: { flexDirection: 'row', gap: spacing.x2 },
  actionTile: { flex: 1, height: 44 },
});
