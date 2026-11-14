import { useLanguage } from '../i18n/language';
import { useCallback, useEffect, useState } from 'react';
import { ActivityIndicator, Alert, FlatList, Linking, Pressable, RefreshControl, StyleSheet, View } from 'react-native';
import { Text } from '../components/Typography';
import { api, ApiError, resolveFileUrl } from '../api/client';
import type { HistoryEventDto, VetAppointmentDto, VetRecordDto } from '../api/types';
import { APPOINTMENT_STATUS_LABELS, ENGLISH_APPOINTMENT_STATUS_LABELS } from '../api/types';
import { tokenStore } from '../auth/tokenStore';
import { useNavigation } from '../navigation/AppStack';
import { DetailHeader } from '../components/ScreenHeader';
import { AddToGoogleCalendar } from '../components/AddToGoogleCalendar';

interface Props {
  petId: number;
  petName: string;
}

/** Sprint 4: merged health chronology (appointments + records), newest event first. */
export function PetHistoryScreen({ petId, petName }: Props) {
  const language = useLanguage();
  const navigation = useNavigation();
  const [events, setEvents] = useState<HistoryEventDto[] | null>(null);
  const [error, setError] = useState<{ ru: string; en: string } | null>(null);
  const [refreshing, setRefreshing] = useState(false);

  const load = useCallback(async () => {
    try {
      const token = await tokenStore.get();
      if (!token) throw new ApiError(401, 'Not authenticated');
      setEvents(await api.getPetHistory(petId, token));
      setError(null);
    } catch {
      setError({ ru: 'Не удалось загрузить историю.', en: 'Failed to load history' });
    }
  }, [petId]);

  useEffect(() => {
    void load();
  }, [load]);

  const onRefresh = async () => {
    setRefreshing(true);
    await load();
    setRefreshing(false);
  };

  const removeEvent = (event: HistoryEventDto) => {
    const isAppt = event.kind === 'APPOINTMENT';
    const id = isAppt ? event.appointment!.id : event.record!.id;
    Alert.alert(
      isAppt ? (language === 'ru' ? 'Удалить визит' : 'Delete appointment') : (language === 'ru' ? 'Удалить запись' : 'Delete record'),
      isAppt ? (language === 'ru' ? 'Удалить этот визит безвозвратно?' : 'Remove this appointment permanently?') : (language === 'ru' ? 'Удалить эту запись и её вложения?' : 'Remove this record and its attachments?'),
      [
        { text: (language === 'ru' ? 'Отмена' : 'Cancel'), style: 'cancel' },
        {
          text: (language === 'ru' ? 'Удалить' : 'Delete'),
          style: 'destructive',
          onPress: async () => {
            try {
              const token = await tokenStore.get();
              if (!token) throw new ApiError(401, 'Not authenticated');
              if (isAppt) await api.deleteAppointment(id, token);
              else await api.deleteRecord(id, token);
              await load();
            } catch {
              Alert.alert((language === 'ru' ? 'Не удалось удалить' : 'Delete failed'), language === 'ru' ? 'Попробуйте ещё раз.' : 'Try again.');
            }
          },
        },
      ],
    );
  };

  if (error && events === null) {
    return (
      <View style={styles.center}>
        <Text style={styles.errorText}>{error[language]}</Text>
        <Pressable style={styles.backBtn} onPress={navigation.pop}>
          <Text style={styles.backText}>{language === 'ru' ? 'Назад' : 'Go back'}</Text>
        </Pressable>
      </View>
    );
  }

  return (
    <View style={styles.flex}>
      {/* Shared navigation-shell header (Design Sprint 0, Step 5). */}
      <DetailHeader route={{ name: 'PetHistory', petId, petName }} />

      {error && <Text style={[styles.errorText, styles.banner]}>{error[language]}</Text>}

      {!events ? (
        <View style={styles.center}>
          <ActivityIndicator size="large" color="#4f46e5" />
        </View>
      ) : (
        <FlatList
          data={events}
          keyExtractor={(item) => `${item.kind}-${item.kind === 'APPOINTMENT' ? item.appointment?.id : item.record?.id}`}
          contentContainerStyle={styles.listContent}
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => void onRefresh()} />}
          ListEmptyComponent={
            <View style={styles.empty}>
              <Text style={styles.emptyEmoji}>🩺</Text>
              <Text style={styles.emptyText}>{language === 'ru' ? 'Визитов и записей пока нет.' : 'No visits or records yet.'}</Text>
            </View>
          }
          renderItem={({ item }) => (
            <TimelineItem
              event={item}
              linkedRecords={events.flatMap(({ record }) =>
                record?.appointmentId != null && record.appointmentId === item.appointment?.id ? [record] : []
              )}
              onAddRecord={(appointmentId) => navigation.push({ name: 'RecordForm', petId, petName, appointmentId })}
              onDelete={() => removeEvent(item)}
            />
          )}
        />
      )}

      <View style={styles.actions}>
        <Pressable
          style={({ pressed }) => [styles.primaryBtn, pressed && styles.pressed]}
          onPress={() => navigation.push({ name: 'AppointmentForm', petId })}
        >
          <Text style={styles.primaryText}>{language === 'ru' ? '＋ Новый визит' : '＋ New appointment'}</Text>
        </Pressable>
        <Pressable
          style={({ pressed }) => [styles.secondaryBtn, pressed && styles.pressed]}
          onPress={() => navigation.push({ name: 'RecordForm', petId })}
        >
          <Text style={styles.secondaryText}>{language === 'ru' ? '＋ Новая медицинская запись' : '＋ New medical record'}</Text>
        </Pressable>
        <Pressable style={styles.back} onPress={navigation.pop}>
          <Text style={styles.backLink}>{language === 'ru' ? '← Назад к' : '← Back to'} {petName}</Text>
        </Pressable>
      </View>
    </View>
  );
}

function TimelineItem({ event, linkedRecords, onAddRecord, onDelete }: {
  event: HistoryEventDto;
  linkedRecords: VetRecordDto[];
  onAddRecord: (appointmentId: number) => void;
  onDelete: () => void;
}) {
  const language = useLanguage();
  return (
    <View style={styles.row}>
      <View style={[styles.dot, event.kind === 'APPOINTMENT' ? styles.dotAppt : styles.dotRec]} />
      <View style={styles.card}>
        {event.kind === 'APPOINTMENT' && event.appointment ? (
          <>
            <AppointmentCard a={event.appointment} />
            {linkedRecords.map((record) => <RecordCard key={record.id} r={record} />)}
            {linkedRecords.length === 0 && (
              <Pressable onPress={() => onAddRecord(event.appointment!.id)} hitSlop={8}>
                <Text style={styles.backLink}>{language === 'ru' ? 'Добавить запись о визите' : 'Add a visit record'}</Text>
              </Pressable>
            )}
          </>
        ) : event.record ? (
          <RecordCard r={event.record} />
        ) : null}
        <Pressable onPress={onDelete} hitSlop={8}>
          <Text style={styles.deleteLink}>{language === 'ru' ? 'Удалить' : 'Delete'}</Text>
        </Pressable>
      </View>
    </View>
  );
}

function AppointmentCard({ a }: { a: VetAppointmentDto }) {
  const language = useLanguage();
  const statusColor =
    a.status === 'COMPLETED' ? '#16a34a' : a.status === 'CANCELLED' ? '#dc2626' : '#4f46e5';
  return (
    <>
      <View style={styles.cardHead}>
        <Text style={styles.kindTag}>{language === 'ru' ? '📅 Визит' : '📅 Appointment'}</Text>
        <Text style={[styles.statusTag, { color: statusColor }]}>
          {(language === 'ru' ? APPOINTMENT_STATUS_LABELS : ENGLISH_APPOINTMENT_STATUS_LABELS)[a.status]}
        </Text>
      </View>
      <Text style={styles.when}>{new Date(a.scheduledAt).toLocaleString(language)}</Text>
      <Text style={styles.line}>
        {a.clinicName}
        {a.doctorName ? ` · ${a.doctorName}` : ''} · {a.durationMinutes} {language === 'ru' ? 'мин' : 'min'}
      </Text>
      {a.address ? <Text style={styles.muted}>{a.address}</Text> : null}
      {a.status === 'SCHEDULED' && <AddToGoogleCalendar title={`${language === 'ru' ? 'Ветеринар' : 'Vet'}: ${a.clinicName} · ${a.petName}`} startsAt={a.scheduledAt} durationMinutes={a.durationMinutes} location={a.address} />}
      {a.cost != null ? (
        <Text style={styles.muted}>
          {a.cost.toFixed(2)} {a.currency ?? ''}
        </Text>
      ) : null}
      {a.reason ? <Text style={styles.line}>{language === 'ru' ? 'Причина визита:' : 'Reason for visit:'} {a.reason}</Text> : null}
      {a.notes ? <Text style={styles.notes}>{a.notes}</Text> : null}
    </>
  );
}

function RecordCard({ r }: { r: VetRecordDto }) {
  const language = useLanguage();
  return (
    <>
      <View style={styles.cardHead}>
        <Text style={styles.kindTag}>{language === 'ru' ? '📋 Медицинская запись' : '📋 Medical record'}</Text>
        {r.appointmentId != null ? <Text style={styles.linkedTag}>{language === 'ru' ? 'Связанный визит №' : 'linked visit #'}{r.appointmentId}</Text> : null}
      </View>
      <Text style={styles.when}>{r.visitDate}</Text>
      {r.diagnosisText ? <Text style={styles.line}>{language === 'ru' ? 'Диагноз:' : 'Diagnosis:'} {r.diagnosisText}</Text> : null}
      {r.recommendationsText ? <Text style={styles.muted}>{language === 'ru' ? 'Рекомендации:' : 'Rec.:'} {r.recommendationsText}</Text> : null}
      {r.prescriptionsText ? <Text style={styles.muted}>{language === 'ru' ? 'Назначения:' : 'Rx:'} {r.prescriptionsText}</Text> : null}
      {r.attachments.length > 0 ? (
        <View style={styles.attachWrap}>
          {r.attachments.map((att) => {
            const url = resolveFileUrl(att.url);
            return (
              <Pressable
                key={att.url}
                onPress={() => url && void Linking.openURL(url)}
                style={styles.attachChip}
              >
                <Text style={styles.attachText}>
                  📎 {att.name} ({Math.round(att.size / 1024)} {language === 'ru' ? 'КБ' : 'KB'})
                </Text>
              </Pressable>
            );
          })}
        </View>
      ) : null}
    </>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1, backgroundColor: '#f6f7fb' },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: 12, padding: 24 },
  header: { paddingHorizontal: 20, paddingTop: 16, paddingBottom: 8, gap: 2 },
  title: { fontSize: 24, fontWeight: '700' },
  subtitle: { color: '#6b7280', fontSize: 15 },
  errorText: { color: '#dc2626', textAlign: 'center' },
  banner: { paddingHorizontal: 20, paddingBottom: 8 },
  listContent: { padding: 20, paddingTop: 8, gap: 12 },
  row: { flexDirection: 'row', gap: 10 },
  dot: { width: 12, height: 12, borderRadius: 6, marginTop: 18 },
  dotAppt: { backgroundColor: '#4f46e5' },
  dotRec: { backgroundColor: '#0ea5e9' },
  card: {
    flex: 1,
    backgroundColor: '#fff',
    borderRadius: 14,
    padding: 14,
    gap: 6,
    borderWidth: 1,
    borderColor: '#e5e7eb',
  },
  cardHead: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  kindTag: { fontSize: 13, fontWeight: '700', color: '#374151' },
  statusTag: { fontSize: 13, fontWeight: '700' },
  linkedTag: { fontSize: 12, color: '#94a3b8' },
  when: { fontSize: 14, fontWeight: '600', color: '#111827' },
  line: { fontSize: 14, color: '#374151' },
  muted: { fontSize: 13, color: '#6b7280' },
  notes: { fontSize: 13, color: '#4b5563', fontStyle: 'italic' },
  attachWrap: { flexDirection: 'row', flexWrap: 'wrap', gap: 6, marginTop: 4 },
  attachChip: { backgroundColor: '#eef2ff', borderRadius: 8, paddingHorizontal: 10, paddingVertical: 6 },
  attachText: { fontSize: 12, color: '#4f46e5', fontWeight: '600' },
  deleteLink: { color: '#dc2626', fontSize: 13, fontWeight: '600', marginTop: 4 },
  empty: { alignItems: 'center', paddingVertical: 48, gap: 8 },
  emptyEmoji: { fontSize: 40 },
  emptyText: { color: '#6b7280' },
  actions: { paddingHorizontal: 20, paddingBottom: 16, gap: 8 },
  primaryBtn: { backgroundColor: '#4f46e5', borderRadius: 12, paddingVertical: 14, alignItems: 'center' },
  primaryText: { color: '#fff', fontSize: 16, fontWeight: '600' },
  secondaryBtn: { backgroundColor: '#e0e7ff', borderRadius: 12, paddingVertical: 14, alignItems: 'center' },
  secondaryText: { color: '#4f46e5', fontSize: 16, fontWeight: '600' },
  back: { alignItems: 'center', paddingVertical: 8 },
  backLink: { color: '#4f46e5', fontSize: 15, fontWeight: '500' },
  backBtn: { backgroundColor: '#4f46e5', borderRadius: 10, paddingHorizontal: 24, paddingVertical: 10 },
  backText: { color: '#fff', fontWeight: '600' },
  pressed: { opacity: 0.85 },
});
