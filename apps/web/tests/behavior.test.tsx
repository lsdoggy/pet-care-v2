import { afterEach, describe, expect, it, vi } from 'vitest'
import { act, cleanup, fireEvent, render, screen } from '@testing-library/react'
import { classifyTask, buildUpcomingEvents, taskComparator, nextVisit, lowStockProducts } from '../src/lib/dashboard'
import { validateQuickPurchase } from '../src/lib/quickPurchase'
import { useDashboardNow } from '../src/lib/useDashboardNow'
import QuickAddPurchaseModal from '../src/components/QuickAddPurchaseModal'
import type { CareTaskDto, FoodProductDto, VetAppointmentDto } from '../src/api/types'

const now = Date.parse('2026-11-13T12:00:00+03:00')
const task = (at: number, status = 'PENDING') => ({ id: at, dueAt: new Date(at).toISOString(), status } as CareTaskDto)
afterEach(() => { cleanup(); vi.useRealTimers(); vi.unstubAllGlobals() })

it('preserves low-stock API flag and seven-day nearest scheduled visit horizon', () => {
  const visit = (days: number, status = 'SCHEDULED') => ({ id: days, scheduledAt: new Date(now + days * 86400000).toISOString(), status } as VetAppointmentDto)
  expect(nextVisit([visit(8), visit(1, 'CANCELLED')], 7, now)).toBeNull()
  expect(nextVisit([visit(7), visit(4)], 7, now)?.id).toBe(4)
  expect(nextVisit([visit(7)], 7, now)?.id).toBe(7)
  expect(lowStockProducts([{ id: 1, lowStock: true }, { id: 2, lowStock: false }] as FoodProductDto[]).map((p) => p.id)).toEqual([1])
})

describe('classification parity', () => {
  it('uses strict epoch boundary and excludes DONE', () => {
    expect(classifyTask(task(now - 1), now)).toBe('overdue')
    expect(classifyTask(task(now), now)).toBe('today')
    expect(classifyTask(task(now + 1), now)).toBe('today')
    expect(classifyTask(task(now - 86400000), now)).toBe('overdue')
    expect(classifyTask(task(now + 86400000), now)).toBe('upcoming')
    expect(classifyTask(task(now - 1, 'DONE'), now)).toBeNull()
    expect(taskComparator(task(now), task(now - 1), now)).toBeGreaterThan(0)
    expect(buildUpcomingEvents([task(now - 1), task(now, 'DONE')], [], now)).toHaveLength(1)
  })
  it('compares calendar dates at local midnight and DST without 24h day threshold', () => {
    const midnight = new Date(2026, 2, 29, 0, 0).getTime()
    expect(classifyTask(task(midnight - 1), midnight)).toBe('overdue')
    expect(classifyTask(task(new Date(2026, 2, 29, 23, 59).getTime()), midnight)).toBe('today')
    expect(classifyTask(task(new Date(2026, 2, 30, 0, 0).getTime()), midnight)).toBe('upcoming')
    expect(classifyTask({ ...task(now), dueAt: '2026-11-13T10:00:00+01:00' }, now)).toBe('today')
  })
})

it('validates all purchase boundaries without rounding', () => {
  for (const name of ['', ' '.repeat(3), 'a'.repeat(151)]) expect(validateQuickPurchase(name, '1').error).toBeTruthy()
  for (const quantity of ['', 'x', '0', '1000', '1.5', '1,5', 'Infinity']) expect(validateQuickPurchase('a', quantity).error).toBeTruthy()
  for (const name of ['a', 'a'.repeat(150)]) for (const quantity of ['1', '999']) expect(validateQuickPurchase(name, quantity).body).toEqual({ customName: name, quantity: Number(quantity), unit: 'PCS' })
  expect(validateQuickPurchase('  Наполнитель  ', '1').body?.customName).toBe('Наполнитель')
})

it('POST shopping only; synchronous guard, disabled, reset and cancellation', async () => {
  let resolve!: (value: unknown) => void
  const fetchMock = vi.fn(() => new Promise((r) => { resolve = r }))
  vi.stubGlobal('fetch', fetchMock)
  const close = vi.fn(); const saved = vi.fn()
  const view = render(<QuickAddPurchaseModal token="token" onClose={close} onSaved={saved} />)
  fireEvent.change(screen.getByLabelText('Название *'), { target: { value: '  Наполнитель  ' } })
  const form = screen.getByRole('button', { name: 'Добавить' }).closest('form')!
  fireEvent.submit(form); fireEvent.submit(form)
  fireEvent.keyDown(document, { key: 'Escape' })
  expect(close).not.toHaveBeenCalled()
  expect(screen.getByRole('button', { name: 'Сохранение…' }).hasAttribute('disabled')).toBe(true)
  expect(fetchMock).toHaveBeenCalledTimes(1)
  expect(fetchMock.mock.calls[0]).toEqual(['/api/v1/shopping-list/items', expect.objectContaining({ method: 'POST', body: JSON.stringify({ customName: 'Наполнитель', quantity: 1, unit: 'PCS' }) })])
  await act(async () => resolve({ ok: true, status: 200, json: async () => ({ id: 1 }) }))
  expect(close).toHaveBeenCalledTimes(1); expect(saved).toHaveBeenCalledTimes(1)
  expect((screen.getByLabelText('Название *') as HTMLInputElement).value).toBe('')
  expect((screen.getByLabelText('Количество (шт.)') as HTMLInputElement).value).toBe('1')
  view.unmount()
  render(<QuickAddPurchaseModal token="token" onClose={close} onSaved={saved} />)
  fireEvent.click(screen.getByRole('button', { name: 'Отмена' }))
  expect(fetchMock).toHaveBeenCalledTimes(1)
})

it('invalid submit makes no request; POST error preserves fields and permits retry', async () => {
  const fetchMock = vi.fn().mockRejectedValueOnce(new Error('offline')).mockResolvedValue({ ok: true, status: 200, json: async () => ({ id: 1 }) })
  vi.stubGlobal('fetch', fetchMock)
  const saved = vi.fn()
  render(<QuickAddPurchaseModal token="token" onClose={vi.fn()} onSaved={saved} />)
  fireEvent.click(screen.getByRole('button', { name: 'Добавить' }))
  expect(fetchMock).not.toHaveBeenCalled()
  fireEvent.change(screen.getByLabelText('Название *'), { target: { value: 'Корм' } })
  fireEvent.change(screen.getByLabelText('Количество (шт.)'), { target: { value: '999' } })
  await act(async () => fireEvent.click(screen.getByRole('button', { name: 'Добавить' })))
  expect(screen.getByRole('alert').textContent).toBe('offline')
  expect((screen.getByLabelText('Название *') as HTMLInputElement).value).toBe('Корм')
  expect((screen.getByLabelText('Количество (шт.)') as HTMLInputElement).value).toBe('999')
  await act(async () => fireEvent.click(screen.getByRole('button', { name: 'Добавить' })))
  expect(fetchMock).toHaveBeenCalledTimes(2); expect(saved).toHaveBeenCalledTimes(1)
})

it('clock ticks, focus and visibility refresh and cleans resources without fetching', () => {
  vi.useFakeTimers(); vi.setSystemTime(now)
  const fetchMock = vi.fn(); vi.stubGlobal('fetch', fetchMock)
  function Clock() { const value = useDashboardNow(); return <span>{classifyTask(task(now + 1), value)}:{value}</span> }
  const view = render(<Clock />)
  expect(screen.getByText(`today:${now}`)).toBeTruthy()
  act(() => vi.advanceTimersByTime(60000))
  expect(screen.getByText(`overdue:${now + 60000}`)).toBeTruthy()
  vi.setSystemTime(new Date(2026, 10, 14, 0, 1))
  act(() => window.dispatchEvent(new Event('focus')))
  expect(screen.getByText(`overdue:${Date.now()}`)).toBeTruthy()
  vi.setSystemTime(now)
  act(() => document.dispatchEvent(new Event('visibilitychange')))
  expect(screen.getByText(`today:${now}`)).toBeTruthy()
  view.unmount()
  expect(vi.getTimerCount()).toBe(0)
  expect(fetchMock).not.toHaveBeenCalled()
})
