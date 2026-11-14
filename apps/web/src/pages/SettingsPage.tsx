import { useLanguage, type Language } from '../i18n/language'
import { useEffect, useState } from 'react'
import type { FormEvent } from 'react'
import { Link, Navigate } from 'react-router-dom'
import type { PetDto } from '../api/types'
import { api } from '../api/client'
import { tokenStore } from '../auth/tokenStore'
import { useAuth } from '../auth/useAuth'
import ConfirmDialog from '../components/ConfirmDialog'
import '../styles/settings.css'

export default function SettingsPage() {
  const { language } = useLanguage()
  const { user, loading, setUser, logout } = useAuth()
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<Record<Language, string> | null>(null)
  const [saved, setSaved] = useState<Record<Language, string> | null>(null)

  const [confirmDeactivation, setConfirmDeactivation] = useState(false)
  const [pets, setPets] = useState<PetDto[] | null>(null)
  const [petsError, setPetsError] = useState(false)
  const [petsAttempt, setPetsAttempt] = useState(0)
  const userId = user?.id

  useEffect(() => {
    const token = tokenStore.get()
    if (userId == null || !token) return
    let active = true
    api.listPets(token).then(
      (items) => { if (active) setPets(items) },
      () => { if (active) setPetsError(true) },
    )
    return () => { active = false }
  }, [userId, petsAttempt])

  async function saveProfile(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    const data = new FormData(event.currentTarget)
    await save(async () => {
      const updated = await api.updateProfile({
        firstName: String(data.get('firstName') ?? '').trim(),
        phone: String(data.get('phone') ?? '').trim(),
      }, tokenStore.get() ?? '')
      setUser(updated)
    }, { ru: 'Данные профиля сохранены', en: 'Profile saved' })
  }

  async function save(action: () => Promise<void>, message: Record<Language, string>) {
    setSaving(true)
    setError(null)
    setSaved(null)
    try {
      await action()
      setSaved(message)
    } catch {
      setError({ ru: 'Не удалось сохранить изменения. Проверьте соединение и попробуйте ещё раз.', en: 'Could not save changes. Check your connection and try again.' })
    } finally {
      setSaving(false)
    }
  }

  async function deactivateAccount() {
    setSaving(true)
    setError(null)
    setSaved(null)
    try {
      await api.deactivateAccount(tokenStore.get() ?? '')
      logout()
    } catch {
      setError({ ru: 'Не удалось деактивировать аккаунт. Попробуйте позже.', en: 'Could not deactivate the account. Try again later.' })
    } finally {
      setSaving(false)
      setConfirmDeactivation(false)
    }
  }

  async function toggle(key: 'push' | 'email' | 'hour' | 'day' | 'overdue' | 'lowStock', value: boolean) {
    if (!user) return
    await save(async () => {
      const updated = await api.updateNotificationSettings(
        key === 'push' ? value : user!.pushNotificationsEnabled,
        key === 'email' ? value : user.emailNotificationsEnabled,
        tokenStore.get() ?? '',
        {
          hourReminderEnabled: key === 'hour' ? value : undefined,
          dayReminderEnabled: key === 'day' ? value : undefined,
          overdueReminderEnabled: key === 'overdue' ? value : undefined,
          lowStockNotificationEnabled: key === 'lowStock' ? value : undefined,
        },
      )
      setUser(updated)
    }, { ru: 'Настройки уведомлений сохранены', en: 'Notification settings saved' })
  }

  if (loading) return <p role="status">{language === 'ru' ? 'Загрузка профиля…' : 'Loading profile…'}</p>
  if (!user) return <Navigate to="/login" replace />

  return (
    <div className="pc-settings">
      <header>
        <h1>{language === 'ru' ? 'Профиль' : 'Profile'}</h1>
        <p className="pc-settings__hint">{language === 'ru' ? 'Ваши данные и напоминания об уходе за питомцами' : 'Your information and pet care reminders'}</p>
      </header>
      {error && <p className="pc-settings__error" role="alert">{error[language]}</p>}
      {saved && <p className="pc-settings__success" role="status">{saved[language]}</p>}
      <section className="pc-settings__card" aria-labelledby="profile-data-title">
        <h2 id="profile-data-title">{language === 'ru' ? 'Личные данные' : 'Personal information'}</h2>
        <form onSubmit={(e) => void saveProfile(e)} className="pc-settings__form">
          <label>{language === 'ru' ? 'Имя' : 'First name'}
            <input name="firstName" autoComplete="given-name" defaultValue={user.firstName ?? ''} maxLength={80} placeholder={language === 'ru' ? 'Как к вам обращаться' : 'What should we call you?'} />
          </label>
          <label>{language === 'ru' ? 'Телефон' : 'Phone'} <span className="pc-settings__hint">{language === 'ru' ? '(необязательно)' : '(optional)'}</span>
            <input name="phone" type="tel" autoComplete="tel" defaultValue={user.phone ?? ''} maxLength={20} pattern={String.raw`[+0-9 \(\)\-]{6,20}`} placeholder="+7 999 123-45-67" />
          </label>
          <label>{language === 'ru' ? 'Электронная почта' : 'Email'}
            <input value={user.email} readOnly autoComplete="email" />
          </label>
          <button className="pc-btn pc-btn--primary" disabled={saving} type="submit">{saving ? (language === 'ru' ? 'Сохранение…' : 'Saving…') : (language === 'ru' ? 'Сохранить изменения' : 'Save changes')}</button>
        </form>
      </section>
      <section className="pc-settings__card" aria-labelledby="profile-pets-title">
        <h2 id="profile-pets-title">{language === 'ru' ? 'Питомцы' : 'Pets'}</h2>
        {petsError ? (
          <div>
            <p role="alert">{language === 'ru' ? 'Не удалось загрузить питомцев.' : 'Could not load your pets.'}</p>
            <button className="pc-btn" type="button" onClick={() => {
              setPetsError(false)
              setPetsAttempt((attempt) => attempt + 1)
            }}>{language === 'ru' ? 'Повторить' : 'Retry'}</button>
          </div>
        ) : pets === null ? <p role="status">{language === 'ru' ? 'Загрузка питомцев…' : 'Loading pets…'}</p>
          : pets.length === 0 ? <p>{language === 'ru' ? 'У вас пока нет питомцев.' : 'You don’t have any pets yet.'}</p>
          : <ul>{pets.map((pet) => <li key={pet.id}><Link to={`/pets/${pet.id}`}>{pet.name}</Link></li>)}</ul>}
      </section>
      <section className="pc-settings__card" aria-labelledby="profile-notifications-title" aria-busy={saving}>
        <h2 id="profile-notifications-title">{language === 'ru' ? 'Уведомления' : 'Notifications'}</h2>
        <label className="pc-settings__row">
          <span><strong>{language === 'ru' ? 'Push-уведомления' : 'Push notifications'}</strong><small>{language === 'ru' ? 'Напоминания на мобильных устройствах, подключённых через приложение.' : 'Reminders on mobile devices linked through the app.'}</small></span>
          <input type="checkbox" role="switch" checked={user.pushNotificationsEnabled} disabled={saving} onChange={(e) => void toggle('push', e.target.checked)} />
        </label>
        <label className="pc-settings__row">
          <span><strong>{language === 'ru' ? 'Письма на почту' : 'Email notifications'}</strong><small>{language === 'ru' ? 'Напоминания о лекарствах, вакцинации и низком остатке корма.' : 'Reminders for medications, vaccinations, and low food stock.'}</small></span>
          <input type="checkbox" role="switch" checked={user.emailNotificationsEnabled} disabled={saving} onChange={(e) => void toggle('email', e.target.checked)} />
        </label>
        <label className="pc-settings__row">
          <span><strong>{language === 'ru' ? 'Напоминания за час' : 'One-hour reminders'}</strong><small>{language === 'ru' ? 'Уведомления о предстоящих задачах ухода.' : 'Notifications for upcoming care tasks.'}</small></span>
          <input type="checkbox" role="switch" checked={user.hourReminderEnabled ?? true} disabled={saving} onChange={(e) => void toggle('hour', e.target.checked)} />
        </label>
        <label className="pc-settings__row">
          <strong>{language === 'ru' ? 'Напоминания за день' : 'One-day reminders'}</strong>
          <input type="checkbox" role="switch" checked={user.dayReminderEnabled ?? false} disabled={saving} onChange={(e) => void toggle('day', e.target.checked)} />
        </label>
        <label className="pc-settings__row">
          <strong>{language === 'ru' ? 'Просроченные задачи' : 'Overdue tasks'}</strong>
          <input type="checkbox" role="switch" checked={user.overdueReminderEnabled ?? false} disabled={saving} onChange={(e) => void toggle('overdue', e.target.checked)} />
        </label>
        <label className="pc-settings__row">
          <strong>{language === 'ru' ? 'Низкий остаток корма' : 'Low food stock'}</strong>
          <input type="checkbox" role="switch" checked={user.lowStockNotificationEnabled ?? false} disabled={saving} onChange={(e) => void toggle('lowStock', e.target.checked)} />
        </label>
      </section>
      <section className="pc-settings__card" aria-labelledby="profile-session-title">
        <h2 id="profile-session-title">{language === 'ru' ? 'Аккаунт' : 'Account'}</h2>
        <p className="pc-settings__hint">{language === 'ru' ? 'Вы вошли как' : 'Signed in as'} {user.email}</p>
        <button className="pc-btn" disabled={saving} type="button" onClick={logout}>{language === 'ru' ? 'Выйти из аккаунта' : 'Sign out'}</button>
        <button className="pc-btn pc-btn--danger" disabled={saving} type="button" onClick={() => setConfirmDeactivation(true)}>{language === 'ru' ? 'Деактивировать аккаунт' : 'Deactivate account'}</button>
      </section>
      {confirmDeactivation && (
        <ConfirmDialog
          titleId="deactivate-account-title"
          title={language === 'ru' ? 'Деактивировать аккаунт?' : 'Deactivate account?'}
          description={language === 'ru' ? 'Вы выйдете из аккаунта на всех устройствах. Данные сохранятся, а ссылка для восстановления придёт на вашу почту.' : 'You will be signed out on all devices. Your data will be kept, and you will receive a recovery link by email.'}
          confirmLabel={language === 'ru' ? 'Деактивировать' : 'Deactivate'}
          busy={saving}
          onCancel={() => setConfirmDeactivation(false)}
          onConfirm={deactivateAccount}
        />
      )}
    </div>
  )
}
