import { localizeAuthError } from '../validation/auth'
import { useLanguage } from '../i18n/language'
import { LanguageSwitcher } from '../i18n/LanguageSwitcher'
import { useState } from 'react'
import type { FormEvent } from 'react'
import { Link, Navigate, useNavigate } from 'react-router-dom'
import { ApiError } from '../api/client'
import { useAuth } from '../auth/useAuth'
import { AlertIcon, EyeIcon, EyeOffIcon, PawIcon, SpinnerIcon } from '../components/icons'
import {
  apiErrorMessageForStatus,
  normalizeFieldName,
  translateApiFieldMessage,
  translateApiMessage,
  validateConfirmPassword,
  validateEmail,
  validateFirstName,
  validateLoginForm,
  validatePassword,
  validatePhone,
  validateRegisterForm,
} from '../validation/auth'
import type { AuthFieldErrors, AuthFieldName } from '../validation/auth'
import '../styles/auth.css'

interface Props {
  mode: 'login' | 'register'
}


export default function AuthPage({ mode }: Props) {
  const { language } = useLanguage()
  const isLogin = mode === 'login'
  const { user, loading, login, register } = useAuth()
  const navigate = useNavigate()

  const [firstName, setFirstName] = useState('')
  const [email, setEmail] = useState('')
  const [phone, setPhone] = useState('')
  const [password, setPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')

  const [showPassword, setShowPassword] = useState(false)
  const [showConfirm, setShowConfirm] = useState(false)

  const [fieldErrors, setFieldErrors] = useState<AuthFieldErrors>({})
  const [formError, setFormError] = useState<string | null>(null)
  const [submitting, setSubmitting] = useState(false)

  if (!loading && user) return <Navigate to="/" replace />

  const setError = (field: AuthFieldName, message: string | null) =>
    setFieldErrors((prev) => {
      if (message === null) {
        if (!(field in prev)) return prev
        const next = { ...prev }
        delete next[field]
        return next
      }
      if (prev[field] === message) return prev
      return { ...prev, [field]: message }
    })

  const runFieldValidation = (field: AuthFieldName): string | null => {
    switch (field) {
      case 'email':
        return validateEmail(email)
      case 'password':
        return validatePassword(password, isLogin)
      case 'confirmPassword':
        return isLogin ? null : validateConfirmPassword(password, confirmPassword)
      case 'firstName':
        return isLogin ? null : validateFirstName(firstName)
      case 'phone':
        return isLogin ? null : validatePhone(phone)
    }
  }

  const handleBlur = (field: AuthFieldName) => setError(field, runFieldValidation(field))

  /** При вводе чистим ошибку только того поля, с которым работал пользователь. */
  const handleChange = (field: AuthFieldName, value: string, apply: (v: string) => void) => {
    apply(value)
    if (fieldErrors[field]) setError(field, null)
    if (formError) setFormError(null)
  }

  const handleSubmit = async (event: FormEvent) => {
    event.preventDefault()
    if (submitting) return

    const values = { firstName, email, phone, password, confirmPassword }
    const errors = isLogin ? validateLoginForm(values) : validateRegisterForm(values)
    setFieldErrors(errors)
    setFormError(null)
    if (Object.keys(errors).length > 0) return

    setSubmitting(true)
    try {
      if (isLogin) {
        await login(email.trim(), password)
      } else {
        await register(email.trim(), password, {
          firstName: firstName.trim(),
          phone: phone.trim() || undefined,
        })
      }
      navigate('/', { replace: true })
    } catch (err) {
      if (err instanceof ApiError) {
        // Полевые ошибки backend → конкретные поля (API-контракт не меняем, только отображение).
        const mapped: AuthFieldErrors = {}
        for (const d of err.details) {
          const field = normalizeFieldName(d.field)
          if (field) mapped[field] = translateApiFieldMessage(field, d.message)
        }
        setFieldErrors(mapped)

        // Сообщения уровня формы (401/409 и т.п.).
        let message: string | null = null
        if (err.status === 409 && !mapped.email) {
          message = 'Эта почта уже зарегистрирована. Попробуйте войти.'
        } else if (err.status === 401) {
          message = 'Неверная почта или пароль. Проверьте данные и попробуйте ещё раз.'
        } else if (Object.keys(mapped).length === 0) {
          message = apiErrorMessageForStatus(err.status) ?? translateApiMessage(err.message)
        }
        setFormError(message)
      } else {
        setFormError('Сервер недоступен. Проверьте подключение к сети и попробуйте ещё раз.')
      }
    } finally {
      setSubmitting(false)
    }
  }

  const hasFieldError = Object.keys(fieldErrors).length > 0
  const alertId = formError ? 'auth-form-alert' : undefined

  return (
    <main className="auth-page">
      <div className="auth-card">
        <LanguageSwitcher />
        <header className="auth-brand">
          <span className="auth-brand-logo" aria-hidden="true">
            <PawIcon size={26} />
          </span>
          <h1 className="auth-title">{isLogin ? (language === 'ru' ? 'Вход в PetCare' : 'Sign in to Pet Care') : (language === 'ru' ? 'Создание аккаунта' : 'Create an account')}</h1>
          <p className="auth-subtitle">
            {isLogin
              ? (language === 'ru' ? 'Здоровье и забота о вашем питомце — под контролем.' : 'Keep track of your pet’s health and care.')
              : (language === 'ru' ? 'Регистрируйтесь, чтобы вести историю здоровья и напоминания.' : 'Create an account to track health history and reminders.')}
          </p>
        </header>

        <form className="auth-form" onSubmit={handleSubmit} noValidate aria-describedby={alertId}>
          {formError && (
            <div className="auth-banner" role="alert" id="auth-form-alert">
              <AlertIcon size={18} />
              <span>{localizeAuthError(formError, language)}</span>
            </div>
          )}

          {!isLogin && (
            <div className="auth-field auth-field--full">
              <label className="auth-label" htmlFor="firstName">
                {language === 'ru' ? 'Имя' : 'First name'}
              </label>
              <input
                id="firstName"
                name="given-name"
                className="auth-input"
                type="text"
                value={firstName}
                onChange={(e) => handleChange('firstName', e.target.value, setFirstName)}
                onBlur={() => handleBlur('firstName')}
                autoComplete="given-name"
                maxLength={80}
                placeholder={language === 'ru' ? 'Например, Анна' : 'For example, Anna'}
                aria-invalid={fieldErrors.firstName ? 'true' : undefined}
                aria-describedby={fieldErrors.firstName ? 'firstName-error' : undefined}
                disabled={submitting}
              />
              {fieldErrors.firstName && (
                <p className="auth-error" id="firstName-error">
                  {localizeAuthError(fieldErrors.firstName, language)}
                </p>
              )}
            </div>
          )}

          <div className="auth-field auth-field--full">
            <label className="auth-label" htmlFor="email">
              {language === 'ru' ? 'Электронная почта' : 'Email'}
            </label>
            <input
              id="email"
              name="email"
              className="auth-input"
              type="email"
              inputMode="email"
              value={email}
              onChange={(e) => handleChange('email', e.target.value, setEmail)}
              onBlur={() => handleBlur('email')}
              autoComplete="email"
              placeholder="name@example.com"
              aria-invalid={fieldErrors.email ? 'true' : undefined}
              aria-describedby={fieldErrors.email ? 'email-error' : undefined}
              disabled={submitting}
            />
            {fieldErrors.email && (
              <p className="auth-error" id="email-error">
                {localizeAuthError(fieldErrors.email, language)}
              </p>
            )}
          </div>

          {!isLogin && (
            <div className="auth-field auth-field--full">
              <label className="auth-label" htmlFor="phone">
                {language === 'ru' ? 'Телефон' : 'Phone'} <span className="auth-optional">{language === 'ru' ? '(необязательно)' : '(optional)'}</span>
              </label>
              <input
                id="phone"
                name="tel"
                className="auth-input"
                type="tel"
                inputMode="tel"
                value={phone}
                onChange={(e) => handleChange('phone', e.target.value, setPhone)}
                onBlur={() => handleBlur('phone')}
                autoComplete="tel"
                maxLength={20}
                placeholder="+7 900 123-45-67"
                aria-invalid={fieldErrors.phone ? 'true' : undefined}
                aria-describedby={fieldErrors.phone ? 'phone-error' : 'phone-hint'}
                disabled={submitting}
              />
              {fieldErrors.phone ? (
                <p className="auth-error" id="phone-error">
                  {localizeAuthError(fieldErrors.phone, language)}
                </p>
              ) : (
                <p className="auth-hint" id="phone-hint">
                  {language === 'ru' ? 'Нужен для SMS-напоминаний, можно указать позже.' : 'Used for SMS reminders. You can add it later.'}
                </p>
              )}
            </div>
          )}

          <div className="auth-field auth-field--full">
            <label className="auth-label" htmlFor="password">
              {language === 'ru' ? 'Пароль' : 'Password'}
            </label>
            <div className="auth-input-wrap">
              <input
                id="password"
                name={isLogin ? 'current-password' : 'new-password'}
                className="auth-input auth-input--password"
                type={showPassword ? 'text' : 'password'}
                value={password}
                onChange={(e) => handleChange('password', e.target.value, setPassword)}
                onBlur={() => handleBlur('password')}
                autoComplete={isLogin ? 'current-password' : 'new-password'}
                maxLength={72}
                placeholder={isLogin ? (language === 'ru' ? 'Введите пароль' : 'Enter your password') : (language === 'ru' ? 'Минимум 8 символов' : 'At least 8 characters')}
                aria-invalid={fieldErrors.password ? 'true' : undefined}
                aria-describedby={fieldErrors.password ? 'password-error' : undefined}
                disabled={submitting}
              />
              <button
                type="button"
                className="auth-reveal"
                onClick={() => setShowPassword((v) => !v)}
                aria-label={showPassword ? (language === 'ru' ? 'Скрыть пароль' : 'Hide password') : (language === 'ru' ? 'Показать пароль' : 'Show password')}
                aria-pressed={showPassword}
              >
                {showPassword ? <EyeOffIcon size={20} /> : <EyeIcon size={20} />}
              </button>
            </div>
            {fieldErrors.password && (
              <p className="auth-error" id="password-error">
                {localizeAuthError(fieldErrors.password, language)}
              </p>
            )}
          </div>

          {!isLogin && (
            <div className="auth-field auth-field--full">
              <label className="auth-label" htmlFor="confirmPassword">
                {language === 'ru' ? 'Повторите пароль' : 'Repeat password'}
              </label>
              <div className="auth-input-wrap">
                <input
                  id="confirmPassword"
                  name="confirm-password"
                  className="auth-input auth-input--password"
                  type={showConfirm ? 'text' : 'password'}
                  value={confirmPassword}
                  onChange={(e) => handleChange('confirmPassword', e.target.value, setConfirmPassword)}
                  onBlur={() => handleBlur('confirmPassword')}
                  autoComplete="new-password"
                  maxLength={72}
                  placeholder={language === 'ru' ? 'Ещё раз — тот же пароль' : 'Enter the same password again'}
                  aria-invalid={fieldErrors.confirmPassword ? 'true' : undefined}
                  aria-describedby={fieldErrors.confirmPassword ? 'confirmPassword-error' : undefined}
                  disabled={submitting}
                />
                <button
                  type="button"
                  className="auth-reveal"
                  onClick={() => setShowConfirm((v) => !v)}
                  aria-label={showConfirm ? (language === 'ru' ? 'Скрыть пароль' : 'Hide password') : (language === 'ru' ? 'Показать пароль' : 'Show password')}
                  aria-pressed={showConfirm}
                >
                  {showConfirm ? <EyeOffIcon size={20} /> : <EyeIcon size={20} />}
                </button>
              </div>
              {fieldErrors.confirmPassword && (
                <p className="auth-error" id="confirmPassword-error">
                  {localizeAuthError(fieldErrors.confirmPassword, language)}
                </p>
              )}
            </div>
          )}

          <button type="submit" className="auth-submit" disabled={submitting} aria-busy={submitting}>
            {submitting && <SpinnerIcon size={18} />}
            {submitting
              ? isLogin
                ? (language === 'ru' ? 'Входим…' : 'Signing in…')
                : (language === 'ru' ? 'Создаём аккаунт…' : 'Creating account…')
              : isLogin
                ? (language === 'ru' ? 'Войти' : 'Sign in')
                : (language === 'ru' ? 'Зарегистрироваться' : 'Sign up')}
          </button>
        </form>

        <p className="auth-switch">
          {isLogin ? (
            <>
              {language === 'ru' ? 'Нет аккаунта?' : 'New to Pet Care?'} <Link to="/register">{language === 'ru' ? 'Зарегистрироваться' : 'Sign up'}</Link>
            </>
          ) : (
            <>
              {language === 'ru' ? 'Уже есть аккаунт?' : 'Already have an account?'} <Link to="/login">{language === 'ru' ? 'Войти' : 'Sign in'}</Link>
            </>
          )}
        </p>

        {/* Доступность: объявляем ошибки после ответа сервера. */}
        <div aria-live="assertive" style={{ position: 'absolute', width: 1, height: 1, overflow: 'hidden', clip: 'rect(0 0 0 0)' }}>
          {hasFieldError || formError ? (language === 'ru' ? 'В форме есть ошибки. Исправьте отмеченные поля.' : 'Correct the highlighted fields.') : ''}
        </div>
      </div>
    </main>
  )
}
