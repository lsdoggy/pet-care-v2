export interface DateFieldProps {
  label: string;
  value: string;
  onChange: (value: string) => void;
  mode?: 'date' | 'time';
  minimum?: string;
  maximum?: string;
  optional?: boolean;
  disabled?: boolean;
}

export function localDateValue(date: Date): string {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
}
