import type { Language } from '../i18n/language';
/**
 * Design Sprint 3 · Pets utilities (validation + formatting, UI-agnostic).
 *
 * Mobile mirror of apps/web/src/lib/petValidation.ts + petFormat.ts —
 * keep all three files in sync. Platform-isolated: RN-экраны импортируют
 * только этот файл (нет импорта из apps/web).
 *
 * Правила зеркалят backend:
 *   name      — обязателен, ≤ 50 символов в UI (backend допускает ≤ 100)
 *   species   — обязателен (enum PetSpecies)
 *   breed     — опционален, ≤ 80 символов (миграция V10)
 *   birthDate — опционален, не в будущем
 *   weightKg  — опционален, > 0 и ≤ 200 (миграция V10)
 *
 * Тексты ошибок — на русском (требование дизайн-спринта).
 */

import type { PetDto, PetSpecies } from '../api/types';

export type PetFieldName = 'name' | 'species' | 'breed' | 'birthDate' | 'weightKg';

export type PetFieldErrors = Partial<Record<PetFieldName, string>>;

export interface PetFormValues {
  name: string;
  /** '' означает «не выбрано». */
  species: PetSpecies | '';
  breed: string;
  /** ISO yyyy-mm-dd или ''. */
  birthDate: string;
  /** Строка TextInput ('' = не задан); запятая нормализуется в точку. */
  weightKg: string;
}

export const PET_NAME_MAX_LENGTH = 50;
export const PET_BREED_MAX_LENGTH = 80;
export const PET_WEIGHT_MAX_KG = 200;

/** «—» для отсутствующих значений (см. sprint3-pets-spec.md §2). */
export const EMPTY_VALUE_PLACEHOLDER = '—';

// ---------------------------------------------------------------------------
// Валидация
// ---------------------------------------------------------------------------

/** Парсит ввод веса («4,5» → 4.5). Пустая строка → null (значение не задано). */
export function parseWeightKg(value: string): number | null {
  const normalized = value.trim().replace(',', '.');
  if (!normalized) return null;
  const parsed = Number(normalized);
  return Number.isFinite(parsed) ? parsed : NaN;
}

/** Сегодняшняя дата в локальном часовом поясе как ISO yyyy-mm-dd. */
function todayIso(): string {
  const now = new Date();
  const m = String(now.getMonth() + 1).padStart(2, '0');
  const d = String(now.getDate()).padStart(2, '0');
  return `${now.getFullYear()}-${m}-${d}`;
}

export function validatePetName(value: string): string | null {
  const name = value.trim();
  if (!name) return 'Укажите имя питомца.';
  if (name.length > PET_NAME_MAX_LENGTH) {
    return `Имя не должно превышать ${PET_NAME_MAX_LENGTH} символов.`;
  }
  return null;
}

export function validatePetSpecies(value: PetSpecies | ''): string | null {
  if (!value) return 'Выберите вид животного.';
  return null;
}

/** Порода необязательна: пустое значение всегда валидно. */
export function validatePetBreed(value: string): string | null {
  const breed = value.trim();
  if (!breed) return null;
  if (breed.length > PET_BREED_MAX_LENGTH) {
    return `Порода не должна превышать ${PET_BREED_MAX_LENGTH} символов.`;
  }
  return null;
}

/** Дата рождения необязательна, но не может быть в будущем. */
export function validatePetBirthDate(value: string): string | null {
  if (!value) return null;
  const date = new Date(`${value}T00:00:00`);
  if (Number.isNaN(date.getTime())) return 'Укажите корректную дату рождения.';
  if (value > todayIso()) return 'Дата рождения не может быть в будущем.';
  return null;
}

/** Вес необязателен; если указан — строго больше 0 и не больше PET_WEIGHT_MAX_KG. */
export function validatePetWeight(value: string): string | null {
  if (!value.trim()) return null;
  const parsed = parseWeightKg(value);
  if (parsed === null || Number.isNaN(parsed)) return 'Укажите вес числом, например 4,5.';
  if (parsed <= 0) return 'Вес должен быть больше 0.';
  if (parsed > PET_WEIGHT_MAX_KG) return `Вес не может превышать ${PET_WEIGHT_MAX_KG} кг.`;
  return null;
}

export function validatePetForm(values: PetFormValues): PetFieldErrors {
  const errors: PetFieldErrors = {};

  const nameError = validatePetName(values.name);
  if (nameError) errors.name = nameError;

  const speciesError = validatePetSpecies(values.species);
  if (speciesError) errors.species = speciesError;

  const breedError = validatePetBreed(values.breed);
  if (breedError) errors.breed = breedError;

  const birthDateError = validatePetBirthDate(values.birthDate);
  if (birthDateError) errors.birthDate = birthDateError;

  const weightError = validatePetWeight(values.weightKg);
  if (weightError) errors.weightKg = weightError;

  return errors;
}

export function isPetFormValid(errors: PetFieldErrors): boolean {
  return Object.keys(errors).length === 0;
}

/** Ошибки 400-го ответа backend → русские сообщения по полям (по образцу Sprint 1). */
export function mapPetApiError(detail: string | undefined): { field?: PetFieldName; message: string } {
  const d = (detail ?? '').toLowerCase();
  if (d.includes('birth')) {
    return { field: 'birthDate', message: 'Дата рождения не может быть в будущем.' };
  }
  if (d.includes('name')) {
    return { field: 'name', message: 'Проверьте имя питомца (1–50 символов).' };
  }
  if (d.includes('species')) {
    return { field: 'species', message: 'Выберите вид животного.' };
  }
  if (d.includes('weight')) {
    return { field: 'weightKg', message: 'Проверьте вес: число больше 0.' };
  }
  return { message: 'Не удалось сохранить питомца. Попробуйте ещё раз.' };
}

// ---------------------------------------------------------------------------
// Форматирование
// ---------------------------------------------------------------------------

/** Русская плюрализация: 1 год, 2 года, 5 лет. */
function pluralYears(n: number): string {
  const mod10 = n % 10;
  const mod100 = n % 100;
  if (mod10 === 1 && mod100 !== 11) return 'год';
  if (mod10 >= 2 && mod10 <= 4 && (mod100 < 12 || mod100 > 14)) return 'года';
  return 'лет';
}

function pluralMonths(n: number): string {
  const mod10 = n % 10;
  const mod100 = n % 100;
  if (mod10 === 1 && mod100 !== 11) return 'месяц';
  if (mod10 >= 2 && mod10 <= 4 && (mod100 < 12 || mod100 > 14)) return 'месяца';
  return 'месяцев';
}

/** Возраст по дате рождения: «3 года», «8 месяцев», «меньше месяца», «—». */
export function formatPetAge(birthDate: string | null | undefined, now: Date = new Date(), language: Language = 'ru'): string {
  if (!birthDate) return EMPTY_VALUE_PLACEHOLDER;
  const birth = new Date(`${birthDate}T00:00:00`);
  if (Number.isNaN(birth.getTime()) || birth > now) return EMPTY_VALUE_PLACEHOLDER;

  let years = now.getFullYear() - birth.getFullYear();
  let months = now.getMonth() - birth.getMonth();
  if (now.getDate() < birth.getDate()) months -= 1;
  if (months < 0) {
    years -= 1;
    months += 12;
  }

  if (language === 'en') {
    const yearLabel = `${years} ${years === 1 ? 'year' : 'years'}`;
    const monthLabel = `${months} ${months === 1 ? 'month' : 'months'}`;
    if (years > 0) return years === 1 && months > 0 ? `${yearLabel} ${monthLabel}` : yearLabel;
    return months > 0 ? monthLabel : 'under one month';
  }

  if (years > 0) {
    if (years === 1 && months > 0) {
      return `${years} ${pluralYears(years)} ${months} ${pluralMonths(months)}`;
    }
    return `${years} ${pluralYears(years)}`;
  }
  if (months > 0) return `${months} ${pluralMonths(months)}`;
  return 'меньше месяца';
}

/** Вес: «4,5 кг»; null/undefined → «—». */
export function formatPetWeight(weightKg: number | null | undefined, language: Language = 'ru'): string {
  if (weightKg === null || weightKg === undefined || !Number.isFinite(weightKg)) {
    return EMPTY_VALUE_PLACEHOLDER;
  }
  const rounded = Math.round(weightKg * 100) / 100;
  return language === 'ru' ? `${String(rounded).replace('.', ',')} кг` : `${rounded} kg`;
}

/** Порода или «—». */
export function formatPetBreed(breed: string | null | undefined): string {
  const trimmed = (breed ?? '').trim();
  return trimmed || EMPTY_VALUE_PLACEHOLDER;
}

/** Дата рождения в формате «дд.мм.yyyy» или «—». */
export function formatBirthDateRu(birthDate: string | null | undefined, language: Language = 'ru'): string {
  if (!birthDate) return EMPTY_VALUE_PLACEHOLDER;
  const [y, m, d] = birthDate.split('-');
  if (!y || !m || !d) return EMPTY_VALUE_PLACEHOLDER;
  return language === 'ru' ? `${d}.${m}.${y}` : `${m}/${d}/${y}`;
}

/** Инициалы для placeholder-аватара (до 2 букв). */
export function petInitials(name: string | null | undefined): string {
  const trimmed = (name ?? '').trim();
  if (!trimmed) return '?';
  const parts = trimmed.split(/\s+/);
  return (parts[0][0] + (parts.length > 1 ? parts[1][0] : '')).toUpperCase();
}

/** Извлекает breed/weightKg из DTO, если backend их уже отдаёт (Этап 3B); иначе null. */
export function readPetOptionalFields(
  pet: PetDto,
): { breed: string | null; weightKg: number | null } {
  const withExtras = pet as PetDto & { breed?: string | null; weightKg?: number | null };
  return { breed: withExtras.breed ?? null, weightKg: withExtras.weightKg ?? null };
}
