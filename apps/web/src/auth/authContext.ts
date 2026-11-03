import { createContext } from 'react'
import type { UserDto } from '../api/types'
import type { RegisterProfile } from '../api/client'

export interface AuthContextValue {
  user: UserDto | null
  loading: boolean
  login: (email: string, password: string) => Promise<void>
  /** Design Sprint 1: optional profile fields (firstName/phone) — backend accepts them since V9. */
  register: (email: string, password: string, profile?: RegisterProfile) => Promise<void>
  logout: () => void
  /** Sprint 6: replace the cached user after PATCH /users/notification-settings. */
  setUser: (user: UserDto) => void
}

export const AuthContext = createContext<AuthContextValue | null>(null)
