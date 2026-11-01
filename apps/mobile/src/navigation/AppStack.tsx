import { createContext, useCallback, useContext, useMemo, useState } from 'react';
import type { ReactNode } from 'react';

export type Route =
  | { name: 'Home' }
  | { name: 'PetForm'; petId?: number }
  | { name: 'PetDetail'; petId: number };

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
  children: (top: Route) => ReactNode;
}

export function AppStack({ children }: AppStackProps) {
  const [stack, setStack] = useState<Route[]>([{ name: 'Home' }]);

  const push = useCallback((route: Route) => {
    setStack((prev) => [...prev, route]);
  }, []);

  const pop = useCallback(() => {
    setStack((prev) => (prev.length > 1 ? prev.slice(0, -1) : prev));
  }, []);

  const value = useMemo(() => ({ push, pop }), [push, pop]);
  const top = stack[stack.length - 1];

  return <NavigationContext.Provider value={value}>{children(top)}</NavigationContext.Provider>;
}
