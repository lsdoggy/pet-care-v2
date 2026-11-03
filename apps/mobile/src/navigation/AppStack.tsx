import { createContext, useCallback, useContext, useMemo, useState } from 'react';
import type { ReactNode } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { colors, spacing, typography, layout } from '../theme/tokens';
import { useSafeAreaInsets } from '../theme/useSafeAreaInsets';

export type Route =
  | { name: 'Home' }
  | { name: 'Tasks' }
  | { name: 'Settings' }
  | { name: 'Shopping' }
  | { name: 'Stock' }
  | { name: 'PetForm'; petId?: number }
  | { name: 'PetDetail'; petId: number; petName?: string }
  | { name: 'PetHistory'; petId: number; petName: string }
  | { name: 'AppointmentForm'; petId: number; petName?: string }
  | { name: 'RecordForm'; petId: number; petName?: string };

/** Tab Bar destinations: Home (pets), Tasks, Buy/Stock, Settings. */
export type TabName = 'Home' | 'Tasks' | 'Shopping' | 'Stock' | 'Settings';

interface NavigationValue {
  push: (route: Route) => void;
  pop: () => void;
}

const NavigationContext = createContext<NavigationValue | null>(null);

/** Minimal custom stack navigation — no third-party library (approved in the plan). */
export function useNavigation(): NavigationValue {
  const ctx = useContext(NavigationContext);
  if (!ctx) throw new Error('useNavigation must be used inside <AppStack>');
  return ctx;
}

interface AppStackProps {
  activeTab: TabName;
  onTabChange: (tab: TabName) => void;
  children: (top: Route) => ReactNode;
}

/**
 * Minimal custom stack + tab navigation — no third-party library (approved in the plan).
 * The stack root is always the active tab; switching tabs resets the stack so the
 * tab screen re-mounts and reloads its data.
 */
export function AppStack({ activeTab, onTabChange, children }: AppStackProps) {
  const [stack, setStack] = useState<Route[]>([{ name: activeTab }]);

  const push = useCallback((route: Route) => {
    setStack((prev) => [...prev, route]);
  }, []);

  const pop = useCallback(() => {
    setStack((prev) => (prev.length > 1 ? prev.slice(0, -1) : prev));
  }, []);

  const switchTab = useCallback(
    (tab: TabName) => {
      if (tab !== activeTab) {
        onTabChange(tab);
        setStack([{ name: tab }]);
      }
    },
    [activeTab, onTabChange],
  );

  const value = useMemo(() => ({ push, pop }), [push, pop]);
  const top = stack[stack.length - 1];
  const insets = useSafeAreaInsets();

  return (
    <NavigationContext.Provider value={value}>
      <View style={shellStyles.root}>
        {/* Top safe area: status bar / notch never overlaps screen content. */}
        <View style={[shellStyles.insetTop, { height: insets.top }]} />
        <View style={shellStyles.content}>{children(top)}</View>
        <TabBar activeTab={activeTab} onChange={switchTab} bottomInset={insets.bottom} />
      </View>
    </NavigationContext.Provider>
  );
}

const TABS: { name: TabName; label: string; icon: string }[] = [
  { name: 'Home', label: 'Home', icon: '🐾' },
  { name: 'Tasks', label: 'Tasks', icon: '📅' },
  { name: 'Settings', label: 'Settings', icon: '⚙️' },
  { name: 'Shopping', label: 'Buy', icon: '🛒' },
  { name: 'Stock', label: 'Stock', icon: '📦' },
];

function TabBar({
  activeTab,
  onChange,
  bottomInset,
}: {
  activeTab: TabName;
  onChange: (tab: TabName) => void;
  bottomInset: number;
}) {
  return (
    <View style={[tabBarStyles.bar, { paddingBottom: spacing.x1 + bottomInset }]} accessibilityRole="tablist">
      {TABS.map((tab) => {
        const active = tab.name === activeTab;
        return (
          <Pressable
            key={tab.name}
            style={tabBarStyles.item}
            onPress={() => onChange(tab.name)}
            accessibilityRole="tab"
            accessibilityState={{ selected: active }}
            accessibilityLabel={tab.label}
          >
            <Text style={[tabBarStyles.icon, active && tabBarStyles.iconActive]}>{tab.icon}</Text>
            <Text style={[tabBarStyles.label, active && tabBarStyles.labelActive]}>{tab.label}</Text>
          </Pressable>
        );
      })}
    </View>
  );
}

const shellStyles = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.pageBackground },
  insetTop: { backgroundColor: colors.surface },
  content: { flex: 1 },
});

const tabBarStyles = StyleSheet.create({
  bar: {
    flexDirection: 'row',
    backgroundColor: colors.surface,
    borderTopWidth: 1,
    borderTopColor: colors.border,
    paddingTop: spacing.x1 + 2,
    minHeight: layout.tabBarHeight,
  },
  item: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.x1,
    paddingVertical: spacing.x1,
    minHeight: layout.minTouchTarget,
  },
  icon: { fontSize: typography.h2.fontSize, opacity: 0.5 },
  iconActive: { opacity: 1 },
  label: { ...typography.caption, color: colors.textTertiary },
  labelActive: { color: colors.primary, fontWeight: typography.button.fontWeight },
});
