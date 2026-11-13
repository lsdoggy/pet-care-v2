/**
 * Dashboard helpers (mobile) — mirror of apps/web/src/lib/dashboard.ts.
 * Pure functions only: no state, no API calls. Design Sprint 2.
 */

import type { CareTaskDto, FoodProductDto, VetAppointmentDto } from '../api/types';

/* ---------- Greeting & time ---------- */

/** Time-of-day greeting in Russian ("Доброе утро" / "Добрый день" / ...). */
export function greetingForNow(now: Date = new Date()): string {
  const h = now.getHours();
  if (h >= 5 && h < 12) return 'Доброе утро';
  if (h >= 12 && h < 18) return 'Добрый день';
  if (h >= 18 && h < 23) return 'Добрый вечер';
  return 'Доброй ночи';
}

/** Short local date, e.g. "4 нояб." */
export function formatDate(iso: string): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return '—';
  return d.toLocaleDateString('ru-RU', { day: 'numeric', month: 'short' });
}

/** Short local datetime, e.g. "4 нояб., 15:30" */
export function formatDateTime(iso: string): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return '—';
  return d.toLocaleString('ru-RU', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' });
}

/** Human-friendly relative label for a due instant: "Сегодня", "Просрочено на 2 дня" etc. */
export function dueLabel(iso: string, now: Date = new Date()): string {
  const due = new Date(iso);
  if (Number.isNaN(due.getTime())) return '';
  const startOfToday = startOfDay(now);
  const startOfDue = startOfDay(due);
  const days = Math.round((startOfDue.getTime() - startOfToday.getTime()) / 86_400_000);
  if (days < 0) {
    const late = Math.abs(days);
    return late === 1 ? 'Просрочено на 1 день' : `Просрочено на ${pluralRu(late, ['дней', 'день', 'дня'])}`;
  }
  if (days === 0) return due.getTime() < now.getTime() ? 'Просрочено сегодня' : 'Сегодня';
  if (days === 1) return 'Завтра';
  if (days < 7) return `Через ${pluralRu(days, ['дней', 'день', 'дня'])}`;
  return formatDate(iso);
}

function startOfDay(d: Date): Date {
  const copy = new Date(d);
  copy.setHours(0, 0, 0, 0);
  return copy;
}

/** Minimal Russian pluralization: forms = [1 день, 2 дня, 5 дней]. */
export function pluralRu(n: number, forms: [string, string, string]): string {
  const abs = Math.abs(n) % 100;
  const last = abs % 10;
  if (abs > 10 && abs < 20) return `${n} ${forms[2]}`;
  if (last === 1) return `${n} ${forms[0]}`;
  if (last >= 2 && last <= 4) return `${n} ${forms[1]}`;
  return `${n} ${forms[2]}`;
}

/** Pet age in human words, e.g. "2 года 3 месяца". */
export function ageLabel(birthDate: string | null): string {
  if (!birthDate) return 'Возраст не указан';
  const birth = new Date(birthDate);
  if (Number.isNaN(birth.getTime())) return 'Возраст не указан';
  const now = new Date();
  let months = (now.getFullYear() - birth.getFullYear()) * 12 + (now.getMonth() - birth.getMonth());
  if (now.getDate() < birth.getDate()) months -= 1;
  if (months < 0) return '—';
  if (months < 1) return '< 1 мес.';
  if (months < 12) return pluralRu(months, ['месяц', 'месяца', 'месяцев']);
  const years = Math.floor(months / 12);
  const rest = months % 12;
  const y = pluralRu(years, ['год', 'года', 'лет']);
  if (rest === 0) return y;
  return `${y} ${pluralRu(rest, ['месяц', 'месяца', 'месяцев'])}`;
}

/* ---------- Attention bucketing ---------- */

export interface AttentionItem {
  key: string;
  kind: 'overdue' | 'today' | 'lowstock' | 'visit';
  petName: string | null;
  title: string;
  meta: string;
  /** ISO instant used for sorting; null for non-time items (low stock). */
  at: string | null;
}

export interface AttentionResult {
  overdueCount: number;
  todayCount: number;
  lowStockCount: number;
  upcomingVisitsCount: number;
  items: AttentionItem[];
}

/**
 * Builds the "Требует внимания" list from already-fetched data.
 * Rules (same as web):
 *  - overdue PENDING tasks first, then today's tasks;
 *  - low-stock products (<= reorder threshold);
 *  - SCHEDULED appointments within the next 14 days;
 *  - total list capped at `limit` to keep the card scannable.
 */
export function buildAttention(
  tasks: CareTaskDto[],
  products: FoodProductDto[],
  appointments: VetAppointmentDto[],
  limit = 6,
  now: Date = new Date(),
): AttentionResult {
  const items: AttentionItem[] = [];

  const pending = tasks.filter((t) => t.status === 'PENDING');
  const timestamp = now.getTime();

  const byDueTime = (a: CareTaskDto, b: CareTaskDto) => new Date(a.dueAt).getTime() - new Date(b.dueAt).getTime();
  const overdue = pending
    .filter((t) => new Date(t.dueAt).getTime() < timestamp)
    .sort(byDueTime);
  const today = pending
    .filter((t) => {
      const due = new Date(t.dueAt);
      return due.getTime() >= timestamp && due.getFullYear() === now.getFullYear()
        && due.getMonth() === now.getMonth() && due.getDate() === now.getDate();
    })
    .sort(byDueTime);

  for (const t of overdue) {
    items.push({
      key: `task-${t.id}`,
      kind: 'overdue',
      petName: t.petName,
      title: t.title,
      meta: dueLabel(t.dueAt, now),
      at: t.dueAt,
    });
  }
  for (const t of today) {
    items.push({
      key: `task-${t.id}`,
      kind: 'today',
      petName: t.petName,
      title: t.title,
      meta: formatDateTime(t.dueAt),
      at: t.dueAt,
    });
  }

  const lowStock = products.filter((p) => p.lowStock);
  for (const p of lowStock) {
    items.push({
      key: `stock-${p.id}`,
      kind: 'lowstock',
      petName: null,
      title: p.name,
      meta: `Осталось ${formatQuantity(p.stockQuantity)} ${unitLabel(p.unit)}`,
      at: null,
    });
  }

  const soonMs = 14 * 86_400_000;
  const visits = appointments
    .filter((a) => a.status === 'SCHEDULED')
    .filter((a) => {
      const ts = new Date(a.scheduledAt).getTime();
      return ts >= now.getTime() && ts <= now.getTime() + soonMs;
    })
    .sort((a, b) => a.scheduledAt.localeCompare(b.scheduledAt));
  for (const a of visits) {
    items.push({
      key: `visit-${a.id}`,
      kind: 'visit',
      petName: a.petName,
      title: `${a.clinicName}${a.doctorName ? `, ${a.doctorName}` : ''}`,
      meta: dueLabel(a.scheduledAt, now),
      at: a.scheduledAt,
    });
  }

  return {
    overdueCount: overdue.length,
    todayCount: today.length,
    lowStockCount: lowStock.length,
    upcomingVisitsCount: visits.length,
    items: items.slice(0, limit),
  };
}

/** Stock quantity formatting: 0.5 -> "0,5", 2 -> "2". */
export function formatQuantity(value: number): string {
  return Number.isInteger(value) ? String(value) : value.toFixed(1).replace('.', ',');
}

export function unitLabel(unit: FoodProductDto['unit']): string {
  switch (unit) {
    case 'KG':
      return 'кг';
    case 'G':
      return 'г';
    default:
      return 'шт';
  }
}

/* ---------- Upcoming events feed ---------- */

export interface UpcomingEvent {
  key: string;
  kind: 'task' | 'visit';
  petName: string | null;
  title: string;
  subtitle: string;
  at: string;
}

/** Merges future PENDING tasks and SCHEDULED appointments into one chronological feed. */
export function buildUpcomingEvents(
  tasks: CareTaskDto[],
  appointments: VetAppointmentDto[],
  limit = 8,
  now: Date = new Date(),
): UpcomingEvent[] {
  const from = now.getTime();
  const events: UpcomingEvent[] = [];

  for (const t of tasks) {
    if (t.status !== 'PENDING') continue;
    if (new Date(t.dueAt).getTime() < from) continue;
    events.push({
      key: `task-${t.id}`,
      kind: 'task',
      petName: t.petName,
      title: t.title,
      subtitle: dueLabel(t.dueAt, now),
      at: t.dueAt,
    });
  }
  for (const a of appointments) {
    if (a.status !== 'SCHEDULED') continue;
    if (new Date(a.scheduledAt).getTime() < from) continue;
    events.push({
      key: `visit-${a.id}`,
      kind: 'visit',
      petName: a.petName,
      title: a.clinicName,
      subtitle: `${a.doctorName ? a.doctorName + ' · ' : ''}${dueLabel(a.scheduledAt, now)}`,
      at: a.scheduledAt,
    });
  }

  return events.sort((a, b) => a.at.localeCompare(b.at)).slice(0, limit);
}
