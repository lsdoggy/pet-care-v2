/**
 * Design Sprint 3 · Pets formatting utilities (UI-agnostic).
 *
 * Чистые функции форматирования для карточки/списка питомцев (Web).
 * Никаких зависимостей от React/DOM — легко тестировать и переиспользовать.
 * Тексты — на русском (требование дизайн-спринта).
 */

import type { Language } from '../i18n/language'
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
export function formatPetAge(birthDate: string | null | undefined, now: Date = new Date(), language: Language = 'ru'): string {
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

  if (language === 'en') {
    const yearLabel = `${years} ${years === 1 ? 'year' : 'years'}`
    const monthLabel = `${months} ${months === 1 ? 'month' : 'months'}`
    if (years > 0) return years === 1 && months > 0 ? `${yearLabel} ${monthLabel}` : yearLabel
    return months > 0 ? monthLabel : 'under one month'
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
export function formatPetWeight(weightKg: number | null | undefined, language: Language = 'ru'): string {
  if (weightKg === null || weightKg === undefined || !Number.isFinite(weightKg)) {
    return EMPTY_VALUE_PLACEHOLDER
  }
  // Десятичная запятая как в русской локали; лишние нули не показываем.
  const rounded = Math.round(weightKg * 100) / 100
  return language === 'ru' ? `${String(rounded).replace('.', ',')} кг` : `${rounded} kg`
}

/** Порода или «—». */
export function formatPetBreed(breed: string | null | undefined): string {
  const trimmed = (breed ?? '').trim()
  return trimmed || EMPTY_VALUE_PLACEHOLDER
}

/** Дата рождения в формате «дд.мм.yyyy» или «—». */
export function formatBirthDateRu(birthDate: string | null | undefined, language: Language = 'ru'): string {
  if (!birthDate) return EMPTY_VALUE_PLACEHOLDER
  const [y, m, d] = birthDate.split('-')
  if (!y || !m || !d) return EMPTY_VALUE_PLACEHOLDER
  return language === 'ru' ? `${d}.${m}.${y}` : `${m}/${d}/${y}`
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

/**
 * Design Sprint 3 · Ближайшая задача питомца для карточки (требование 2).
 *
 * Чистая презентационная функция: принимает уже загруженные tasks/appointments
 * (эндпоинты не меняются) и возвращает ближайший по времени пункт «следующей
 * задачи»: care-задача PENDING или запланированный визит к врачу.
 * Возвращает null, если ничего не запланировано.
 */

import type { CareTaskDto, VetAppointmentDto } from '../api/types'
import { TASK_TYPE_LABELS } from '../api/types'

export interface NextPetAction {
  kind: 'task' | 'appointment'
  /** Короткая подпись для карточки, например «Прививка · через 3 дня». */
  label: string
  /** Полный текст для aria-label/title. */
  fullLabel: string
}

function pluralDaysRu(n: number): string {
  const mod10 = n % 10
  const mod100 = n % 100
  if (mod10 === 1 && mod100 !== 11) return 'день'
  if (mod10 >= 2 && mod10 <= 4 && (mod100 < 12 || mod100 > 14)) return 'дня'
  return 'дней'
}

/** «Сегодня» / «Завтра» / «через N дней» — по локальному дедлайну. */
export function dueInLabel(iso: string, now: Date = new Date()): string {
  const due = new Date(iso)
  if (Number.isNaN(due.getTime())) return ''
  const startOfDay = (d: Date) => new Date(d.getFullYear(), d.getMonth(), d.getDate()).getTime()
  const diffDays = Math.round((startOfDay(due) - startOfDay(now)) / 86_400_000)
  if (diffDays < 0) return 'просрочено'
  if (diffDays === 0) return 'сегодня'
  if (diffDays === 1) return 'завтра'
  return `через ${diffDays} ${pluralDaysRu(diffDays)}`
}

export function findNextPetAction(
  petId: number,
  tasks: CareTaskDto[],
  appointments: VetAppointmentDto[],
  now: Date = new Date(),
): NextPetAction | null {
  const candidates: Array<{ at: number; action: NextPetAction }> = []

  for (const t of tasks) {
    if (t.petId !== petId || t.status !== 'PENDING') continue
    const at = new Date(t.dueAt).getTime()
    if (Number.isNaN(at)) continue
    const when = dueInLabel(t.dueAt, now)
    candidates.push({
      at,
      action: {
        kind: 'task',
        label: `${TASK_TYPE_LABELS[t.type]}${when ? ` · ${when}` : ''}`,
        fullLabel: `${t.title} · ${TASK_TYPE_LABELS[t.type]}${when ? ` · ${when}` : ''}`,
      },
    })
  }

  for (const a of appointments) {
    if (a.petId !== petId || a.status !== 'SCHEDULED') continue
    const at = new Date(a.scheduledAt).getTime()
    if (Number.isNaN(at)) continue
    const when = dueInLabel(a.scheduledAt, now)
    candidates.push({
      at,
      action: {
        kind: 'appointment',
        label: `Визит к врачу${when ? ` · ${when}` : ''}`,
        fullLabel: `${a.clinicName}${a.doctorName ? `, ${a.doctorName}` : ''}${when ? ` · ${when}` : ''}`,
      },
    })
  }

  if (candidates.length === 0) return null
  candidates.sort((x, y) => x.at - y.at)
  return candidates[0].action
}
