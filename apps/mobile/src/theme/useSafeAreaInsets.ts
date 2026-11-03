/**
 * useSafeAreaInsets — tiny dependency-free safe-area hook (Design Sprint 0, Step 5).
 *
 * Why not `react-native-safe-area-context`? It would be a new dependency and the
 * sprint rules forbid adding dependencies without explicit approval. This hook
 * covers the insets we actually need for the navigation shell:
 *   - top:    Android status bar via `StatusBar.currentHeight`; iOS uses a
 *             conservative constant for the status-bar/notch area;
 *   - bottom: iPhone home-indicator area (Face ID devices); 0 elsewhere;
 *   - left/right: 0 (landscape-notch handling can come with the real library).
 *
 * API shape matches `react-native-safe-area-context`'s `useSafeAreaInsets()`
 * (`{ top, bottom, left, right }`), so later migration is drop-in if approved.
 */

import { useMemo } from 'react';
import { Platform, StatusBar } from 'react-native';

export interface Insets {
  top: number;
  bottom: number;
  left: number;
  right: number;
}

/** Conservative constants for modern iPhones (notch / Dynamic Island + home indicator). */
const IOS_STATUS_BAR_HEIGHT = 47;
const IOS_HOME_INDICATOR_INSET = 34;

export function useSafeAreaInsets(): Insets {
  return useMemo<Insets>(() => {
    if (Platform.OS === 'android') {
      return { top: StatusBar.currentHeight ?? 24, bottom: 0, left: 0, right: 0 };
    }
    if (Platform.OS === 'ios') {
      // Extra padding never clips content, so we assume Face ID metrics.
      // Precise per-device detection arrives with react-native-safe-area-context
      // (drop-in replacement, same API).
      return {
        top: IOS_STATUS_BAR_HEIGHT,
        bottom: IOS_HOME_INDICATOR_INSET,
        left: 0,
        right: 0,
      };
    }
    // web / other: browsers already expose env(safe-area-inset-*) to CSS;
    // no JS-side padding needed in the RN-web shell.
    return { top: 0, bottom: 0, left: 0, right: 0 };
  }, []);
}
