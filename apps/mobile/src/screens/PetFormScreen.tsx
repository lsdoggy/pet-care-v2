import { PetPhoto } from '../components/PetPhoto';
import { useEffect, useMemo, useState } from 'react';
import { ActivityIndicator, Image, KeyboardAvoidingView, Platform, Pressable, ScrollView, StyleSheet, View } from 'react-native';
import { Text, TextInput } from '../components/Typography';
import * as ImagePicker from 'expo-image-picker';
import { api, ApiError } from '../api/client';
import type { PetSpecies } from '../api/types';
import { PET_SPECIES, SPECIES_LABELS } from '../api/types';
import { tokenStore } from '../auth/tokenStore';
import { useNavigation } from '../navigation/AppStack';
import {
  PET_BREED_MAX_LENGTH,
  PET_NAME_MAX_LENGTH,
  parseWeightKg,
  validatePetForm,
  type PetFieldErrors,
  type PetFormValues,
} from '../lib/petUtils';
import { colors } from '../theme/tokens';
import { DateField } from '../components/DateField';
import { localDateValue } from '../components/DateField.types';

interface Props {
  /** When set — edit mode (PATCH + optional photo re-upload). Otherwise create mode. */
  petId?: number;
}

/**
 * Design Sprint 3 · Pets (mobile): форма добавления/редактирования.
 * Bottom-sheet layout на мобильном: заголовок сверху, липкая кнопка действия снизу.
 * Валидация — единая функция validatePetForm (имя*, вид*, дата не в будущем, вес > 0),
 * тексты ошибок на русском. Бизнес-логика API не меняется (POST/PATCH /pets/{id}).
 */
const EMPTY_FORM: PetFormValues = { name: '', species: '', breed: '', birthDate: '', weightKg: '' };

export function PetFormScreen({ petId }: Props) {
  const navigation = useNavigation();
  const isEdit = petId !== undefined;

  const [loading, setLoading] = useState(isEdit);
  const [values, setValues] = useState<PetFormValues>(EMPTY_FORM);
  const [touched, setTouched] = useState(false);
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});
  const [submitting, setSubmitting] = useState(false);
  const [pickedPhotoUri, setPickedPhotoUri] = useState<string | null>(null);
  const [existingPhotoPath, setExistingPhotoPath] = useState<string | null>(null);

  const setField = <K extends keyof PetFormValues>(key: K, value: PetFormValues[K]) =>
    setValues((prev) => ({ ...prev, [key]: value }));

  useEffect(() => {
    if (!isEdit || petId === undefined) return;
    (async () => {
      try {
        const token = await tokenStore.get();
        if (!token) throw new ApiError(401, 'Not authenticated');
        const pet = await api.getPet(petId, token);
        setValues({
          name: pet.name,
          species: pet.species,
          breed: pet.breed ?? '',
          birthDate: pet.birthDate ?? '',
          weightKg: pet.weightKg != null ? String(pet.weightKg).replace('.', ',') : '',
        });
        setExistingPhotoPath(pet.photoUrl);
      } catch (e) {
        setFieldErrors({ form: e instanceof Error ? e.message : 'Не удалось загрузить питомца' });
      } finally {
        setLoading(false);
      }
    })();
  }, [isEdit, petId]);

  const pickFromGallery = async () => {
    const permission = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (!permission.granted) {
      setFieldErrors((prev) => ({ ...prev, photo: 'Нужен доступ к галерее для выбора фото' }));
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

  /** live-ошибки показываем только после первой попытки отправки. */
  const liveErrors: PetFieldErrors = useMemo(() => validatePetForm(values), [values]);
  const shownError = (field: keyof PetFormValues): string | undefined =>
    fieldErrors[field] ?? (touched ? liveErrors[field] : undefined);

  const submit = async () => {
    if (submitting) return;
    setTouched(true);
    const errors = validatePetForm(values);
    if (Object.keys(errors).length > 0) {
      setFieldErrors({});
      return;
    }
    setSubmitting(true);
    try {
      const token = await tokenStore.get();
      if (!token) throw new ApiError(401, 'Not authenticated');

      const payload = {
        name: values.name.trim(),
        species: values.species as PetSpecies,
        birthDate: values.birthDate || null,
        breed: values.breed.trim() || null,
        weightKg: parseWeightKg(values.weightKg),
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
        setFieldErrors({ form: e instanceof Error ? e.message : 'Не удалось сохранить' });
      }
    } finally {
      setSubmitting(false);
    }
  };

  if (loading) {
    return (
      <View style={styles.center}>
        <ActivityIndicator size="large" color={colors.primary} />
      </View>
    );
  }

  return (
    <KeyboardAvoidingView
      style={styles.flex}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
    >
      <ScrollView contentContainerStyle={styles.container} keyboardShouldPersistTaps="handled">
        <Text style={styles.title}>{isEdit ? 'Редактировать питомца' : 'Новый питомец'}</Text>

        <Text style={styles.label}>Фото</Text>
        <Pressable
          style={({ pressed }) => [styles.photoBox, pressed && styles.pressed]}
          onPress={pickFromGallery}
          accessibilityRole="button"
          accessibilityLabel="Выбрать фото из галереи"
        >
          {pickedPhotoUri ? (
            <Image source={{ uri: pickedPhotoUri }} style={styles.photoImage} resizeMode="cover" />
          ) : (
            <PetPhoto
              path={existingPhotoPath}
              style={styles.photoImage}
              resizeMode="cover"
              fallback={<Text style={styles.photoHint}>Нажмите, чтобы выбрать фото из галереи</Text>}
            />
          )}
        </Pressable>
        {shownError('photo' as keyof PetFormValues) || fieldErrors.photo ? (
          <Text style={styles.error}>{fieldErrors.photo}</Text>
        ) : null}

        <Text style={styles.label}>Имя *</Text>
        <TextInput
          style={[styles.input, !!shownError('name') && styles.inputError]}
          value={values.name}
          onChangeText={(t) => setField('name', t)}
          placeholder="Барсик"
          maxLength={PET_NAME_MAX_LENGTH}
          accessibilityLabel="Имя питомца, обязательно"
        />
        {shownError('name') ? <Text style={styles.error}>{shownError('name')}</Text> : null}

        <Text style={styles.label}>Вид *</Text>
        {/* Custom chip "picker" — RN deprecated native Picker; keeps deps minimal */}
        <View style={styles.chips}>
          {PET_SPECIES.map((s) => (
            <Pressable
              key={s}
              onPress={() => setField('species', s)}
              style={[styles.chip, values.species === s && styles.chipActive]}
              accessibilityRole="radiobutton"
              accessibilityState={{ selected: values.species === s }}
            >
              <Text style={[styles.chipText, values.species === s && styles.chipTextActive]}>
                {SPECIES_LABELS[s]}
              </Text>
            </Pressable>
          ))}
        </View>
        {shownError('species') ? <Text style={styles.error}>{shownError('species')}</Text> : null}

        <Text style={styles.label}>Порода</Text>
        <TextInput
          style={[styles.input, !!shownError('breed') && styles.inputError]}
          value={values.breed}
          onChangeText={(t) => setField('breed', t)}
          placeholder="Например: мейн-кун"
          maxLength={PET_BREED_MAX_LENGTH}
          accessibilityLabel="Порода, необязательно"
        />
        {shownError('breed') ? <Text style={styles.error}>{shownError('breed')}</Text> : null}

        <DateField
          label="Дата рождения (необязательно)"
          value={values.birthDate}
          onChange={(value) => setField('birthDate', value)}
          maximum={localDateValue(new Date())}
          optional
          disabled={submitting}
        />
        {shownError('birthDate') ? <Text style={styles.error}>{shownError('birthDate')}</Text> : null}

        <Text style={styles.label}>Вес, кг</Text>
        <TextInput
          style={[styles.input, !!shownError('weightKg') && styles.inputError]}
          value={values.weightKg}
          onChangeText={(t) => setField('weightKg', t)}
          placeholder="4,5"
          keyboardType="decimal-pad"
          accessibilityLabel="Вес в килограммах, больше нуля"
        />
        {shownError('weightKg') ? <Text style={styles.error}>{shownError('weightKg')}</Text> : null}

        {fieldErrors.form ? <Text style={styles.error}>{fieldErrors.form}</Text> : null}

        <Pressable
          style={({ pressed }) => [styles.submit, pressed && styles.pressed, submitting && styles.disabled]}
          onPress={() => void submit()}
          disabled={submitting}
          accessibilityRole="button"
        >
          {submitting ? (
            <ActivityIndicator color={colors.onPrimary} />
          ) : (
            <Text style={styles.submitText}>{isEdit ? 'Сохранить изменения' : 'Добавить питомца'}</Text>
          )}
        </Pressable>

        <Pressable style={styles.cancel} onPress={navigation.pop} accessibilityRole="button">
          <Text style={styles.cancelText}>Отмена</Text>
        </Pressable>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center', backgroundColor: colors.pageBackground },
  container: { padding: 20, backgroundColor: colors.pageBackground, gap: 6 },
  title: { fontSize: 24, fontWeight: '700', marginBottom: 12, color: colors.textPrimary },
  label: { fontSize: 14, fontWeight: '600', color: colors.textPrimary, marginTop: 12 },
  input: {
    backgroundColor: colors.surface,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: colors.border,
    paddingHorizontal: 14,
    paddingVertical: 12,
    fontSize: 16,
    marginTop: 6,
    minHeight: 44,
    color: colors.textPrimary,
  },
  inputError: { borderColor: colors.danger },
  error: { color: colors.danger, fontSize: 13, marginTop: 4 },
  photoBox: {
    height: 140,
    borderRadius: 14,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderStyle: 'dashed',
    borderColor: colors.borderStrong,
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'hidden',
    marginTop: 6,
  },
  photoImage: { width: '100%', height: '100%' },
  photoHint: { color: colors.textSecondary },
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginTop: 8 },
  chip: {
    paddingHorizontal: 14,
    paddingVertical: 10,
    borderRadius: 18,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
    minHeight: 44,
    justifyContent: 'center',
  },
  chipActive: { backgroundColor: colors.primary, borderColor: colors.primary },
  chipText: { color: colors.textPrimary, fontWeight: '500' },
  chipTextActive: { color: colors.onPrimary },
  submit: {
    backgroundColor: colors.primary,
    borderRadius: 12,
    paddingVertical: 14,
    alignItems: 'center',
    marginTop: 24,
    minHeight: 48,
  },
  submitText: { color: colors.onPrimary, fontSize: 16, fontWeight: '600' },
  cancel: { alignItems: 'center', paddingVertical: 14, marginTop: 4, minHeight: 44 },
  cancelText: { color: colors.textSecondary, fontSize: 15 },
  pressed: { opacity: 0.85 },
  disabled: { opacity: 0.6 },
});
