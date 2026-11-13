import { afterEach, expect, it, vi } from 'vitest'
import { act, cleanup, fireEvent, render, screen } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import HomePage from '../src/pages/HomePage'

vi.mock('../src/auth/tokenStore', () => ({ tokenStore: { get: () => 'token' } }))
// Stable identity matters: auth normally provides one user snapshot.
vi.mock('../src/auth/useAuth', () => {
  const user = { email: 'test@example.com' }
  return { useAuth: () => ({ user, loading: false }) }
})
afterEach(() => { cleanup(); vi.useRealTimers(); vi.unstubAllGlobals() })

it('HomePage updates counts and explicit overdue feed at ticks/foreground with no reload', async () => {
  vi.useFakeTimers()
  const now = new Date(2026, 10, 13, 12).getTime()
  vi.setSystemTime(now)
  const fetchMock = vi.fn(async (url: string) => ({ ok: true, status: 200, json: async () => url.endsWith('/tasks/upcoming') ? [
    { id: 1, title: 'Кормление', petId: 1, petName: 'Кот', type: 'OTHER', status: 'PENDING', dueAt: new Date(now + 1).toISOString() },
    { id: 2, title: 'Готово', petId: 1, status: 'DONE', dueAt: new Date(now - 1).toISOString() },
  ] : [] }))
  vi.stubGlobal('fetch', fetchMock)
  await act(async () => { render(<MemoryRouter><HomePage /></MemoryRouter>) })
  expect(screen.getByText('Сегодня · 1')).toBeTruthy()
  expect(screen.queryByText('Готово')).toBeNull()
  act(() => vi.advanceTimersByTime(60000))
  expect(screen.getByText('Просрочено · 1')).toBeTruthy()
  expect(screen.queryByText('Сегодня · 1')).toBeNull()
  expect(screen.getAllByText(/Просрочено · сегодня/)).toHaveLength(2)
  expect(fetchMock).toHaveBeenCalledTimes(4)
  vi.setSystemTime(new Date(2026, 10, 14, 0, 1))
  act(() => window.dispatchEvent(new Event('focus')))
  expect(screen.getAllByText(/Просрочено · вчера/)).toHaveLength(2)
  expect(fetchMock).toHaveBeenCalledTimes(4)
})

it('keeps purchase input focus and selection through clock ticks and foreground updates', async () => {
  vi.useFakeTimers()
  vi.setSystemTime(new Date(2026, 10, 13, 12))
  vi.stubGlobal('fetch', vi.fn(async () => ({ ok: true, status: 200, json: async () => [] })))
  await act(async () => { render(<MemoryRouter><HomePage /></MemoryRouter>) })

  const opener = screen.getByRole('button', { name: 'Добавить покупку' })
  opener.focus()
  fireEvent.click(opener)
  const name = screen.getByLabelText('Название *') as HTMLInputElement
  const quantity = screen.getByLabelText('Количество (шт.)') as HTMLInputElement
  expect(document.activeElement).toBe(name)
  fireEvent.change(name, { target: { value: 'Корм' } })
  fireEvent.change(quantity, { target: { value: '12' } })
  quantity.focus()
  quantity.setSelectionRange(1, 1)

  act(() => vi.advanceTimersByTime(60_000))
  expect(document.activeElement).toBe(quantity)
  expect(quantity.selectionStart).toBe(1)
  expect(quantity.selectionEnd).toBe(1)

  vi.setSystemTime(new Date(2026, 10, 13, 12, 2))
  act(() => window.dispatchEvent(new Event('focus')))
  expect(document.activeElement).toBe(quantity)
  expect(quantity.selectionStart).toBe(1)
  expect(quantity.selectionEnd).toBe(1)
  expect(name.value).toBe('Корм')
  expect(quantity.value).toBe('12')

  fireEvent.keyDown(document, { key: 'Escape' })
  expect(screen.queryByRole('dialog')).toBeNull()
  expect(document.activeElement).toBe(opener)
})

it('successful custom purchase closes even if dashboard refresh fails; no second POST', async () => {
  let requests = 0
  const fetchMock = vi.fn(async (url: string, options: RequestInit) => {
    if (options.method === 'POST') return { ok: true, status: 200, json: async () => ({ id: 1, status: 'OPEN' }) }
    requests++
    if (requests > 4) throw new Error('refresh failed')
    return { ok: true, status: 200, json: async () => [] }
  })
  vi.stubGlobal('fetch', fetchMock)
  await act(async () => { render(<MemoryRouter><HomePage /></MemoryRouter>) })
  fireEvent.click(screen.getByRole('button', { name: 'Добавить покупку' }))
  fireEvent.change(screen.getByLabelText('Название *'), { target: { value: 'Корм' } })
  await act(async () => fireEvent.click(screen.getByRole('button', { name: 'Добавить' })))
  expect(screen.queryByRole('dialog')).toBeNull()
  expect(screen.getByRole('alert').textContent).toContain('Не удалось загрузить питомцев')
  expect(fetchMock.mock.calls.filter(([, opts]) => opts.method === 'POST')).toHaveLength(1)
})
