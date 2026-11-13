import { useState } from 'react';
import { Linking, Pressable, View } from 'react-native';
import { Text } from './Typography';
import { colors } from '../theme/tokens';

interface Props {
  title: string;
  startsAt: string;
  durationMinutes?: number;
  location?: string | null;
}

export function AddToGoogleCalendar({ title, startsAt, durationMinutes = 30, location }: Props) {
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
        ['details', 'Добавлено из Pet Care.'], ['location', location ?? ''],
      ].map(([key, value]) => `${key}=${encodeURIComponent(value)}`).join('&');
      await Linking.openURL(`https://calendar.google.com/calendar/render?${params}`);
    } catch {
      setError(true);
    } finally {
      setBusy(false);
    }
  };
  return <View style={{ gap: 4 }}>
    <Pressable accessibilityRole="button" accessibilityLabel={`Добавить в Google Calendar: ${title}`} disabled={busy}
      onPress={() => void open()} style={{ minHeight: 44, justifyContent: 'center', paddingVertical: 8 }}>
      <Text style={{ color: colors.primaryStrong, fontWeight: '600' }}>{busy ? 'Открываю…' : 'Добавить в Google Calendar'}</Text>
    </Pressable>
    <Text style={{ color: colors.textSecondary, fontSize: 12 }}>Войдите в Google и подтвердите сохранение события.</Text>
    {error && <Text accessibilityRole="alert" style={{ color: colors.danger }}>Не удалось открыть календарь. Попробуйте ещё раз.</Text>}
  </View>;
}
