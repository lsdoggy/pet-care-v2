import { useCallback, useEffect, useState } from 'react';
import {
  ActivityIndicator,
  FlatList,
  Image,
  Pressable,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { api, ApiError, resolveFileUrl } from '../api/client';
import type { PetDto, UserDto } from '../api/types';
import { SPECIES_LABELS } from '../api/types';
import { tokenStore } from '../auth/tokenStore';
import { useNavigation } from '../navigation/AppStack';

interface Props {
  user: UserDto;
  onLogout: () => void;
}

export function PetsHomeScreen({ user, onLogout }: Props) {
  const navigation = useNavigation();
  const [pets, setPets] = useState<PetDto[] | null>(null);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setError(null);
    try {
      const token = await tokenStore.get();
      if (!token) throw new ApiError(401, 'Not authenticated');
      setPets(await api.listPets(token));
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to load pets');
    }
  }, []);

  // Refresh the list whenever this screen instance mounts — i.e. on app start
  // and every time we pop back from PetForm/PetDetail (custom stack re-mounts Home).
  useEffect(() => {
    void load();
  }, [load]);

  const renderItem = ({ item }: { item: PetDto }) => {
    const photo = resolveFileUrl(item.photoUrl);
    return (
      <Pressable
        style={({ pressed }) => [styles.card, pressed && styles.cardPressed]}
        onPress={() => navigation.push({ name: 'PetDetail', petId: item.id })}
      >
        {photo ? (
          <View style={styles.photoWrap}>
            {/* Image kept simple to avoid native module beyond expo-image-picker */}
            <PetPhoto uri={photo} />
          </View>
        ) : (
          <View style={[styles.photoWrap, styles.photoPlaceholder]}>
            <Text style={styles.placeholderEmoji}>🐾</Text>
          </View>
        )}
        <View style={styles.info}>
          <Text style={styles.name}>{item.name}</Text>
          <Text style={styles.species}>{SPECIES_LABELS[item.species]}</Text>
        </View>
      </Pressable>
    );
  };

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <View>
          <Text style={styles.title}>My pets</Text>
          <Text style={styles.email}>{user.email}</Text>
        </View>
        <Pressable style={({ pressed }) => [styles.logoutBtn, pressed && styles.pressed]} onPress={onLogout}>
          <Text style={styles.logoutText}>Log out</Text>
        </Pressable>
      </View>

      {error ? (
        <View style={styles.centerBox}>
          <Text style={styles.errorText}>{error}</Text>
          <Pressable style={styles.retryBtn} onPress={() => void load()}>
            <Text style={styles.retryText}>Retry</Text>
          </Pressable>
        </View>
      ) : pets === null ? (
        <View style={styles.centerBox}>
          <ActivityIndicator size="large" color="#4f46e5" />
        </View>
      ) : (
        <FlatList
          data={pets}
          keyExtractor={(item) => String(item.id)}
          renderItem={renderItem}
          contentContainerStyle={pets.length === 0 ? styles.emptyWrap : styles.list}
          ListEmptyComponent={
            <View style={styles.emptyBox}>
              <Text style={styles.emptyTitle}>No pets yet</Text>
              <Text style={styles.emptyText}>Tap “+” to add your first pet.</Text>
            </View>
          }
          refreshing={false}
          onRefresh={() => void load()}
        />
      )}

      <Pressable
        style={({ pressed }) => [styles.fab, pressed && styles.pressed]}
        onPress={() => navigation.push({ name: 'PetForm' })}
      >
        <Text style={styles.fabText}>+</Text>
      </Pressable>
    </View>
  );
}

function PetPhoto({ uri }: { uri: string }) {
  return <Image source={{ uri }} style={styles.photo} resizeMode="cover" />;
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#f6f7fb' },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingTop: 24,
    paddingBottom: 12,
  },
  title: { fontSize: 24, fontWeight: '700' },
  email: { fontSize: 13, color: '#6b7280', marginTop: 2 },
  logoutBtn: { backgroundColor: '#fee2e2', borderRadius: 8, paddingHorizontal: 14, paddingVertical: 8 },
  logoutText: { color: '#dc2626', fontWeight: '600' },
  list: { padding: 16, gap: 12, paddingBottom: 96 },
  card: {
    flexDirection: 'row',
    backgroundColor: '#fff',
    borderRadius: 14,
    padding: 12,
    gap: 12,
    alignItems: 'center',
    shadowColor: '#000',
    shadowOpacity: 0.06,
    shadowRadius: 8,
    shadowOffset: { width: 0, height: 2 },
    elevation: 2,
  },
  cardPressed: { opacity: 0.85 },
  photoWrap: { width: 64, height: 64, borderRadius: 12, overflow: 'hidden' },
  photo: { width: 64, height: 64 },
  photoPlaceholder: { backgroundColor: '#eef0f6', alignItems: 'center', justifyContent: 'center' },
  placeholderEmoji: { fontSize: 26 },
  info: { flex: 1 },
  name: { fontSize: 17, fontWeight: '600' },
  species: { fontSize: 14, color: '#6b7280', marginTop: 2 },
  centerBox: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: 12, padding: 24 },
  errorText: { color: '#dc2626', textAlign: 'center' },
  retryBtn: { backgroundColor: '#4f46e5', borderRadius: 10, paddingHorizontal: 20, paddingVertical: 10 },
  retryText: { color: '#fff', fontWeight: '600' },
  emptyWrap: { flexGrow: 1, alignItems: 'center', justifyContent: 'center', padding: 24 },
  emptyBox: { alignItems: 'center', gap: 6 },
  emptyTitle: { fontSize: 18, fontWeight: '700' },
  emptyText: { fontSize: 14, color: '#6b7280' },
  fab: {
    position: 'absolute',
    right: 24,
    bottom: 32,
    width: 56,
    height: 56,
    borderRadius: 28,
    backgroundColor: '#4f46e5',
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#000',
    shadowOpacity: 0.25,
    shadowRadius: 10,
    shadowOffset: { width: 0, height: 4 },
    elevation: 6,
  },
  fabText: { color: '#fff', fontSize: 28, fontWeight: '600', lineHeight: 32 },
  pressed: { opacity: 0.85 },
});
