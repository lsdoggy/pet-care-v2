import { expect, it } from 'vitest';
import { languageForLocale } from '../src/i18n/language';

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
