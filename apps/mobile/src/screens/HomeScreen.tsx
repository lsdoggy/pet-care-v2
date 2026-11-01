import { Pressable, StyleSheet, Text, View } from 'react-native';
import type { UserDto } from '../api/types';

interface Props {
  user: UserDto;
  onLogout: () => void;
}

export function HomeScreen({ user, onLogout }: Props) {
  return (
    <View style={styles.container}>
      <Text style={styles.title}>Welcome!</Text>
      <Text style={styles.email}>{user.email}</Text>
      <Text style={styles.since}>Registered: {new Date(user.createdAt).toLocaleDateString()}</Text>
      <Pressable style={({ pressed }) => [styles.button, pressed && styles.pressed]} onPress={onLogout}>
        <Text style={styles.buttonText}>Log out</Text>
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#f6f7fb', alignItems: 'center', justifyContent: 'center', padding: 24 },
  title: { fontSize: 24, fontWeight: '700', marginBottom: 8 },
  email: { fontSize: 18, color: '#4f46e5', marginBottom: 4 },
  since: { fontSize: 14, color: '#6b7280', marginBottom: 24 },
  button: { backgroundColor: '#dc2626', borderRadius: 10, paddingHorizontal: 32, paddingVertical: 12 },
  pressed: { opacity: 0.85 },
  buttonText: { color: '#fff', fontSize: 16, fontWeight: '600' },
});
