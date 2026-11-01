import { useState } from 'react';
import {
  ActivityIndicator,
  Alert,
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
import type { AppointmentStatus, CreateAppointmentRequest } from '../api/types';
import { APPOINTMENT_STATUS_LABELS } from '../api/types';
import { tokenStore } from '../auth/tokenStore';
import { useNavigation } from '../navigation/AppStack';

interface Props {
  petId: number;
  petName?: string;
}

const STATUSES: AppointmentStatus[] = ['SCHEDULED', 'COMPLETED', 'CANCELLED'];

/** Sprint 4: create a veterinary appointment for the given pet. */
export function AppointmentFormScreen({ petId, petName }: Props) {
  const navigation = useNavigation();
  const [clinicName, setClinicName] = useState('');
  const [doctorName, setDoctorName] = useState('');
  const [dateStr, setDateStr] = useState(''); // YYYY-MM-DD
  const [timeStr, setTimeStr] = useState('09:00'); // HH:mm
  const [durationStr, setDurationStr] = useState('30');
  const [status, setStatus] = useState<AppointmentStatus>('SCHEDULED');
  const [address, setAddress] = useState('');
  const [costStr, setCostStr] = useState('');
  const [currency, setCurrency] = useState('USD');
  const [notes, setNotes] = useState('');
  const [saving, setSaving] = useState(false);

  const validate = (): string | null => {
    if (!clinicName.trim()) return 'Clinic name is required';
    if (!/^\d{4}-\d{2}-\d{2}$/.test(dateStr.trim())) return 'Date must be YYYY-MM-DD';
    if (!/^([01]\d|2[0-3]):[0-5]\d$/.test(timeStr.trim())) return 'Time must be HH:mm (24h)';
    const d = new Date(`${dateStr.trim()}T${timeStr.trim()}:00Z`);
    if (Number.isNaN(d.getTime())) return 'Invalid date/time';
    const dur = Number(durationStr);
    if (!Number.isInteger(dur) || dur < 5 || dur > 480) return 'Duration must be 5–480 minutes';
    if (costStr.trim()) {
      const c = Number(costStr);
      if (Number.isNaN(c) || c < 0) return 'Cost must be a non-negative number';
      if (!/^[A-Za-z]{3}$/.test(currency.trim())) return 'Currency must be a 3-letter ISO code';
    }
    return null;
  };

  const onSubmit = async () => {
    const problem = validate();
    if (problem) {
      Alert.alert('Check the form', problem);
      return;
    }
    try {
      const token = await tokenStore.get();
      if (!token) throw new ApiError(401, 'Not authenticated');

      const body: CreateAppointmentRequest = {
        petId,
        clinicName: clinicName.trim(),
        doctorName: doctorName.trim() || null,
        scheduledAt: new Date(`${dateStr.trim()}T${timeStr.trim()}:00Z`).toISOString(),
        durationMinutes: Number(durationStr),
        status,
        address: address.trim() || null,
        cost: costStr.trim() ? Number(costStr) : null,
        currency: costStr.trim() ? currency.trim().toUpperCase() : null,
        notes: notes.trim() || null,
      };

      await api.createAppointment(body, token);
      navigation.pop();
    } catch (e) {
      Alert.alert('Save failed', e instanceof Error ? e.message : 'Unknown error');
    } finally {
      setSaving(false);
    }
  };

  return (
    <KeyboardAvoidingView style={styles.flex} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
      <ScrollView contentContainerStyle={styles.container} keyboardShouldPersistTaps="handled">
        <Text style={styles.title}>New appointment</Text>
        {petName ? <Text style={styles.subtitle}>For {petName}</Text> : null}

        <Text style={styles.label}>Clinic name *</Text>
        <TextInput style={styles.input} value={clinicName} onChangeText={setClinicName} placeholder="CityVet Clinic" maxLength={150} />

        <Text style={styles.label}>Doctor</Text>
        <TextInput style={styles.input} value={doctorName} onChangeText={setDoctorName} placeholder="Dr. Smith" maxLength={150} />

        <View style={styles.rowInputs}>
          <View style={styles.flexCol}>
            <Text style={styles.label}>Date * (YYYY-MM-DD)</Text>
            <TextInput style={styles.input} value={dateStr} onChangeText={setDateStr} placeholder="2026-11-10" autoCapitalize="none" />
          </View>
          <View style={styles.flexCol}>
            <Text style={styles.label}>Time * (UTC, HH:mm)</Text>
            <TextInput style={styles.input} value={timeStr} onChangeText={setTimeStr} placeholder="09:30" autoCapitalize="none" />
          </View>
        </View>

        <View style={styles.rowInputs}>
          <View style={styles.flexCol}>
            <Text style={styles.label}>Duration, min</Text>
            <TextInput style={styles.input} value={durationStr} onChangeText={setDurationStr} keyboardType="number-pad" />
          </View>
          <View style={styles.flexCol}>
            <Text style={styles.label}>Cost</Text>
            <TextInput style={styles.input} value={costStr} onChangeText={setCostStr} keyboardType="decimal-pad" placeholder="45.50" />
          </View>
          <View style={styles.flexColNarrow}>
            <Text style={styles.label}>Curr.</Text>
            <TextInput style={styles.input} value={currency} onChangeText={setCurrency} autoCapitalize="characters" maxLength={3} />
          </View>
        </View>

        <Text style={styles.label}>Status</Text>
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

        <Text style={styles.label}>Address</Text>
        <TextInput style={styles.input} value={address} onChangeText={setAddress} placeholder="Main st 1" maxLength={255} />

        <Text style={styles.label}>Notes</Text>
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
            setSaving(true);
            void onSubmit();
          }}
          disabled={saving}
        >
          {saving ? <ActivityIndicator color="#fff" /> : <Text style={styles.submitText}>Save appointment</Text>}
        </Pressable>

        <Pressable style={styles.cancel} onPress={navigation.pop}>
          <Text style={styles.cancelText}>Cancel</Text>
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
