import { useCallback, useEffect, useState } from 'react';
import { ActivityIndicator, KeyboardAvoidingView, Platform, Pressable, ScrollView, StyleSheet, Switch, Text, TextInput, View } from 'react-native';
import { api, ApiError } from '../api/client';
import type { DeviceDto, NotificationDto, UserDto } from '../api/types';
import { tokenStore } from '../auth/tokenStore';
import { colors } from '../theme/tokens';

interface SettingsScreenProps {
  user: UserDto;
  onUserChange: (user: UserDto) => void;
  onLogout: () => void;
}

/**
 * Sprint 6 — "Settings" tab:
 *  - Push On/Off and Email On/Off switches (PATCH /api/v1/users/notification-settings);
 *  - registered devices list with masked Expo push tokens;
 *  - notification feed with unread badge, tap-to-mark-read.
 */
export function SettingsScreen({ user, onUserChange, onLogout }: SettingsScreenProps) {
  const [devices, setDevices] = useState<DeviceDto[]>([]);
  const [notifications, setNotifications] = useState<NotificationDto[]>([]);
  const [savingKey, setSavingKey] = useState<'push' | 'email' | 'profile' | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [firstName, setFirstName] = useState(user.firstName ?? '');
  const [phone, setPhone] = useState(user.phone ?? '');
  const [saved, setSaved] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState(false);

  const saveProfile = async () => {
    if (savingKey) return;
    setSaved(null);
    if (phone.trim() && !/^\+?[0-9 ()-]{6,20}$/.test(phone.trim())) {
      setError('Проверьте телефон: допустимы цифры, пробелы, скобки, дефисы и + в начале.');
      return;
    }
    setSavingKey('profile');
    setError(null);
    try {
      const token = await tokenStore.get();
      if (!token) throw new Error();
      const updated = await api.updateProfile({ firstName: firstName.trim(), phone: phone.trim() }, token);
      onUserChange(updated);
      setFirstName(updated.firstName ?? '');
      setPhone(updated.phone ?? '');
      setSaved('Данные профиля сохранены');
    } catch {
      setError('Не удалось сохранить профиль. Проверьте соединение и попробуйте ещё раз.');
    } finally {
      setSavingKey(null);
    }
  };

  const load = useCallback(async () => {
    setLoading(true);
    setLoadError(false);
    try {
      const token = await tokenStore.get();
      if (!token) throw new ApiError(401, 'Not authenticated');
      const [devs, notifs] = await Promise.all([api.listDevices(token), api.listNotifications(token)]);
      setDevices(devs);
      setNotifications(notifs);
    } catch {
      setLoadError(true);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  const toggle = useCallback(
    async (key: 'push' | 'email', value: boolean) => {
      setSavingKey(key);
      setError(null);
      setSaved(null);
      try {
        const token = await tokenStore.get();
        if (!token) throw new ApiError(401, 'Not authenticated');
        const pushEnabled = key === 'push' ? value : user.pushNotificationsEnabled;
        const emailEnabled = key === 'email' ? value : user.emailNotificationsEnabled;
        const updated = await api.updateNotificationSettings(pushEnabled, emailEnabled, token);
        onUserChange(updated);
        setSaved('Настройки уведомлений сохранены');
      } catch {
        setError('Не удалось сохранить настройки. Попробуйте ещё раз.');
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
      setError('Не удалось отметить уведомление прочитанным. Попробуйте ещё раз.');
    }
  }, []);

  const unread = notifications.filter((n) => n.channelStatus !== 'read').length;

  return (
    <KeyboardAvoidingView style={styles.container} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
    <ScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
      <Text style={styles.title}>Профиль</Text>
      <Text style={styles.email}>{user.email}</Text>

      {error && <Text style={styles.error} accessibilityRole="alert">{error}</Text>}
      {saved && <Text style={styles.badgeOn} accessibilityLiveRegion="polite">{saved}</Text>}

      <View style={styles.card}>
        <Text style={styles.sectionTitle}>Личные данные</Text>
        <Text style={styles.rowTitle}>Имя</Text>
        <TextInput accessibilityLabel="Имя" style={styles.input} value={firstName} onChangeText={setFirstName} maxLength={80} autoComplete="given-name" editable={!savingKey} placeholder="Как к вам обращаться" />
        <Text style={styles.rowTitle}>Телефон (необязательно)</Text>
        <TextInput accessibilityLabel="Телефон" style={styles.input} value={phone} onChangeText={setPhone} maxLength={20} autoComplete="tel" keyboardType="phone-pad" editable={!savingKey} placeholder="+7 999 123-45-67" />
        <Pressable accessibilityRole="button" disabled={savingKey !== null} onPress={() => void saveProfile()} style={styles.action}>
          <Text style={styles.actionText}>{savingKey === 'profile' ? 'Сохранение…' : 'Сохранить изменения'}</Text>
        </Pressable>
      </View>

      {/* ---- Notification switches ---- */}
      <View style={styles.card}>
        <Text style={styles.sectionTitle}>Уведомления</Text>

        <View style={styles.row}>
          <View style={styles.rowLabel}>
            <Text style={styles.rowTitle}>Push-уведомления</Text>
            <Text style={styles.rowHint}>Напоминания на подключённых мобильных устройствах</Text>
          </View>
          {savingKey === 'push' ? (
            <ActivityIndicator color="#4f46e5" />
          ) : (
            <Switch
              accessibilityLabel="Push-уведомления"
              disabled={savingKey !== null}
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
            <Text style={styles.rowTitle}>Письма на почту</Text>
            <Text style={styles.rowHint}>Важные события: лекарства и вакцинация</Text>
          </View>
          {savingKey === 'email' ? (
            <ActivityIndicator color="#4f46e5" />
          ) : (
            <Switch
              accessibilityLabel="Письма на почту"
              disabled={savingKey !== null}
              value={user.emailNotificationsEnabled}
              onValueChange={(v) => void toggle('email', v)}
              trackColor={{ false: '#cbd5e1', true: '#a5b4fc' }}
              thumbColor={user.emailNotificationsEnabled ? '#4f46e5' : '#f1f5f9'}
            />
          )}
        </View>
      </View>

      {loading && <ActivityIndicator color={colors.primary} accessibilityLabel="Загрузка устройств и уведомлений" />}
      {loadError && <View style={styles.card}>
        <Text style={styles.error} accessibilityRole="alert">Не удалось загрузить устройства и уведомления.</Text>
        <Pressable accessibilityRole="button" onPress={() => void load()} style={styles.action}><Text style={styles.actionText}>Повторить загрузку</Text></Pressable>
      </View>}
      {!loading && !loadError && <>
      <View style={styles.card}>
        <Text style={styles.sectionTitle}>Подключённые устройства</Text>
        {devices.length === 0 ? (
          <Text style={styles.empty}>
            Устройств пока нет. Откройте приложение на телефоне и разрешите уведомления, чтобы получать напоминания.
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
                {d.pushEnabled ? 'Включены' : 'Выключены'}
              </Text>
            </View>
          ))
        )}
      </View>

      {/* ---- Notification feed ---- */}
      <View style={styles.card}>
        <Text style={styles.sectionTitle}>
          История уведомлений{unread > 0 ? ` · новых: ${unread}` : ''}
        </Text>
        {notifications.length === 0 ? (
          <Text style={styles.empty}>Здесь появятся напоминания об уходе.</Text>
        ) : (
          notifications.map((n) => (
            <Pressable key={n.id} accessibilityRole="button" accessibilityLabel={`${n.title}. ${n.channelStatus === 'read' ? 'Прочитано' : 'Отметить прочитанным'}`} onPress={() => void markRead(n)} style={styles.notifRow}>
              <Text style={styles.notifDot}>{n.channelStatus === 'read' ? '・' : '●'}</Text>
              <View style={{ flex: 1 }}>
                <Text style={[styles.rowTitle, n.channelStatus === 'read' && styles.readText]}>
                  {n.title}
                </Text>
                <Text style={styles.rowHint}>{n.body}</Text>
                <Text style={styles.rowHint}>
                  {new Date(n.createdAt).toLocaleString('ru-RU')} · {n.type === 'email' ? 'Почта' : 'Push'} · {{ pending: 'Ожидает отправки', sent: 'Отправлено', failed: 'Ошибка доставки', read: 'Прочитано' }[n.channelStatus]}
                </Text>
              </View>
            </Pressable>
          ))
        )}
      </View>
      </>}
      <Pressable accessibilityRole="button" disabled={savingKey !== null} onPress={onLogout} style={styles.action}><Text style={styles.actionText}>Выйти из аккаунта</Text></Pressable>
    </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#f6f7fb' },
  content: { padding: 16, gap: 16, width: '100%', maxWidth: 720, alignSelf: 'center' },
  input: { minHeight: 44, borderWidth: 1, borderColor: colors.borderStrong, borderRadius: 8, padding: 12, color: colors.textPrimary, backgroundColor: colors.surface },
  action: { minHeight: 44, padding: 12, borderRadius: 8, backgroundColor: colors.primary, alignItems: 'center', justifyContent: 'center' },
  actionText: { color: colors.onPrimary, fontWeight: '600' },
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
