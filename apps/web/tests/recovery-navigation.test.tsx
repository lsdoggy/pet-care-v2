import { act, cleanup, fireEvent, render, screen } from '@testing-library/react'
import { afterEach, expect, it, vi } from 'vitest'
import App from '../src/App'
import { api } from '../src/api/client'

afterEach(() => {
  cleanup()
  vi.restoreAllMocks()
  localStorage.clear()
  window.history.replaceState(null, '', '/')
})

const first = 'a'.repeat(64)
const second = 'b'.repeat(64)

it.each(['/reset-password', '/restore-account'])('isolates consecutive links on %s', async route => {
  const reset = route === '/reset-password'
  const pending = Promise.withResolvers<void>()
  const send = vi.spyOn(api, reset ? 'resetPassword' : 'restoreAccount')
    .mockReturnValueOnce(pending.promise).mockResolvedValueOnce(undefined)
  localStorage.setItem('petcare.language', 'en')
  window.history.replaceState(null, '', route + '#' + first)
  render(<App />)
  const button = () => screen.getByRole('button', { name: reset ? 'Save password' : 'Restore account' })
  const password = () => screen.getByLabelText<HTMLInputElement>('New password')
  expect(send).not.toHaveBeenCalled()
  if (reset) fireEvent.change(password(), { target: { value: 'first-passphrase' } })
  fireEvent.click(button())
  expect(send.mock.calls).toEqual([reset ? [first, 'first-passphrase'] : [first]])

  act(() => {
    window.history.pushState(null, '', route + '?source=test#' + second)
    window.dispatchEvent(new PopStateEvent('popstate'))
  })
  expect((button() as HTMLButtonElement).disabled).toBe(false)
  if (reset) expect(password().value).toBe('')
  await act(async () => { pending.resolve() })
  expect(window.location.hash).toBe('#' + second)
  expect(screen.queryByRole('status')).toBeNull()
  expect(send).toHaveBeenCalledTimes(1)

  if (reset) fireEvent.change(password(), { target: { value: 'second-passphrase' } })
  fireEvent.click(button())
  expect(await screen.findByRole('status')).toBeTruthy()
  expect(send.mock.lastCall).toEqual(reset ? [second, 'second-passphrase'] : [second])
  expect(window.location.hash).toBe('')
  expect(window.location.search).toBe('')
})
