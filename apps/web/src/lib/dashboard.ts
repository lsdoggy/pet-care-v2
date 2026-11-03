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
export function taskComparator(a: CareTaskDto, b: CareTaskDto): number {
  const rank = (t: CareTaskDto) => {
    const u = classifyTask(t)
    return u === 'overdue' ? 0 : u === 'today' ? 1 : 2
  }
  const r = rank(a) - rank(b)
  if (r !== 0) return r
  return new Date(a.dueAt).getTime() - new Date(b.dueAt).getTime()
}

export function classifyTask(task: CareTaskDto, now: number = Date.now()): TaskUrgency {
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
