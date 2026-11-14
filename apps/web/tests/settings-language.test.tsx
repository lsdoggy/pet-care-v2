import { cleanup, fireEvent, render, screen } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import { afterEach, expect, it, vi } from 'vitest'
import { LanguageProvider } from '../src/i18n/LanguageProvider'
import { LanguageSwitcher } from '../src/i18n/LanguageSwitcher'
import SettingsPage from '../src/pages/SettingsPage'

const { user, updateProfile } = vi.hoisted(() => ({
  user: { id: 1, email: 'owner@example.test', firstName: 'Анна', phone: '' },
  updateProfile: vi.fn(),
}))
vi.mock('../src/api/client', () => ({ api: { listPets: async () => [], updateProfile } }))
vi.mock('../src/auth/tokenStore', () => ({ tokenStore: { get: () => 'test-token' } }))
vi.mock('../src/auth/useAuth', () => ({
  useAuth: () => ({ user, loading: false, setUser: () => {}, logout: () => {} }),
}))

afterEach(() => {
  cleanup()
  localStorage.removeItem('petcare.language')
  document.documentElement.removeAttribute('lang')
})

it('changes a pending profile save confirmation to the active language', async () => {
  let finishSave: (value: typeof user) => void = () => {}
  updateProfile.mockImplementationOnce(() => new Promise<typeof user>((resolve) => { finishSave = resolve }))
  render(<LanguageProvider><MemoryRouter><LanguageSwitcher /><SettingsPage /></MemoryRouter></LanguageProvider>)

  fireEvent.click(screen.getByRole('button', { name: 'Сохранить изменения' }))
  fireEvent.change(screen.getByRole('combobox', { name: 'Язык' }), { target: { value: 'en' } })
  finishSave(user)
  expect(await screen.findByText('Profile saved')).toBeTruthy()

  fireEvent.change(screen.getByRole('combobox', { name: 'Language' }), { target: { value: 'ru' } })
  expect(screen.getByText('Данные профиля сохранены')).toBeTruthy()
})
