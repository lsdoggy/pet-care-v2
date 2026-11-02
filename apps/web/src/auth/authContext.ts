import { createContext } from 'react'
import type { UserDto } from '../api/types'

export interface AuthContextValue {
  user: UserDto | null
  loading: boolean
  login: (email: string, password: string) => Promise<void>
  register: (email: string, password: string) => Promise<void>
  logout: () => void
  /** Sprint 6: replace the cached user after PATCH /users/notification-settings. */
  setUser: (user: UserDto) => void
}

export const AuthContext = createContext<AuthContextValue | null>(null)
