/**
 * Design Sprint 3 · Pets validation (shared logic, UI-agnostic).
 *
 * Клиентская валидация формы питомца. Правила зеркалят backend:
 *   name      — обязателен, ≤ 50 символов в UI (backend допускает ≤ 100 —
 *               обратная совместимость сохранена)
 *   species   — обязателен (enum PetSpecies)
 *   breed     — опционален, ≤ 80 символов (миграция V10)
 *   birthDate — опционален, не в будущем (FutureBirthDateException на сервере)
 *   weightKg  — опционален, > 0 и ≤ 200 (миграция V10)
 *
 * Возвращаемый объект плоский: { field: 'текст ошибки' } — удобен для
 * привязки к aria-invalid / aria-describedby (WCAG AA).
 * Тексты ошибок — на русском (требование дизайн-спринта).
 */

import type { PetSpecies } from '../api/types'

export type PetFieldName = 'name' | 'species' | 'breed' | 'birthDate' | 'weightKg'

export type PetFieldErrors = Partial<Record<PetFieldName, string>>

export interface PetFormValues {
  name: string
  /** '' означает «не выбрано» в <select>. */
  species: PetSpecies | ''
  breed: string
  /** ISO yyyy-mm-dd или ''. */
  birthDate: string
  /** Строка числового input ('' = не задан); запятая нормализуется в точку. */
  weightKg: string
}

export const PET_NAME_MAX_LENGTH = 50
export const PET_BREED_MAX_LENGTH = 80
export const PET_WEIGHT_MAX_KG = 200

export const PET_SPECIES_OPTIONS: ReadonlyArray<{ value: PetSpecies; label: string }> = [
  { value: 'DOG', label: 'Собака' },
  { value: 'CAT', label: 'Кошка' },
  { value: 'BIRD', label: 'Птица' },
  { value: 'HAMSTER', label: 'Хомяк' },
  { value: 'RABBIT', label: 'Кролик' },
  { value: 'TURTLE', label: 'Черепаха' },
  { value: 'FISH', label: 'Рыбка' },
  { value: 'OTHER', label: 'Другое' },
]

export function petSpeciesLabel(species: PetSpecies | null | undefined): string {
  if (!species) return '—'
  return PET_SPECIES_OPTIONS.find((o) => o.value === species)?.label ?? species
}

/** Парсит ввод веса («4,5» → 4.5). Пустая строка → null (значение не задано). */
export function parseWeightKg(value: string): number | null {
  const normalized = value.trim().replace(',', '.')
  if (!normalized) return null
  const parsed = Number(normalized)
  return Number.isFinite(parsed) ? parsed : NaN
}

/** Сегодняшняя дата в локальном часовом поясе как ISO yyyy-mm-dd (для сравнения с input[type=date]). */
function todayIso(): string {
  const now = new Date()
  const m = String(now.getMonth() + 1).padStart(2, '0')
  const d = String(now.getDate()).padStart(2, '0')
  return `${now.getFullYear()}-${m}-${d}`
}

export function validatePetName(value: string): string | null {
  const name = value.trim()
  if (!name) return 'Укажите имя питомца.'
  if (name.length > PET_NAME_MAX_LENGTH) {
    return `Имя не должно превышать ${PET_NAME_MAX_LENGTH} символов.`
  }
  return null
}

export function validatePetSpecies(value: PetSpecies | ''): string | null {
  if (!value) return 'Выберите вид животного.'
  return null
}

/** Порода необязательна: пустое значение всегда валидно. */
export function validatePetBreed(value: string): string | null {
  const breed = value.trim()
  if (!breed) return null
  if (breed.length > PET_BREED_MAX_LENGTH) {
    return `Порода не должна превышать ${PET_BREED_MAX_LENGTH} символов.`
  }
  return null
}

/** Дата рождения необязательна, но не может быть в будущем. */
export function validatePetBirthDate(value: string): string | null {
  if (!value) return null
  const date = new Date(`${value}T00:00:00`)
  if (Number.isNaN(date.getTime())) return 'Укажите корректную дату рождения.'
  if (value > todayIso()) return 'Дата рождения не может быть в будущем.'
  return null
}

/** Вес необязателен; если указан — строго больше 0 и не больше PET_WEIGHT_MAX_KG. */
export function validatePetWeight(value: string): string | null {
  if (!value.trim()) return null
  const parsed = parseWeightKg(value)
  if (parsed === null || Number.isNaN(parsed)) return 'Укажите вес числом, например 4,5.'
  if (parsed <= 0) return 'Вес должен быть больше 0.'
  if (parsed > PET_WEIGHT_MAX_KG) return `Вес не может превышать ${PET_WEIGHT_MAX_KG} кг.`
  return null
}

export function validatePetForm(values: PetFormValues): PetFieldErrors {
  const errors: PetFieldErrors = {}

  const nameError = validatePetName(values.name)
  if (nameError) errors.name = nameError

  const speciesError = validatePetSpecies(values.species)
  if (speciesError) errors.species = speciesError

  const breedError = validatePetBreed(values.breed)
  if (breedError) errors.breed = breedError

  const birthDateError = validatePetBirthDate(values.birthDate)
  if (birthDateError) errors.birthDate = birthDateError

  const weightError = validatePetWeight(values.weightKg)
  if (weightError) errors.weightKg = weightError

  return errors
}

export function isPetFormValid(errors: PetFieldErrors): boolean {
  return Object.keys(errors).length === 0
}

/** Ошибки 400-го ответа backend → русские сообщения по полям (по образцу Sprint 1). */
export function mapPetApiError(detail: string | undefined): { field?: PetFieldName; message: string } {
  const d = (detail ?? '').toLowerCase()
  if (d.includes('birth')) {
    return { field: 'birthDate', message: 'Дата рождения не может быть в будущем.' }
  }
  if (d.includes('name')) {
    return { field: 'name', message: 'Проверьте имя питомца (1–50 символов).' }
  }
  if (d.includes('species')) {
    return { field: 'species', message: 'Выберите вид животного.' }
  }
  if (d.includes('weight')) {
    return { field: 'weightKg', message: 'Проверьте вес: число больше 0.' }
  }
  return { message: 'Не удалось сохранить питомца. Попробуйте ещё раз.' }
}
