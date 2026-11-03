import { useCallback, useEffect, useState } from 'react';
import { ActivityIndicator, Pressable, ScrollView, StyleSheet, Switch, Text, View } from 'react-native';
import { api, ApiError } from '../api/client';
import type { DeviceDto, NotificationDto, UserDto } from '../api/types';
import { tokenStore } from '../auth/tokenStore';

interface SettingsScreenProps {
  user: UserDto;
  onUserChange: (user: UserDto) => void;
}

/**
 * Sprint 6 — "Settings" tab:
 *  - Push On/Off and Email On/Off switches (PATCH /api/v1/users/notification-settings);
 *  - registered devices list with masked Expo push tokens;
 *  - notification feed with unread badge, tap-to-mark-read.
 */
export function SettingsScreen({ user, onUserChange }: SettingsScreenProps) {
  const [devices, setDevices] = useState<DeviceDto[]>([]);
  const [notifications, setNotifications] = useState<NotificationDto[]>([]);
  const [savingKey, setSavingKey] = useState<'push' | 'email' | null>(null);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    try {
      const token = await tokenStore.get();
      if (!token) throw new ApiError(401, 'Not authenticated');
      const [devs, notifs] = await Promise.all([api.listDevices(token), api.listNotifications(token)]);
      setDevices(devs);
      setNotifications(notifs);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to load settings');
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  const toggle = useCallback(
    async (key: 'push' | 'email', value: boolean) => {
      setSavingKey(key);
      setError(null);
      try {
        const token = await tokenStore.get();
        if (!token) throw new ApiError(401, 'Not authenticated');
        const pushEnabled = key === 'push' ? value : user.pushNotificationsEnabled;
        const emailEnabled = key === 'email' ? value : user.emailNotificationsEnabled;
        const updated = await api.updateNotificationSettings(pushEnabled, emailEnabled, token);
        onUserChange(updated);
      } catch (e) {
        setError(e instanceof Error ? e.message : 'Failed to save settings');
      } finally {
        setSavingKey(null);
      }
    },
    [user.pushNotificationsEnabled, user.emailNotificationsEnabled, onUserChange],
  );

  const markRead = useCallback(async (n: NotificationDto) => {
    if (n.channelStatus === 'read') return;
    try {
      const token = await tokenStore.get();
      if (!token) return;
      const updated = await api.markNotificationRead(n.id, token);
      setNotifications((prev) => prev.map((x) => (x.id === updated.id ? updated : x)));
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to mark as read');
    }
  }, []);

  const unread = notifications.filter((n) => n.channelStatus !== 'read').length;

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content}>
      <Text style={styles.title}>Settings</Text>
      <Text style={styles.email}>{user.email}</Text>

      {error && <Text style={styles.error}>{error}</Text>}

      {/* ---- Notification switches ---- */}
      <View style={styles.card}>
        <Text style={styles.sectionTitle}>Notifications</Text>

        <View style={styles.row}>
          <View style={styles.rowLabel}>
            <Text style={styles.rowTitle}>Push notifications</Text>
            <Text style={styles.rowHint}>Reminders about care tasks on this device</Text>
          </View>
          {savingKey === 'push' ? (
            <ActivityIndicator color="#4f46e5" />
          ) : (
            <Switch
              value={user.pushNotificationsEnabled}
              onValueChange={(v) => void toggle('push', v)}
              trackColor={{ false: '#cbd5e1', true: '#a5b4fc' }}
              thumbColor={user.pushNotificationsEnabled ? '#4f46e5' : '#f1f5f9'}
            />
          )}
        </View>

        <View style={styles.divider} />

        <View style={styles.row}>
          <View style={styles.rowLabel}>
            <Text style={styles.rowTitle}>Email notifications</Text>
            <Text style={styles.rowHint}>Important events only (medication, vaccination)</Text>
          </View>
          {savingKey === 'email' ? (
            <ActivityIndicator color="#4f46e5" />
          ) : (
            <Switch
              value={user.emailNotificationsEnabled}
              onValueChange={(v) => void toggle('email', v)}
              trackColor={{ false: '#cbd5e1', true: '#a5b4fc' }}
              thumbColor={user.emailNotificationsEnabled ? '#4f46e5' : '#f1f5f9'}
            />
          )}
        </View>
      </View>

      {/* ---- Registered devices ---- */}
      <View style={styles.card}>
        <Text style={styles.sectionTitle}>Devices</Text>
        {devices.length === 0 ? (
          <Text style={styles.empty}>
            No push token registered yet. Allow notifications when prompted — the app registers this
            device automatically on start.
          </Text>
        ) : (
          devices.map((d) => (
            <View key={d.id} style={styles.deviceRow}>
              <Text style={styles.deviceIcon}>
                {d.platform === 'ios' ? '🍎' : d.platform === 'android' ? '🤖' : '💻'}
              </Text>
              <View style={{ flex: 1 }}>
                <Text style={styles.rowTitle}>{d.platform}</Text>
                <Text style={styles.rowHint}>{d.tokenPreview}</Text>
              </View>
              <Text style={d.pushEnabled ? styles.badgeOn : styles.badgeOff}>
                {d.pushEnabled ? 'active' : 'disabled'}
              </Text>
            </View>
          ))
        )}
      </View>

      {/* ---- Notification feed ---- */}
      <View style={styles.card}>
        <Text style={styles.sectionTitle}>
          Notifications{unread > 0 ? ` (${unread} new)` : ''}
        </Text>
        {notifications.length === 0 ? (
          <Text style={styles.empty}>Nothing yet. Reminders will appear here.</Text>
        ) : (
          notifications.map((n) => (
            <Pressable key={n.id} onPress={() => void markRead(n)} style={styles.notifRow}>
              <Text style={styles.notifDot}>{n.channelStatus === 'read' ? '・' : '●'}</Text>
              <View style={{ flex: 1 }}>
                <Text style={[styles.rowTitle, n.channelStatus === 'read' && styles.readText]}>
                  {n.title}
                </Text>
                <Text style={styles.rowHint}>{n.body}</Text>
                <Text style={styles.rowHint}>
                  {new Date(n.createdAt).toLocaleString()} · {n.type} · {n.channelStatus}
                </Text>
              </View>
            </Pressable>
          ))
        )}
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#f6f7fb' },
  content: { padding: 16, gap: 16 },
  title: { fontSize: 26, fontWeight: '700', color: '#111827' },
  email: { color: '#6b7280', fontSize: 14, marginTop: 2 },
  error: { color: '#c0392b', fontSize: 13 },
  card: { backgroundColor: '#fff', borderRadius: 12, padding: 16, gap: 12 },
  sectionTitle: { fontSize: 16, fontWeight: '700', color: '#111827' },
  row: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 12 },
  rowLabel: { flex: 1 },
  rowTitle: { fontSize: 15, color: '#111827', fontWeight: '600' },
  rowHint: { fontSize: 12, color: '#6b7280', marginTop: 2 },
  divider: { height: 1, backgroundColor: '#eef0f4' },
  empty: { color: '#6b7280', fontSize: 13 },
  deviceRow: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  deviceIcon: { fontSize: 20 },
  badgeOn: { color: '#16a34a', fontSize: 12, fontWeight: '700' },
  badgeOff: { color: '#9ca3af', fontSize: 12, fontWeight: '700' },
  notifRow: { flexDirection: 'row', gap: 8, alignItems: 'flex-start' },
  notifDot: { color: '#4f46e5', fontSize: 14, marginTop: 2 },
  readText: { color: '#6b7280' },
});
