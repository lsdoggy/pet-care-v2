import { useLanguage } from '../i18n/language'
import { NavLink } from 'react-router-dom'

export interface NavTabDef {
  to: string
  label: { ru: string; en: string }
}

const tabs: NavTabDef[] = [
  { to: '/', label: { ru: 'Главная', en: 'Home' } },
  { to: '/stock', label: { ru: 'Запасы', en: 'Stock' } },
  { to: '/shopping', label: { ru: 'Покупки', en: 'Shopping' } },
]

/**
 * Sprint 5: top navigation between Home / Stock ("Запасы") / Shopping ("Купить").
 * The active tab is underlined; links use client-side routing (no full reload).
 */
export default function NavTabs() {
  const { language } = useLanguage()
  return (
    <nav style={navStyle} aria-label={language === 'ru' ? 'Основная навигация' : 'Main navigation'}>
      {tabs.map((tab) => (
        <NavLink
          key={tab.to}
          to={tab.to}
          end={tab.to === '/'}
          style={({ isActive }) => ({
            padding: '8px 14px',
            fontSize: 15,
            textDecoration: 'none',
            color: isActive ? '#2c3e50' : '#7f8c8d',
            fontWeight: isActive ? 700 : 500,
            borderBottom: isActive ? '2px solid #2c3e50' : '2px solid transparent',
          })}
        >
          {tab.label[language]}
        </NavLink>
      ))}
    </nav>
  )
}

const navStyle: React.CSSProperties = {
  display: 'flex',
  gap: 4,
  marginBottom: 20,
  borderBottom: '1px solid #ecf0f1',
}
