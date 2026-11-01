import { useEffect, useState } from 'react';
import { StatusBar } from 'expo-status-bar';
import { StyleSheet, Text, View } from 'react-native';

// Ответ эндпоинта GET /api/v1/health
type HealthResponse = {
  status: string;
};

// Состояние экрана: ещё проверяем / всё ок / ошибка
type State = 'checking' | 'ok' | 'error';

// Адрес backend берётся из переменной окружения (файл .env):
// EXPO_PUBLIC_API_URL=http://192.168.x.x:8080
// ВАЖНО: с телефона "localhost" — это сам телефон, поэтому нужен IP компьютера в Wi-Fi.
const API_URL = process.env.EXPO_PUBLIC_API_URL ?? 'http://localhost:8080';

export default function App() {
  const [state, setState] = useState<State>('checking');

  useEffect(() => {
    fetch(`${API_URL}/api/v1/health`)
      .then((response) => {
        if (!response.ok) {
          throw new Error(`HTTP ${response.status}`);
        }
        return response.json() as Promise<HealthResponse>;
      })
      .then((data) => {
        setState(data.status === 'ok' ? 'ok' : 'error');
      })
      .catch(() => {
        setState('error');
      });
  }, []);

  return (
    <View style={styles.container}>
      <Text style={styles.title}>Pet Care Platform — Mobile Sprint 0</Text>
      {state === 'checking' && <Text style={styles.text}>Checking backend health…</Text>}
      {state === 'ok' && <Text style={[styles.badge, styles.okBadge]}>OK</Text>}
      {state === 'error' && <Text style={[styles.badge, styles.errorBadge]}>Error</Text>}
      <StatusBar style="auto" />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#fff',
    alignItems: 'center',
    justifyContent: 'center',
  },
  title: {
    fontSize: 18,
    fontWeight: '700',
    marginBottom: 16,
  },
  text: {
    fontSize: 16,
  },
  badge: {
    fontSize: 32,
    fontWeight: '800',
    paddingHorizontal: 32,
    paddingVertical: 12,
    borderRadius: 12,
    overflow: 'hidden',
  },
  okBadge: {
    backgroundColor: '#d1f7d1',
    color: '#1a7a1a',
  },
  errorBadge: {
    backgroundColor: '#f7d1d1',
    color: '#a11a1a',
  },
});
