import { createContext, useCallback, useContext, useMemo, useState } from 'react';
import type { ReactNode } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';

export type Route =
  | { name: 'Home' }
  | { name: 'Tasks' }
  | { name: 'PetForm'; petId?: number }
  | { name: 'PetDetail'; petId: number; petName?: string }
  | { name: 'PetHistory'; petId: number; petName: string }
  | { name: 'AppointmentForm'; petId: number; petName?: string }
  | { name: 'RecordForm'; petId: number; petName?: string };

/** Tab Bar destinations (Sprint 3): Home (pets) and Tasks (upcoming care tasks). */
export type TabName = 'Home' | 'Tasks';

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

  return (
    <NavigationContext.Provider value={value}>
      {children(top)}
      <TabBar activeTab={activeTab} onChange={switchTab} />
    </NavigationContext.Provider>
  );
}

const TABS: { name: TabName; label: string; icon: string }[] = [
  { name: 'Home', label: 'Home', icon: '🐾' },
  { name: 'Tasks', label: 'Tasks', icon: '📅' },
];

function TabBar({ activeTab, onChange }: { activeTab: TabName; onChange: (tab: TabName) => void }) {
  return (
    <View style={tabBarStyles.bar}>
      {TABS.map((tab) => {
        const active = tab.name === activeTab;
        return (
          <Pressable key={tab.name} style={tabBarStyles.item} onPress={() => onChange(tab.name)}>
            <Text style={[tabBarStyles.icon, active && tabBarStyles.iconActive]}>{tab.icon}</Text>
            <Text style={[tabBarStyles.label, active && tabBarStyles.labelActive]}>{tab.label}</Text>
          </Pressable>
        );
      })}
    </View>
  );
}

const tabBarStyles = StyleSheet.create({
  bar: {
    flexDirection: 'row',
    backgroundColor: '#fff',
    borderTopWidth: 1,
    borderTopColor: '#e2e8f0',
    paddingBottom: 8,
    paddingTop: 6,
  },
  item: { flex: 1, alignItems: 'center', gap: 2 },
  icon: { fontSize: 20, opacity: 0.5 },
  iconActive: { opacity: 1 },
  label: { fontSize: 12, color: '#94a3b8', fontWeight: '600' },
  labelActive: { color: '#4f46e5' },
});
