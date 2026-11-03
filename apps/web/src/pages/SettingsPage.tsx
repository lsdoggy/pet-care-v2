import { useCallback, useState } from 'react'
import type { CSSProperties } from 'react'
import { api } from '../api/client'
import { tokenStore } from '../auth/tokenStore'
import { useAuth } from '../auth/useAuth'

/**
 * Sprint 6 — Settings page: Push On/Off and Email On/Off switches backed by
 * PATCH /api/v1/users/notification-settings. The updated UserDto is pushed
 * into the auth context so the whole app stays in sync.
 */
export default function SettingsPage() {
  const { user, setUser } = useAuth()
  const [saving, setSaving] = useState<'push' | 'email' | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [saved, setSaved] = useState(false)

  const toggle = useCallback(
    async (key: 'push' | 'email', value: boolean) => {
      if (!user) return
      setSaving(key)
      setError(null)
      setSaved(false)
      try {
        const token = tokenStore.get() ?? ''
        const pushEnabled = key === 'push' ? value : user.pushNotificationsEnabled
        const emailEnabled = key === 'email' ? value : user.emailNotificationsEnabled
        const updated = await api.updateNotificationSettings(pushEnabled, emailEnabled, token)
        setUser(updated)
        setSaved(true)
      } catch (e) {
        setError(e instanceof Error ? e.message : 'Failed to save settings')
      } finally {
        setSaving(null)
      }
    },
    [user, setUser],
  )

  if (!user) return null

  return (
    <main style={pageStyle}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <h1 style={{ fontSize: 26 }}>Settings</h1>
        <span style={{ color: '#6b7280', fontSize: 14 }}>{user.email}</span>
      </div>

      {error && <p style={{ color: '#c0392b' }}>{error}</p>}
      {saved && !error && <p style={{ color: '#16a34a' }}>Saved.</p>}

      <section style={cardStyle}>
        <h2 style={{ fontSize: 16, margin: 0 }}>Notifications</h2>

        <label style={rowStyle}>
          <span>
            <strong>Push notifications</strong>
            <br />
            <small style={hintStyle}>Care-task reminders on your registered mobile devices</small>
          </span>
          <input
            type="checkbox"
            checked={user.pushNotificationsEnabled}
            disabled={saving !== null}
            onChange={(e) => void toggle('push', e.target.checked)}
            style={{ width: 20, height: 20, accentColor: '#4f46e5', cursor: 'pointer' }}
          />
        </label>

        <label style={rowStyle}>
          <span>
            <strong>Email notifications</strong>
            <br />
            <small style={hintStyle}>Important events only (medication, vaccination)</small>
          </span>
          <input
            type="checkbox"
            checked={user.emailNotificationsEnabled}
            disabled={saving !== null}
            onChange={(e) => void toggle('email', e.target.checked)}
            style={{ width: 20, height: 20, accentColor: '#4f46e5', cursor: 'pointer' }}
          />
        </label>
      </section>
    </main>
  )
}

const pageStyle: CSSProperties = {
  maxWidth: 720,
  margin: '0 auto',
  padding: 24,
  fontFamily: 'system-ui, sans-serif',
}

const cardStyle: CSSProperties = {
  marginTop: 24,
  background: '#fff',
  border: '1px solid #e2e8f0',
  borderRadius: 12,
  padding: 20,
  display: 'flex',
  flexDirection: 'column',
  gap: 16,
}

const rowStyle: CSSProperties = {
  display: 'flex',
  justifyContent: 'space-between',
  alignItems: 'center',
  gap: 16,
  borderTop: '1px solid #f1f5f9',
  paddingTop: 12,
  cursor: 'pointer',
}

const hintStyle: CSSProperties = { color: '#6b7280' }
