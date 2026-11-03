/**
 * Design Sprint 3 · Pets formatting utilities (UI-agnostic).
 *
 * Чистые функции форматирования для карточки/списка питомцев (Web).
 * Никаких зависимостей от React/DOM — легко тестировать и переиспользовать.
 * Тексты — на русском (требование дизайн-спринта).
 */

import type { PetDto } from '../api/types'

/** «—» для отсутствующих значений (см. sprint3-pets-spec.md §2). */
export const EMPTY_VALUE_PLACEHOLDER = '—'

/** Русская плюрализация: 1 год, 2 года, 5 лет. */
function pluralYears(n: number): string {
  const mod10 = n % 10
  const mod100 = n % 100
  if (mod10 === 1 && mod100 !== 11) return 'год'
  if (mod10 >= 2 && mod10 <= 4 && (mod100 < 12 || mod100 > 14)) return 'года'
  return 'лет'
}

function pluralMonths(n: number): string {
  const mod10 = n % 10
  const mod100 = n % 100
  if (mod10 === 1 && mod100 !== 11) return 'месяц'
  if (mod10 >= 2 && mod10 <= 4 && (mod100 < 12 || mod100 > 14)) return 'месяца'
  return 'месяцев'
}

/**
 * Возраст по дате рождения: «3 года», «8 месяцев», «меньше месяца».
 * Пустая/некорректная дата → EMPTY_VALUE_PLACEHOLDER.
 */
export function formatPetAge(birthDate: string | null | undefined, now: Date = new Date()): string {
  if (!birthDate) return EMPTY_VALUE_PLACEHOLDER
  const birth = new Date(`${birthDate}T00:00:00`)
  if (Number.isNaN(birth.getTime()) || birth > now) return EMPTY_VALUE_PLACEHOLDER

  let years = now.getFullYear() - birth.getFullYear()
  let months = now.getMonth() - birth.getMonth()
  if (now.getDate() < birth.getDate()) months -= 1
  if (months < 0) {
    years -= 1
    months += 12
  }

  if (years > 0) {
    // «1 год 3 месяца» до двух лет — иначе округляем до полных лет.
    if (years === 1 && months > 0) return `${years} ${pluralYears(years)} ${months} ${pluralMonths(months)}`
    return `${years} ${pluralYears(years)}`
  }
  if (months > 0) return `${months} ${pluralMonths(months)}`
  return 'меньше месяца'
}

/** Вес: «4,5 кг»; null/undefined → EMPTY_VALUE_PLACEHOLDER. */
export function formatPetWeight(weightKg: number | null | undefined): string {
  if (weightKg === null || weightKg === undefined || !Number.isFinite(weightKg)) {
    return EMPTY_VALUE_PLACEHOLDER
  }
  // Десятичная запятая как в русской локали; лишние нули не показываем.
  const rounded = Math.round(weightKg * 100) / 100
  return `${String(rounded).replace('.', ',')} кг`
}

/** Порода или «—». */
export function formatPetBreed(breed: string | null | undefined): string {
  const trimmed = (breed ?? '').trim()
  return trimmed || EMPTY_VALUE_PLACEHOLDER
}

/** Дата рождения в формате «дд.мм.yyyy» или «—». */
export function formatBirthDateRu(birthDate: string | null | undefined): string {
  if (!birthDate) return EMPTY_VALUE_PLACEHOLDER
  const [y, m, d] = birthDate.split('-')
  if (!y || !m || !d) return EMPTY_VALUE_PLACEHOLDER
  return `${d}.${m}.${y}`
}

/** Инициалы для placeholder-аватара (до 2 букв, регистр сохраняется). */
export function petInitials(name: string | null | undefined): string {
  const trimmed = (name ?? '').trim()
  if (!trimmed) return '?'
  const parts = trimmed.split(/\s+/)
  const initials = (parts[0][0] + (parts.length > 1 ? parts[1][0] : '')).toUpperCase()
  return initials
}

/** Извлекает breed/weightKg из DTO, если backend их уже отдаёт (Этап 3B); иначе undefined. */
export function readPetOptionalFields(pet: PetDto): { breed?: string | null; weightKg?: number | null } {
  const withExtras = pet as PetDto & { breed?: string | null; weightKg?: number | null }
  return { breed: withExtras.breed ?? null, weightKg: withExtras.weightKg ?? null }
}
