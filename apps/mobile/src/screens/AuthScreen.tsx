import { useState } from 'react';
import {
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { ApiError } from '../api/client';

export type AuthMode = 'login' | 'register';

interface Props {
  mode: AuthMode;
  onSubmit: (email: string, password: string) => Promise<void>;
  onSwitchMode: () => void;
}

export function AuthScreen({ mode, onSubmit, onSwitchMode }: Props) {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const isLogin = mode === 'login';

  const handleSubmit = async () => {
    setError(null);
    setBusy(true);
    try {
      await onSubmit(email.trim().toLowerCase(), password);
    } catch (e) {
      if (e instanceof ApiError) {
        const fieldErrors = e.details.map((d) => d.message).join('; ');
        setError(fieldErrors || e.message);
      } else {
        setError('Network error. Check EXPO_PUBLIC_API_URL and backend availability.');
      }
    } finally {
      setBusy(false);
    }
  };

  return (
    <KeyboardAvoidingView
      style={styles.container}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
    >
      <View style={styles.card}>
        <Text style={styles.title}>{isLogin ? 'Sign in' : 'Create account'}</Text>
        <Text style={styles.subtitle}>Pet Care Platform</Text>

        <TextInput
          style={styles.input}
          placeholder="Email"
          autoCapitalize="none"
          autoComplete="email"
          keyboardType="email-address"
          value={email}
          onChangeText={setEmail}
        />
        <TextInput
          style={styles.input}
          placeholder="Password"
          secureTextEntry
          autoComplete={isLogin ? 'password' : 'new-password'}
          value={password}
          onChangeText={setPassword}
        />

        {error !== null && <Text style={styles.error}>{error}</Text>}

        <Pressable
          style={({ pressed }) => [styles.button, pressed && styles.buttonPressed]}
          onPress={handleSubmit}
          disabled={busy}
        >
          {busy ? (
            <ActivityIndicator color="#fff" />
          ) : (
            <Text style={styles.buttonText}>{isLogin ? 'Log in' : 'Register'}</Text>
          )}
        </Pressable>

        <Pressable onPress={onSwitchMode} hitSlop={8}>
          <Text style={styles.link}>
            {isLogin ? "Don't have an account? Register" : 'Already have an account? Sign in'}
          </Text>
        </Pressable>
      </View>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#f6f7fb', justifyContent: 'center', padding: 24 },
  card: { backgroundColor: '#fff', borderRadius: 16, padding: 24, gap: 12 },
  title: { fontSize: 22, fontWeight: '700' },
  subtitle: { fontSize: 14, color: '#6b7280', marginBottom: 8 },
  input: {
    borderWidth: 1,
    borderColor: '#d1d5db',
    borderRadius: 10,
    paddingHorizontal: 12,
    paddingVertical: 10,
    fontSize: 16,
  },
  error: { color: '#dc2626', fontSize: 14 },
  button: {
    backgroundColor: '#4f46e5',
    borderRadius: 10,
    paddingVertical: 12,
    alignItems: 'center',
  },
  buttonPressed: { opacity: 0.85 },
  buttonText: { color: '#fff', fontSize: 16, fontWeight: '600' },
  link: { color: '#4f46e5', textAlign: 'center', fontSize: 14 },
});
