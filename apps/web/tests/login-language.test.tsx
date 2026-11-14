import { cleanup, fireEvent, render, screen } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import { afterEach, expect, it, vi } from 'vitest'
import { ApiError } from '../src/api/client'
import { LanguageProvider } from '../src/i18n/LanguageProvider'
import AuthPage from '../src/pages/AuthPage'

const { login } = vi.hoisted(() => ({ login: vi.fn() }))
vi.mock('../src/auth/useAuth', () => ({
  useAuth: () => ({ user: null, loading: false, login }),
}))

afterEach(() => {
  cleanup()
  localStorage.removeItem('petcare.language')
  document.documentElement.removeAttribute('lang')
})

it.each([
  [401, 'Invalid email or password', 'Incorrect email address or password. Try again.', 'Неверная почта или пароль. Проверьте данные и попробуйте ещё раз.'],
  [500, 'Внутренняя ошибка', 'The request failed. Try again.', 'Запрос не выполнен. Попробуйте ещё раз.'],
])('localizes a login failure with HTTP status %s', async (status, message, english, russian) => {
  localStorage.setItem('petcare.language', 'en')
  login.mockRejectedValueOnce(new ApiError(status, message))
  const { container } = render(<LanguageProvider><MemoryRouter><AuthPage mode="login" /></MemoryRouter></LanguageProvider>)

  fireEvent.change(container.querySelector('#email')!, { target: { value: 'owner@example.test' } })
  fireEvent.change(container.querySelector('#password')!, { target: { value: 'password123' } })
  fireEvent.submit(container.querySelector('form')!)

  expect(await screen.findByText(english)).toBeTruthy()
  fireEvent.change(screen.getByRole('combobox', { name: 'Language' }), { target: { value: 'ru' } })
  expect(screen.getByText(russian)).toBeTruthy()
})
