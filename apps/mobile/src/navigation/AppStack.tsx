import { createContext, useCallback, useContext, useMemo, useState } from 'react';
import type { ReactNode } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { colors, spacing, typography, layout, radius } from '../theme/tokens';
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

/**
 * Tab Bar destinations: Home (pets), Tasks, Buy/Stock, Settings.
 * Order here defines the visual order of the bottom navigation bar.
 */
export type TabName = 'Home' | 'Tasks' | 'Shopping' | 'Stock' | 'Settings';

/**
 * Screen title per route — single source of truth for headers.
 * Used by DetailHeader on pushed (non-tab) screens.
 */
export const ROUTE_TITLES: Record<Route['name'], string> = {
  Home: 'Главная',
  Tasks: 'Upcoming tasks',
  Shopping: 'Shopping list',
  Stock: 'Food stock',
  Settings: 'Settings',
  PetForm: 'Pet details',
  PetDetail: 'Pet profile',
  PetHistory: 'Health history',
  AppointmentForm: 'New vet visit',
  RecordForm: 'New health record',
};

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
        <TabBar activeTab={activeTab} onChange={switchTab} />
        {/* Bottom safe area (surface color, continues the tab bar): home indicator
            never overlaps interactive elements on iOS devices without inset groups. */}
        <View style={[shellStyles.insetBottom, { height: insets.bottom }]} />
      </View>
    </NavigationContext.Provider>
  );
}

const TABS: { name: TabName; label: string; icon: string }[] = [
  { name: 'Home', label: 'Pets', icon: '🐾' },
  { name: 'Tasks', label: 'Tasks', icon: '📅' },
  { name: 'Shopping', label: 'Buy', icon: '🛒' },
  { name: 'Stock', label: 'Stock', icon: '📦' },
  { name: 'Settings', label: 'Profile', icon: '⚙️' },
];

function TabBar({ activeTab, onChange }: { activeTab: TabName; onChange: (tab: TabName) => void }) {
  return (
    <View style={tabBarStyles.bar} accessibilityRole="tablist">
      {TABS.map((tab) => {
        const active = tab.name === activeTab;
        return (
          <Pressable
            key={tab.name}
            style={({ pressed }) => [tabBarStyles.item, pressed && tabBarStyles.pressed]}
            onPress={() => onChange(tab.name)}
            accessibilityRole="tab"
            accessibilityState={{ selected: active }}
            accessibilityLabel={tab.label}
          >
            {/* Active indicator: small teal pill above the icon — state is not
                conveyed by color alone (WCAG 1.4.1). */}
            <View style={[tabBarStyles.indicator, active ? tabBarStyles.indicatorActive : null]} />
            <Text style={[tabBarStyles.icon, active && tabBarStyles.iconActive]} importantForAccessibility="no">
              {tab.icon}
            </Text>
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
  insetBottom: { backgroundColor: colors.surface },
  content: { flex: 1 },
});

const tabBarStyles = StyleSheet.create({
  bar: {
    flexDirection: 'row',
    backgroundColor: colors.surface,
    borderTopWidth: 1,
    borderTopColor: colors.border,
    paddingTop: spacing.x1,
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
  pressed: { backgroundColor: colors.primarySubtle },
  indicator: {
    width: 20,
    height: 3,
    borderRadius: radius.full,
    backgroundColor: 'transparent',
  },
  indicatorActive: { backgroundColor: colors.primary },
  icon: { fontSize: typography.h3.fontSize, opacity: 0.55 },
  iconActive: { opacity: 1 },
  label: { ...typography.caption, color: colors.textSecondary },
  labelActive: { color: colors.primaryStrong, fontWeight: typography.button.fontWeight },
});
