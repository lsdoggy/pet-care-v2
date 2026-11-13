/**
 * DashboardScreen — главный экран мобильного приложения (Design Sprint 2).
 * Mobile-first, WCAG AA (minTouchTarget 44dp, контраст из токенов), system fonts.
 *
 * Данные: существующие эндпоинты GET /api/v1/{pets,tasks,appointments,food-products}
 * — бизнес-логика и API не меняются. Навигация — через штатный useNavigation().
 * Быстрые действия ведут на уже существующие формы (PetForm / AppointmentForm)
 * и вкладки (Tasks / Shopping); создание задачи и покупка открывают лёгкие inline-формы,
 * использующие те же api-методы, что и остальные экраны.
 */

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { validateQuickPurchase } from '../lib/quickPurchase';
import { useDashboardNow } from '../lib/useDashboardNow';
import type { ReactNode } from 'react';
import {
  ActivityIndicator,
  Image,
  KeyboardAvoidingView,
  Modal,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { api, ApiError, resolveFileUrl } from '../api/client';
import type {
  CareTaskDto,
  FoodProductDto,
  PetDto,
  UserDto,
  VetAppointmentDto,
} from '../api/types';
import { SPECIES_LABELS } from '../api/types';
import { tokenStore } from '../auth/tokenStore';
import { useNavigation, type TabName } from '../navigation/AppStack';
import { ScreenHeader, headerActionStyles } from '../components/ScreenHeader';
import { DashboardSkeleton } from '../components/DashboardSkeleton';
import {
  ageLabel,
  buildAttention,
  buildUpcomingEvents,
  formatDateTime,
  greetingForNow,
  type AttentionItem,
  type UpcomingEvent,
} from '../lib/dashboard';
import { colors, fontSize, layout, radius, shadow, spacing, stack, typography } from '../theme/tokens';

interface Props {
  user: UserDto;
  onLogout: () => void;
  /** Switches the shell tab (exists in AuthGate since Sprint 0 navigation shell). */
  onTabChange: (tab: TabName) => void;
}

type Phase = 'loading' | 'ready' | 'error';

const KIND_STYLE: Record<AttentionItem['kind'], { dot: string; label: string }> = {
  overdue: { dot: colors.danger, label: 'Просрочено' },
  today: { dot: colors.warning, label: 'Сегодня' },
  lowstock: { dot: colors.accent, label: 'Мало на складе' },
  visit: { dot: colors.info, label: 'Визит' },
};

export function DashboardScreen({ user, onLogout, onTabChange }: Props) {
  const navigation = useNavigation();
  const [phase, setPhase] = useState<Phase>('loading');
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [pets, setPets] = useState<PetDto[]>([]);
  const [tasks, setTasks] = useState<CareTaskDto[]>([]);
  const [appointments, setAppointments] = useState<VetAppointmentDto[]>([]);
  const [products, setProducts] = useState<FoodProductDto[]>([]);
  const [pickerOpen, setPickerOpen] = useState(false);
  const [taskModalOpen, setTaskModalOpen] = useState(false);
  const [purchaseModalOpen, setPurchaseModalOpen] = useState(false);

  const load = useCallback(async () => {
    setPhase('loading');
    setErrorMsg(null);
    try {
      const token = await tokenStore.get();
      if (!token) throw new ApiError(401, 'Необходима авторизация');
      // Параллельная загрузка — те же четыре GET-эндпоинта, что использует web-дашборд.
      const [p, t, a, f] = await Promise.all([
        api.listPets(token),
        api.listTasks(token),
        api.listAppointments(token),
        api.listFoodProducts(token),
      ]);
      setPets(p);
      setTasks(t);
      setAppointments(a);
      setProducts(f);
      setPhase('ready');
    } catch (e) {
      setErrorMsg(e instanceof Error ? e.message : 'Не удалось загрузить данные');
      setPhase('error');
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  const now = useDashboardNow();
  const attention = useMemo(() => buildAttention(tasks, products, appointments, 6, now), [tasks, products, appointments, now]);
  const events = useMemo(() => buildUpcomingEvents(tasks, appointments, 8, now), [tasks, appointments, now]);

  const goVet = useCallback(() => {
    if (pets.length === 0) {
      navigation.push({ name: 'PetForm' });
      return;
    }
    if (pets.length === 1) {
      navigation.push({ name: 'AppointmentForm', petId: pets[0].id, petName: pets[0].name });
      return;
    }
    setPickerOpen(true);
  }, [pets, navigation]);

  /* ---------- render helpers ---------- */

  const renderBody = () => {
    if (phase === 'loading') return <DashboardSkeleton />;

    if (phase === 'error') {
      return (
        <View style={styles.stateBox}>
          <Text style={styles.stateTitle}>Не удалось загрузить данные</Text>
          <Text style={styles.stateText}>{errorMsg}</Text>
          <Pressable
            style={({ pressed }) => [styles.primaryBtn, pressed && styles.pressed]}
            onPress={() => void load()}
            accessibilityRole="button"
            accessibilityLabel="Повторить загрузку"
          >
            <Text style={styles.primaryBtnText}>Повторить</Text>
          </Pressable>
        </View>
      );
    }

    // Empty state: питомцев нет вообще.
    if (pets.length === 0) {
      return (
        <View style={styles.stateBox}>
          <Text style={styles.emptyEmoji} importantForAccessibility="no">
            🐾
          </Text>
          <Text style={styles.stateTitle}>Пока нет питомцев</Text>
          <Text style={styles.stateText}>Добавьте первого питомца, чтобы получать напоминания о кормлении, прививках и визитах к врачу.</Text>
          <Pressable
            style={({ pressed }) => [styles.primaryBtn, pressed && styles.pressed]}
            onPress={() => navigation.push({ name: 'PetForm' })}
            accessibilityRole="button"
            accessibilityLabel="Добавить питомца"
          >
            <Text style={styles.primaryBtnText}>+ Добавить питомца</Text>
          </Pressable>
        </View>
      );
    }

    return (
      <ScrollView
        style={styles.scroll}
        contentContainerStyle={styles.scrollContent}
        refreshControl={undefined}
      >
        {/* Приветствие */}
        <Text style={styles.greeting}>{greetingForNow(now)}, {user.email.split('@')[0]}!</Text>
        <Text style={styles.greetingSub}>
          {attention.overdueCount > 0
            ? `⚠ Просрочено задач: ${attention.overdueCount}. Откройте «Требует внимания» ниже.`
            : attention.todayCount > 0
              ? `На сегодня задач: ${attention.todayCount}. Хорошего дня!`
              : 'Срочных дел нет — всё под контролем.'}
        </Text>

        {/* Требует внимания */}
        <Section title="Требует внимания" badge={attention.items.length}>
          {attention.items.length === 0 ? (
            <Text style={styles.okText}>✅ Всё сделано. Ближайшие 14 дней спокойны.</Text>
          ) : (
            attention.items.map((item) => {
              const kind = KIND_STYLE[item.kind];
              return (
                <View key={item.key} style={styles.attentionRow}>
                  <View style={[styles.kindDot, { backgroundColor: kind.dot }]} importantForAccessibility="no" />
                  <View style={styles.attentionBody}>
                    <Text style={styles.attentionTitle}>{item.title}</Text>
                    <Text style={styles.attentionMeta}>
                      {kind.label}
                      {item.petName ? ` · ${item.petName}` : ''} · {item.meta}
                    </Text>
                  </View>
                </View>
              );
            })
          )}
        </Section>

        {/* Быстрые действия */}
        <Section title="Быстрые действия">
          <View style={styles.actionsGrid}>
            <QuickAction
              emoji="🐶"
              label="Добавить питомца"
              onPress={() => navigation.push({ name: 'PetForm' })}
            />
            <QuickAction emoji="📝" label="Создать задачу" onPress={() => setTaskModalOpen(true)} />
            <QuickAction emoji="🩺" label="Записать к врачу" onPress={goVet} />
            <QuickAction emoji="🛒" label="Добавить покупку" onPress={() => setPurchaseModalOpen(true)} />
          </View>
        </Section>

        {/* Мои питомцы */}
        <Section title="Мои питомцы" actionLabel="Все" onAction={() => onTabChange('Home')}>
          {pets.map((pet) => {
            const photo = resolveFileUrl(pet.photoUrl);
            return (
              <Pressable
                key={pet.id}
                style={({ pressed }) => [styles.petCard, pressed && styles.pressed]}
                onPress={() => navigation.push({ name: 'PetDetail', petId: pet.id, petName: pet.name })}
                accessibilityRole="button"
                accessibilityLabel={`Профиль питомца ${pet.name}`}
              >
                {photo ? (
                  <Image source={{ uri: photo }} style={styles.petPhoto} resizeMode="cover" />
                ) : (
                  <View style={styles.petPhotoPlaceholder}>
                    <Text style={styles.petPhotoEmoji} importantForAccessibility="no">
                      🐾
                    </Text>
                  </View>
                )}
                <View style={styles.petInfo}>
                  <Text style={styles.petName}>{pet.name}</Text>
                  <Text style={styles.petMeta}>
                    {SPECIES_LABELS[pet.species]} · {ageLabel(pet.birthDate)}
                  </Text>
                </View>
                <Text style={styles.chevron} importantForAccessibility="no">
                  ›
                </Text>
              </Pressable>
            );
          })}
        </Section>

        {/* Ближайшие события */}
        <Section title="Ближайшие события" actionLabel="Все задачи" onAction={() => onTabChange('Tasks')}>
          {events.length === 0 ? (
            <Text style={styles.okText}>Впереди нет запланированных событий.</Text>
          ) : (
            events.map((ev: UpcomingEvent) => (
              <View key={ev.key} style={styles.eventRow}>
                <Text style={styles.eventEmoji} importantForAccessibility="no">
                  {ev.kind === 'visit' ? '🩺' : '📌'}
                </Text>
                <View style={styles.eventBody}>
                  <Text style={styles.eventTitle}>{ev.title}</Text>
                  <Text style={styles.eventMeta}>
                    {ev.subtitle}
                    {ev.petName ? ` · ${ev.petName}` : ''} · {formatDateTime(ev.at)}
                  </Text>
                </View>
              </View>
            ))
          )}
        </Section>

        {/* Остаток корма — короткая сводка со ссылкой на склад */}
        {attention.lowStockCount > 0 ? (
          <Section title="Склад корма" actionLabel="Открыть" onAction={() => onTabChange('Stock')}>
            <Text style={styles.warnText}>
              ⚠ Позиций с низким остатком: {attention.lowStockCount}. Добавьте их в список покупок.
            </Text>
          </Section>
        ) : null}
      </ScrollView>
    );
  };

  return (
    <KeyboardAvoidingView
      style={styles.container}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
    >
      <ScreenHeader
        title="Главная"
        subtitle={user.email}
        actions={
          <Pressable
            style={({ pressed }) => [headerActionStyles.pill, styles.logoutBtn, pressed && styles.pressed]}
            onPress={onLogout}
            accessibilityRole="button"
            accessibilityLabel="Выйти из аккаунта"
          >
            <Text style={styles.logoutText}>Выход</Text>
          </Pressable>
        }
      />

      {renderBody()}

      {/* Пикер питомца для записи к врачу */}
      <Modal visible={pickerOpen} transparent animationType="fade" onRequestClose={() => setPickerOpen(false)}>
        <View style={styles.modalOverlay}>
          <View style={styles.sheet}>
            <Text style={styles.sheetTitle}>Кого записываем к врачу?</Text>
            {pets.map((pet) => (
              <Pressable
                key={pet.id}
                style={({ pressed }) => [styles.sheetItem, pressed && styles.pressed]}
                onPress={() => {
                  setPickerOpen(false);
                  navigation.push({ name: 'AppointmentForm', petId: pet.id, petName: pet.name });
                }}
                accessibilityRole="button"
                accessibilityLabel={`Записать ${pet.name}`}
              >
                <Text style={styles.sheetItemText}>
                  {SPECIES_LABELS[pet.species]} · {pet.name}
                </Text>
              </Pressable>
            ))}
            <Pressable
              style={({ pressed }) => [styles.sheetCancel, pressed && styles.pressed]}
              onPress={() => setPickerOpen(false)}
              accessibilityRole="button"
              accessibilityLabel="Отмена"
            >
              <Text style={styles.sheetCancelText}>Отмена</Text>
            </Pressable>
          </View>
        </View>
      </Modal>

      {/* Быстрое создание задачи (POST /tasks — тот же контракт, что TasksScreen) */}
      <QuickTaskModal
        visible={taskModalOpen}
        pets={pets}
        onClose={() => setTaskModalOpen(false)}
        onCreated={() => {
          setTaskModalOpen(false);
          void load();
        }}
      />

      {/* Быстрое добавление покупки (POST /shopping-list/items custom mode) */}
      <QuickPurchaseModal
        visible={purchaseModalOpen}
        onClose={() => setPurchaseModalOpen(false)}
        onCreated={() => {
          setPurchaseModalOpen(false);
          void load();
        }}
      />
    </KeyboardAvoidingView>
  );
}

/* ---------- Small presentational building blocks ---------- */

function Section({
  title,
  badge,
  actionLabel,
  onAction,
  children,
}: {
  title: string;
  badge?: number;
  actionLabel?: string;
  onAction?: () => void;
  children: ReactNode;
}) {
  return (
    <View style={styles.section}>
      <View style={styles.sectionHead}>
        <Text style={styles.sectionTitle}>{title}</Text>
        {typeof badge === 'number' && badge > 0 ? <Text style={styles.badge}>{badge}</Text> : null}
        <View style={styles.sectionSpacer} />
        {actionLabel && onAction ? (
          <Pressable onPress={onAction} hitSlop={8} accessibilityRole="button" accessibilityLabel={actionLabel}>
            <Text style={styles.sectionLink}>{actionLabel} ›</Text>
          </Pressable>
        ) : null}
      </View>
      <View style={styles.card}>{children}</View>
    </View>
  );
}

function QuickAction({ emoji, label, onPress }: { emoji: string; label: string; onPress: () => void }) {
  return (
    <Pressable
      style={({ pressed }) => [styles.actionTile, pressed && styles.pressed]}
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel={label}
    >
      <Text style={styles.actionEmoji} importantForAccessibility="no">
        {emoji}
      </Text>
      <Text style={styles.actionLabel}>{label}</Text>
    </Pressable>
  );
}

/* ---------- Inline quick forms (reuse existing api methods) ---------- */

function QuickTaskModal({
  visible,
  pets,
  onClose,
  onCreated,
}: {
  visible: boolean;
  pets: PetDto[];
  onClose: () => void;
  onCreated: () => void;
}) {
  const [title, setTitle] = useState('');
  const [petId, setPetId] = useState<number | null>(pets[0]?.id ?? null);
  const [dueLocal, setDueLocal] = useState(defaultDueLocal());
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  useEffect(() => {
    if (visible) {
      setTitle('');
      setPetId(pets[0]?.id ?? null);
      setDueLocal(defaultDueLocal());
      setErr(null);
    }
  }, [visible, pets]);

  const submit = async () => {
    if (!title.trim() || petId == null) {
      setErr('Укажите название и питомца.');
      return;
    }
    const dueAt = new Date(dueLocal);
    if (Number.isNaN(dueAt.getTime())) {
      setErr('Некорректные дата и время.');
      return;
    }
    setBusy(true);
    setErr(null);
    try {
      const token = await tokenStore.get();
      if (!token) throw new ApiError(401, 'Необходима авторизация');
      await api.createTask(
        { petId, title: title.trim(), type: 'OTHER', dueAt: dueAt.toISOString() },
        token,
      );
      onCreated();
    } catch (e) {
      setErr(e instanceof Error ? e.message : 'Не удалось создать задачу');
    } finally {
      setBusy(false);
    }
  };

  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onClose}>
      <View style={styles.modalOverlay}>
        <View style={styles.sheet}>
          <Text style={styles.sheetTitle}>Новая задача</Text>

          <Text style={styles.fieldLabel}>Название</Text>
          <TextInput
            style={styles.input}
            value={title}
            onChangeText={setTitle}
            placeholder="Например: дать витамины"
            placeholderTextColor={colors.textTertiary}
            accessibilityLabel="Название задачи"
          />

          <Text style={styles.fieldLabel}>Питомец</Text>
          {pets.map((p) => (
            <Pressable
              key={p.id}
              style={[styles.chip, petId === p.id && styles.chipSelected]}
              onPress={() => setPetId(p.id)}
              accessibilityRole="radio"
              accessibilityState={{ selected: petId === p.id }}
              accessibilityLabel={p.name}
            >
              <Text style={[styles.chipText, petId === p.id && styles.chipTextSelected]}>{p.name}</Text>
            </Pressable>
          ))}

          <Text style={styles.fieldLabel}>Дата и время (ГГГГ-ММ-ДДЧЧ:ММ)</Text>
          <TextInput
            style={styles.input}
            value={dueLocal}
            onChangeText={setDueLocal}
            placeholder="2026-11-05T18:00"
            placeholderTextColor={colors.textTertiary}
            autoCapitalize="none"
            accessibilityLabel="Дата и время выполнения"
          />

          {err ? <Text style={styles.errText}>{err}</Text> : null}

          <View style={styles.modalActions}>
            <Pressable style={({ pressed }) => [styles.secondaryBtn, pressed && styles.pressed]} onPress={onClose}>
              <Text style={styles.secondaryBtnText}>Отмена</Text>
            </Pressable>
            <Pressable
              style={({ pressed }) => [styles.primaryBtn, pressed && styles.pressed, busy && styles.pressed]}
              onPress={() => void submit()}
              accessibilityRole="button"
              accessibilityLabel="Создать задачу"
            >
              {busy ? (
                <ActivityIndicator color={colors.onPrimary} />
              ) : (
                <Text style={styles.primaryBtnText}>Создать</Text>
              )}
            </Pressable>
          </View>
        </View>
      </View>
    </Modal>
  );
}

export function QuickPurchaseModal({
  visible,
  onClose,
  onCreated,
}: {
  visible: boolean;
  onClose: () => void;
  onCreated: () => void;
}) {
  const [name, setName] = useState('');
  const [qty, setQty] = useState('1');
  const inFlight = useRef(false);
  const [busy, setBusy] = useState(false);
  const close = () => { if (!inFlight.current) onClose(); };
  const [err, setErr] = useState<string | null>(null);

  useEffect(() => {
    if (visible) {
      setName('');
      setQty('1');
      setErr(null);
    }
  }, [visible]);

  const submit = async () => {
    if (inFlight.current) return;
    const result = validateQuickPurchase(name, qty);
    if (!result.payload) { setErr(result.error); return; }
    inFlight.current = true;
    setBusy(true);
    setErr(null);
    try {
      const token = await tokenStore.get();
      if (!token) throw new ApiError(401, 'Необходима авторизация');
      await api.createShoppingItem(result.payload, token);
    } catch (e) {
      setErr(e instanceof Error ? e.message : 'Не удалось добавить покупку');
      return;
    } finally {
      inFlight.current = false;
      setBusy(false);
    }
    setName('');
    setQty('1');
    onClose();
    // Refresh has a separate outcome: it must never become a failed creation.
    onCreated();
  };

  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={close}>
      <View style={styles.modalOverlay}>
        <View style={styles.sheet}>
          <Text style={styles.sheetTitle}>Добавить в список покупок</Text>

          <Text style={styles.fieldLabel}>Товар</Text>
          <TextInput
            style={styles.input}
            editable={!busy}
            value={name}
            onChangeText={setName}
            placeholder="Например: корм Royal Canin 4 кг"
            placeholderTextColor={colors.textTertiary}
            accessibilityLabel="Название товара"
          />

          <Text style={styles.fieldLabel}>Количество (шт)</Text>
          <TextInput
            style={styles.input}
            editable={!busy}
            value={qty}
            onChangeText={setQty}
            keyboardType="numeric"
            accessibilityLabel="Количество"
          />

          {err ? <Text style={styles.errText}>{err}</Text> : null}

          <View style={styles.modalActions}>
            <Pressable style={({ pressed }) => [styles.secondaryBtn, pressed && styles.pressed]} onPress={close} disabled={busy}>
              <Text style={styles.secondaryBtnText}>Отмена</Text>
            </Pressable>
            <Pressable
              style={({ pressed }) => [styles.primaryBtn, pressed && styles.pressed, busy && styles.pressed]}
              onPress={() => void submit()}
              accessibilityRole="button"
              accessibilityLabel="Добавить покупку"
              disabled={busy}
              accessibilityState={{ disabled: busy }}
            >
              {busy ? (
                <ActivityIndicator color={colors.onPrimary} />
              ) : (
                <Text style={styles.primaryBtnText}>Добавить</Text>
              )}
            </Pressable>
          </View>
        </View>
      </View>
    </Modal>
  );
}

/** Значение по умолчанию: завтра, 09:00 локального времени (формат datetime-local). */
function defaultDueLocal(): string {
  const d = new Date();
  d.setDate(d.getDate() + 1);
  d.setHours(9, 0, 0, 0);
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

/* ---------- styles (tokens only, no raw hex) ---------- */

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.pageBackground },
  scroll: { flex: 1 },
  scrollContent: {
    paddingHorizontal: layout.pagePaddingX,
    paddingTop: stack.base,
    paddingBottom: layout.contentBottomInset,
    gap: stack.xl,
  },

  greeting: { ...typography.h1, color: colors.textPrimary },
  greetingSub: { ...typography.body, color: colors.textSecondary, marginTop: spacing.x1 },

  section: { gap: stack.tight },
  sectionHead: { flexDirection: 'row', alignItems: 'center', gap: spacing.x2, paddingHorizontal: spacing.x1 },
  sectionTitle: { ...typography.h3, color: colors.textPrimary },
  sectionSpacer: { flex: 1 },
  sectionLink: { ...typography.button, fontSize: typography.caption.fontSize, color: colors.primaryStrong },
  badge: {
    minWidth: 22,
    height: 22,
    borderRadius: radius.full,
    backgroundColor: colors.danger,
    color: colors.textInverse,
    textAlign: 'center',
    lineHeight: 22,
    fontSize: fontSize.xs,
    fontWeight: '700',
    paddingHorizontal: spacing.x1,
  },

  card: {
    backgroundColor: colors.surface,
    borderRadius: radius.lg,
    borderWidth: 1,
    borderColor: colors.border,
    padding: spacing.x4,
    gap: spacing.x3,
    ...shadow.card,
  },

  attentionRow: { flexDirection: 'row', alignItems: 'flex-start', gap: spacing.x3 },
  kindDot: { width: 10, height: 10, borderRadius: radius.full, marginTop: 6 },
  attentionBody: { flex: 1 },
  attentionTitle: { ...typography.bodyStrong, color: colors.textPrimary },
  attentionMeta: { ...typography.caption, color: colors.textSecondary, marginTop: 2 },

  okText: { ...typography.body, color: colors.success },
  warnText: { ...typography.body, color: colors.warning },

  actionsGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.x2 },
  actionTile: {
    flexGrow: 1,
    flexBasis: '46%',
    minHeight: layout.minTouchTarget + 28,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.surfaceMuted,
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.x1,
    paddingVertical: spacing.x3,
  },
  actionEmoji: { fontSize: 22 },
  actionLabel: { ...typography.caption, color: colors.textPrimary, textAlign: 'center', fontWeight: '600' },

  petCard: { flexDirection: 'row', alignItems: 'center', gap: spacing.x3 },
  petPhoto: { width: 48, height: 48, borderRadius: radius.md },
  petPhotoPlaceholder: {
    width: 48,
    height: 48,
    borderRadius: radius.md,
    backgroundColor: colors.primarySubtle,
    alignItems: 'center',
    justifyContent: 'center',
  },
  petPhotoEmoji: { fontSize: 22 },
  petInfo: { flex: 1 },
  petName: { ...typography.bodyStrong, color: colors.textPrimary },
  petMeta: { ...typography.caption, color: colors.textSecondary, marginTop: 2 },
  chevron: { fontSize: 22, color: colors.textTertiary, fontWeight: '700' },

  eventRow: { flexDirection: 'row', alignItems: 'flex-start', gap: spacing.x3 },
  eventEmoji: { fontSize: 18, marginTop: 1 },
  eventBody: { flex: 1 },
  eventTitle: { ...typography.bodyStrong, color: colors.textPrimary },
  eventMeta: { ...typography.caption, color: colors.textSecondary, marginTop: 2 },

  stateBox: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.x3,
    padding: spacing.x8,
  },
  emptyEmoji: { fontSize: 44 },
  stateTitle: { ...typography.h2, color: colors.textPrimary, textAlign: 'center' },
  stateText: { ...typography.body, color: colors.textSecondary, textAlign: 'center' },

  primaryBtn: {
    minHeight: layout.minTouchTarget,
    paddingHorizontal: spacing.x5,
    borderRadius: radius.md,
    backgroundColor: colors.primary,
    alignItems: 'center',
    justifyContent: 'center',
  },
  primaryBtnText: { ...typography.button, color: colors.onPrimary },
  secondaryBtn: {
    minHeight: layout.minTouchTarget,
    paddingHorizontal: spacing.x5,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.borderStrong,
    backgroundColor: colors.surface,
    alignItems: 'center',
    justifyContent: 'center',
  },
  secondaryBtnText: { ...typography.button, color: colors.textPrimary },

  logoutBtn: { backgroundColor: colors.dangerSubtle },
  logoutText: { ...typography.button, fontSize: typography.caption.fontSize, color: colors.danger },

  modalOverlay: { flex: 1, backgroundColor: 'rgba(15, 23, 42, 0.5)', justifyContent: 'flex-end' },
  sheet: {
    backgroundColor: colors.surface,
    borderTopLeftRadius: radius.xl,
    borderTopRightRadius: radius.xl,
    padding: spacing.x5,
    gap: spacing.x3,
    paddingBottom: spacing.x10,
  },
  sheetTitle: { ...typography.h2, color: colors.textPrimary },
  sheetItem: {
    minHeight: layout.minTouchTarget,
    borderRadius: radius.md,
    backgroundColor: colors.surfaceMuted,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: spacing.x4,
  },
  sheetItemText: { ...typography.bodyStrong, color: colors.textPrimary },
  sheetCancel: {
    minHeight: layout.minTouchTarget,
    alignItems: 'center',
    justifyContent: 'center',
  },
  sheetCancelText: { ...typography.button, color: colors.textSecondary },

  fieldLabel: { ...typography.caption, color: colors.textSecondary, marginTop: spacing.x2 },
  input: {
    minHeight: layout.minTouchTarget,
    borderWidth: 1,
    borderColor: colors.borderStrong,
    borderRadius: radius.md,
    paddingHorizontal: spacing.x3,
    fontSize: fontSize.md,
    color: colors.textPrimary,
    backgroundColor: colors.surface,
  },
  chip: {
    alignSelf: 'flex-start',
    marginRight: spacing.x2,
    marginTop: spacing.x1,
    paddingHorizontal: spacing.x3,
    paddingVertical: spacing.x2,
    borderRadius: radius.full,
    borderWidth: 1,
    borderColor: colors.borderStrong,
    backgroundColor: colors.surface,
    minWidth: 44,
  },
  chipSelected: { backgroundColor: colors.primary, borderColor: colors.primary },
  chipText: { ...typography.caption, color: colors.textPrimary },
  chipTextSelected: { color: colors.onPrimary, fontWeight: '600' },

  errText: { ...typography.caption, color: colors.danger },
  modalActions: { flexDirection: 'row', gap: spacing.x2, marginTop: spacing.x3 },

  pressed: { opacity: 0.85 },
});
