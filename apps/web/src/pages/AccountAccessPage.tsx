import { useEffect, useState } from 'react'
import type { FormEvent } from 'react'
import { Link, useLocation } from 'react-router-dom'
import { api } from '../api/client'
import { LanguageSwitcher } from '../i18n/LanguageSwitcher'
import { useLanguage } from '../i18n/language'
import '../styles/auth.css'

export default function AccountAccessPage({ reset = false }: { reset?: boolean }) {
  const { pathname, hash } = useLocation()
  return <AccountAccessForm key={reset ? hash : 'request'} reset={reset} pathname={pathname} hash={hash} />
}

function AccountAccessForm({ reset, pathname, hash }: { reset: boolean; pathname: string; hash: string }) {
  const { language } = useLanguage()
  const ru = language === 'ru'
  const token = hash.slice(1)
  const validLink = /^[0-9a-f]{64}$/.test(token)
  const [value, setValue] = useState('')
  const [status, setStatus] = useState<'idle' | 'pending' | 'done' | 'failed'>('idle')

  useEffect(() => {
    if (reset && status === 'done' && window.location.pathname === pathname && window.location.hash === hash) {
      window.history.replaceState(window.history.state, '', pathname)
    }
  }, [reset, status, pathname, hash])

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    setStatus('pending')
    try {
      if (reset) {
        await api.resetPassword(token, value)
      } else {
        await api.requestAccessLink(value.trim())
      }
      setValue('')
      setStatus('done')
    } catch {
      setStatus('failed')
    }
  }

  return (
    <main className="auth-page">
      <section className="auth-card">
        <LanguageSwitcher />
        <h1 className="auth-title">{reset ? (ru ? 'Сброс пароля' : 'Reset password') : (ru ? 'Восстановление доступа' : 'Recover access')}</h1>
        {status === 'done' ? (
          <p role="status">
            {reset
              ? (ru ? 'Пароль обновлён. Войдите с новым паролем.' : 'Password updated. Sign in with your new password.')
              : (ru ? 'Если аккаунт существует, проверьте почту.' : 'If the account exists, check your email.')}
          </p>
        ) : reset && !validLink ? (
          <p className="auth-error" role="alert">{ru ? 'Ссылка недействительна.' : 'The link is invalid.'}</p>
        ) : (
          <form className="auth-form" onSubmit={submit}>
            <label className="auth-label" htmlFor="account-access-value">
              {reset ? (ru ? 'Новый пароль' : 'New password') : 'Email'}
            </label>
            <input
              id="account-access-value"
              className="auth-input"
              required
              type={reset ? 'password' : 'email'}
              autoComplete={reset ? 'new-password' : 'email'}
              minLength={reset ? 8 : undefined}
              maxLength={reset ? 72 : 255}
              value={value}
              disabled={status === 'pending'}
              onChange={(event) => setValue(event.target.value)}
            />
            {status === 'failed' && (
              <p className="auth-error" role="alert">
                {reset
                  ? (ru ? 'Не удалось обновить пароль. Проверьте ссылку и пароль или запросите новую ссылку.' : 'Could not update the password. Check the link and password or request a new link.')
                  : (ru ? 'Попробуйте запросить ссылку позже.' : 'Try requesting the link again later.')}
              </p>
            )}
            <button className="auth-submit" disabled={status === 'pending'} aria-busy={status === 'pending'}>
              {reset ? (ru ? 'Сохранить пароль' : 'Save password') : (ru ? 'Отправить ссылку' : 'Send link')}
            </button>
          </form>
        )}
        {reset && status !== 'done' && (
          <p><Link to="/account-access">{ru ? 'Запросить новую ссылку' : 'Request a new link'}</Link></p>
        )}
        <p><Link to="/login">{ru ? 'Перейти ко входу' : 'Go to sign in'}</Link></p>
      </section>
    </main>
  )
}
