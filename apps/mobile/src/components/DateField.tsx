import { useState } from 'react';
import { Modal, Platform, Pressable, Text, View } from 'react-native';
import DateTimePicker from '@react-native-community/datetimepicker';
import { colors } from '../theme/tokens';
import { localDateValue, type DateFieldProps } from './DateField.types';

export function DateField({ label, value, onChange, mode = 'date', minimum, maximum, optional, disabled }: DateFieldProps) {
  const [open, setOpen] = useState(false);
  const [draft, setDraft] = useState(new Date());
  const parse = (input: string) => new Date(mode === 'time' ? `2000-01-01T${input}:00` : `${input}T12:00:00`);
  const format = (date: Date) => mode === 'time' ? `${String(date.getHours()).padStart(2, '0')}:${String(date.getMinutes()).padStart(2, '0')}` : localDateValue(date);
  const show = () => {
    const selected = value ? parse(value) : new Date();
    const earliest = minimum ? parse(minimum) : null;
    const latest = maximum ? parse(maximum) : null;
    setDraft(latest && selected > latest ? latest : earliest && selected < earliest ? earliest : selected);
    setOpen(true);
  };
  const picker = <DateTimePicker value={draft} mode={mode} display={Platform.OS === 'ios' ? 'spinner' : 'default'} is24Hour locale="ru-RU"
    minimumDate={minimum ? parse(minimum) : undefined} maximumDate={maximum ? parse(maximum) : undefined}
    onChange={(event, date) => {
      if (Platform.OS === 'android') {
        setOpen(false);
        if (event.type === 'set' && date) onChange(format(date));
      } else if (date) setDraft(date);
    }} />;
  return <View style={{ gap: 8 }}>
    <Text style={{ color: colors.textPrimary }}>{label}</Text>
    <Pressable accessibilityRole="button" accessibilityLabel={`${label}: ${value || 'не выбрана'}`} disabled={disabled} onPress={show} style={{ minHeight: 48, padding: 12, borderWidth: 1, borderColor: colors.borderStrong, borderRadius: 8, backgroundColor: colors.surface, justifyContent: 'center' }}>
      <Text style={{ color: colors.textPrimary }}>{value ? mode === 'date' ? parse(value).toLocaleDateString('ru-RU') : value : 'Выбрать дату'}</Text>
    </Pressable>
    {optional && value ? <Pressable accessibilityRole="button" disabled={disabled} onPress={() => onChange('')} style={{ minHeight: 44, justifyContent: 'center' }}><Text style={{ color: colors.primaryStrong }}>Очистить дату</Text></Pressable> : null}
    {open && Platform.OS === 'android' ? picker : null}
    <Modal visible={open && Platform.OS === 'ios'} transparent animationType="slide" onRequestClose={() => setOpen(false)}>
      <View style={{ flex: 1, justifyContent: 'flex-end', backgroundColor: 'rgba(0,0,0,0.35)' }}>
        <View style={{ padding: 20, backgroundColor: colors.surface, gap: 12 }}>
          <Text>{label}</Text>{open ? picker : null}
          <Pressable accessibilityRole="button" onPress={() => { onChange(format(draft)); setOpen(false); }} style={{ minHeight: 44, justifyContent: 'center' }}><Text style={{ color: colors.primaryStrong }}>Готово</Text></Pressable>
          <Pressable accessibilityRole="button" onPress={() => setOpen(false)} style={{ minHeight: 44, justifyContent: 'center' }}><Text>Отмена</Text></Pressable>
        </View>
      </View>
    </Modal>
  </View>;
}
