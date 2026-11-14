import { createContext, useContext } from 'react'

export type Language = 'ru' | 'en'

export const LanguageContext = createContext<{
  language: Language
  setLanguage: (language: Language) => void
}>({ language: 'ru', setLanguage: () => {} })

export function useLanguage() {
  return useContext(LanguageContext)
}
