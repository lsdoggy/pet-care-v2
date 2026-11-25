import { useLanguage } from '../i18n/language'
import { LanguageSwitcher } from '../i18n/LanguageSwitcher'
import { useEffect, useState } from 'react'
import { Link, useLocation } from 'react-router-dom'
import { api } from '../api/client'
import '../styles/settings.css'

export default function RestoreAccountPage() {
  const { pathname, hash } = useLocation()
  return <RestoreAccountForm key={hash} pathname={pathname} hash={hash} />
}

function RestoreAccountForm({ pathname, hash }: { pathname: string; hash: string }) {
  const { language } = useLanguage()
  const token = hash.slice(1)
  const [status, setStatus] = useState<'idle' | 'pending' | 'restored' | 'failed'>('idle')

  useEffect(() => {
    if (status === 'restored' && window.location.pathname === pathname && window.location.hash === hash) {
      window.history.replaceState(window.history.state, '', pathname)
    }
  }, [status, pathname, hash])

  async function restore() {
    setStatus('pending')
    try {
      await api.restoreAccount(token)
      setStatus('restored')
    } catch {
      setStatus('failed')
    }
  }

  const validLink = /^[0-9a-f]{64}$/.test(token)

  return (
    <main className="pc-settings">
      <LanguageSwitcher />
      <section className="pc-settings__card">
        <h1>{language === 'ru' ? 'Восстановление аккаунта' : 'Restore account'}</h1>
        {status === 'restored' ? (
          <p role="status">{language === 'ru' ? 'Аккаунт восстановлен. Теперь можно войти.' : 'Your account has been restored. You can now sign in.'}</p>
        ) : validLink ? (
          <button className="pc-btn pc-btn--primary" disabled={status === 'pending'} onClick={() => void restore()}>
            {status === 'pending' ? (language === 'ru' ? 'Восстановление…' : 'Restoring…') : (language === 'ru' ? 'Восстановить аккаунт' : 'Restore account')}
          </button>
        ) : <p role="alert">{language === 'ru' ? 'Ссылка для восстановления недействительна.' : 'The recovery link is invalid.'}</p>}
        {status === 'failed' && <p role="alert">{language === 'ru' ? 'Не удалось восстановить аккаунт. Проверьте ссылку и попробуйте ещё раз.' : 'Could not restore the account. Check the link and try again.'}</p>}
        {status !== 'restored' && (
          <p><Link to="/account-access">{language === 'ru' ? 'Запросить новую ссылку' : 'Request a new link'}</Link></p>
        )}
        <Link to="/login">{language === 'ru' ? 'Перейти ко входу' : 'Go to sign in'}</Link>
      </section>
    </main>
  )
}
