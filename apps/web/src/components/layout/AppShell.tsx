import { LanguageSwitcher } from '../../i18n/LanguageSwitcher'
import { useLanguage, type Language } from '../../i18n/language'
import { NavLink, Outlet } from 'react-router-dom'
import { useAuth } from '../../auth/useAuth'
import { BoxIcon, CartIcon, GearIcon, HomeIcon, PawIcon } from '../icons'
import '../../styles/appshell.css'

interface NavItem {
  to: string
  label: Record<Language, string>
  icon: typeof HomeIcon
}

/**
 * Design Sprint 0 layout shell.
 * - Mobile-first: sticky header + fixed bottom tab bar (placeholder nav).
 * - Desktop (>=768px): left sidebar + header, bottom bar hidden.
 * Pages render through <Outlet/>; existing routes/pages are untouched.
 */
const NAV_ITEMS: NavItem[] = [
  { to: '/', label: { ru: 'Главная', en: 'Home' }, icon: HomeIcon },
  { to: '/stock', label: { ru: 'Запасы', en: 'Stock' }, icon: BoxIcon },
  { to: '/shopping', label: { ru: 'Купить', en: 'Shopping' }, icon: CartIcon },
  { to: '/settings', label: { ru: 'Профиль', en: 'Profile' }, icon: GearIcon },
]

export default function AppShell() {
  const { language } = useLanguage()
  const navigationLabel = language === 'ru' ? 'Основная навигация' : 'Main navigation'
  const { user } = useAuth()

  return (
    <div className="pc-shell">
      <a href="#pc-main" className="pc-skip-link sr-only">
        {language === 'ru' ? 'Перейти к содержимому' : 'Skip to content'}
      </a>

      {/* ---------- Sidebar (desktop only) ---------- */}
      <nav className="pc-sidebar" aria-label={navigationLabel}>
        <span className="pc-header__brand" style={{ padding: '0 var(--space-3) var(--space-4)' }}>
          <span className="pc-header__brand-icon">
            <PawIcon size={22} />
          </span>
          Pet Care
        </span>
        <span className="pc-sidebar__title">{language === 'ru' ? 'Разделы' : 'Sections'}</span>
        {NAV_ITEMS.map((item) => (
          <NavLink
            key={item.to}
            to={item.to}
            end={item.to === '/'}
            className={({ isActive }) =>
              `pc-sidebar__link${isActive ? ' pc-sidebar__link--active' : ''}`
            }
          >
            <item.icon size={18} />
            {item.label[language]}
          </NavLink>
        ))}
      </nav>

      <div className="pc-main">
        {/* ---------- Header ---------- */}
        <header className="pc-header">
          <span className="pc-header__brand-icon" aria-hidden="true">
            <PawIcon size={20} />
          </span>
          <span className="pc-header__brand" style={{ fontSize: 'var(--font-size-md)' }}>
            Pet Care
          </span>
          <span className="pc-header__spacer" />
          <LanguageSwitcher />
          {user && (
            <span className="pc-header__user" title={user.email}>
              {user.email}
            </span>
          )}
        </header>

        {/* ---------- Content ---------- */}
        <main id="pc-main" className="pc-shell__content">
          <Outlet />
        </main>
      </div>

      {/* ---------- Bottom navigation (mobile only) ---------- */}
      <nav className="pc-bottom-nav" aria-label={navigationLabel}>
        {NAV_ITEMS.map((item) => (
          <NavLink
            key={item.to}
            to={item.to}
            end={item.to === '/'}
            className={({ isActive }) =>
              `pc-bottom-nav__item${isActive ? ' pc-bottom-nav__item--active' : ''}`
            }
          >
            <item.icon size={20} />
            {item.label[language]}
          </NavLink>
        ))}
      </nav>
    </div>
  )
}
