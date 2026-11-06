import { useState } from 'react'
import type { FormEvent } from 'react'
import { Navigate } from 'react-router-dom'
import { api } from '../api/client'
import { tokenStore } from '../auth/tokenStore'
import { useAuth } from '../auth/useAuth'
import '../styles/settings.css'

export default function SettingsPage() {
  const { user, loading, setUser, logout } = useAuth()
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [saved, setSaved] = useState<string | null>(null)

  async function saveProfile(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    const data = new FormData(event.currentTarget)
    await save(async () => {
      const updated = await api.updateProfile({
        firstName: String(data.get('firstName') ?? '').trim(),
        phone: String(data.get('phone') ?? '').trim(),
      }, tokenStore.get() ?? '')
      setUser(updated)
    }, 'Данные профиля сохранены')
  }

  async function save(action: () => Promise<void>, message: string) {
    setSaving(true)
    setError(null)
    setSaved(null)
    try {
      await action()
      setSaved(message)
    } catch {
      setError('Не удалось сохранить изменения. Проверьте соединение и попробуйте ещё раз.')
    } finally {
      setSaving(false)
    }
  }

  async function toggle(key: 'push' | 'email', value: boolean) {
    if (!user) return
    await save(async () => {
      const updated = await api.updateNotificationSettings(
        key === 'push' ? value : user!.pushNotificationsEnabled,
        key === 'email' ? value : user!.emailNotificationsEnabled,
        tokenStore.get() ?? '',
      )
      setUser(updated)
    }, 'Настройки уведомлений сохранены')
  }

  if (loading) return <p role="status">Загрузка профиля…</p>
  if (!user) return <Navigate to="/login" replace />

  return (
    <div className="pc-settings">
      <header>
        <h1>Профиль</h1>
        <p className="pc-settings__hint">Ваши данные и напоминания об уходе за питомцами</p>
      </header>
      {error && <p className="pc-settings__error" role="alert">{error}</p>}
      {saved && <p className="pc-settings__success" role="status">{saved}</p>}
      <section className="pc-settings__card" aria-labelledby="profile-data-title">
        <h2 id="profile-data-title">Личные данные</h2>
        <form onSubmit={(e) => void saveProfile(e)} className="pc-settings__form">
          <label>Имя
            <input name="firstName" autoComplete="given-name" defaultValue={user.firstName ?? ''} maxLength={80} placeholder="Как к вам обращаться" />
          </label>
          <label>Телефон <span className="pc-settings__hint">(необязательно)</span>
            <input name="phone" type="tel" autoComplete="tel" defaultValue={user.phone ?? ''} maxLength={20} pattern={String.raw`[+0-9 \(\)\-]{6,20}`} placeholder="+7 999 123-45-67" />
          </label>
          <label>Электронная почта
            <input value={user.email} readOnly autoComplete="email" />
          </label>
          <button className="pc-btn pc-btn--primary" disabled={saving} type="submit">{saving ? 'Сохранение…' : 'Сохранить изменения'}</button>
        </form>
      </section>
      <section className="pc-settings__card" aria-labelledby="profile-notifications-title" aria-busy={saving}>
        <h2 id="profile-notifications-title">Уведомления</h2>
        <label className="pc-settings__row">
          <span><strong>Push-уведомления</strong><small>Напоминания на мобильных устройствах, подключённых через приложение.</small></span>
          <input type="checkbox" role="switch" checked={user.pushNotificationsEnabled} disabled={saving} onChange={(e) => void toggle('push', e.target.checked)} />
        </label>
        <label className="pc-settings__row">
          <span><strong>Письма на почту</strong><small>Важные события: приём лекарств и вакцинация.</small></span>
          <input type="checkbox" role="switch" checked={user.emailNotificationsEnabled} disabled={saving} onChange={(e) => void toggle('email', e.target.checked)} />
        </label>
      </section>
      <section className="pc-settings__card" aria-labelledby="profile-session-title">
        <h2 id="profile-session-title">Аккаунт</h2>
        <p className="pc-settings__hint">Вы вошли как {user.email}</p>
        <button className="pc-btn" disabled={saving} type="button" onClick={logout}>Выйти из аккаунта</button>
      </section>
    </div>
  )
}
