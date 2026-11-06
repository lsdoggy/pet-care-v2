import { useState } from 'react';
import {
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { api, ApiError } from '../api/client';
import type { AppointmentStatus, CreateAppointmentRequest, VetAppointmentDto } from '../api/types';
import { APPOINTMENT_STATUS_LABELS } from '../api/types';
import { tokenStore } from '../auth/tokenStore';
import { useNavigation } from '../navigation/AppStack';
import { DateField } from '../components/DateField';

interface Props {
  petId: number;
  petName?: string;
  appointment?: VetAppointmentDto;
}

const STATUSES: AppointmentStatus[] = ['SCHEDULED', 'COMPLETED', 'CANCELLED'];

/** Sprint 4: create a veterinary appointment for the given pet. */
export function AppointmentFormScreen({ petId, petName, appointment }: Props) {
  const navigation = useNavigation();
  const initialDate = appointment ? new Date(appointment.scheduledAt) : null;
  const [clinicName, setClinicName] = useState(appointment?.clinicName ?? '');
  const [doctorName, setDoctorName] = useState(appointment?.doctorName ?? '');
  const [dateStr, setDateStr] = useState(initialDate ? `${initialDate.getFullYear()}-${String(initialDate.getMonth() + 1).padStart(2, '0')}-${String(initialDate.getDate()).padStart(2, '0')}` : '');
  const [timeStr, setTimeStr] = useState(initialDate ? `${String(initialDate.getHours()).padStart(2, '0')}:${String(initialDate.getMinutes()).padStart(2, '0')}` : '09:00');
  const [durationStr, setDurationStr] = useState(String(appointment?.durationMinutes ?? 30));
  const [status, setStatus] = useState<AppointmentStatus>(appointment?.status ?? 'SCHEDULED');
  const [address, setAddress] = useState(appointment?.address ?? '');
  const [costStr, setCostStr] = useState(appointment?.cost != null ? String(appointment.cost) : '');
  const [currency, setCurrency] = useState(appointment?.currency ?? 'RUB');
  const [notes, setNotes] = useState(appointment?.notes ?? '');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const validate = (): string | null => {
    if (!clinicName.trim()) return 'Укажите название клиники';
    if (!/^\d{4}-\d{2}-\d{2}$/.test(dateStr.trim())) return 'Укажите дату в формате ГГГГ-ММ-ДД';
    if (!/^([01]\d|2[0-3]):[0-5]\d$/.test(timeStr.trim())) return 'Укажите время в формате ЧЧ:ММ';
    const d = new Date(`${dateStr.trim()}T${timeStr.trim()}:00`);
    if (Number.isNaN(d.getTime()) || d.getFullYear() !== Number(dateStr.slice(0, 4)) || d.getMonth() + 1 !== Number(dateStr.slice(5, 7)) || d.getDate() !== Number(dateStr.slice(8, 10))) return 'Проверьте дату и время';
    const dur = Number(durationStr);
    if (!Number.isInteger(dur) || dur < 5 || dur > 480) return 'Длительность должна быть от 5 до 480 минут';
    if (costStr.trim()) {
      const c = Number(costStr);
      if (!Number.isFinite(c) || c < 0) return 'Укажите неотрицательную стоимость';
      if (!/^[A-Za-z]{3}$/.test(currency.trim())) return 'Укажите код валюты из трёх букв';
    }
    return null;
  };

  const onSubmit = async () => {
    const problem = validate();
    if (problem) {
      setError(problem);
      return;
    }
    setSaving(true);
    setError(null);
    try {
      const token = await tokenStore.get();
      if (!token) throw new ApiError(401, 'Not authenticated');

      const body: CreateAppointmentRequest = {
        petId,
        clinicName: clinicName.trim(),
        doctorName: doctorName.trim() || null,
        scheduledAt: new Date(`${dateStr.trim()}T${timeStr.trim()}:00`).toISOString(),
        durationMinutes: Number(durationStr),
        status,
        address: address.trim() || null,
        cost: costStr.trim() ? Number(costStr) : null,
        currency: costStr.trim() ? currency.trim().toUpperCase() : null,
        notes: notes.trim() || null,
      };

      if (appointment) await api.updateAppointment(appointment.id, body, token);
      else await api.createAppointment(body, token);
      navigation.pop();
    } catch (e) {
      setError('Не удалось сохранить визит. Проверьте соединение и попробуйте ещё раз.');
    } finally {
      setSaving(false);
    }
  };

  return (
    <KeyboardAvoidingView style={styles.flex} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
      <ScrollView contentContainerStyle={styles.container} keyboardShouldPersistTaps="handled">
        <Text style={styles.title}>{appointment ? 'Перенести визит' : 'Новый визит'}</Text>
        {petName ? <Text style={styles.subtitle}>Питомец: {petName}</Text> : null}
        {error && <Text accessibilityRole="alert">{error}</Text>}

        <Text style={styles.label}>Клиника *</Text>
        <TextInput style={styles.input} value={clinicName} onChangeText={setClinicName} placeholder="CityVet Clinic" maxLength={150} />

        <Text style={styles.label}>Врач</Text>
        <TextInput style={styles.input} value={doctorName} onChangeText={setDoctorName} placeholder="Dr. Smith" maxLength={150} />

        <View style={styles.rowInputs}>
          <View style={styles.flexCol}>
            <DateField label="Дата визита *" value={dateStr} onChange={setDateStr} disabled={saving} />
          </View>
          <View style={styles.flexCol}>
            <DateField label="Местное время *" mode="time" value={timeStr} onChange={setTimeStr} disabled={saving} />
          </View>
        </View>

        <View style={styles.rowInputs}>
          <View style={styles.flexCol}>
            <Text style={styles.label}>Длительность, мин</Text>
            <TextInput style={styles.input} value={durationStr} onChangeText={setDurationStr} keyboardType="number-pad" />
          </View>
          <View style={styles.flexCol}>
            <Text style={styles.label}>Стоимость</Text>
            <TextInput style={styles.input} value={costStr} onChangeText={setCostStr} keyboardType="decimal-pad" placeholder="45.50" />
          </View>
          <View style={styles.flexColNarrow}>
            <Text style={styles.label}>Валюта</Text>
            <TextInput style={styles.input} value={currency} onChangeText={setCurrency} autoCapitalize="characters" maxLength={3} />
          </View>
        </View>

        <Text style={styles.label}>Статус</Text>
        <View style={styles.statusRow}>
          {STATUSES.map((s) => (
            <Pressable
              key={s}
              onPress={() => setStatus(s)}
              style={[styles.statusChip, status === s && styles.statusChipActive]}
            >
              <Text style={[styles.statusText, status === s && styles.statusTextActive]}>
                {APPOINTMENT_STATUS_LABELS[s]}
              </Text>
            </Pressable>
          ))}
        </View>

        <Text style={styles.label}>Адрес</Text>
        <TextInput style={styles.input} value={address} onChangeText={setAddress} placeholder="Main st 1" maxLength={255} />

        <Text style={styles.label}>Заметки</Text>
        <TextInput
          style={[styles.input, styles.multiline]}
          value={notes}
          onChangeText={setNotes}
          multiline
          placeholder="Vaccination, check-up…"
        />

        <Pressable
          style={({ pressed }) => [styles.submitBtn, pressed && styles.pressed, saving && styles.disabled]}
          onPress={() => {
            if (saving) return;
            void onSubmit();
          }}
          disabled={saving}
        >
          {saving ? <ActivityIndicator color="#fff" /> : <Text style={styles.submitText}>Сохранить визит</Text>}
        </Pressable>

        <Pressable style={styles.cancel} onPress={navigation.pop}>
          <Text style={styles.cancelText}>Отмена</Text>
        </Pressable>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1, backgroundColor: '#f6f7fb' },
  container: { padding: 20, gap: 8 },
  title: { fontSize: 24, fontWeight: '700', marginBottom: 2 },
  subtitle: { color: '#6b7280', fontSize: 15, marginBottom: 8 },
  label: { color: '#374151', fontSize: 13, fontWeight: '600', marginTop: 8 },
  input: {
    backgroundColor: '#fff',
    borderRadius: 10,
    borderWidth: 1,
    borderColor: '#e5e7eb',
    paddingHorizontal: 12,
    paddingVertical: 10,
    fontSize: 15,
  },
  multiline: { minHeight: 80, textAlignVertical: 'top' },
  rowInputs: { flexDirection: 'row', gap: 10 },
  flexCol: { flex: 1 },
  flexColNarrow: { width: 70 },
  statusRow: { flexDirection: 'row', gap: 8 },
  statusChip: { backgroundColor: '#fff', borderRadius: 10, borderWidth: 1, borderColor: '#e5e7eb', paddingHorizontal: 14, paddingVertical: 8 },
  statusChipActive: { backgroundColor: '#4f46e5', borderColor: '#4f46e5' },
  statusText: { color: '#4b5563', fontWeight: '600' },
  statusTextActive: { color: '#fff' },
  submitBtn: { backgroundColor: '#4f46e5', borderRadius: 12, paddingVertical: 14, alignItems: 'center', marginTop: 20 },
  submitText: { color: '#fff', fontSize: 16, fontWeight: '600' },
  cancel: { alignItems: 'center', paddingVertical: 12 },
  cancelText: { color: '#4f46e5', fontSize: 15, fontWeight: '500' },
  pressed: { opacity: 0.85 },
  disabled: { opacity: 0.6 },
});
