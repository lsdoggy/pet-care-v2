import { useLanguage } from '../i18n/language';
import { createElement, useId } from 'react';
import { colors } from '../theme/tokens';
import type { DateFieldProps } from './DateField.types';

export function DateField({ label, value, onChange, mode = 'date', minimum, maximum, optional, disabled }: DateFieldProps) {
  const language = useLanguage();
  const identifier = useId();
  return createElement('div', { style: { display: 'grid', gap: 8, minWidth: 0, fontFamily: 'Roboto_400Regular, sans-serif', fontSize: 16, lineHeight: 1.5 } },
    createElement('label', { htmlFor: identifier, style: { color: colors.textPrimary, fontSize: 14 } }, label),
    createElement('input', {
      id: identifier, type: mode, value, min: minimum, max: maximum, disabled,
      onChange: (event: React.ChangeEvent<HTMLInputElement>) => onChange(event.target.value),
      style: { width: '100%', minHeight: 48, padding: 12, boxSizing: 'border-box', borderRadius: 8, border: `1px solid ${colors.borderStrong}`, background: colors.surface, color: colors.textPrimary, font: 'inherit', colorScheme: 'light' },
    }),
    optional && value ? createElement('button', { type: 'button', disabled, onClick: () => onChange(''), style: { minHeight: 44, background: 'transparent', border: 0, color: colors.primaryStrong, cursor: 'pointer', textAlign: 'left', font: 'inherit' } }, language === 'ru' ? 'Очистить дату' : 'Clear date') : null,
  );
}
