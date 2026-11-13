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
  expect(screen.getByRole('alert').textContent).toContain('refresh failed')
  expect(fetchMock.mock.calls.filter(([, opts]) => opts.method === 'POST')).toHaveLength(1)
})
