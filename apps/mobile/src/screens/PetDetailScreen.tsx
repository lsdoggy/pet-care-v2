import { useCallback, useEffect, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Image,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { api, ApiError, resolveFileUrl } from '../api/client';
import type { PetDto } from '../api/types';
import { SPECIES_LABELS } from '../api/types';
import { tokenStore } from '../auth/tokenStore';
import { useNavigation } from '../navigation/AppStack';

interface Props {
  petId: number;
}

export function PetDetailScreen({ petId }: Props) {
  const navigation = useNavigation();
  const [pet, setPet] = useState<PetDto | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [deleting, setDeleting] = useState(false);

  const load = useCallback(async () => {
    try {
      const token = await tokenStore.get();
      if (!token) throw new ApiError(401, 'Not authenticated');
      setPet(await api.getPet(petId, token));
      setError(null);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to load pet');
    }
  }, [petId]);

  useEffect(() => {
    void load();
  }, [load]);

  const confirmDelete = () => {
    Alert.alert('Delete pet', `Remove “${pet?.name ?? ''}” permanently?`, [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Delete',
        style: 'destructive',
        onPress: async () => {
          if (deleting) return;
          setDeleting(true);
          try {
            const token = await tokenStore.get();
            if (!token) throw new ApiError(401, 'Not authenticated');
            await api.deletePet(petId, token);
            // Home re-mounts and reloads when we pop back (keyed stack children).
            navigation.pop();
          } catch (e) {
            Alert.alert('Delete failed', e instanceof Error ? e.message : 'Unknown error');
          } finally {
            setDeleting(false);
          }
        },
      },
    ]);
  };

  if (error) {
    return (
      <View style={styles.center}>
        <Text style={styles.errorText}>{error}</Text>
        <Pressable style={styles.backBtn} onPress={navigation.pop}>
          <Text style={styles.backText}>Go back</Text>
        </Pressable>
      </View>
    );
  }

  if (!pet) {
    return (
      <View style={styles.center}>
        <ActivityIndicator size="large" color="#4f46e5" />
      </View>
    );
  }

  const photo = resolveFileUrl(pet.photoUrl);

  return (
    <ScrollView style={styles.flex} contentContainerStyle={styles.container}>
      <Text style={styles.title}>{pet.name}</Text>

      <View style={styles.photoWrap}>
        {photo ? (
          <Image source={{ uri: photo }} style={styles.photo} resizeMode="cover" />
        ) : (
          <View style={styles.photoPlaceholder}>
            <Text style={styles.placeholderEmoji}>🐾</Text>
          </View>
        )}
      </View>

      <View style={styles.fieldRow}>
        <Text style={styles.fieldLabel}>Species</Text>
        <Text style={styles.fieldValue}>{SPECIES_LABELS[pet.species]}</Text>
      </View>
      <View style={styles.fieldRow}>
        <Text style={styles.fieldLabel}>Birth date</Text>
        <Text style={styles.fieldValue}>{pet.birthDate ?? '—'}</Text>
      </View>
      <View style={styles.fieldRow}>
        <Text style={styles.fieldLabel}>Added</Text>
        <Text style={styles.fieldValue}>{new Date(pet.createdAt).toLocaleDateString()}</Text>
      </View>

      <Pressable
        style={({ pressed }) => [styles.historyBtn, pressed && styles.pressed]}
        onPress={() => navigation.push({ name: 'PetHistory', petId: pet.id, petName: pet.name })}
      >
        <Text style={styles.historyText}>🩺 Health history</Text>
      </Pressable>

      <Pressable
        style={({ pressed }) => [styles.editBtn, pressed && styles.pressed]}
        onPress={() => navigation.push({ name: 'PetForm', petId: pet.id })}
      >
        <Text style={styles.editText}>Edit</Text>
      </Pressable>

      <Pressable
        style={({ pressed }) => [styles.deleteBtn, pressed && styles.pressed, deleting && styles.disabled]}
        onPress={confirmDelete}
        disabled={deleting}
      >
        <Text style={styles.deleteText}>{deleting ? 'Deleting…' : 'Delete'}</Text>
      </Pressable>

      <Pressable style={styles.back} onPress={navigation.pop}>
        <Text style={styles.backLink}>← Back to list</Text>
      </Pressable>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1, backgroundColor: '#f6f7fb' },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center', backgroundColor: '#f6f7fb', gap: 12, padding: 24 },
  errorText: { color: '#dc2626', textAlign: 'center' },
  container: { padding: 20, gap: 12 },
  title: { fontSize: 26, fontWeight: '700' },
  photoWrap: {
    width: '100%',
    height: 220,
    borderRadius: 16,
    overflow: 'hidden',
    backgroundColor: '#fff',
  },
  photo: { width: '100%', height: '100%' },
  photoPlaceholder: { flex: 1, alignItems: 'center', justifyContent: 'center', backgroundColor: '#eef0f6' },
  placeholderEmoji: { fontSize: 48 },
  fieldRow: { flexDirection: 'row', justifyContent: 'space-between', paddingVertical: 8, borderBottomWidth: 1, borderBottomColor: '#e5e7eb' },
  fieldLabel: { color: '#6b7280', fontSize: 15 },
  fieldValue: { fontWeight: '600', fontSize: 15 },
  editBtn: { backgroundColor: '#4f46e5', borderRadius: 12, paddingVertical: 14, alignItems: 'center', marginTop: 12 },
  editText: { color: '#fff', fontSize: 16, fontWeight: '600' },
  historyBtn: { backgroundColor: '#e0e7ff', borderRadius: 12, paddingVertical: 14, alignItems: 'center', marginTop: 12 },
  historyText: { color: '#4f46e5', fontSize: 16, fontWeight: '600' },
  deleteBtn: { backgroundColor: '#fee2e2', borderRadius: 12, paddingVertical: 14, alignItems: 'center', marginTop: 8 },
  deleteText: { color: '#dc2626', fontSize: 16, fontWeight: '600' },
  back: { alignItems: 'center', paddingVertical: 14 },
  backLink: { color: '#4f46e5', fontSize: 15, fontWeight: '500' },
  backBtn: { backgroundColor: '#4f46e5', borderRadius: 10, paddingHorizontal: 24, paddingVertical: 10 },
  backText: { color: '#fff', fontWeight: '600' },
  pressed: { opacity: 0.85 },
  disabled: { opacity: 0.6 },
});
