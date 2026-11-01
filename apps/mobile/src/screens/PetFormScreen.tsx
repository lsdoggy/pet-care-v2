import { useEffect, useState } from 'react';
import {
  ActivityIndicator,
  Image,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import * as ImagePicker from 'expo-image-picker';
import { api, ApiError, resolveFileUrl } from '../api/client';
import type { PetSpecies } from '../api/types';
import { PET_SPECIES, SPECIES_LABELS } from '../api/types';
import { tokenStore } from '../auth/tokenStore';
import { useNavigation } from '../navigation/AppStack';

interface Props {
  /** When set — edit mode (PATCH + optional photo re-upload). Otherwise create mode. */
  petId?: number;
}

const TODAY = new Date().toISOString().slice(0, 10);

export function PetFormScreen({ petId }: Props) {
  const navigation = useNavigation();
  const isEdit = petId !== undefined;

  const [loading, setLoading] = useState(isEdit);
  const [name, setName] = useState('');
  const [species, setSpecies] = useState<PetSpecies>('DOG');
  const [birthDate, setBirthDate] = useState('');
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});
  const [submitting, setSubmitting] = useState(false);
  const [pickedPhotoUri, setPickedPhotoUri] = useState<string | null>(null);
  const [existingPhotoUri, setExistingPhotoUri] = useState<string | null>(null);

  useEffect(() => {
    if (!isEdit || petId === undefined) return;
    (async () => {
      try {
        const token = await tokenStore.get();
        if (!token) throw new ApiError(401, 'Not authenticated');
        const pet = await api.getPet(petId, token);
        setName(pet.name);
        setSpecies(pet.species);
        setBirthDate(pet.birthDate ?? '');
        setExistingPhotoUri(resolveFileUrl(pet.photoUrl));
      } catch (e) {
        setFieldErrors({ form: e instanceof Error ? e.message : 'Failed to load pet' });
      } finally {
        setLoading(false);
      }
    })();
  }, [isEdit, petId]);

  const pickFromGallery = async () => {
    const permission = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (!permission.granted) {
      setFieldErrors((prev) => ({ ...prev, photo: 'Gallery permission is required to pick a photo' }));
      return;
    }
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ['images'],
      allowsEditing: true,
      aspect: [1, 1],
      quality: 0.8,
    });
    if (!result.canceled && result.assets[0]) {
      setPickedPhotoUri(result.assets[0].uri);
      setFieldErrors((prev) => {
        const { photo: _removed, ...rest } = prev;
        return rest;
      });
    }
  };

  const validate = (): boolean => {
    const errors: Record<string, string> = {};
    if (!name.trim()) errors.name = 'Name is required';
    if (birthDate && birthDate > TODAY) errors.birthDate = 'Birth date cannot be in the future';
    if (birthDate && !/^\d{4}-\d{2}-\d{2}$/.test(birthDate)) errors.birthDate = 'Use format YYYY-MM-DD';
    setFieldErrors(errors);
    return Object.keys(errors).length === 0;
  };

  const submit = async () => {
    if (!validate() || submitting) return;
    setSubmitting(true);
    try {
      const token = await tokenStore.get();
      if (!token) throw new ApiError(401, 'Not authenticated');

      const payload = {
        name: name.trim(),
        species,
        birthDate: birthDate || null,
      };

      let savedPetId: number;
      if (isEdit && petId !== undefined) {
        const updated = await api.updatePet(petId, payload, token);
        savedPetId = updated.id;
      } else {
        const created = await api.createPet(payload, token);
        savedPetId = created.id;
      }

      if (pickedPhotoUri) {
        const fileName = pickedPhotoUri.split('/').pop() || `pet-${savedPetId}.jpg`;
        await api.uploadPetPhoto(savedPetId, pickedPhotoUri, fileName, token);
      }

      navigation.pop();
    } catch (e) {
      if (e instanceof ApiError) {
        const map: Record<string, string> = {};
        e.details.forEach((d) => (map[d.field] = d.message));
        map.form = e.message;
        setFieldErrors(map);
      } else {
        setFieldErrors({ form: e instanceof Error ? e.message : 'Save failed' });
      }
    } finally {
      setSubmitting(false);
    }
  };

  if (loading) {
    return (
      <View style={styles.center}>
        <ActivityIndicator size="large" color="#4f46e5" />
      </View>
    );
  }

  const previewUri = pickedPhotoUri ?? existingPhotoUri;

  return (
    <KeyboardAvoidingView
      style={styles.flex}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
    >
      <ScrollView contentContainerStyle={styles.container} keyboardShouldPersistTaps="handled">
        <Text style={styles.title}>{isEdit ? 'Edit pet' : 'New pet'}</Text>

        <Text style={styles.label}>Photo</Text>
        <Pressable style={({ pressed }) => [styles.photoBox, pressed && styles.pressed]} onPress={pickFromGallery}>
          {previewUri ? (
            <Image source={{ uri: previewUri }} style={styles.photoImage} resizeMode="cover" />
          ) : (
            <Text style={styles.photoHint}>Tap to pick from gallery</Text>
          )}
        </Pressable>
        {fieldErrors.photo ? <Text style={styles.error}>{fieldErrors.photo}</Text> : null}

        <Text style={styles.label}>Name *</Text>
        <TextInput
          style={[styles.input, fieldErrors.name && styles.inputError]}
          value={name}
          onChangeText={setName}
          placeholder="Buddy"
          maxLength={100}
        />
        {fieldErrors.name ? <Text style={styles.error}>{fieldErrors.name}</Text> : null}

        <Text style={styles.label}>Species *</Text>
        {/* Custom chip "picker" — RN deprecated native Picker; keeps deps minimal */}
        <View style={styles.chips}>
          {PET_SPECIES.map((s) => (
            <Pressable
              key={s}
              onPress={() => setSpecies(s)}
              style={[styles.chip, species === s && styles.chipActive]}
            >
              <Text style={[styles.chipText, species === s && styles.chipTextActive]}>
                {SPECIES_LABELS[s]}
              </Text>
            </Pressable>
          ))}
        </View>

        <Text style={styles.label}>Birth date (YYYY-MM-DD)</Text>
        <TextInput
          style={[styles.input, fieldErrors.birthDate && styles.inputError]}
          value={birthDate}
          onChangeText={setBirthDate}
          placeholder="2020-05-01"
          autoCapitalize="none"
        />
        {fieldErrors.birthDate ? <Text style={styles.error}>{fieldErrors.birthDate}</Text> : null}

        {fieldErrors.form ? <Text style={styles.error}>{fieldErrors.form}</Text> : null}

        <Pressable
          style={({ pressed }) => [styles.submit, pressed && styles.pressed, submitting && styles.disabled]}
          onPress={() => void submit()}
          disabled={submitting}
        >
          {submitting ? (
            <ActivityIndicator color="#fff" />
          ) : (
            <Text style={styles.submitText}>{isEdit ? 'Save changes' : 'Create pet'}</Text>
          )}
        </Pressable>

        <Pressable style={styles.cancel} onPress={navigation.pop}>
          <Text style={styles.cancelText}>Cancel</Text>
        </Pressable>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center', backgroundColor: '#f6f7fb' },
  container: { padding: 20, backgroundColor: '#f6f7fb', gap: 6 },
  title: { fontSize: 24, fontWeight: '700', marginBottom: 12 },
  label: { fontSize: 14, fontWeight: '600', color: '#374151', marginTop: 12 },
  input: {
    backgroundColor: '#fff',
    borderRadius: 10,
    borderWidth: 1,
    borderColor: '#e5e7eb',
    paddingHorizontal: 14,
    paddingVertical: 12,
    fontSize: 16,
    marginTop: 6,
  },
  inputError: { borderColor: '#dc2626' },
  error: { color: '#dc2626', fontSize: 13, marginTop: 4 },
  photoBox: {
    height: 140,
    borderRadius: 14,
    backgroundColor: '#fff',
    borderWidth: 1,
    borderStyle: 'dashed',
    borderColor: '#c7cad1',
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'hidden',
    marginTop: 6,
  },
  photoImage: { width: '100%', height: '100%' },
  photoHint: { color: '#6b7280' },
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginTop: 8 },
  chip: {
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 18,
    backgroundColor: '#fff',
    borderWidth: 1,
    borderColor: '#e5e7eb',
  },
  chipActive: { backgroundColor: '#4f46e5', borderColor: '#4f46e5' },
  chipText: { color: '#374151', fontWeight: '500' },
  chipTextActive: { color: '#fff' },
  submit: {
    backgroundColor: '#4f46e5',
    borderRadius: 12,
    paddingVertical: 14,
    alignItems: 'center',
    marginTop: 24,
  },
  submitText: { color: '#fff', fontSize: 16, fontWeight: '600' },
  cancel: { alignItems: 'center', paddingVertical: 14, marginTop: 4 },
  cancelText: { color: '#6b7280', fontSize: 15 },
  pressed: { opacity: 0.85 },
  disabled: { opacity: 0.6 },
});
