import { useState } from 'react'
import type { FormEvent } from 'react'
import { Link, Navigate, useNavigate } from 'react-router-dom'
import { ApiError } from '../api/client'
import type { FieldError } from '../api/types'
import { useAuth } from '../auth/useAuth'

const pageStyle: React.CSSProperties = {
  fontFamily: 'sans-serif',
  maxWidth: 360,
  margin: '10vh auto',
  padding: 24,
  border: '1px solid #ddd',
  borderRadius: 12,
}

const inputStyle: React.CSSProperties = {
  display: 'block',
  width: '100%',
  padding: 10,
  margin: '8px 0 4px',
  boxSizing: 'border-box',
  borderRadius: 6,
  border: '1px solid #ccc',
}

const buttonStyle: React.CSSProperties = {
  marginTop: 16,
  width: '100%',
  padding: 12,
  borderRadius: 6,
  border: 'none',
  backgroundColor: '#1a73e8',
  color: '#fff',
  fontSize: 16,
  cursor: 'pointer',
}

const errorStyle: React.CSSProperties = { color: '#c0392b', fontSize: 14, marginTop: 8 }

interface Props {
  mode: 'login' | 'register'
}

export default function AuthPage({ mode }: Props) {
  const { user, loading, login, register } = useAuth()
  const navigate = useNavigate()
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [errors, setErrors] = useState<FieldError[]>([])
  const [formError, setFormError] = useState<string | null>(null)
  const [submitting, setSubmitting] = useState(false)

  if (!loading && user) return <Navigate to="/" replace />

  const handleSubmit = async (event: FormEvent) => {
    event.preventDefault()
    setErrors([])
    setFormError(null)
    setSubmitting(true)
    try {
      if (mode === 'login') await login(email, password)
      else await register(email, password)
      navigate('/', { replace: true })
    } catch (err) {
      if (err instanceof ApiError) {
        setErrors(err.details)
        setFormError(err.message)
      } else {
        setFormError('Network error. Is the backend running?')
      }
    } finally {
      setSubmitting(false)
    }
  }

  const isLogin = mode === 'login'

  return (
    <main style={pageStyle}>
      <h2>{isLogin ? 'Sign in' : 'Create account'}</h2>
      <form onSubmit={handleSubmit}>
        <label htmlFor="email">Email</label>
        <input
          id="email"
          style={inputStyle}
          type="email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          autoComplete="email"
          required
        />
        <label htmlFor="password">Password</label>
        <input
          id="password"
          style={inputStyle}
          type="password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          autoComplete={isLogin ? 'current-password' : 'new-password'}
          minLength={isLogin ? undefined : 8}
          required
        />
        {errors.map((fieldError) => (
          <p key={fieldError.field} style={errorStyle}>
            {fieldError.field}: {fieldError.message}
          </p>
        ))}
        {formError && <p style={errorStyle}>{formError}</p>}
        <button style={buttonStyle} type="submit" disabled={submitting}>
          {submitting ? 'Please wait…' : isLogin ? 'Sign in' : 'Register'}
        </button>
      </form>
      <p style={{ marginTop: 16, textAlign: 'center' }}>
        {isLogin ? (
          <>
            No account? <Link to="/register">Register</Link>
          </>
        ) : (
          <>
            Already registered? <Link to="/login">Sign in</Link>
          </>
        )}
      </p>
    </main>
  )
}
