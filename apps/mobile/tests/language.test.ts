import { expect, it } from 'vitest';
import { languageForLocale } from '../src/i18n/language';
import { dueLabel, greetingForNow } from '../src/lib/dashboard';

it.each([
  ['ru', 'ru'],
  ['ru-RU', 'ru'],
  ['ru-KZ', 'ru'],
  ['en-US', 'en'],
  ['fr-FR', 'en'],
  ['', 'en'],
])('maps device locale %s to %s', (locale, expected) => {
  expect(languageForLocale(locale)).toBe(expected);
});

it('formats the same dashboard instant for both languages', () => {
  const now = new Date(2026, 10, 14, 9);
  expect(greetingForNow(now, 'ru')).toBe('Доброе утро');
  expect(greetingForNow(now, 'en')).toBe('Good morning');
  const tomorrow = new Date(2026, 10, 15, 10).toISOString();
  expect(dueLabel(tomorrow, now, 'ru')).toBe('Завтра');
  expect(dueLabel(tomorrow, now, 'en')).toBe('tomorrow');
});
