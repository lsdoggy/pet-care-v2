import { useState } from 'react';
import { Linking, Pressable, View } from 'react-native';
import { Text } from './Typography';
import { useLanguage } from '../i18n/language';
import { colors } from '../theme/tokens';

interface Props {
  title: string;
  startsAt: string;
  durationMinutes?: number;
  location?: string | null;
}

export function AddToGoogleCalendar({ title, startsAt, durationMinutes = 30, location }: Props) {
  const language = useLanguage();
  const addLabel = language === 'ru' ? 'Добавить в Google Calendar' : 'Add to Google Calendar';
  const [error, setError] = useState(false);
  const [busy, setBusy] = useState(false);
  const open = async () => {
    setError(false);
    setBusy(true);
    try {
      const start = new Date(startsAt);
      const end = new Date(start.getTime() + durationMinutes * 60_000);
      const format = (date: Date) => date.toISOString().replace(/[-:]/g, '').replace(/\.\d{3}Z$/, 'Z');
      const params = [
        ['action', 'TEMPLATE'], ['text', title], ['dates', `${format(start)}/${format(end)}`],
        ['details', language === 'ru' ? 'Добавлено из Pet Care.' : 'Added from Pet Care.'], ['location', location ?? ''],
      ].map(([key, value]) => `${key}=${encodeURIComponent(value)}`).join('&');
      await Linking.openURL(`https://calendar.google.com/calendar/render?${params}`);
    } catch {
      setError(true);
    } finally {
      setBusy(false);
    }
  };
  return <View style={{ gap: 4 }}>
    <Pressable accessibilityRole="button" accessibilityLabel={`${addLabel}: ${title}`} disabled={busy}
      onPress={() => void open()} style={{ minHeight: 44, justifyContent: 'center', paddingVertical: 8 }}>
      <Text style={{ color: colors.primaryStrong, fontWeight: '600' }}>{busy ? (language === 'ru' ? 'Открываем…' : 'Opening…') : addLabel}</Text>
    </Pressable>
    <Text style={{ color: colors.textSecondary, fontSize: 12 }}>{language === 'ru' ? 'Войдите в Google и подтвердите сохранение события.' : 'Sign in to Google and confirm the event.'}</Text>
    {error && <Text accessibilityRole="alert" style={{ color: colors.danger }}>{language === 'ru' ? 'Не удалось открыть календарь. Попробуйте ещё раз.' : 'Could not open the calendar. Try again.'}</Text>}
  </View>;
}
