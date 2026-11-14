import { cleanup, fireEvent, render, screen } from '@testing-library/react'
import { afterEach, expect, it } from 'vitest'
import { LanguageProvider } from '../src/i18n/LanguageProvider'
import { LanguageSwitcher } from '../src/i18n/LanguageSwitcher'

import { notificationText } from '../src/i18n/notificationText'
import type { NotificationDto } from '../src/api/types'
import AppointmentFormModal from '../src/components/AppointmentFormModal'
import ProductFormModal from '../src/components/ProductFormModal'
import { useLanguage } from '../src/i18n/language'
import { localizeAuthError, validateEmail } from '../src/validation/auth'

function ValidationMessage() {
  const { language } = useLanguage()
  const message = validateEmail('')
  return <p>{message && localizeAuthError(message, language)}</p>
}
afterEach(() => {
  cleanup()
  localStorage.removeItem('petcare.language')
  document.documentElement.removeAttribute('lang')
})

it('switches the document language and restores the selection on remount', () => {
  const view = render(<LanguageProvider><LanguageSwitcher /></LanguageProvider>)
  expect(screen.getAllByRole('option').map((option) => option.textContent)).toEqual(['ru', 'en'])
  fireEvent.change(screen.getByRole('combobox', { name: 'Язык' }), { target: { value: 'en' } })
  expect(document.documentElement.lang).toBe('en')
  view.unmount()

  render(<LanguageProvider><LanguageSwitcher /></LanguageProvider>)
  expect((screen.getByRole('combobox', { name: 'Language' }) as HTMLSelectElement).value).toBe('en')
})

it('changes an existing validation message together with the selected language', () => {
  render(<LanguageProvider><LanguageSwitcher /><ValidationMessage /></LanguageProvider>)
  expect(screen.getByText('Укажите электронную почту.')).toBeTruthy()
  fireEvent.change(screen.getByRole('combobox', { name: 'Язык' }), { target: { value: 'en' } })
  expect(screen.getByText('Enter your email address.')).toBeTruthy()
  fireEvent.change(screen.getByRole('combobox', { name: 'Language' }), { target: { value: 'ru' } })
  expect(screen.getByText('Укажите электронную почту.')).toBeTruthy()
})

it('switches an open appointment form without resetting the input', () => {
  render(
    <LanguageProvider>
      <LanguageSwitcher />
      <AppointmentFormModal petId={1} token="test-token" onClose={() => {}} onSaved={() => {}} />
    </LanguageProvider>,
  )
  fireEvent.click(screen.getByRole('button', { name: 'Сохранить' }))
  expect(screen.getByRole('alert').textContent).toBe('Укажите название клиники')
  fireEvent.change(screen.getByLabelText('Клиника *'), { target: { value: 'Ветцентр' } })
  fireEvent.change(screen.getByRole('combobox', { name: 'Язык' }), { target: { value: 'en' } })
  expect(screen.getByRole('heading', { name: 'Book a vet visit' })).toBeTruthy()
  expect(screen.getByRole('alert').textContent).toBe('Enter the clinic name.')
  expect((screen.getByLabelText('Clinic *') as HTMLInputElement).value).toBe('Ветцентр')
  expect(screen.getByRole('option', { name: 'Scheduled' })).toBeTruthy()
})

it('localizes structured feed notifications and preserves legacy text', () => {
  const legacy: NotificationDto = {
    id: 1, type: 'push', channelStatus: 'sent', title: 'Legacy', body: 'Saved text',
    payloadJson: '{invalid', createdAt: '2026-11-14T00:00:00Z', sentAt: null,
  }
  expect(notificationText(legacy, 'ru')).toEqual({ title: 'Legacy', body: 'Saved text' })
  const lowStock = { ...legacy, payloadJson: JSON.stringify({ type: 'low_stock', productName: 'Лакомство' }) }
  expect(notificationText(lowStock, 'ru').title).toBe('Мало корма')
  expect(notificationText(lowStock, 'en')).toEqual({
    title: 'Low food stock',
    body: '“Лакомство” has reached its reorder threshold.',
  })
})

it('localizes the new product dialog in both languages', () => {
  render(
    <LanguageProvider>
      <LanguageSwitcher />
      <ProductFormModal submitting={false} onSubmit={() => {}} onClose={() => {}} />
    </LanguageProvider>,
  )
  expect(screen.getByRole('heading', { name: 'Новый товар' })).toBeTruthy()
  expect(screen.getByRole('button', { name: 'Отмена' })).toBeTruthy()
  expect(screen.getByRole('button', { name: 'Сохранить' })).toBeTruthy()

  fireEvent.change(screen.getByRole('combobox', { name: 'Язык' }), { target: { value: 'en' } })
  expect(screen.getByRole('heading', { name: 'New product' })).toBeTruthy()
  expect(screen.getByRole('button', { name: 'Cancel' })).toBeTruthy()
  expect(screen.getByRole('button', { name: 'Save' })).toBeTruthy()
})
