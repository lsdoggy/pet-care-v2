import { PetPhoto } from '../components/PetPhoto';
import { useLanguage } from '../i18n/language';
import { useCallback, useEffect, useState } from 'react';
import { ActivityIndicator, Alert, Pressable, ScrollView, StyleSheet, View } from 'react-native';
import { Text } from '../components/Typography';
import { api, ApiError } from '../api/client';
import type { PetDto } from '../api/types';
import { ENGLISH_SPECIES_LABELS, SPECIES_LABELS } from '../api/types';
import { tokenStore } from '../auth/tokenStore';
import { useNavigation } from '../navigation/AppStack';
import {
  formatBirthDateRu,
  formatPetAge,
  formatPetBreed,
  formatPetWeight,
  petInitials,
} from '../lib/petUtils';
import { colors } from '../theme/tokens';

interface Props {
  petId: number;
}

/**
 * Design Sprint 3 · Pets (mobile): карточка питомца.
 * Фото/placeholder, имя, вид, порода, возраст, вес, дата рождения +
 * доступное подтверждение удаления (нативный Alert с destructive-кнопкой).
 * Вызовы API не меняются: GET /pets/{id}, DELETE /pets/{id}.
 */
export function PetDetailScreen({ petId }: Props) {
  const language = useLanguage();
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
      setError(e instanceof Error ? e.message : 'Не удалось загрузить питомца');
    }
  }, [petId]);

  useEffect(() => {
    void load();
  }, [load]);

  const confirmDelete = () => {
    Alert.alert((language === 'ru' ? 'Удалить питомца?' : 'Delete pet?'), language === 'ru' ? `Удалить «${pet?.name ?? ''}» безвозвратно?` : `Permanently delete “${pet?.name ?? ''}”?`, [
      { text: (language === 'ru' ? 'Отмена' : 'Cancel'), style: 'cancel' },
      {
        text: (language === 'ru' ? 'Удалить' : 'Delete'),
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
            Alert.alert((language === 'ru' ? 'Не удалось удалить' : 'Could not delete pet'), e instanceof Error ? e.message : (language === 'ru' ? 'Неизвестная ошибка' : 'Unknown error'));
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
          <Text style={styles.backText}>{language === 'ru' ? (language === 'ru' ? 'Назад' : 'Back') : 'Back'}</Text>
        </Pressable>
      </View>
    );
  }

  if (!pet) {
    return (
      <View style={styles.center}>
        <ActivityIndicator size="large" color={colors.primary} />
      </View>
    );
  }

  const photo = pet.photoUrl;

  return (
    <ScrollView style={styles.flex} contentContainerStyle={styles.container}>
      <Text style={styles.title}>{pet.name}</Text>

      <View style={styles.photoWrap}>
        <PetPhoto
          path={photo}
          style={styles.photo}
          resizeMode="cover"
          fallback={(
            <View style={styles.photoPlaceholder}>
              <Text style={styles.placeholderText}>{petInitials(pet.name) || '🐾'}</Text>
            </View>
          )}
        />
      </View>

      <View style={styles.fieldRow}>
        <Text style={styles.fieldLabel}>{language === 'ru' ? (language === 'ru' ? 'Вид' : 'Species') : 'Species'}</Text>
        <Text style={styles.fieldValue}>{(language === 'ru' ? SPECIES_LABELS : ENGLISH_SPECIES_LABELS)[pet.species]}</Text>
      </View>
      <View style={styles.fieldRow}>
        <Text style={styles.fieldLabel}>{language === 'ru' ? (language === 'ru' ? 'Порода' : 'Breed') : 'Breed'}</Text>
        <Text style={styles.fieldValue}>{formatPetBreed(pet.breed)}</Text>
      </View>
      <View style={styles.fieldRow}>
        <Text style={styles.fieldLabel}>{language === 'ru' ? (language === 'ru' ? 'Дата рождения' : 'Birth date') : 'Birth date'}</Text>
        <Text style={styles.fieldValue}>{formatBirthDateRu(pet.birthDate, language)}</Text>
      </View>
      <View style={styles.fieldRow}>
        <Text style={styles.fieldLabel}>{language === 'ru' ? (language === 'ru' ? 'Возраст' : 'Age') : 'Age'}</Text>
        <Text style={styles.fieldValue}>{formatPetAge(pet.birthDate, undefined, language)}</Text>
      </View>
      <View style={styles.fieldRow}>
        <Text style={styles.fieldLabel}>{language === 'ru' ? (language === 'ru' ? 'Вес' : 'Weight') : 'Weight'}</Text>
        <Text style={styles.fieldValue}>{formatPetWeight(pet.weightKg, language)}</Text>
      </View>
      <View style={styles.fieldRow}>
        <Text style={styles.fieldLabel}>{language === 'ru' ? (language === 'ru' ? 'Добавлен' : 'Added') : 'Added'}</Text>
        <Text style={styles.fieldValue}>{formatBirthDateRu(pet.createdAt.slice(0, 10), language)}</Text>
      </View>

      <Pressable
        style={({ pressed }) => [styles.historyBtn, pressed && styles.pressed]}
        onPress={() => navigation.push({ name: 'PetHistory', petId: pet.id, petName: pet.name })}
        accessibilityRole="button"
      >
        <Text style={styles.historyText}>{language === 'ru' ? (language === 'ru' ? '🩺 История здоровья' : '🩺 Health history') : '🩺 Health history'}</Text>
      </Pressable>

      <Pressable
        style={({ pressed }) => [styles.editBtn, pressed && styles.pressed]}
        onPress={() => navigation.push({ name: 'PetForm', petId: pet.id })}
        accessibilityRole="button"
      >
        <Text style={styles.editText}>{language === 'ru' ? (language === 'ru' ? 'Редактировать' : 'Edit') : 'Edit'}</Text>
      </Pressable>

      <Pressable
        style={({ pressed }) => [styles.deleteBtn, pressed && styles.pressed, deleting && styles.disabled]}
        onPress={confirmDelete}
        disabled={deleting}
        accessibilityRole="button"
        accessibilityLabel={language === 'ru' ? `Удалить питомца ${pet.name}` : `Delete ${pet.name}`}
      >
        <Text style={styles.deleteText}>{deleting ? (language === 'ru' ? 'Удаляем…' : 'Deleting…') : (language === 'ru' ? 'Удалить' : 'Delete')}</Text>
      </Pressable>

      <Pressable style={styles.back} onPress={navigation.pop}>
        <Text style={styles.backLink}>{language === 'ru' ? (language === 'ru' ? '← К списку' : '← Back to pets') : '← Back to pets'}</Text>
      </Pressable>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1, backgroundColor: colors.pageBackground },
  center: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.pageBackground,
    gap: 12,
    padding: 24,
  },
  errorText: { color: colors.danger, textAlign: 'center' },
  container: { padding: 20, gap: 12 },
  title: { fontSize: 26, fontWeight: '700', color: colors.textPrimary },
  photoWrap: {
    width: '100%',
    height: 220,
    borderRadius: 16,
    overflow: 'hidden',
    backgroundColor: colors.surface,
  },
  photo: { width: '100%', height: '100%' },
  photoPlaceholder: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.surfaceMuted,
  },
  placeholderText: { fontSize: 44, fontWeight: '700', color: colors.primaryStrong },
  fieldRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingVertical: 10,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  fieldLabel: { color: colors.textSecondary, fontSize: 15 },
  fieldValue: { fontWeight: '600', fontSize: 15, color: colors.textPrimary },
  editBtn: {
    backgroundColor: colors.primary,
    borderRadius: 12,
    paddingVertical: 14,
    alignItems: 'center',
    marginTop: 12,
    minHeight: 48,
    justifyContent: 'center',
  },
  editText: { color: colors.onPrimary, fontSize: 16, fontWeight: '600' },
  historyBtn: {
    backgroundColor: colors.primarySubtle,
    borderRadius: 12,
    paddingVertical: 14,
    alignItems: 'center',
    marginTop: 12,
    minHeight: 48,
    justifyContent: 'center',
  },
  historyText: { color: colors.primaryStrong, fontSize: 16, fontWeight: '600' },
  deleteBtn: {
    backgroundColor: colors.dangerSubtle,
    borderRadius: 12,
    paddingVertical: 14,
    alignItems: 'center',
    marginTop: 8,
    minHeight: 48,
    justifyContent: 'center',
  },
  deleteText: { color: colors.danger, fontSize: 16, fontWeight: '600' },
  back: { alignItems: 'center', paddingVertical: 14, minHeight: 44 },
  backLink: { color: colors.primaryStrong, fontSize: 15, fontWeight: '500' },
  backBtn: {
    backgroundColor: colors.primary,
    borderRadius: 10,
    paddingHorizontal: 24,
    paddingVertical: 12,
    minHeight: 44,
  },
  backText: { color: colors.onPrimary, fontWeight: '600' },
  pressed: { opacity: 0.85 },
  disabled: { opacity: 0.6 },
});
