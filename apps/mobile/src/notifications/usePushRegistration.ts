import { useCallback, useEffect, useRef } from 'react';
import { Platform } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import * as Notifications from 'expo-notifications';
import Constants, { ExecutionEnvironment } from 'expo-constants';
import { api, ApiError } from '../api/client';
import { notificationRoute, type NotificationDestination } from './notificationRoute';

const nativePush = Platform.OS !== 'web' &&
  Constants.executionEnvironment !== ExecutionEnvironment.StoreClient;

async function removeDevice(id: number, jwt: string) {
  try {
    await api.unregisterDevice(id, jwt);
  } catch (error) {
    if (!(error instanceof ApiError && [401, 403, 404].includes(error.status))) throw error;
  }
}

export function usePushRegistration(
  jwt: string | null,
  userId: number | undefined,
  onOpen: (destination: NotificationDestination) => void,
) {
  const register = useRef<Promise<void> | null>(null);
  const sessionEnding = useRef(false);
  const key = userId === undefined ? null : `petcare_push_device_${userId}`;

  useEffect(() => {
    if (!jwt || !key || !nativePush) return;
    let active = true;
    sessionEnding.current = false;
    const projectId = Constants.expoConfig?.extra?.eas?.projectId ?? Constants.easConfig?.projectId;

    Notifications.setNotificationHandler({
      handleNotification: async () => ({
        shouldShowBanner: true,
        shouldShowList: true,
        shouldPlaySound: false,
        shouldSetBadge: false,
      }),
    });

    const open = (response: Notifications.NotificationResponse) => {
      if (sessionEnding.current) return;
      Notifications.clearLastNotificationResponse();
      const destination = notificationRoute(response.notification.request.content.data);
      if (destination) onOpen(destination);
    };
    const subscription = Notifications.addNotificationResponseReceivedListener(open);
    const lastResponse = Notifications.getLastNotificationResponse();
    if (lastResponse) open(lastResponse);

    if (projectId) {
      void (async () => {
        if (Platform.OS === 'android') {
          await Notifications.setNotificationChannelAsync('reminders', {
            name: 'Pet Care',
            importance: Notifications.AndroidImportance.DEFAULT,
            lockscreenVisibility: Notifications.AndroidNotificationVisibility.PRIVATE,
          });
        }
        const current = await Notifications.getPermissionsAsync();
        const status = current.status !== 'granted' && current.canAskAgain
          ? (await Notifications.requestPermissionsAsync()).status
          : current.status;
        const previousId = await AsyncStorage.getItem(key);
        if (!active || sessionEnding.current) return;
        if (status !== 'granted') {
          if (previousId) {
            await removeDevice(Number(previousId), jwt);
            await AsyncStorage.removeItem(key);
          }
          return;
        }

        const pushToken = (await Notifications.getExpoPushTokenAsync({ projectId })).data;
        if (!active || sessionEnding.current) return;

        register.current = (async () => {
          const device = await api.registerDevice(pushToken, Platform.OS === 'ios' ? 'ios' : 'android', jwt);
          await AsyncStorage.setItem(key, String(device.id));
          if (previousId && Number(previousId) !== device.id) {
            await removeDevice(Number(previousId), jwt);
          }
        })().catch(() => console.warn('[push] device registration failed'));
      })().catch(() => console.warn('[push] push setup failed'));
    }

    return () => {
      active = false;
      subscription.remove();
      Notifications.setNotificationHandler(null);
    };
  }, [jwt, key, onOpen]);

  return useCallback(async () => {
    if (!jwt || !key || !nativePush) return;
    sessionEnding.current = true;
    try {
      await register.current;
      const id = await AsyncStorage.getItem(key);
      if (id) {
        await removeDevice(Number(id), jwt);
        await AsyncStorage.removeItem(key);
      }
    } catch {
      // The next successful registration moves this installation to the new account.
      console.warn('[push] device unregistration failed');
    }
    Notifications.clearLastNotificationResponse();
    await Notifications.dismissAllNotificationsAsync()
      .catch(() => console.warn('[push] could not dismiss device notifications'));
  }, [jwt, key]);
}
