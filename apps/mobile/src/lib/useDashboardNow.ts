import { useEffect, useState } from 'react';
import { AppState } from 'react-native';

/** Active dashboard clock: no network work, foreground always takes a fresh snapshot. */
export function useDashboardNow(): Date {
  const [now, setNow] = useState(() => new Date());
  useEffect(() => {
    let timer: ReturnType<typeof setInterval> | undefined;
    const stop = () => { if (timer !== undefined) clearInterval(timer); timer = undefined; };
    const start = () => { stop(); setNow(new Date()); timer = setInterval(() => setNow(new Date()), 60_000); };
    if (AppState.currentState === 'active') start();
    const subscription = AppState.addEventListener('change', (state) => {
      if (state === 'active') start(); else stop();
    });
    return () => { stop(); subscription.remove(); };
  }, []);
  return now;
}
