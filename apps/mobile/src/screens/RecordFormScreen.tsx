import { useLanguage } from '../i18n/language';
import { useRef, useState } from 'react';
import { ActivityIndicator, Alert, KeyboardAvoidingView, Platform, Pressable, ScrollView, StyleSheet, View } from 'react-native';
import { Text, TextInput } from '../components/Typography';
import * as DocumentPicker from 'expo-document-picker';
import * as ImagePicker from 'expo-image-picker';
import { api, ApiError, newIdempotencyKey } from '../api/client';
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
  const language = useLanguage();
  const navigation = useNavigation();
  const [visitDate, setVisitDate] = useState(() => localDateValue(new Date()));
  const [diagnosis, setDiagnosis] = useState('');
  const [recommendations, setRecommendations] = useState('');
  const [prescriptions, setPrescriptions] = useState('');
  const [savedRecordId, setSavedRecordId] = useState<number>();
  const [saving, setSaving] = useState(false);
  const createKeys = useRef(new Map<string, string>());
  const submitting = useRef(false);

  // Picked attachment kept locally; uploaded AFTER the record is created (record id required).
  const [picked, setPicked] = useState<{ uri: string; name: string; mimeType: string; key: string; file?: File } | null>(null);
  const pickPhoto = async (source: 'camera' | 'gallery') => {
    if (source === 'camera' && !(await ImagePicker.requestCameraPermissionsAsync()).granted) {
      Alert.alert((language === 'ru' ? 'Нет доступа к камере' : 'Camera access denied'), (language === 'ru' ? 'Разрешите доступ к камере в настройках устройства.' : 'Allow camera access in device settings.'));
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
      key: newIdempotencyKey(),
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
      Alert.alert((language === 'ru' ? 'Проверьте файл' : 'Check the file'), (language === 'ru' ? 'Можно прикрепить непустой файл размером до 10 МБ.' : 'Choose a non-empty file up to 10 MB.'));
      return;
    }
    setPicked({ key: newIdempotencyKey(), uri: asset.uri, name: asset.name, mimeType: asset.mimeType ?? 'application/octet-stream', file: asset.file });
  };

  const openPicker = (pick: () => Promise<void>) => {
    void pick().catch(() => Alert.alert((language === 'ru' ? 'Не удалось открыть выбор файла' : 'Could not open the file picker'), (language === 'ru' ? 'Попробуйте ещё раз.' : 'Try again.')));
  };

  const askAttachmentSource = () => {
    if (Platform.OS === 'web') {
      openPicker(pickDocument);
      return;
    }
    Alert.alert((language === 'ru' ? 'Прикрепить файл' : 'Attach a file'), (language === 'ru' ? 'Выберите источник' : 'Choose a source'), [
      { text: (language === 'ru' ? 'Камера' : 'Camera'), onPress: () => openPicker(() => pickPhoto('camera')) },
      { text: (language === 'ru' ? 'Галерея' : 'Gallery'), onPress: () => openPicker(() => pickPhoto('gallery')) },
      { text: 'PDF', onPress: () => openPicker(pickDocument) },
    ]);
  };

  const onSubmit = async () => {
    if (submitting.current) return;
    if (!/^\d{4}-\d{2}-\d{2}$/.test(visitDate) || visitDate > localDateValue(new Date())) {
      Alert.alert((language === 'ru' ? 'Проверьте дату' : 'Check the date'), (language === 'ru' ? 'Выберите дату не позднее сегодняшнего дня' : 'Choose a date on or before today.'));
      return;
    }
    submitting.current = true;
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

      const payload = JSON.stringify(body);
      const key = createKeys.current.get(payload) ?? newIdempotencyKey();
      createKeys.current.set(payload, key);
      const recordId = savedRecordId ?? (await api.createRecord(body, token, key)).id;
      setSavedRecordId(recordId);

      if (picked) {
        await api.uploadRecordAttachment(recordId, picked.uri, picked.name, picked.mimeType, token, picked.file, picked.key);
      }
      navigation.pop();
    } catch {
      Alert.alert((language === 'ru' ? 'Не удалось сохранить запись' : 'Save failed'), language === 'ru' ? 'Попробуйте сохранить запись ещё раз.' : 'Try saving the record again.');
    } finally {
      submitting.current = false;
      setSaving(false);
    }
  };

  return (
    <KeyboardAvoidingView style={styles.flex} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
      <ScrollView contentContainerStyle={styles.container} keyboardShouldPersistTaps="handled">
        <Text style={styles.title}>{language === 'ru' ? 'Новая медицинская запись' : 'New medical record'}</Text>
        {petName ? <Text style={styles.subtitle}>{language === 'ru' ? 'Питомец:' : 'Pet:'} {petName}</Text> : null}

        <DateField label={language === 'ru' ? 'Дата медицинской записи *' : 'Record date *'} value={visitDate} onChange={setVisitDate} maximum={localDateValue(new Date())} disabled={saving || savedRecordId != null} />

        <Text style={styles.label}>{language === 'ru' ? 'Диагноз' : 'Diagnosis'}</Text>
        <TextInput style={[styles.input, styles.multiline]} value={diagnosis} onChangeText={setDiagnosis} editable={!saving && savedRecordId == null} multiline placeholder={language === 'ru' ? 'Лёгкий отит' : 'Otitis media, mild'} />

        <Text style={styles.label}>{language === 'ru' ? 'Рекомендации' : 'Recommendations'}</Text>
        <TextInput style={[styles.input, styles.multiline]} value={recommendations} onChangeText={setRecommendations} editable={!saving && savedRecordId == null} multiline placeholder={language === 'ru' ? 'Беречь ухо от воды, повторный осмотр через 7 дней' : 'Keep ear dry, recheck in 7 days'} />

        <Text style={styles.label}>{language === 'ru' ? 'Назначения' : 'Prescriptions'}</Text>
        <TextInput style={[styles.input, styles.multiline]} value={prescriptions} onChangeText={setPrescriptions} editable={!saving && savedRecordId == null} multiline placeholder={language === 'ru' ? 'Назначения врача' : 'Amoxicillin 250mg, 2x/day, 7 days'} />

        <Text style={styles.label}>{language === 'ru' ? 'Вложения' : 'Attachments'}</Text>
        {picked ? (
          <View style={styles.pickedRow}>
            <Text style={styles.pickedName} numberOfLines={1}>📎 {picked.name}</Text>
            <Pressable disabled={saving} onPress={() => setPicked(null)} hitSlop={8}>
              <Text style={styles.removeText}>{language === 'ru' ? 'Убрать' : 'Remove'}</Text>
            </Pressable>
          </View>
        ) : (
          <Pressable style={({ pressed }) => [styles.attachBtn, pressed && styles.pressed]} disabled={saving} onPress={askAttachmentSource}>
            <Text style={styles.attachText}>{language === 'ru' ? 'Прикрепить фото или PDF' : 'Attach photo or PDF'}</Text>
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
          {saving ? <ActivityIndicator color="#fff" /> : <Text style={styles.submitText}>{language === 'ru' ? 'Сохранить запись' : 'Save record'}</Text>}
        </Pressable>

        <Pressable style={styles.cancel} onPress={navigation.pop}>
          <Text style={styles.cancelText}>{language === 'ru' ? 'Отмена' : 'Cancel'}</Text>
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
