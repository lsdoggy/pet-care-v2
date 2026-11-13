import { useEffect } from 'react';
import { Platform } from 'react-native';
import * as Notifications from 'expo-notifications';
import Constants from 'expo-constants';
import { api, ApiError } from '../api/client';

/**
 * Sprint 6: on cold start (and whenever the JWT changes) request notification
 * permission, obtain the Expo push token and register it on the backend via
 * POST /api/v1/devices/register. The call is idempotent server-side, so running
 * it on every app start keeps last_seen_at fresh and rotates changed tokens.
 *
 * Failures are logged only — a missing push permission must never block the app.
 */
export function usePushRegistration(jwt: string | null): void {
  useEffect(() => {
    if (!jwt || Platform.OS === 'web') return;

    // Show incoming pushes while the app is foregrounded.
    void Notifications.setNotificationHandler({
      handleNotification: async () => ({
        shouldShowBanner: true,
        shouldShowList: true,
        shouldPlaySound: false,
        shouldSetBadge: true,
      }),
    });

    (async () => {
      try {
        const current = await Notifications.getPermissionsAsync();
        let status = current.status;
        if (status !== 'granted') {
          status = (await Notifications.requestPermissionsAsync()).status;
        }
        if (status !== 'granted') {
          console.log('[push] notification permission denied by user');
          return;
        }

        const projectId =
          Constants.expoConfig?.extra?.eas?.projectId ??
          Constants.easConfig?.projectId ??
          undefined;
        const pushToken = (await Notifications.getExpoPushTokenAsync(projectId)).data;
        if (!pushToken) return;

        const platform = Platform.OS === 'ios' ? 'ios' : 'android';
        await api.registerDevice(pushToken, platform, jwt);
        console.log('[push] device token registered');
      } catch (e) {
        if (e instanceof ApiError && (e.status === 401 || e.status === 403)) {
          console.log('[push] not registered: session expired');
        } else {
          console.warn('[push] token registration failed', e);
        }
      }
    })();
  }, [jwt]);
}
