import { useCallback, useMemo, useSyncExternalStore } from 'react'
import type { ReactNode } from 'react'
import { api } from '../api/client'
import type { UserDto } from '../api/types'
import { AuthContext } from './authContext'
import { tokenStore } from './tokenStore'

type Session = { status: 'loading' } | { status: 'anon' } | { status: 'authed'; user: UserDto }

let session: Session = { status: 'loading' }
const listeners = new Set<() => void>()

function emit() {
  for (const l of listeners) l()
}

function subscribe(listener: () => void) {
  listeners.add(listener)
  return () => listeners.delete(listener)
}

function bootstrap() {
  const token = tokenStore.get()
  if (!token) {
    session = { status: 'anon' }
    emit()
    return
  }
  api
    .me(token)
    .then((user) => {
      session = { status: 'authed', user }
    })
    .catch(() => tokenStore.clear())
    .finally(() => {
      if (session.status === 'loading') session = { status: 'anon' }
      emit()
    })
}

bootstrap()

export function AuthProvider({ children }: { children: ReactNode }) {
  const current = useSyncExternalStore(subscribe, () => session)

  const login = useCallback(async (email: string, password: string) => {
    const res = await api.login(email, password)
    tokenStore.set(res.accessToken)
    session = { status: 'authed', user: res.user }
    emit()
  }, [])

  const register = useCallback(async (email: string, password: string) => {
    const res = await api.register(email, password)
    tokenStore.set(res.accessToken)
    session = { status: 'authed', user: res.user }
    emit()
  }, [])

  const logout = useCallback(() => {
    tokenStore.clear()
    session = { status: 'anon' }
    emit()
  }, [])

  const value = useMemo(
    () => ({
      user: current.status === 'authed' ? current.user : null,
      loading: current.status === 'loading',
      login,
      register,
      logout,
    }),
    [current, login, register, logout],
  )

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>
}
