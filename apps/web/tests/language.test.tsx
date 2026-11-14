import { cleanup, fireEvent, render, screen } from '@testing-library/react'
import { afterEach, expect, it } from 'vitest'
import { LanguageProvider } from '../src/i18n/LanguageProvider'
import { LanguageSwitcher } from '../src/i18n/LanguageSwitcher'

afterEach(() => {
  cleanup()
  localStorage.removeItem('petcare.language')
  document.documentElement.removeAttribute('lang')
})

it('switches the document language and restores the selection on remount', () => {
  const view = render(<LanguageProvider><LanguageSwitcher /></LanguageProvider>)
  fireEvent.change(screen.getByRole('combobox', { name: 'Язык' }), { target: { value: 'en' } })
  expect(document.documentElement.lang).toBe('en')
  view.unmount()

  render(<LanguageProvider><LanguageSwitcher /></LanguageProvider>)
  expect((screen.getByRole('combobox', { name: 'Language' }) as HTMLSelectElement).value).toBe('en')
})
