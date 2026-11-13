import { useState } from 'react'
import { Link, useLocation } from 'react-router-dom'
import { api } from '../api/client'
import '../styles/settings.css'

export default function RestoreAccountPage() {
  const { hash } = useLocation()
  const token = hash.slice(1)
  const [status, setStatus] = useState<'idle' | 'pending' | 'restored' | 'failed'>('idle')

  async function restore() {
    setStatus('pending')
    try {
      await api.restoreAccount(token)
      window.history.replaceState(window.history.state, '', window.location.pathname)
      setStatus('restored')
    } catch {
      setStatus('failed')
    }
  }

  const validLink = /^[0-9a-f]{64}$/.test(token)

  return (
    <main className="pc-settings">
      <section className="pc-settings__card">
        <h1>Восстановление аккаунта</h1>
        {status === 'restored' ? (
          <p role="status">Аккаунт восстановлен. Теперь можно войти.</p>
        ) : validLink ? (
          <button className="pc-btn pc-btn--primary" disabled={status === 'pending'} onClick={() => void restore()}>
            {status === 'pending' ? 'Восстановление…' : 'Восстановить аккаунт'}
          </button>
        ) : <p role="alert">Ссылка для восстановления недействительна.</p>}
        {status === 'failed' && <p role="alert">Не удалось восстановить аккаунт. Проверьте ссылку и попробуйте ещё раз.</p>}
        <Link to="/login">Перейти ко входу</Link>
      </section>
    </main>
  )
}
