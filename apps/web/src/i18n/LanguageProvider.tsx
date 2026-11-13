import { useEffect, useState, type ReactNode } from 'react'
import { LanguageContext, type Language } from './language'

const storageKey = 'petcare.language'

function initialLanguage(): Language {
  try {
    return localStorage.getItem(storageKey) === 'en' ? 'en' : 'ru'
  } catch {
    return 'ru'
  }
}

export function LanguageProvider({ children }: { children: ReactNode }) {
  const [language, setLanguage] = useState(initialLanguage)

  useEffect(() => {
    document.documentElement.lang = language
    document.title = language === 'ru' ? 'Pet Care — уход за питомцами' : 'Pet Care — pet care app'
    try {
      localStorage.setItem(storageKey, language)
    } catch {
      // The current selection still works when browser storage is unavailable.
    }
  }, [language])

  return <LanguageContext.Provider value={{ language, setLanguage }}>{children}</LanguageContext.Provider>
}
