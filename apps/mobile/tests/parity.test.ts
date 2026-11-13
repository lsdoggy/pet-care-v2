import { describe, it, expect } from 'vitest';
import { buildAttention, buildUpcomingEvents } from '../src/lib/dashboard';
import { validateQuickPurchase } from '../src/lib/quickPurchase';
import type { CareTaskDto } from '../src/api/types';
const task = (dueAt: string, status = 'PENDING') => ({ id: 1, title: 'Task', petName: 'Pet', dueAt, status } as CareTaskDto);
describe('purchase parity boundaries', () => {
  it.each(['', ' ', 'x'.repeat(151)])('rejects name %s', (name) => expect(validateQuickPurchase(name, '1').error).toBeTruthy());
  it.each(['', ' ', 'abc', '0', '1000', '1.5', '1,5', 'Infinity'])('rejects quantity %s without rounding', (qty) => expect(validateQuickPurchase('Name', qty).error).toBeTruthy());
  it.each([[' x ', '1', 'x', 1], ['x'.repeat(150), '999', 'x'.repeat(150), 999]])('valid payload', (name, qty, trimmed, quantity) => expect(validateQuickPurchase(String(name), String(qty)).payload).toEqual({ customName: trimmed, quantity, unit: 'PCS' }));
});
describe('time boundaries in local timezone', () => {
  const now = new Date('2026-11-13T12:00:00+03:00');
  it.each([-1, 0, 1])('dueAt now %+ims', (delta) => {
    const t = task(new Date(now.getTime() + delta).toISOString());
    const result = buildAttention([t], [], [], 6, now);
    expect(result.overdueCount).toBe(delta < 0 ? 1 : 0);
    expect(result.todayCount).toBe(delta < 0 ? 0 : 1);
    expect(buildUpcomingEvents([t], [], 8, now).length).toBe(delta < 0 ? 0 : 1);
  });
  it('yesterday, tomorrow, DONE and offset instant', () => {
    expect(buildAttention([task('2026-11-12T12:00:00+03:00')], [], [], 6, now).overdueCount).toBe(1);
    expect(buildAttention([task('2026-11-14T12:00:00+03:00'), task('2026-11-12T00:00:00Z', 'DONE')], [], [], 6, now).items).toEqual([]);
    expect(buildAttention([task('2026-11-13T10:00:00+01:00')], [], [], 6, now).todayCount).toBe(1);
  });
  it('preserves six-item attention, fourteen-day visits and eight-event feed', () => {
    const tasks = Array.from({ length: 10 }, (_, i) => ({ ...task(now.toISOString()), id: i }));
    const visits = [14, 15].map((days, i) => ({ id: i, status: 'SCHEDULED', scheduledAt: new Date(now.getTime() + days * 86400000).toISOString(), clinicName: 'Clinic', petName: 'Pet' } as any));
    const result = buildAttention(tasks, [], visits, 6, now);
    expect(result.items).toHaveLength(6); expect(result.todayCount).toBe(10); expect(result.upcomingVisitsCount).toBe(1);
    expect(buildUpcomingEvents(tasks, visits, 8, now)).toHaveLength(8);
  });
  it('exact local midnight DST fixtures agreed with web', () => {
    const midnight = new Date(2026, 2, 29, 0);
    const late = new Date(2026, 2, 29, 23, 59);
    const next = new Date(2026, 2, 30, 0);
    expect(buildAttention([task(new Date(midnight.getTime() - 1).toISOString())], [], [], 6, midnight).overdueCount).toBe(1);
    expect(buildAttention([task(late.toISOString())], [], [], 6, midnight).todayCount).toBe(1);
    expect(buildAttention([task(next.toISOString())], [], [], 6, midnight).items).toEqual([]);
  });
  it.each(['2026-03-29T00:00:00', '2026-03-29T23:30:00', '2026-10-25T23:30:00'])('calendar day around DST %s', (iso) => {
    const local = new Date(iso); const tomorrow = new Date(local); tomorrow.setDate(tomorrow.getDate() + 1); tomorrow.setHours(0, 0, 0, 0);
    expect(buildAttention([task(tomorrow.toISOString())], [], [], 6, local).todayCount).toBe(0);
    expect(buildAttention([task(local.toISOString())], [], [], 6, local).todayCount).toBe(1);
  });
});
