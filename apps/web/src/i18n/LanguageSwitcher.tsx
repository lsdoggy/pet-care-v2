import { useLanguage } from './language'

export function LanguageSwitcher() {
  const { language, setLanguage } = useLanguage()
  return (
    <select
      aria-label={language === 'ru' ? 'Язык' : 'Language'}
      value={language}
      onChange={(event) => setLanguage(event.target.value === 'en' ? 'en' : 'ru')}
    >
      <option lang="ru" value="ru">Русский</option>
      <option lang="en" value="en">English</option>
    </select>
  )
}
