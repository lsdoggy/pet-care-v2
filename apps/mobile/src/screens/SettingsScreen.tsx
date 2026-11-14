import { notificationText } from '../i18n/notificationText';
import { useLanguage, type Language } from '../i18n/language';
import { useCallback, useEffect, useState } from 'react';
import { ActivityIndicator, KeyboardAvoidingView, Platform, Pressable, ScrollView, StyleSheet, Switch, View } from 'react-native';
import { Text, TextInput } from '../components/Typography';
import { api, ApiError } from '../api/client';
import type { DeviceDto, NotificationDto, PetDto, UserDto } from '../api/types';
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
  const language = useLanguage();
  const [confirmDeactivation, setConfirmDeactivation] = useState(false);
  const [pets, setPets] = useState<PetDto[] | null>(null);
  const [petsError, setPetsError] = useState(false);
  const [petsAttempt, setPetsAttempt] = useState(0);

  useEffect(() => {
    let active = true;
    async function loadPets() {
      try {
        const token = await tokenStore.get();
        if (!token) throw new ApiError(401, 'Not authenticated');
        const items = await api.listPets(token);
        if (active) setPets(items);
      } catch {
        if (active) setPetsError(true);
      }
    }
    void loadPets();
    return () => { active = false; };
  }, [user.id, petsAttempt]);

  const [devices, setDevices] = useState<DeviceDto[]>([]);
  const [notifications, setNotifications] = useState<NotificationDto[]>([]);
  const [savingKey, setSavingKey] = useState<'push' | 'email' | 'hour' | 'day' | 'overdue' | 'lowStock' | 'profile' | 'deactivate' | null>(null);
  const [error, setError] = useState<Record<Language, string> | null>(null);
  const [firstName, setFirstName] = useState(user.firstName ?? '');
  const [phone, setPhone] = useState(user.phone ?? '');
  const [saved, setSaved] = useState<Record<Language, string> | null>(null);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState(false);

  const saveProfile = async () => {
    if (savingKey) return;
    setSaved(null);
    if (phone.trim() && !/^\+?[0-9 ()-]{6,20}$/.test(phone.trim())) {
      setError({ ru: 'Проверьте телефон: допустимы цифры, пробелы, скобки, дефисы и + в начале.', en: 'Use digits, spaces, parentheses, or hyphens, with an optional leading +.' });
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
      setSaved({ ru: 'Данные профиля сохранены', en: 'Profile saved' });
    } catch {
      setError({ ru: 'Не удалось сохранить профиль. Проверьте соединение и попробуйте ещё раз.', en: 'Could not save your profile. Check your connection and try again.' });
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
    async (key: 'push' | 'email' | 'hour' | 'day' | 'overdue' | 'lowStock', value: boolean) => {
      setSavingKey(key);
      setError(null);
      setSaved(null);
      try {
        const token = await tokenStore.get();
        if (!token) throw new ApiError(401, 'Not authenticated');
        const pushEnabled = key === 'push' ? value : user.pushNotificationsEnabled;
        const emailEnabled = key === 'email' ? value : user.emailNotificationsEnabled;
        const updated = await api.updateNotificationSettings(pushEnabled, emailEnabled, token, {
          hourReminderEnabled: key === 'hour' ? value : undefined,
          dayReminderEnabled: key === 'day' ? value : undefined,
          overdueReminderEnabled: key === 'overdue' ? value : undefined,
          lowStockNotificationEnabled: key === 'lowStock' ? value : undefined,
        });
        onUserChange(updated);
        setSaved({ ru: 'Настройки уведомлений сохранены', en: 'Notification settings saved' });
      } catch {
        setError({ ru: 'Не удалось сохранить настройки. Попробуйте ещё раз.', en: 'Could not save settings. Try again.' });
      } finally {
        setSavingKey(null);
      }
    },
    [user.pushNotificationsEnabled, user.emailNotificationsEnabled, onUserChange],
  );

  const deactivateAccount = async () => {
    if (savingKey) return;
    setSavingKey('deactivate');
    setError(null);
    setSaved(null);
    try {
      const token = await tokenStore.get();
      if (!token) throw new ApiError(401, 'Not authenticated');
      await api.deactivateAccount(token);
      onLogout();
    } catch {
      setError({ ru: 'Не удалось деактивировать аккаунт. Попробуйте позже.', en: 'Could not deactivate the account. Try again later.' });
    } finally {
      setSavingKey(null);
      setConfirmDeactivation(false);
    }
  };

  const markRead = useCallback(async (n: NotificationDto) => {
    if (n.channelStatus === 'read') return;
    try {
      const token = await tokenStore.get();
      if (!token) return;
      const updated = await api.markNotificationRead(n.id, token);
      setNotifications((prev) => prev.map((x) => (x.id === updated.id ? updated : x)));
    } catch (e) {
      setError({ ru: 'Не удалось отметить уведомление прочитанным. Попробуйте ещё раз.', en: 'Could not mark the notification as read. Try again.' });
    }
  }, []);

  const unread = notifications.filter((n) => n.channelStatus !== 'read').length;

  return (
    <KeyboardAvoidingView style={styles.container} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
    <ScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
      <Text style={styles.title}>{language === 'ru' ? 'Профиль' : 'Profile'}</Text>
      <Text style={styles.email}>{user.email}</Text>

      {error && <Text style={styles.error} accessibilityRole="alert">{error[language]}</Text>}
      {saved && <Text style={styles.badgeOn} accessibilityLiveRegion="polite">{saved[language]}</Text>}

      <View style={styles.card}>
        <Text style={styles.sectionTitle}>{language === 'ru' ? 'Личные данные' : 'Personal information'}</Text>
        <Text style={styles.rowTitle}>{language === 'ru' ? 'Имя' : 'First name'}</Text>
        <TextInput accessibilityLabel={language === 'ru' ? 'Имя' : 'First name'} style={styles.input} value={firstName} onChangeText={setFirstName} maxLength={80} autoComplete="given-name" editable={!savingKey} placeholder={language === 'ru' ? 'Как к вам обращаться' : 'What should we call you?'} />
        <Text style={styles.rowTitle}>{language === 'ru' ? 'Телефон (необязательно)' : 'Phone (optional)'}</Text>
        <TextInput accessibilityLabel={language === 'ru' ? 'Телефон' : 'Phone'} style={styles.input} value={phone} onChangeText={setPhone} maxLength={20} autoComplete="tel" keyboardType="phone-pad" editable={!savingKey} placeholder="+7 999 123-45-67" />
        <Pressable accessibilityRole="button" disabled={savingKey !== null} onPress={() => void saveProfile()} style={styles.action}>
          <Text style={styles.actionText}>{savingKey === 'profile' ? (language === 'ru' ? 'Сохранение…' : 'Saving…') : (language === 'ru' ? 'Сохранить изменения' : 'Save changes')}</Text>
        </Pressable>
      </View>

      <View style={styles.card}>
        <Text style={styles.sectionTitle}>{language === 'ru' ? 'Питомцы' : 'Pets'}</Text>
        {petsError ? (
          <>
            <Text>{language === 'ru' ? 'Не удалось загрузить питомцев.' : 'Could not load pets.'}</Text>
            <Pressable accessibilityRole="button" style={styles.action} onPress={() => {
              setPetsError(false);
              setPetsAttempt((attempt) => attempt + 1);
            }}>
              <Text style={styles.actionText}>{language === 'ru' ? 'Повторить' : 'Retry'}</Text>
            </Pressable>
          </>
        ) : pets === null ? <ActivityIndicator accessibilityLabel={language === 'ru' ? 'Загрузка питомцев' : 'Loading pets'} />
          : pets.length === 0 ? <Text>{language === 'ru' ? 'У вас пока нет питомцев.' : 'You don’t have any pets yet.'}</Text>
          : pets.map((pet) => <Text key={pet.id}>{pet.name}</Text>)}
      </View>

      {/* ---- Notification switches ---- */}
      <View style={styles.card}>
        <Text style={styles.sectionTitle}>{language === 'ru' ? 'Уведомления' : 'Notifications'}</Text>

        <View style={styles.row}>
          <View style={styles.rowLabel}>
            <Text style={styles.rowTitle}>{language === 'ru' ? 'Push-уведомления' : 'Push notifications'}</Text>
            <Text style={styles.rowHint}>{language === 'ru' ? 'Напоминания на подключённых мобильных устройствах' : 'Reminders on linked mobile devices'}</Text>
          </View>
          {savingKey === 'push' ? (
            <ActivityIndicator color="#4f46e5" />
          ) : (
            <Switch
              accessibilityLabel={language === 'ru' ? 'Push-уведомления' : 'Push notifications'}
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
            <Text style={styles.rowTitle}>{language === 'ru' ? 'Письма на почту' : 'Email notifications'}</Text>
            <Text style={styles.rowHint}>{language === 'ru' ? 'Лекарства, вакцинация и низкий остаток корма' : 'Medications, vaccinations, and low food stock'}</Text>
          </View>
          {savingKey === 'email' ? (
            <ActivityIndicator color="#4f46e5" />
          ) : (
            <Switch
              accessibilityLabel={language === 'ru' ? 'Письма на почту' : 'Email notifications'}
              disabled={savingKey !== null}
              value={user.emailNotificationsEnabled}
              onValueChange={(v) => void toggle('email', v)}
              trackColor={{ false: '#cbd5e1', true: '#a5b4fc' }}
              thumbColor={user.emailNotificationsEnabled ? '#4f46e5' : '#f1f5f9'}
            />
          )}
        </View>
      </View>

      {loading && <ActivityIndicator color={colors.primary} accessibilityLabel={language === 'ru' ? 'Загрузка устройств и уведомлений' : 'Loading devices and notifications'} />}
      {loadError && <View style={styles.card}>
        <Text style={styles.error} accessibilityRole="alert">{language === 'ru' ? 'Не удалось загрузить устройства и уведомления.' : 'Could not load devices and notifications.'}</Text>
        <Pressable accessibilityRole="button" onPress={() => void load()} style={styles.action}><Text style={styles.actionText}>{language === 'ru' ? 'Повторить загрузку' : 'Reload'}</Text></Pressable>
        <View style={styles.divider} />
        <View style={styles.row}>
          <View style={styles.rowLabel}>
            <Text style={styles.rowTitle}>{language === 'ru' ? 'Напоминания за час' : 'One-hour reminders'}</Text>
            <Text style={styles.rowHint}>{language === 'ru' ? 'Уведомления о предстоящих задачах ухода' : 'Notifications for upcoming care tasks'}</Text>
          </View>
          <Switch
            accessibilityLabel={language === 'ru' ? 'Напоминания за час' : 'One-hour reminders'}
            disabled={savingKey !== null}
            value={user.hourReminderEnabled ?? true}
            onValueChange={(value) => void toggle('hour', value)}
          />
        </View>
        <View style={styles.divider} />
        <View style={styles.row}>
          <Text style={styles.rowTitle}>{language === 'ru' ? 'Напоминания за день' : 'One-day reminders'}</Text>
          <Switch
            accessibilityLabel={language === 'ru' ? 'Напоминания за день' : 'One-day reminders'}
            disabled={savingKey !== null}
            value={user.dayReminderEnabled ?? false}
            onValueChange={(value) => void toggle('day', value)}
          />
        </View>
        <View style={styles.divider} />
        <View style={styles.row}>
          <Text style={styles.rowTitle}>{language === 'ru' ? 'Просроченные задачи' : 'Overdue tasks'}</Text>
          <Switch
            accessibilityLabel={language === 'ru' ? 'Просроченные задачи' : 'Overdue tasks'}
            disabled={savingKey !== null}
            value={user.overdueReminderEnabled ?? false}
            onValueChange={(value) => void toggle('overdue', value)}
          />
        </View>
        <View style={styles.divider} />
        <View style={styles.row}>
          <Text style={styles.rowTitle}>{language === 'ru' ? 'Низкий остаток корма' : 'Low food stock'}</Text>
          <Switch
            accessibilityLabel={language === 'ru' ? 'Низкий остаток корма' : 'Low food stock'}
            disabled={savingKey !== null}
            value={user.lowStockNotificationEnabled ?? false}
            onValueChange={(value) => void toggle('lowStock', value)}
          />
        </View>
      </View>}
      {!loading && !loadError && <>
      <View style={styles.card}>
        <Text style={styles.sectionTitle}>{language === 'ru' ? 'Подключённые устройства' : 'Linked devices'}</Text>
        {devices.length === 0 ? (
          <Text style={styles.empty}>
            {language === 'ru' ? 'Устройств пока нет. Откройте приложение на телефоне и разрешите уведомления, чтобы получать напоминания.' : 'No linked devices yet. Open the app on your phone and allow notifications to receive reminders.'}
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
                {d.pushEnabled ? (language === 'ru' ? 'Включены' : 'Enabled') : (language === 'ru' ? 'Выключены' : 'Disabled')}
              </Text>
            </View>
          ))
        )}
      </View>

      {/* ---- Notification feed ---- */}
      <View style={styles.card}>
        <Text style={styles.sectionTitle}>
          {language === 'ru' ? 'История уведомлений' : 'Notification history'}{unread > 0 ? ` · ${language === 'ru' ? 'новых' : 'unread'}: ${unread}` : ''}
        </Text>
        {notifications.length === 0 ? (
          <Text style={styles.empty}>{language === 'ru' ? 'Здесь появятся напоминания об уходе.' : 'Care reminders will appear here.'}</Text>
        ) : (
          notifications.map((n) => {
            const { title, body } = notificationText(n, language);
            return (
              <Pressable key={n.id} accessibilityRole="button" accessibilityLabel={`${title}. ${n.channelStatus === 'read' ? (language === 'ru' ? 'Прочитано' : 'Read') : (language === 'ru' ? 'Отметить прочитанным' : 'Mark as read')}`} onPress={() => void markRead(n)} style={styles.notifRow}>
                <Text style={styles.notifDot}>{n.channelStatus === 'read' ? '・' : '●'}</Text>
                <View style={{ flex: 1 }}>
                  <Text style={[styles.rowTitle, n.channelStatus === 'read' && styles.readText]}>
                    {title}
                  </Text>
                  <Text style={styles.rowHint}>{body}</Text>
                  <Text style={styles.rowHint}>
                    {new Date(n.createdAt).toLocaleString(language)} · {n.type === 'email' ? (language === 'ru' ? 'Почта' : 'Email') : 'Push'} · {(language === 'ru' ? { pending: 'Ожидает отправки', sent: 'Отправлено', failed: 'Ошибка доставки', read: 'Прочитано' } : { pending: 'Pending', sent: 'Sent', failed: 'Delivery failed', read: 'Read' })[n.channelStatus]}
                  </Text>
                </View>
              </Pressable>
            );
          })
        )}
      </View>
      </>}
      <Pressable accessibilityRole="button" disabled={savingKey !== null} onPress={onLogout} style={styles.action}><Text style={styles.actionText}>{language === 'ru' ? 'Выйти из аккаунта' : 'Sign out'}</Text></Pressable>
      {confirmDeactivation ? (
        <View style={styles.card}>
          <Text style={styles.sectionTitle}>{language === 'ru' ? 'Деактивировать аккаунт?' : 'Deactivate account?'}</Text>
          <Text>{language === 'ru' ? 'Данные сохранятся. Ссылка для восстановления придёт на вашу почту.' : 'Your data will be kept. You will receive a recovery link by email.'}</Text>
          <Pressable accessibilityRole="button" disabled={savingKey !== null} style={styles.action} onPress={() => void deactivateAccount()}>
            <Text style={styles.actionText}>{savingKey === 'deactivate' ? (language === 'ru' ? 'Деактивация…' : 'Deactivating…') : (language === 'ru' ? 'Подтвердить деактивацию' : 'Confirm deactivation')}</Text>
          </Pressable>
          <Pressable accessibilityRole="button" disabled={savingKey !== null} style={styles.action} onPress={() => setConfirmDeactivation(false)}>
            <Text style={styles.actionText}>{language === 'ru' ? 'Отмена' : 'Cancel'}</Text>
          </Pressable>
        </View>
      ) : (
        <Pressable accessibilityRole="button" disabled={savingKey !== null} style={styles.action} onPress={() => setConfirmDeactivation(true)}>
          <Text style={styles.actionText}>{language === 'ru' ? 'Деактивировать аккаунт' : 'Deactivate account'}</Text>
        </Pressable>
      )}
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
