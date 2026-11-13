import { useState } from 'react';
import { ActivityIndicator, Alert, KeyboardAvoidingView, Platform, Pressable, ScrollView, StyleSheet, View } from 'react-native';
import { Text, TextInput } from '../components/Typography';
import * as DocumentPicker from 'expo-document-picker';
import * as ImagePicker from 'expo-image-picker';
import { api, ApiError } from '../api/client';
import type { CreateRecordRequest } from '../api/types';
import { tokenStore } from '../auth/tokenStore';
import { useNavigation } from '../navigation/AppStack';
import { DateField } from '../components/DateField';
import { localDateValue } from '../components/DateField.types';

interface Props {
  petId: number;
  petName?: string;
  appointmentId?: number;
}

/** Sprint 4: create a medical record, optionally attaching a photo (camera/gallery) or PDF-like document. */
export function RecordFormScreen({ petId, petName, appointmentId }: Props) {
  const navigation = useNavigation();
  const [visitDate, setVisitDate] = useState(() => localDateValue(new Date()));
  const [diagnosis, setDiagnosis] = useState('');
  const [recommendations, setRecommendations] = useState('');
  const [prescriptions, setPrescriptions] = useState('');
  const [savedRecordId, setSavedRecordId] = useState<number>();
  const [saving, setSaving] = useState(false);

  // Picked attachment kept locally; uploaded AFTER the record is created (record id required).
  const [picked, setPicked] = useState<{ uri: string; name: string; mimeType: string; file?: File } | null>(null);
  const pickPhoto = async (source: 'camera' | 'gallery') => {
    if (source === 'camera' && !(await ImagePicker.requestCameraPermissionsAsync()).granted) {
      Alert.alert('Нет доступа к камере', 'Разрешите доступ к камере в настройках устройства.');
      return;
    }
    const options: ImagePicker.ImagePickerOptions = {
      mediaTypes: ['images'],
      quality: 0.8,
      allowsEditing: false,
    };
    const result =
      source === 'camera' ? await ImagePicker.launchCameraAsync(options) : await ImagePicker.launchImageLibraryAsync(options);
    if (result.canceled || result.assets.length === 0) return;
    const asset = result.assets[0];
    const ext = (asset.fileName?.split('.').pop() ?? 'jpg').toLowerCase();
    setPicked({
      uri: asset.uri,
      name: asset.fileName ?? `photo-${Date.now()}.${ext}`,
      mimeType: asset.mimeType ?? 'image/jpeg',
    });
  };

  const pickDocument = async () => {
    const result = await DocumentPicker.getDocumentAsync({
      type: Platform.OS === 'web' ? ['application/pdf', 'image/jpeg', 'image/png', 'image/webp'] : 'application/pdf',
    });
    if (result.canceled) return;
    const asset = result.assets[0];
    if (asset.size != null && (asset.size === 0 || asset.size > 10 * 1024 * 1024)) {
      Alert.alert('Проверьте файл', 'Можно прикрепить непустой файл размером до 10 МБ.');
      return;
    }
    setPicked({ uri: asset.uri, name: asset.name, mimeType: asset.mimeType ?? 'application/octet-stream', file: asset.file });
  };

  const openPicker = (pick: () => Promise<void>) => {
    void pick().catch(() => Alert.alert('Не удалось открыть выбор файла', 'Попробуйте ещё раз.'));
  };

  const askAttachmentSource = () => {
    if (Platform.OS === 'web') {
      openPicker(pickDocument);
      return;
    }
    Alert.alert('Прикрепить файл', 'Выберите источник', [
      { text: 'Камера', onPress: () => openPicker(() => pickPhoto('camera')) },
      { text: 'Галерея', onPress: () => openPicker(() => pickPhoto('gallery')) },
      { text: 'PDF', onPress: () => openPicker(pickDocument) },
    ]);
  };

  const onSubmit = async () => {
    if (!/^\d{4}-\d{2}-\d{2}$/.test(visitDate) || visitDate > localDateValue(new Date())) {
      Alert.alert('Проверьте дату', 'Выберите дату не позднее сегодняшнего дня');
      return;
    }
    setSaving(true);
    try {
      const token = await tokenStore.get();
      if (!token) throw new ApiError(401, 'Not authenticated');

      const body: CreateRecordRequest = {
        petId,
        appointmentId,
        visitDate: visitDate.trim(),
        diagnosisText: diagnosis.trim() || null,
        recommendationsText: recommendations.trim() || null,
        prescriptionsText: prescriptions.trim() || null,
      };

      const recordId = savedRecordId ?? (await api.createRecord(body, token)).id;
      setSavedRecordId(recordId);

      if (picked) {
        await api.uploadRecordAttachment(recordId, picked.uri, picked.name, picked.mimeType, token, picked.file);
      }
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
        <Text style={styles.title}>New medical record</Text>
        {petName ? <Text style={styles.subtitle}>For {petName}</Text> : null}

        <DateField label="Дата медицинской записи *" value={visitDate} onChange={setVisitDate} maximum={localDateValue(new Date())} disabled={saving || savedRecordId != null} />

        <Text style={styles.label}>Diagnosis</Text>
        <TextInput style={[styles.input, styles.multiline]} value={diagnosis} onChangeText={setDiagnosis} editable={!saving && savedRecordId == null} multiline placeholder="Otitis media, mild" />

        <Text style={styles.label}>Recommendations</Text>
        <TextInput style={[styles.input, styles.multiline]} value={recommendations} onChangeText={setRecommendations} editable={!saving && savedRecordId == null} multiline placeholder="Keep ear dry, recheck in 7 days" />

        <Text style={styles.label}>Prescriptions</Text>
        <TextInput style={[styles.input, styles.multiline]} value={prescriptions} onChangeText={setPrescriptions} editable={!saving && savedRecordId == null} multiline placeholder="Amoxicillin 250mg, 2x/day, 7 days" />

        <Text style={styles.label}>Attachments</Text>
        {picked ? (
          <View style={styles.pickedRow}>
            <Text style={styles.pickedName} numberOfLines={1}>📎 {picked.name}</Text>
            <Pressable disabled={saving} onPress={() => setPicked(null)} hitSlop={8}>
              <Text style={styles.removeText}>Remove</Text>
            </Pressable>
          </View>
        ) : (
          <Pressable style={({ pressed }) => [styles.attachBtn, pressed && styles.pressed]} disabled={saving} onPress={askAttachmentSource}>
            <Text style={styles.attachText}>Прикрепить фото или PDF</Text>
          </Pressable>
        )}

        <Pressable
          style={({ pressed }) => [styles.submitBtn, pressed && styles.pressed, saving && styles.disabled]}
          onPress={() => {
            if (saving) return;
            void onSubmit();
          }}
          disabled={saving}
        >
          {saving ? <ActivityIndicator color="#fff" /> : <Text style={styles.submitText}>Save record</Text>}
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
  multiline: { minHeight: 70, textAlignVertical: 'top' },
  attachBtn: {
    backgroundColor: '#eef2ff',
    borderRadius: 10,
    borderWidth: 1,
    borderColor: '#c7d2fe',
    paddingVertical: 12,
    alignItems: 'center',
  },
  attachText: { color: '#4f46e5', fontWeight: '600', fontSize: 14 },
  pickedRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: '#fff',
    borderRadius: 10,
    borderWidth: 1,
    borderColor: '#e5e7eb',
    paddingHorizontal: 12,
    paddingVertical: 10,
  },
  pickedName: { flex: 1, color: '#374151', fontSize: 14 },
  removeText: { color: '#dc2626', fontWeight: '600', fontSize: 13, marginLeft: 10 },
  submitBtn: { backgroundColor: '#4f46e5', borderRadius: 12, paddingVertical: 14, alignItems: 'center', marginTop: 20 },
  submitText: { color: '#fff', fontSize: 16, fontWeight: '600' },
  cancel: { alignItems: 'center', paddingVertical: 12 },
  cancelText: { color: '#4f46e5', fontSize: 15, fontWeight: '500' },
  pressed: { opacity: 0.85 },
  disabled: { opacity: 0.6 },
});
