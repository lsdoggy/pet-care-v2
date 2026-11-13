import { createContext, useContext } from 'react';

export type Language = 'ru' | 'en';

export function languageForLocale(locale: string): Language {
  return locale.split(/[-_]/)[0].toLowerCase() === 'ru' ? 'ru' : 'en';
}

export const LanguageContext = createContext<Language>('ru');

export function useLanguage() {
  return useContext(LanguageContext);
}
