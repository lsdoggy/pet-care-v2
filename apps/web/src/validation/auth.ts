/**
 * Design Sprint 1 · Auth validation (shared logic, UI-agnostic).
 *
 * Клиентская валидация полей формы входа/регистрации.
 * Правила зеркалят backend-аннотации (RegisterRequest):
 *   email     — @NotBlank @Email, max 255
 *   password  — @NotBlank @Size(min=8, max=72)
 *   firstName — @Size(max=80)
 *   phone     — ^\+?[0-9 \-()]{6,20}$ (optional)
 *
 * Тексты ошибок — на русском (требование дизайн-спринта).
 */

export type AuthFieldName = 'email' | 'password' | 'confirmPassword' | 'firstName' | 'phone'

export type AuthFieldErrors = Partial<Record<AuthFieldName, string>>

export interface RegisterFormValues {
  firstName: string
  email: string
  phone: string
  password: string
  confirmPassword: string
}

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/
const PHONE_RE = /^\+?[0-9 \-()]{6,20}$/

export const PASSWORD_MIN_LENGTH = 8
export const PASSWORD_MAX_LENGTH = 72

export function validateEmail(value: string): string | null {
  const email = value.trim()
  if (!email) return 'Укажите электронную почту.'
  if (email.length > 255) return 'Адрес электронной почты слишком длинный.'
  if (!EMAIL_RE.test(email)) return 'Укажите корректный адрес, например name@example.com.'
  return null
}

export function validatePassword(value: string, isLogin: boolean): string | null {
  if (!value) return isLogin ? 'Введите пароль.' : 'Придумайте пароль.'
  if (value.length < PASSWORD_MIN_LENGTH) return `Пароль должен содержать не менее ${PASSWORD_MIN_LENGTH} символов.`
  if (value.length > PASSWORD_MAX_LENGTH) return `Пароль не должен превышать ${PASSWORD_MAX_LENGTH} символов.`
  return null
}

export function validateConfirmPassword(password: string, confirmPassword: string): string | null {
  if (!confirmPassword) return 'Повторите пароль.'
  if (password !== confirmPassword) return 'Пароли не совпадают.'
  return null
}

export function validateFirstName(value: string): string | null {
  const name = value.trim()
  if (!name) return 'Укажите имя.'
  if (name.length > 80) return 'Имя не должно превышать 80 символов.'
  return null
}

/** Телефон необязательный: пустое значение всегда валидно. */
export function validatePhone(value: string): string | null {
  const phone = value.trim()
  if (!phone) return null
  if (!PHONE_RE.test(phone)) return 'Укажите корректный номер, например +7 900 123-45-67.'
  return null
}

export function validateLoginForm(values: { email: string; password: string }): AuthFieldErrors {
  const errors: AuthFieldErrors = {}
  const email = validateEmail(values.email)
  const password = validatePassword(values.password, true)
  if (email) errors.email = email
  if (password) errors.password = password
  return errors
}

export function validateRegisterForm(values: RegisterFormValues): AuthFieldErrors {
  const errors: AuthFieldErrors = {}
  const firstName = validateFirstName(values.firstName)
  const email = validateEmail(values.email)
  const phone = validatePhone(values.phone)
  const password = validatePassword(values.password, false)
  const confirmPassword = validateConfirmPassword(values.password, values.confirmPassword)
  if (firstName) errors.firstName = firstName
  if (email) errors.email = email
  if (phone) errors.phone = phone
  if (password) errors.password = password
  if (confirmPassword) errors.confirmPassword = confirmPassword
  return errors
}

/** Русификация типовых backend-сообщений (API-контракт не меняем — только отображение). */
export function translateApiMessage(message: string): string {
  switch (message.trim()) {
    case 'Invalid email or password':
    case 'Invalid credentials':
      return 'Неверная почта или пароль. Проверьте данные и попробуйте ещё раз.'
    case 'Validation failed':
      return 'Проверьте правильность заполнения полей.'
    case 'Request failed':
      return 'Запрос не выполнен. Попробуйте ещё раз.'
    default:
      return message
  }
}

/** Перевод известных backend-сообщений валидации для конкретных полей. */
export function translateApiFieldMessage(field: string, message: string): string {
  const m = message.trim().toLowerCase()
  if (m.includes('must be between 8 and 72 characters') || m.includes('size must be between 8 and 72')) {
    return `Пароль должен содержать от ${PASSWORD_MIN_LENGTH} до ${PASSWORD_MAX_LENGTH} символов.`
  }
  if (m.includes('must be a well-formed email address')) return 'Укажите корректный адрес электронной почты.'
  if (m.includes('phone number format is invalid')) return 'Укажите корректный номер телефона.'
  if (m.startsWith('must not be blank')) {
    if (field === 'email') return 'Укажите электронную почту.'
    if (field === 'password') return 'Введите пароль.'
    if (field === 'firstName') return 'Укажите имя.'
  }
  return message
}

/** Сообщения об ошибках HTTP-статусов auth-эндпоинтов (на русском). */
export function apiErrorMessageForStatus(status: number): string | null {
  switch (status) {
    case 401:
      return 'Неверная почта или пароль. Проверьте данные и попробуйте ещё раз.'
    case 403:
      return 'Доступ запрещён. Проверьте учётные данные.'
    case 409:
      return 'Эта почта уже зарегистрирована. Попробуйте войти.'
    case 400:
      return 'Проверьте правильность заполнения полей.'
    default:
      return null
  }
}

/** Поле из имени ошибки Spring (может быть "registerRequest.email"). */
export function normalizeFieldName(raw: string): AuthFieldName | null {
  const last = raw.split('.').pop() ?? raw
  switch (last) {
    case 'email':
    case 'password':
    case 'firstName':
    case 'phone':
    case 'confirmPassword':
      return last
    default:
      return null
  }
}
