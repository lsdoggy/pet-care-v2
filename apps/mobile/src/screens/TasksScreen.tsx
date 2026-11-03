import { useCallback, useEffect, useState } from 'react';
import { ActivityIndicator, FlatList, Pressable, StyleSheet, Text, View } from 'react-native';
import { api, ApiError } from '../api/client';
import type { CareTaskDto } from '../api/types';
import { formatDueAt, TASK_TYPE_LABELS } from '../api/types';
import { tokenStore } from '../auth/tokenStore';
import { ScreenHeader } from '../components/ScreenHeader';
import { colors } from '../theme/tokens';

/**
 * Sprint 3 — "Tasks" tab: upcoming pending care tasks ordered by due_at ASC.
 * Completion is done via a tap on the ✓ button (swipe would require an extra
 * native gesture library, which was excluded from this sprint's approved plan).
 */
export function TasksScreen() {
  const [tasks, setTasks] = useState<CareTaskDto[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busyId, setBusyId] = useState<number | null>(null);

  const load = useCallback(async () => {
    setError(null);
    try {
      const token = await tokenStore.get();
      if (!token) throw new ApiError(401, 'Not authenticated');
      setTasks(await api.listUpcomingTasks(token));
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to load tasks');
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  const handleComplete = useCallback(
    async (task: CareTaskDto) => {
      setBusyId(task.id);
      setError(null);
      try {
        const token = await tokenStore.get();
        if (!token) throw new ApiError(401, 'Not authenticated');
        // If the task has a recurrence rule the API creates and returns a NEW
        // pending task; otherwise it returns the completed task itself.
        const result = await api.completeTask(task.id, token);
        await load();
        // Give feedback when a recurring task was rescheduled.
        if (result.status === 'PENDING') {
          setError(null); // success — new occurrence already in the reloaded list
        }
      } catch (e) {
        setError(e instanceof Error ? e.message : 'Failed to complete task');
      } finally {
        setBusyId(null);
      }
    },
    [load],
  );

  const renderItem = ({ item }: { item: CareTaskDto }) => {
    const busy = busyId === item.id;
    return (
      <View style={styles.card}>
        <View style={styles.infoWrap}>
          <Text style={styles.title}>{item.title}</Text>
          <Text style={styles.meta}>
            {item.petName} · {TASK_TYPE_LABELS[item.type]}
          </Text>
          <Text style={styles.due}>{formatDueAt(item.dueAt)}</Text>
          {item.recurrenceRule ? (
            <Text style={styles.recurrence}>🔁 Repeats: {item.recurrenceRule}</Text>
          ) : null}
        </View>
        <Pressable
          style={({ pressed }) => [styles.completeBtn, pressed && styles.completeBtnPressed, busy && styles.completeBtnBusy]}
          onPress={() => handleComplete(item)}
          disabled={busy}
          accessibilityRole="button"
          accessibilityLabel={`Complete task ${item.title}`}
        >
          {busy ? <ActivityIndicator color="#fff" /> : <Text style={styles.completeBtnText}>✓</Text>}
        </Pressable>
      </View>
    );
  };

  return (
    <View style={styles.container}>
      <ScreenHeader
        title="Upcoming tasks"
        actions={
          <Pressable onPress={() => void load()} hitSlop={8} accessibilityRole="button" accessibilityLabel="Refresh tasks">
            <Text style={styles.refresh}>⟳</Text>
          </Pressable>
        }
      />

      {error ? <Text style={styles.error}>{error}</Text> : null}

      {tasks === null ? (
        <View style={styles.center}>
          <ActivityIndicator size="large" color="#4f46e5" />
        </View>
      ) : (
        <FlatList
          data={tasks}
          keyExtractor={(t) => String(t.id)}
          renderItem={renderItem}
          contentContainerStyle={tasks.length === 0 ? styles.emptyWrap : styles.list}
          ListEmptyComponent={
            <View style={styles.emptyWrap}>
              <Text style={styles.emptyEmoji}>🎉</Text>
              <Text style={styles.emptyText}>No upcoming tasks. Enjoy the free time!</Text>
            </View>
          }
        />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.pageBackground },
  // header/headerTitle moved to <ScreenHeader/> (design shell) — Step 5.
  refresh: { fontSize: 20, color: colors.primary, paddingHorizontal: 8 },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  list: { padding: 16, gap: 10 },
  error: { color: '#dc2626', paddingHorizontal: 16, paddingBottom: 8, fontSize: 13 },
  card: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#fff',
    borderRadius: 14,
    padding: 14,
    gap: 12,
    shadowColor: '#000',
    shadowOpacity: 0.05,
    shadowRadius: 6,
    shadowOffset: { width: 0, height: 2 },
    elevation: 2,
  },
  infoWrap: { flex: 1, gap: 3 },
  title: { fontSize: 16, fontWeight: '600', color: '#111827' },
  meta: { fontSize: 13, color: '#6b7280' },
  due: { fontSize: 13, color: '#4f46e5', fontWeight: '600' },
  recurrence: { fontSize: 12, color: '#94a3b8' },
  completeBtn: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: '#16a34a',
    alignItems: 'center',
    justifyContent: 'center',
  },
  completeBtnPressed: { opacity: 0.85 },
  completeBtnBusy: { backgroundColor: '#86efac' },
  completeBtnText: { color: '#fff', fontSize: 20, fontWeight: '700' },
  emptyWrap: { flexGrow: 1, alignItems: 'center', justifyContent: 'center', gap: 8 },
  emptyEmoji: { fontSize: 40 },
  emptyText: { color: '#6b7280', fontSize: 14 },
});
