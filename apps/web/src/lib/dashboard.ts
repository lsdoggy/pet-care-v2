/**
 * Design Sprint 2 — Dashboard view-model.
 * Pure presentation helpers: grouping/formatting of existing API DTOs.
 * No fetching, no mutation of business logic — backend contract unchanged.
 */
import type { CareTaskDto, FoodProductDto, VetAppointmentDto } from '../api/types'

export interface DashboardData {
  /** All pending tasks (GET /tasks/upcoming ∪ overdue part of GET /tasks). */
  tasks: CareTaskDto[]
  appointments: VetAppointmentDto[]
  products: FoodProductDto[]
}

export type TaskUrgency = 'overdue' | 'today' | 'upcoming'

const MS_IN_DAY = 24 * 60 * 60 * 1000

function startOfDay(d: Date): number {
  const x = new Date(d)
  x.setHours(0, 0, 0, 0)
  return x.getTime()
}

/** Overdue → today → soon; inside a bucket — by due date ascending. */
export function taskComparator(a: CareTaskDto, b: CareTaskDto, now: number): number {
  const rank = (t: CareTaskDto) => {
    const u = classifyTask(t, now)
    return u === 'overdue' ? 0 : u === 'today' ? 1 : 2
  }
  const r = rank(a) - rank(b)
  if (r !== 0) return r
  return new Date(a.dueAt).getTime() - new Date(b.dueAt).getTime()
}

export function classifyTask(task: CareTaskDto, now: number): TaskUrgency | null {
  if (task.status !== 'PENDING') return null
  const due = new Date(task.dueAt).getTime()
  if (due < now) return 'overdue'
  if (startOfDay(new Date(due)) === startOfDay(new Date(now))) return 'today'
  return 'upcoming'
}

/** Nearest scheduled visit in the next `days` days (null if none). */
export function nextVisit(appointments: VetAppointmentDto[], days = 7, now: number = Date.now()): VetAppointmentDto | null {
  const horizon = now + days * MS_IN_DAY
  const upcoming = appointments
    .filter((a) => a.status === 'SCHEDULED')
    .map((a) => ({ a, t: new Date(a.scheduledAt).getTime() }))
    .filter(({ t }) => t >= now && t <= horizon)
    .sort((x, y) => x.t - y.t)
  return upcoming.length > 0 ? upcoming[0].a : null
}

/** Products flagged low by the API (FoodProductDto.lowStock), most urgent first. */
export function lowStockProducts(products: FoodProductDto[]): FoodProductDto[] {
  return products.filter((p) => p.lowStock)
}

/** Days of food left (stock / daily portion); null when portion is unknown. */
export function daysLeft(product: FoodProductDto): number | null {
  if (!product.dailyPortionGrams || product.dailyPortionGrams <= 0) return null
  const stockGrams = product.unit === 'KG' ? product.stockQuantity * 1000 : product.stockQuantity
  return Math.max(0, Math.floor(stockGrams / product.dailyPortionGrams))
}

/* ---------- human-friendly Russian date/time formatting (Intl, no deps) ---------- */

const TIME_FMT = new Intl.DateTimeFormat('ru-RU', { hour: '2-digit', minute: '2-digit' })
const DAY_MONTH_FMT = new Intl.DateTimeFormat('ru-RU', { day: 'numeric', month: 'short' })
const WEEKDAY_FMT = new Intl.DateTimeFormat('ru-RU', { weekday: 'short' })

/** "сегодня, 14:30" / "просрочено · 3 дн. назад" / "5 нояб., 09:00". */
export function formatDueLabel(iso: string, now: number = Date.now()): string {
  const d = new Date(iso)
  const dueDay = startOfDay(d)
  const today = startOfDay(new Date(now))
  const diffDays = Math.round((today - dueDay) / MS_IN_DAY) // >0 → overdue
  if (diffDays === 0) return `сегодня, ${TIME_FMT.format(d)}`
  if (diffDays === 1) return `вчера, ${TIME_FMT.format(d)}`
  if (diffDays > 1) return `просрочено · ${pluralRu(diffDays, ['день', 'дня', 'дней'])} назад`
  if (dueDay - today === MS_IN_DAY) return `завтра, ${TIME_FMT.format(d)}`
  return `${DAY_MONTH_FMT.format(d)}, ${TIME_FMT.format(d)}`
}

/** Appointment card line: "пт, 7 нояб., 09:00". */
export function formatVisitLabel(iso: string): string {
  const d = new Date(iso)
  return `${WEEKDAY_FMT.format(d)}, ${DAY_MONTH_FMT.format(d)}, ${TIME_FMT.format(d)}`
}

/** Russian pluralization helper: 1 день / 2 дня / 5 дней. */
export function pluralRu(n: number, forms: [string, string, string]): string {
  const mod10 = n % 10
  const mod100 = n % 100
  if (mod10 === 1 && mod100 !== 11) return `${n} ${forms[0]}`
  if (mod10 >= 2 && mod10 <= 4 && (mod100 < 12 || mod100 > 14)) return `${n} ${forms[1]}`
  return `${n} ${forms[2]}`
}

/* ---------- age & greeting (Design Sprint 2 dashboard) ---------- */

/** "3 года" / "5 мес." / "12 дн." — pet age from a local YYYY-MM-DD birth date. */
export function formatAgeRu(birthDate: string, now: Date = new Date()): string {
  const b = new Date(`${birthDate}T00:00:00`)
  if (Number.isNaN(b.getTime())) return ''
  let years = now.getFullYear() - b.getFullYear()
  let months = now.getMonth() - b.getMonth()
  if (now.getDate() < b.getDate()) months -= 1
  if (months < 0) {
    years -= 1
    months += 12
  }
  if (years >= 0 && !(years === 0 && months === 0)) {
    if (years === 0) return pluralRu(months, ['месяц', 'месяца', 'месяцев'])
    const y = pluralRu(years, ['год', 'года', 'лет'])
    return months > 0 ? `${y}, ${pluralRu(months, ['месяц', 'месяца', 'месяцев'])}` : y
  }
  const days = Math.floor((startOfDay(now) - startOfDay(b)) / MS_IN_DAY)
  return pluralRu(Math.max(0, days), ['день', 'дня', 'дней'])
}

/** Time-of-day greeting part: "Доброе утро" / "Добрый день" / "Добрый вечер" / "Доброй ночи". */
export function greetingWord(now: Date = new Date()): string {
  const h = now.getHours()
  if (h >= 5 && h < 12) return 'Доброе утро'
  if (h >= 12 && h < 18) return 'Добрый день'
  if (h >= 18 && h < 23) return 'Добрый вечер'
  return 'Доброй ночи'
}

/** Display name for a user: email local-part before "@", fallback to the whole email. */
export function displayNameFromEmail(email: string): string {
  const at = email.indexOf('@')
  const base = at > 0 ? email.slice(0, at) : email
  return base.length > 0 ? base : email
}

const MONTH_GENITIVE_RU = [
  'января', 'февраля', 'марта', 'апреля', 'мая', 'июня',
  'июля', 'августа', 'сентября', 'октября', 'ноября', 'декабря',
]

/** Today's line for the greeting block: "Четверг, 4 ноября". */
export function todayLabel(now: Date = new Date()): string {
  const wd = new Intl.DateTimeFormat('ru-RU', { weekday: 'long' }).format(now)
  return `${wd[0].toUpperCase()}${wd.slice(1)}, ${now.getDate()} ${MONTH_GENITIVE_RU[now.getMonth()]}`
}

/** Parses "DAILY:1" / "WEEKLY:2" backend recurrence rules into Russian copy; null when unknown. */
export function recurrenceLabel(rule: string | null): string | null {
  if (!rule) return null
  const [unitRaw, intervalRaw] = rule.split(':')
  const interval = Number.parseInt(intervalRaw ?? '1', 10)
  if (!Number.isFinite(interval) || interval < 1) return null
  switch (unitRaw?.toUpperCase()) {
    case 'DAILY':
      return interval === 1 ? 'Каждый день' : `Каждые ${interval} дн.`
    case 'WEEKLY':
      return interval === 1 ? 'Каждую неделю' : `Каждые ${interval} нед.`
    case 'MONTHLY':
      return interval === 1 ? 'Каждый месяц' : `Каждые ${interval} мес.`
    case 'YEARLY':
      return interval === 1 ? 'Каждый год' : `Каждые ${interval} г.`
    default:
      return null
  }
}

/* ---------- unified upcoming-events feed (tasks + visits) ---------- */

export type DashboardEvent =
  | { kind: 'task'; at: number; task: CareTaskDto }
  | { kind: 'visit'; at: number; appointment: VetAppointmentDto }

/** Merges pending tasks and scheduled future visits into one chronological feed. */
export function buildUpcomingEvents(
  tasks: CareTaskDto[],
  appointments: VetAppointmentDto[],
  now: number = Date.now(),
): DashboardEvent[] {
  const taskEvents: DashboardEvent[] = tasks.filter((t) => t.status === 'PENDING').map((t) => ({ kind: 'task', at: new Date(t.dueAt).getTime(), task: t }))
  const visitEvents: DashboardEvent[] = appointments
    .filter((a) => a.status === 'SCHEDULED' && new Date(a.scheduledAt).getTime() >= now)
    .map((a) => ({ kind: 'visit', at: new Date(a.scheduledAt).getTime(), appointment: a }))
  return [...taskEvents, ...visitEvents].sort((x, y) => x.at - y.at)
}
