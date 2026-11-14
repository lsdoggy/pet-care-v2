import { PetPhoto } from '../components/PetPhoto';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { ActivityIndicator, FlatList, Pressable, StyleSheet, View } from 'react-native';
import { Text } from '../components/Typography';
import { api, ApiError } from '../api/client';
import type { CareTaskDto, PetDto, UserDto } from '../api/types';
import { SPECIES_LABELS, TASK_TYPE_LABELS } from '../api/types';
import { tokenStore } from '../auth/tokenStore';
import { useNavigation } from '../navigation/AppStack';
import { ScreenHeader, headerActionStyles } from '../components/ScreenHeader';
import {
  EMPTY_VALUE_PLACEHOLDER,
  formatPetAge,
  formatPetWeight,
  formatPetBreed,
  petInitials,
} from '../lib/petUtils';
import { colors, typography } from '../theme/tokens';

interface Props {
  user: UserDto;
  onLogout: () => void;
}

/**
 * Design Sprint 3 · Pets (mobile).
 * Список питомцев: фото/placeholder, имя, вид, порода, возраст, вес, следующая задача.
 * Empty state на русском; данные — существующие эндпоинты GET /pets и GET /tasks/upcoming.
 */
export function PetsHomeScreen({ user, onLogout }: Props) {
  const navigation = useNavigation();
  const [pets, setPets] = useState<PetDto[] | null>(null);
  const [tasks, setTasks] = useState<CareTaskDto[]>([]);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setError(null);
    try {
      const token = await tokenStore.get();
      if (!token) throw new ApiError(401, 'Not authenticated');
      // Следующая задача — опциональное обогащение: ошибка задач не ломает список питомцев.
      const [petsRes, tasksRes] = await Promise.all([
        api.listPets(token),
        api.listUpcomingTasks(token).catch(() => [] as CareTaskDto[]),
      ]);
      setPets(petsRes);
      setTasks(tasksRes);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Не удалось загрузить питомцев');
    }
  }, []);

  // Refresh the list whenever this screen instance mounts — i.e. on app start
  // and every time we pop back from PetForm/PetDetail (custom stack re-mounts Home).
  useEffect(() => {
    void load();
  }, [load]);

  /** ближайшая PENDING-задача по питомцу (список от /tasks/upcoming уже отсортирован). */
  const nextTaskByPet = useMemo(() => {
    const map = new Map<number, CareTaskDto>();
    for (const t of tasks) {
      if (t.status !== 'PENDING') continue;
      if (!map.has(t.petId)) map.set(t.petId, t);
    }
    return map;
  }, [tasks]);

  const renderItem = ({ item }: { item: PetDto }) => {
    const photo = item.photoUrl;
    const next = nextTaskByPet.get(item.id);
    return (
      <Pressable
        style={({ pressed }) => [styles.card, pressed && styles.cardPressed]}
        onPress={() => navigation.push({ name: 'PetDetail', petId: item.id })}
        accessibilityRole="button"
        accessibilityLabel={`Открыть карточку: ${item.name}`}
      >
        {photo ? (
          <View style={styles.photoWrap}>
            <PetPhoto path={photo} style={styles.photo} resizeMode="cover" />
          </View>
        ) : (
          <View style={[styles.photoWrap, styles.photoPlaceholder]}>
            <Text style={styles.placeholderText}>{petInitials(item.name) || '🐾'}</Text>
          </View>
        )}
        <View style={styles.info}>
          <Text style={styles.name}>{item.name}</Text>
          <Text style={styles.facts} numberOfLines={2}>
            {`${SPECIES_LABELS[item.species]} · ${formatPetAge(item.birthDate)} · ${formatPetWeight(item.weightKg)}`}
          </Text>
          {formatPetBreed(item.breed) !== EMPTY_VALUE_PLACEHOLDER ? (
            <Text style={styles.breed} numberOfLines={1}>{item.breed}</Text>
          ) : null}
          <Text style={styles.next} numberOfLines={1}>
            {next
              ? `Далее: ${TASK_TYPE_LABELS[next.type]} — ${next.title}`
              : 'Задач не запланировано'}
          </Text>
        </View>
      </Pressable>
    );
  };

  return (
    <View style={styles.container}>
      <ScreenHeader
        title="Мои питомцы"
        subtitle={user.email}
        actions={
          <Pressable
            style={({ pressed }) => [headerActionStyles.pill, styles.logoutBtn, pressed && styles.pressed]}
            onPress={onLogout}
            accessibilityRole="button"
            accessibilityLabel="Выйти"
          >
            <Text style={styles.logoutText}>Выйти</Text>
          </Pressable>
        }
      />

      {error ? (
        <View style={styles.centerBox}>
          <Text style={styles.errorText}>{error}</Text>
          <Pressable style={styles.retryBtn} onPress={() => void load()} accessibilityRole="button">
            <Text style={styles.retryText}>Повторить</Text>
          </Pressable>
        </View>
      ) : pets === null ? (
        <View style={styles.centerBox}>
          <ActivityIndicator size="large" color={colors.primary} />
        </View>
      ) : (
        <FlatList
          data={pets}
          keyExtractor={(item) => String(item.id)}
          renderItem={renderItem}
          contentContainerStyle={pets.length === 0 ? styles.emptyWrap : styles.list}
          ListEmptyComponent={
            <View style={styles.emptyBox}>
              <Text style={styles.emptyEmoji}>🐾</Text>
              <Text style={styles.emptyTitle}>Пока нет питомцев</Text>
              <Text style={styles.emptyText}>
                Добавьте первого питомца, чтобы вести историю здоровья и напоминания.
              </Text>
            </View>
          }
          refreshing={false}
          onRefresh={() => void load()}
        />
      )}

      <Pressable
        style={({ pressed }) => [styles.fab, pressed && styles.pressed]}
        onPress={() => navigation.push({ name: 'PetForm' })}
        accessibilityRole="button"
        accessibilityLabel="Добавить питомца"
      >
        <Text style={styles.fabText}>+</Text>
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.pageBackground },
  // header/title/email moved to <ScreenHeader/> (design shell) — Step 5.
  logoutBtn: { backgroundColor: colors.dangerSubtle },
  logoutText: { ...typography.button, color: colors.danger },
  list: { padding: 16, gap: 12, paddingBottom: 96 },
  card: {
    flexDirection: 'row',
    backgroundColor: colors.surface,
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
  photoPlaceholder: {
    backgroundColor: colors.surfaceMuted,
    alignItems: 'center',
    justifyContent: 'center',
  },
  placeholderText: { fontSize: 22, fontWeight: '700', color: colors.primaryStrong },
  info: { flex: 1, gap: 2 },
  name: { fontSize: 17, fontWeight: '600', color: colors.textPrimary },
  facts: { fontSize: 13, color: colors.textSecondary, marginTop: 2 },
  breed: { fontSize: 13, color: colors.textSecondary },
  next: { fontSize: 13, color: colors.primaryStrong, fontWeight: '500', marginTop: 2 },
  centerBox: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: 12, padding: 24 },
  errorText: { color: colors.danger, textAlign: 'center' },
  retryBtn: {
    backgroundColor: colors.primary,
    borderRadius: 10,
    paddingHorizontal: 20,
    paddingVertical: 12,
    minHeight: 44,
  },
  retryText: { color: colors.onPrimary, fontWeight: '600' },
  emptyWrap: { flexGrow: 1, alignItems: 'center', justifyContent: 'center', padding: 24 },
  emptyBox: { alignItems: 'center', gap: 6 },
  emptyEmoji: { fontSize: 44 },
  emptyTitle: { fontSize: 18, fontWeight: '700', color: colors.textPrimary },
  emptyText: { fontSize: 14, color: colors.textSecondary, textAlign: 'center' },
  fab: {
    position: 'absolute',
    right: 24,
    bottom: 32,
    width: 56,
    height: 56,
    borderRadius: 28,
    backgroundColor: colors.primary,
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#000',
    shadowOpacity: 0.25,
    shadowRadius: 10,
    shadowOffset: { width: 0, height: 4 },
    elevation: 6,
  },
  fabText: { color: colors.onPrimary, fontSize: 28, fontWeight: '600', lineHeight: 32 },
  pressed: { opacity: 0.85 },
});
